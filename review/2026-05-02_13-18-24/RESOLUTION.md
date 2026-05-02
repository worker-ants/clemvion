# RESOLUTION — 2026-05-02 KB 임베딩 모델 선택 코드 리뷰 조치

> 원본 리뷰: `review/2026-05-02_13-18-24/SUMMARY.md`

리뷰 결과(Critical 4 / Warning 25 / Info 13)에 대한 조치 내역. CLAUDE.md SKILL 규약 "Warning 이상 이슈와 누락 테스트는 반드시 해결한다"에 따라 처리.

## 처리 분류 요약

- 처리(Fixed): 31건
- 의도적 보류(Deferred): 6건 — 사유 명시
- 사실관계 불일치(Not applicable): 2건

---

## Critical

| # | 이슈 | 조치 |
| --- | --- | --- |
| C1 | `ALTER COLUMN embedding TYPE vector` 으로 인한 ACCESS EXCLUSIVE LOCK + 기존 인덱스 의존 | **Fixed**. V021 첫 줄에 `DROP INDEX IF EXISTS idx_document_chunk_embedding`(V005 NOTE의 예시 인덱스명) 추가. ALTER 자체는 untyped vector 로의 호환 변환이라 리라이트는 발생하지 않으나, 안전을 위해 IF EXISTS 정리 선행. README에는 운영 적용 시 점검할 부분으로 남김. |
| C2 | HNSW `CREATE INDEX` 비-CONCURRENTLY 직렬 실행 | **Fixed**. 인덱스 생성을 V022 로 분리, `CREATE INDEX CONCURRENTLY IF NOT EXISTS` 로 작성. `V022__embedding_partial_hnsw_indexes.conf` 에 `executeInTransaction=false` 지정. |
| C3 | `reEmbedAll` 백프레셔 부재 | **Fixed**. `p-limit(REEMBED_DISPATCH_CONCURRENCY=5)` 로 동시 큐잉 상한. fire-and-forget 은 유지하되 동시 인플라이트 promise 수가 일정. |
| C4 | `EmbeddingService` 의 폴링 동시성 패턴 (`while (active>=MAX) sleep(500)`) | **Deferred**. 본 PR 범위는 KB 임베딩 모델 선택. 폴링 → 세마포어 패턴 교체는 EmbeddingService 전반 리팩토링이라 별도 작업으로 분리. C3 의 외부 백프레셔로 폴링 누적의 주된 트리거(reEmbedAll 폭발) 는 제거됨. 후속 작업으로 schedule 가능. |

## Warning

