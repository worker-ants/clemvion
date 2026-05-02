## 성능 코드 리뷰

### 발견사항

---

**[CRITICAL]** `reEmbedAll`이 백프레셔 없이 문서 전체를 동시 발사
- **위치**: `knowledge-base.service.ts` — `reEmbedAll()` 내 for 루프
- **상세**: `for (const doc of docs)` 반복에서 `processDocument`를 `.catch()`만 붙인 채 fire-and-forget으로 일제히 실행. KB에 문서가 100개면 100개의 Promise가 동시에 생성되며, 각각 `processDocument` 안의 폴링 대기(`while (activeTasks >= 3) { await sleep(500) }`)에 진입. 결과적으로 100개의 500ms 타이머 루프가 동시에 스핀하면서 클로저와 힙을 점유. CPU/메모리 모두 압박.
- **제안**: 외부에서 직접 배치 순회하거나, `p-limit`/채널 방식으로 동시 실행 상한을 강제. 예: `const limit = pLimit(MAX_CONCURRENT); await Promise.all(docs.map(d => limit(() => embeddingService.processDocument(d.id, true))))`. 내부 폴링 대기는 제거 가능.

---

**[CRITICAL]** 폴링 방식 동시성 제한자 (busy-wait)
- **위치**: `embedding.service.ts:37-40`
- **상세**: `while (this.activeTasks >= MAX_CONCURRENT) { await new Promise(r => setTimeout(r, 500)); }`. 대기 중인 호출이 많을수록 타이머 수가 선형으로 증가. 100개 대기 = 200ms마다 100번의 콜백 실행.
- **제안**: 세마포어 패턴으로 교체. 완료 시 `resolve()` 호출로 대기자를 직접 깨우면 폴링 불필요.

---

**[HIGH]** SQL 마이그레이션 — 블로킹 HNSW 인덱스 3개 직렬 생성
- **위치**: `V021__variable_embedding_dimension.sql:18-28`
- **상세**: `CREATE INDEX ... USING hnsw` 3개를 논블로킹 옵션 없이 순차 실행. HNSW 빌드는 데이터 크기에 따라 수십 분~수 시간 소요 가능. Flyway 트랜잭션 안에서 실행되면 테이블 락이 그 시간 동안 유지됨. `ALTER TABLE ... TYPE vector`(전체 테이블 재작성) 직후라 더 위험.
- **제안**: 인덱스 생성을 별도 마이그레이션으로 분리하고 `CREATE INDEX CONCURRENTLY`(트랜잭션 밖에서만 사용 가능 — Flyway `outOfOrder` 또는 `mixed: true` 설정 필요) 사용. 주석에 이미 언급되어 있으나 현재 마이그레이션 자체가 문제.

---

**[HIGH]** 모든 임베딩 벡터를 메모리에 누적 후 INSERT
- **위치**: `embedding.service.ts:129` — `allEmbeddings: number[][]`
- **상세**: 전체 청크의 임베딩을 `allEmbeddings`에 모두 쌓은 뒤 트랜잭션에서 INSERT. 1000청크 × 3072차원 × 8바이트 ≈ 24MB가 단일 객체로 힙에 상주. 대용량 문서에서 GC 압박 및 OOM 위험.
- **제안**: 배치 임베딩 직후 즉시 INSERT 트랜잭션에 반영하는 스트리밍 방식으로 변경. 트랜잭션 분리가 어려우면 임베딩 배치 크기와 INSERT 배치 크기를 맞춰 파이프라인 처리.

---

**[MEDIUM]** RAG 검색 — (model, dim) 그룹을 직렬로 처리
- **위치**: `rag-search.service.ts:101-135` — `for (const { model, dim, kbIds } of groups.values())`
- **상세**: 그룹마다 `embed()` + SQL 검색을 순차 await. 그룹이 2개면 레이턴시가 두 배. 각 그룹의 임베딩·검색은 서로 독립적.
- **제안**: `await Promise.all([...groups.values()].map(g => searchGroup(g)))` 패턴으로 병렬화. LLM API rate limit이 문제라면 `p-limit`으로 상한 설정.

