### 발견사항

---

**[CRITICAL]** `EmbeddingService.activeTasks` 카운터 경쟁 조건
- 위치: `embedding.service.ts` — `activeTasks` 필드 및 `processDocument` 메서드
- 상세: `activeTasks`는 단순 숫자 필드이고, Node.js는 단일 스레드 이벤트 루프이므로 기본적인 정수 증감은 원자적입니다. 그러나 **busy-wait 루프** (`while (this.activeTasks >= MAX_CONCURRENT) { await sleep(500); }`)가 진짜 문제입니다. 여러 요청이 동시에 루프에 진입할 경우, 루프를 탈출하는 순간과 `this.activeTasks++` 사이에 다른 코루틴이 스케줄될 수 있어 `MAX_CONCURRENT`를 초과할 수 있습니다 (TOCTOU 패턴).
  ```ts
  // 문제: 두 요청이 동시에 조건 통과 후 증가 가능
  while (this.activeTasks >= MAX_CONCURRENT) { await sleep(500); }
  // ← 여기서 context switch 가능
  this.activeTasks++;
  ```
- 제안: 세마포어(Semaphore) 패턴으로 교체하거나, 큐 기반 작업 처리기를 사용하세요. 간단하게는 카운터 증가를 조건 체크와 원자적으로 묶어야 합니다.
  ```ts
  // 개선: 진입 전 즉시 점유 선언 후 대기
  if (this.activeTasks >= MAX_CONCURRENT) {
    await this.waitForSlot();
  }
  this.activeTasks++;
  ```
  더 나은 방법은 `p-limit` 라이브러리나 세마포어 구현을 활용하는 것입니다.

---

**[WARNING]** `LlmService.embed` 이중 배치 처리 — `EmbeddingService`와의 중복 배치 로직
- 위치: `llm.service.ts:embed` + `embedding.service.ts:doProcess`
- 상세: `EmbeddingService.doProcess`가 20개씩 배치 처리한 후, 각 배치를 `LlmService.embed`에 전달합니다. `LlmService.embed` 내부에서도 동일한 크기(20)로 다시 배치 분리를 시도합니다. 결국 배치 크기가 20 이하이면 문제없지만, 두 레이어의 배치 로직이 중복되어 유지보수 혼란과 잠재적 비효율이 있습니다.
- 제안: 배치 처리 책임을 한 레이어에 통일하세요. `EmbeddingService`가 청크를 직접 넘기고, `LlmService.embed`는 배치 분리 없이 전달받은 텍스트를 그대로 처리하거나, 반대로 배치 책임을 `LlmService`에 완전히 위임하세요.

---

**[WARNING]** `LlmService.withRetry` — 지수 백오프 중 이벤트 루프 블로킹
- 위치: `llm.service.ts:withRetry`
- 상세: Rate limit 재시도 시 최대 `2^2 * 1000 = 4000ms`를 `setTimeout`으로 대기합니다. 이 자체는 이벤트 루프를 블로킹하지 않으나, `maxRetries = 3` 기본값에서 총 대기 시간이 최대 7초(1+2+4초)에 달합니다. HTTP 요청 컨텍스트에서 클라이언트가 타임아웃을 먼저 겪을 수 있으며, 다수의 동시 요청이 모두 재시도 대기에 들어가면 연결 풀이 고갈됩니다.
- 제안: 재시도는 백그라운드 큐에서만 허용하거나, HTTP 응답은 즉시 `202 Accepted`로 반환 후 비동기 처리하는 구조로 개선하세요. 또는 최대 재시도 횟수를 외부 호출(AI Agent 핸들러)에서는 낮게(1회) 설정하세요.

---

**[WARNING]** `KnowledgeBaseController.uploadDocument` — 비동기 fire-and-forget 오류 처리 불완전
- 위치: `knowledge-base.controller.ts:107-111`
- 상세:
  ```ts
  this.embeddingService.processDocument(doc.id).catch((err) => {
    void err; // 오류 완전히 무시
  });
  ```
  `processDocument` 내부에서 DB 상태 업데이트가 실패하면 에러가 조용히 삼켜집니다. 더불어, 동일 문서에 대해 빠르게 두 번 업로드 요청이 오면 두 번의 `processDocument`가 동시에 실행될 수 있습니다.
