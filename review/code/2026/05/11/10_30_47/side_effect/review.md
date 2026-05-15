## 발견사항

---

### [CRITICAL] 롤링 배포 시 `error → failed` 데이터 마이그레이션 충돌

- **위치**: `V037__kb_retry_failed_status.sql` 36~39행
- **상세**: 마이그레이션이 `embedding_status = 'error'` 행을 일괄 `'failed'`로 전환한다. 롤링 배포 중 구버전 워커가 `'error'` 상태를 기록하거나 `'error'` 조건으로 문서를 조회하는 동안 마이그레이션이 실행되면 해당 레코드가 사라져 구버전 코드가 문서를 찾지 못한다. `executeInTransaction=true`가 설정되어 있어 마이그레이션 자체는 원자적이지만, 배포 전략상 **구버전 프로세스 종료 후 마이그레이션 실행 순서를 강제**해야 한다.
- **제안**: 배포 순서를 (1) 구버전 워커 전부 종료 → (2) 마이그레이션 → (3) 신버전 배포로 문서화하거나, 마이그레이션을 두 단계(컬럼 추가 + CHECK 추가 → 별도 배포 후 UPDATE)로 분리한다.

---

### [WARNING] `withTimeout` race 후 백그라운드 HTTP 소켓 누적

- **위치**: `llm.service.ts` — `chat()` +8~14행, `embed()` +167~174행
- **상세**: `withTimeout`은 Promise race로만 구현되며 `AbortSignal`을 LLM 클라이언트에 전달하지 않는다. timeout이 발화하면 경주에서 진 LLM 호출 Promise는 Node.js 이벤트 루프에 떠다니고, 내부 HTTP 소켓/keep-alive 연결은 LLM 응답이 도착할 때까지 유지된다. timeout이 연속으로 발생(재시도 3회 × 동시 문서 처리)할 경우 연결 풀 소진 또는 메모리 누수로 이어질 수 있다.
- **제안**: 단기: `http.globalAgent.maxSockets` 하한을 설정하거나 `axios-timeout` 등 HTTP 레이어 timeout을 병행 적용. 중기: 후속 PR에서 LLMClient 인터페이스에 `AbortSignal`을 추가(plan 문서에 이미 예정됨).

---

### [WARNING] `document:embedding_error` / `document:graph_error` 이벤트가 더 이상 emit 되지 않음

- **위치**: `embedding.service.ts` `onAttempt` 콜백, `graph-extraction.service.ts` `onAttempt` 콜백
- **상세**: 구버전에서는 최종 실패 시 `document:embedding_error` / `document:graph_error`를 emit했으나, 신버전 `onAttempt`는 재시도 가능 케이스만 `document:embedding_retry`를 emit하고, 비재시도성 단 1회 실패의 경우 아무 retry/failed 이벤트도 즉시 emit하지 않은 채 outer catch로 넘어간다. `use-kb-events.ts`가 `document:embedding_error` / `document:graph_error`를 구독하고 있으나 이 이벤트는 이제 발화되지 않아 dead subscription이 된다. spec(`8-embedding-pipeline.md`)은 `embedding_error` 이벤트가 "일시 오류 발생 시" 발화된다고 명시하지만 구현에 없다.
- **제안**: `onAttempt` 내부에서 항상 `document:embedding_error` / `document:graph_error`를 emit해 spec과 일치시키거나, spec에서 해당 이벤트를 제거하고 `use-kb-events.ts`의 dead subscription을 정리한다.

---

### [WARNING] `doExtract`에서 KB를 매 retry마다 재조회

- **위치**: `graph-extraction.service.ts` `doExtract()` +166~170행 (private method 내부)
- **상세**: 부모 `extractForDocument`에서 이미 KB를 조회해 `knowledgeBaseId`를 넘기지만, `doExtract` 내부에서 `this.kbRepository.findOne`을 다시 호출한다. 재시도 3회 시 DB 조회가 추가로 3번 발생하며, 재시도 사이에 `extractionLlmConfigId`가 변경될 경우 첫 시도와 다른 LLM 설정이 사용되는 비결정적 동작이 발생할 수 있다.
- **제안**: `doExtract(documentId, kb: KnowledgeBase)` 형태로 시그니처를 바꿔 이미 조회된 객체를 전달하거나, `knowledgeBaseId` 대신 `kb` 객체를 통째로 받는다.