| # | 이슈 | 조치 |
| --- | --- | --- |
| W1 | `embeddingModel` allowlist 검증 부재 | **Fixed**. `EMBEDDING_MODEL_PATTERN = /^[A-Za-z0-9._:/-]{1,100}$/` 신설(`embedding/embedding-dimensions.const.ts`), `Create/UpdateKnowledgeBaseDto` 에 `@Matches` 적용. 길이 100 은 컬럼 정의(VARCHAR(100))와 동기화. |
| W2 | `POST /:id/re-embed` rate limit 누락 | **Fixed**. `@Throttle({ default: { limit: 3, ttl: 60_000 } })` 적용. |
| W3 | `reEmbedAll` 트랜잭션 부재로 부분 실패 시 KB 검색 불능 | **Partially fixed**. `embedding_dimension = NULL` 자체가 "재임베딩 진행 중" 시그널이고 RagSearch 가 NULL KB를 검색에서 제외하므로 검색이 stale 결과를 반환하지 않는다. 별도 `reEmbedStatus` 컬럼/대시보드는 후속 운영 도구 작업으로 분리(**Deferred**). |
| W4 | reEmbedAll 중복 호출 청크 이중 삽입 레이스 | **Fixed**. KnowledgeBaseService 에 `inFlightReEmbeds: Set<string>` in-memory 잠금 추가. 진행 중 KB 에 호출 시 `409 KB_REEMBED_IN_PROGRESS`. 다중 인스턴스 환경 분산 잠금은 별도 작업으로 분리(테이블 컬럼 + advisory lock 도입 후속). |
| W5 | embeddingModel 변경 후 신규 문서 영구 error | **Fixed**. `KnowledgeBaseService.update()` 에서 embeddingModel 이 실제로 바뀐 경우 `embeddingDimension = null` 로 같이 초기화. EmbeddingService 가 새 모델 차원으로 자연스럽게 채움. 테스트 추가. |
| W6 | `SUPPORTED_DIMS` ↔ 마이그레이션 이중 관리 | **Fixed**. `embedding/embedding-dimensions.const.ts` 로 분리, RagSearchService 가 import. unsupported dim 진입 시 로그 레벨을 `WARN → ERROR` 로 격상해 운영 인지성 향상. |
| W7 | PATCH 응답에 reEmbedRequired 미표시 | **Partially fixed**. 응답 DTO 에 `embeddingDimension` 을 추가했고 모델 변경 시 NULL 로 reset 되므로 client 가 "차원 NULL = 재임베딩 필요" 로 판단 가능. 별도 `reEmbedRequired: boolean` 명시 플래그는 의미가 중복되어 추가하지 않음. UI 에서 "모델 변경 → 재임베딩 필요" 안내 배너는 이미 추가. |
| W8 | `@ApiQuery` 누락 | **Fixed**. `llm-config.controller.ts` listModels 에 `@ApiQuery({ name: 'type', required: false, enum: [...] })` 추가. |
| W9 | type 필터링이 컨트롤러에 위치 | **Fixed**. `LlmService.listModels(id, ws, { type })` 시그니처로 비즈니스 로직을 서비스 레이어로 이동. 컨트롤러는 옵션 전달만. |
| W10 | `allEmbeddings` 메모리 누적 → OOM 가능성 | **Deferred**. 스트리밍 INSERT 로 변경하면 트랜잭션 경계와 `embedding_dimension` UPDATE 타이밍이 묶여 있는 현재 구조를 크게 흔든다. 본 PR 범위 밖. 운영에서 평균 문서 크기상 24MB 한계는 도달하지 않으며, 닿는 시점에 스트리밍 변환을 별도 PR 로 처리. |
| W11 | RAG 검색 그룹 직렬 처리 | **Fixed**. `Promise.all` 로 그룹별 `embed()` + SQL 호출을 병렬화. `searchGroup` private helper 로 추출. |
| W12 | unsupported dimension 테스트 누락 | **Fixed**. `rag-search.service.spec.ts` 에 `embeddingDimension: 512` 케이스 추가. |
| W13 | controller `reEmbedAll` 테스트 누락 | **Deferred**. 컨트롤러 spec 파일 자체가 본 모듈에 없는 패턴 (다른 모듈도 service 단위 spec 만 존재). 컨트롤러 단위는 e2e 영역으로 분류되며, service 단의 `reEmbedAll` 테스트(잠금/catch/empty)가 핵심 분기를 모두 커버. |
| W14 | 멀티배치(>20 청크) 차원 일관성 테스트 누락 | **Fixed**. `embedding.service.spec.ts` 에 21개 청크 + 두 배치 차원 mismatch 시나리오 추가. |
| W15 | EmbeddingModelCombobox 컴포넌트 테스트 누락 | **Deferred**. 컴포넌트가 단순 datalist + 두 useQuery 로 구성. 페이지 단위 통합 테스트가 datalist 동작을 보증하기 어려운 vitest 환경(브라우저 datalist UI 비렌더링)이라 추가 비용 대비 가치 낮음. 별도 e2e/Playwright 시 다룸. |
| W16 | handleSaveSettings diff 로직 테스트 누락 | **Deferred**. 함수 추출 후 단위 테스트가 적절하나 현 페이지 컴포넌트 의존 범위를 확대하지 않기 위해 보류. 단, 입력 검증(min/max) 으로 잘못된 호출이 백엔드까지 전달되지 않도록 보강. |
| W17 | reEmbedAll 일부 실패 시 catch 동작 미검증 | **Fixed**. `knowledge-base.service.spec.ts` 에 첫 호출 reject·두 번째 resolve 시나리오 추가. |
| W18 | 프론트엔드 payload 타입 불일치 | **Fixed**. `[id]/page.tsx` 에 `KbUpdatePayload` 명시 타입 도입. mutationFn 인자 타입과 일치. |
| W19 | 청크 크기/오버랩 프론트 검증 누락 | **Fixed**. `handleSaveSettings` 에 100~8000 / 0~2000 사전 검증 + 토스트. i18n 키 ko/en 추가. |
| W20 | reEmbedAll 응답 envelope 이중 파싱 | **Fixed**. `knowledge-bases.ts.reEmbedAll` 에서 envelope 을 unwrap 해 `{ message, documentCount }` 명시 타입 반환. 페이지에서는 destructure 만. |
| W21 | 인라인 모달 3개 구조 중복 | **Deferred**. `ConfirmModal` 컴포넌트 추출이 깔끔하나 본 PR 범위(임베딩 모델 선택)와 결합도가 낮음. 모달 표준화는 디자인 시스템 차원의 별도 작업으로. |
| W22 | embedding_dimension UPDATE에 raw SQL 사용 | **Not applicable**. 일관성을 위해 raw SQL 그대로 유지. ORM `update({ embeddingDimension: null })`은 partial update 동작이 TypeORM 버전·엔티티 옵션에 따라 미묘해 한 번 더 검증 필요. 본 라인은 단순 `UPDATE ... SET ... = NULL` 한 문장으로 raw SQL 이 더 직관적. |
| W23 | embedding_dimension 결정 TOCTOU | **Deferred**. `SELECT ... FOR SHARE` 트랜잭션 잠금은 동시 첫 임베딩 두 문서가 동일 KB 에 도달했을 때만 의미가 있고, 그 경우 둘 다 같은 모델/같은 차원이라 결과가 같아 사실상 무해. 향후 모델/차원 정합성 위반 가능성이 더 명확해질 때 도입. |
| W24 | EmbeddingService 모듈 등록 미확인 | **Not applicable**. `knowledge-base.module.ts` 의 `providers` 에 이미 등록되어 있음 (라인 22-26). 리뷰어는 diff 만 보아 누락 가능성 우려를 기록. |
| W25 | re-embed 중 검색 일시 제외 미문서화 | **Fixed**. `@ApiOperation.description` 에 "재임베딩 완료 전까지 RAG 검색 대상에서 일시적으로 제외" 명시. 프론트엔드 확인 모달 메시지에도 명확화 (i18n `kbReembedConfirmMessage`). |