- 제안: catch 블록에서 최소한 로깅은 해야 합니다. 또한 문서 업로드 시 `embeddingStatus = 'pending'`인 상태를 확인해 중복 처리 방지 로직을 추가하세요.

---

**[WARNING]** `RagSearchService.search` — `workspaceId` 검증 없는 Cross-workspace 벡터 검색
- 위치: `rag-search.service.ts:40-52` SQL 쿼리
- 상세: SQL 쿼리에서 `knowledge_base_id = ANY($2)` 조건만 있고, `knowledge_base`와 `workspace_id`를 JOIN하여 소유권을 검증하지 않습니다. `knowledgeBaseIds` 목록이 다른 워크스페이스의 KB ID를 포함해도 데이터가 노출됩니다.
- 제안:
  ```sql
  JOIN knowledge_base kb ON kb.id = dc.knowledge_base_id
  WHERE kb.workspace_id = $5
    AND dc.knowledge_base_id = ANY($2::uuid[])
  ```

---

**[INFO]** `EmbeddingService.doProcess` — QueryRunner 트랜잭션 내 대용량 순차 INSERT
- 위치: `embedding.service.ts:127-147`
- 상세: 청크 수백 개를 단일 트랜잭션 내에서 개별 INSERT로 처리합니다. 트랜잭션 유지 시간이 길어지면 DB 잠금 경쟁이 발생할 수 있습니다. 동시에 여러 문서가 처리되면 `document_chunk` 테이블에 대한 잠금이 겹칩니다.
- 제안: `INSERT ... VALUES ($1,$2), ($3,$4), ...` 형태의 bulk INSERT를 사용하거나, `pgvector`를 지원하는 ORM 확장을 활용하여 트랜잭션 유지 시간을 최소화하세요.

---

**[INFO]** `GoogleClient.embed` — 순차 임베딩 (병렬화 없음)
- 위치: `google.client.ts:embed`
- 상세:
  ```ts
  for (const text of texts) {
    const result = await embeddingModel.embedContent(text);
  }
  ```
  텍스트를 하나씩 순차 처리합니다. OpenAI 클라이언트는 배치 API를 사용하는 반면 Google 클라이언트는 N개의 텍스트를 N번 직렬 호출합니다.
- 제안: `Promise.all`로 병렬화하되, 동시성 제한(`p-limit`)을 함께 적용하세요.

---

**[INFO]** `setDefault` 비원자성 — TOCTOU
- 위치: `llm-config.service.ts:setDefault`
- 상세:
  ```ts
  await this.clearDefault(workspaceId);   // 기존 default 해제
  await this.llmConfigRepository.update(..., { isDefault: true }); // 새 default 설정
  ```
  두 UPDATE 사이에 다른 요청이 진입하면 잠시 default가 없는 상태가 됩니다. 단일 프로세스에서는 낮은 빈도지만, 동시 요청 시 `resolveConfig`가 default를 찾지 못해 예외를 던질 수 있습니다.
- 제안: 두 UPDATE를 단일 DB 트랜잭션으로 묶으세요.

---

### 요약

전체적으로 Node.js 단일 스레드 특성 덕분에 전통적인 멀티스레드 경쟁 조건은 제한적이나, **async/await 컨텍스트 스위치 지점**에서의 TOCTOU 패턴이 실제 위험 요소입니다. 가장 심각한 문제는 `EmbeddingService`의 busy-wait 동시성 제한 방식으로, `await` 직후 컨텍스트 전환으로 `MAX_CONCURRENT`를 초과할 수 있습니다. 부차적으로 `RagSearchService`의 cross-workspace 데이터 노출, `LlmService`의 장시간 재시도 블로킹, `setDefault`의 비원자 2단계 업데이트가 운영 환경에서 간헐적 버그를 유발할 수 있습니다. `GoogleClient.embed`의 순차 처리는 성능 저하 요인입니다.

### 위험도

**HIGH**