---

### [WARNING] 최종 실패 시 DB `UPDATE` 이중 실행 (embedding)

- **위치**: `embedding.service.ts` `processDocument()` — `onAttempt` 콜백 및 outer `catch` 블록
- **상세**: 재시도 소진 또는 비재시도성 오류 발생 시 `onAttempt`에서 `embeddingStatus: 'error'`로 1차 UPDATE, 이후 outer catch에서 `embeddingStatus: 'failed'`로 2차 UPDATE가 순차 실행된다. 트랜잭션 밖에서 두 번 쓰기 때문에 두 UPDATE 사이 다른 프로세스가 상태를 읽으면 순간적으로 `'error'`를 관찰할 수 있다. Graph extraction도 동일한 패턴.
- **제안**: `onAttempt` 내에서 `willRetry` 여부를 판단해 `false`이면 상태를 `'error'`가 아닌 `'failed'`로 직접 기록하거나, outer catch의 `failed` 전환만 단독으로 유지하고 `onAttempt`에서는 상태를 `'error'`로 기록하지 않는다.

---

### [INFO] `StuckDocumentRecoveryService` 다중 인스턴스 중복 큐잉

- **위치**: `stuck-document-recovery.service.ts` `recoverStuckEmbedding()`, `recoverStuckGraphExtraction()`
- **상세**: 동시 부팅된 인스턴스들이 SELECT → UPDATE → queue.add를 `FOR UPDATE` 없이 수행하므로 같은 문서가 여러 번 큐에 추가될 수 있다. `reEmbed=true`로 idempotent하지만 불필요한 LLM 비용이 발생한다.
- **제안**: UPDATE에 `RETURNING` 사용 후 실제로 업데이트된 행만 큐잉하는 방식(`UPDATE ... WHERE ... AND embedding_status = 'processing' RETURNING id`)으로 경쟁 조건을 원천 차단한다(현재 `retryFailedDocuments`에서는 이 패턴을 올바르게 사용하고 있어 일관성 확보도 겸함).

---

### [INFO] `use-kb-events.ts` 1초 throttle로 인한 중간 이벤트 누락

- **위치**: `use-kb-events.ts` `scheduleInvalidate()` 함수
- **상세**: 1초 내 연속 이벤트(예: `embedding_completed` 직후 `graph_started`)는 후자가 드롭된다. `useQuery`의 5초 polling이 fallback으로 있어 데이터 정합성은 유지되지만 UI 반응이 최대 5초 지연될 수 있다.
- **제안**: throttle 대신 debounce(trailing, 200ms)로 변경하면 폭발적 이벤트를 억제하면서도 마지막 이벤트는 반드시 처리된다.

---

### [INFO] plan 문서 체크박스 미체크 — 상태 불일치

- **위치**: `plan/in-progress/rag-kb-retry-failure-recovery.md` 24~28행
- **상세**: PR1~PR5 모두 `[ ]`로 표시되어 있어 plan만 보면 아무것도 구현되지 않은 것처럼 보이지만, 실제로는 해당 코드가 모두 커밋된 상태다. CLAUDE.md 규약("작업이 끝나면 결과에 맞춰 갱신")에 따라 완료된 항목을 `[x]`로 갱신하고 all-done 시 `plan/complete/`로 이동해야 한다.

---

## 요약

전체 변경사항은 KB 재시도/실패 회복 시스템을 일관되게 구현하고 있으며 대부분의 설계 결정(idempotency, backward-compatible 시그니처 추가, WS fallback)은 적절하다. 그러나 **롤링 배포 중 `error→failed` 일괄 UPDATE**와 **`withTimeout` 사용 시 미해제 HTTP 소켓 누적** 두 가지가 운영 환경에서 실질적 위험이 되며, **`embedding_error`/`graph_error` 이벤트 미발화**는 spec과 구현 사이의 계약 불일치를 남긴다. `doExtract`의 중복 KB 조회와 최종 실패 시 이중 UPDATE는 기능 정확성에는 문제없으나 운영 비용과 순간적 상태 불일치를 유발한다.

## 위험도

**MEDIUM** (운영 배포 전 롤링 배포 순서 문서화 및 `withTimeout` 소켓 누수 완화 조치 필요)