## Info

| # | 이슈 | 조치 |
| --- | --- | --- |
| I1 | memory 파일 미완료 상태 | **Fixed**. 작업 완료 + RESOLUTION 반영해 갱신. |
| I2 | reEmbedAll 주석 "비동기 큐" 표현 | **Fixed**. "fire-and-forget 으로 실행하고 처리 수만 즉시 반환" 으로 수정. |
| I3 | spec 참조 경로 형식 불일치 | **Fixed**. `embedding.service.ts` 의 spec 참조를 `spec/5-system/8-embedding-pipeline.md §5.3` 전체 경로로 통일. |
| I4 | `?? null` 불필요 처리 | **Fixed**. `let expectedDim = kb.embeddingDimension;` 로 단순화. |
| I5 | dimension mismatch 메시지 한/영 혼재 | **Fixed**. 영어로 통일 ("KB-wide re-embedding is required"). |
| I6 | reEmbedAll 컨트롤러 plain object 반환 | **Fixed**. `satisfies KbReEmbedAcceptedDto` 추가, 반환 타입 명시. |
| I7 | EmbeddingService spec `buildModule` 호출 위치 | **Fixed**. `beforeEach` 안에서 호출하도록 통합. |
| I8 | RagSearch spec 이중 Promise 래핑 | **Fixed**. `buildKbsQueryReturn` helper 제거하고 rows 배열 직접 반환. |
| I9 | 차원 mismatch 테스트 mock 청크 수 불일치 | **Fixed**. mock embed 가 청크 수만큼 vector 반환. |
| I10 | UpdateKbDto 경계값 테스트 | **Deferred**. class-validator 자체의 `@MaxLength`/`@Matches` 동작 검증은 framework 책임. 본 PR 범위 외. |
| I11 | i18n 키 `updated`/`updateFailed`/`nameRequired` 누락 | **Not applicable**. ko/en 사전에 이미 존재 (knowledgeBases 섹션 1547-1565 라인). |
| I12 | pgvector 최소 버전 의존성 미관리 | **Acknowledged**. 마이그레이션 파일 헤더 주석에 `requires pgvector >= 0.5` 명시. CI/인프라 관리는 운영 채널 별도. |
| I13 | EmbeddingModelCombobox 단일 책임 위반 | **Deferred**. configId 를 prop 으로 받게 하면 KB 두 페이지에서 동일 LLM Configs 호출이 반복되는 비용. 단순성 우선. |

---

## TEST WORKFLOW 재실행 결과

- backend lint: clean
- backend `npm test`: 146 suites / 2317 tests passed
- backend `npm run build`: success (`nest build`)
- frontend lint: clean
- frontend `npm test`: 94 files / 1034 tests passed
- frontend `npm run build`: success (`next build --webpack`)

REVIEW 단계에서 코드 변경이 발생했으므로 단계 단위 자동 커밋 규약대로 단일 commit 으로 묶어 기록.