---

**[MEDIUM]** SQL 쿼리 플랜 캐시 미활용 — `dim` 인라인
- **위치**: `rag-search.service.ts:112-125`
- **상세**: `\`...::vector(${dim})...\`` 방식으로 쿼리 문자열에 차원값을 직접 삽입. PostgreSQL이 쿼리 텍스트 기준으로 플랜을 캐시하므로, 차원마다 새 플랜을 컴파일. `SUPPORTED_DIMS`가 3개이면 3가지 플랜이 각각 반복 컴파일됨(pgvector 특성상 불가피한 면이 있으나, 적어도 쿼리 캐시 히트를 기대하기 어렵다는 점 인지 필요).
- **제안**: 차원별 쿼리를 상수로 미리 정의하거나(빌드 시), 최소한 이 트레이드오프를 주석으로 명시. 현재 주석은 안전성 근거만 설명하고 성능 비용을 언급하지 않음.

---

**[MEDIUM]** `EmbeddingModelCombobox` — 2단계 직렬 API 호출 후 자동완성 노출
- **위치**: `embedding-model-combobox.tsx:33-51`
- **상세**: `llmConfigsApi.getAll()` → `defaultConfigId` 결정 → `llmConfigsApi.listModels()` 순서로 2번의 네트워크 왕복이 필요. 두 번째 쿼리는 첫 번째 결과에 의존하므로 병렬화 불가. staleTime 설정(`30s`/`60s`)으로 캐시는 되지만, cold load 시 자동완성이 늦게 뜸.
- **제안**: `/llm-configs?isDefault=true` 같은 단일 엔드포인트가 있다면 한 번에 해결. 없다면 서버 측에서 default config ID를 워크스페이스 컨텍스트에 포함시키는 것을 고려.

---

**[LOW]** 임베딩 벡터 문자열 변환 비용
- **위치**: `embedding.service.ts:171` — `const vectorStr = \`[${embedding.join(',')}]\``
- **상세**: 3072차원 벡터를 매 청크마다 문자열로 직렬화. `join`은 임시 문자열 배열을 생성한 뒤 합침. 100청크 배치 기준 약 2MB 임시 할당.
- **제안**: 성능 병목이 될 수준은 아니지만, 대규모 운영 환경에서는 TypedArray 기반 직렬화나 pgvector binary 프로토콜을 고려할 수 있음. 현재 단계에서는 INFO 수준.

---

**[INFO]** `reEmbedAll` — `documentRepository.find` SELECT 결과물 전체 로드
- **위치**: `knowledge-base.service.ts:122-126`
- **상세**: `select: ['id']`로 필요한 컬럼만 가져오는 것은 올바름. 단, KB에 수천 개 문서가 있으면 전체 ID 배열을 메모리에 올린 뒤 루프 실행. 실용적 상한이 없음.
- **제안**: 매우 큰 KB를 지원할 계획이라면, 청크 단위로 find→fire 하는 페이지네이션 패턴 또는 DB 큐(예: pg-boss) 도입 고려.

---

### 요약

핵심 성능 리스크는 두 군데다. `reEmbedAll`이 제한 없이 수백 개의 문서 처리 태스크를 동시 발사하고, 각 태스크 내부는 500ms 폴링으로 슬롯을 기다리는 구조라 다수 재임베딩 요청 시 메모리·CPU 모두 급증할 수 있다. 마이그레이션의 블로킹 HNSW 인덱스 3개 직렬 생성은 운영 환경 배포 시 상당한 다운타임 위험을 내포한다. RAG 검색은 그룹 병렬화로 레이턴시를 개선할 여지가 있고, 임베딩 전체를 메모리에 누적하는 패턴은 대용량 문서에서 OOM으로 이어질 수 있다. 나머지는 캐시·자동완성 UX 개선 수준으로 기능 안정화 후 순차 대응이 적절하다.

### 위험도

**HIGH**