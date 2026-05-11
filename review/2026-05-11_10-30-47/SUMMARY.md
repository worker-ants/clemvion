# Code Review 통합 보고서

## 전체 위험도
**HIGH** — WebSocket 이벤트 의미론 파괴적 변경, 핵심 기능 테스트 부재, DOWN 마이그레이션 롤백 불가 위험이 복합적으로 존재

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 마이그레이션 | **DOWN 롤백 시 CHECK 제약 위반**: DOWN 절에서 `chk_doc_*_status` 재추가 전 `failed` 상태 행을 `error`로 역변환하는 UPDATE가 없어 롤백 실행 자체가 실패함 | `V037__kb_retry_failed_status.sql` (DOWN 주석) | DOWN 절 시작부에 `UPDATE document SET embedding_status='error' WHERE embedding_status='failed'` 및 graph 동일 패턴 추가 |
| 2 | 배포 안전성 | **롤링 배포 시 `error→failed` 일괄 UPDATE 충돌**: 구버전 워커가 `error` 상태를 기록/조회하는 동안 마이그레이션이 실행되면 해당 레코드가 사라져 구버전 코드가 문서를 찾지 못함 | `V037__kb_retry_failed_status.sql:36-39` | (1) 구버전 워커 종료 → (2) 마이그레이션 → (3) 신버전 배포 순서를 배포 문서화, 또는 컬럼 추가와 데이터 변환을 별도 마이그레이션으로 분리 |
| 3 | API 계약 | **WebSocket 이벤트 의미론 파괴적 변경**: `document:embedding_error`/`document:graph_error`가 "영구 실패 신호"에서 "일시 오류 신호"로 의미가 완전히 바뀌었고, 기존 구독자는 신규 영구 실패 이벤트(`*_failed`)를 수신하지 못함. `use-kb-events.ts`의 해당 이벤트 구독은 dead subscription | `embedding.service.ts`, `graph-extraction.service.ts`, `use-kb-events.ts`, `spec/5-system/8-embedding-pipeline.md` | `document:embedding_error`를 "일시 오류" 전용으로 spec에 명시하고 `onAttempt` 내에서 emit하거나, 신규 이름(`embedding_transient_error`)으로 도입. `use-kb-events.ts`의 dead subscription 정리 |
| 4 | 테스트 | **`retryFailedDocuments` 테스트 전무**: 이번 변경의 핵심 비즈니스 로직(scope 분기, vector 모드 KB, 대상 0건, 다수 문서 큐잉)에 대한 테스트가 없음 | `knowledge-base.service.spec.ts` | scope별 분기 + vector 모드 + 대상 없음 케이스 테스트 추가 |
| 5 | 테스트 | **`getEmbeddingStats` 테스트 전무**: 신규 메서드의 집계 SQL 결과 매핑을 검증하는 테스트 없음 | `knowledge-base.service.spec.ts` | 다양한 status 분포 데이터로 집계 결과 매핑 검증 테스트 추가 |
| 6 | 테스트 | **`GraphExtractionService` 재시도 시나리오 테스트 전무**: `EmbeddingService`에는 timeout 후 성공·3회 연속 실패 테스트가 있으나 동일 `retryWithBackoff`를 쓰는 `GraphExtractionService`에 대응 테스트 없음. `doExtract`의 idempotency(chunk_entity DELETE 재진입) 검증도 없음 | `graph-extraction.service.spec.ts` | `embedding.service.spec.ts`와 동등한 `retry & failure` describe 블록 추가 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 데이터베이스 | **`CREATE INDEX` without `CONCURRENTLY` — 배포 중 테이블 쓰기 차단**: `executeInTransaction=true` 환경에서 `SHARE` 락이 인덱스 빌드 완료까지 `document` 테이블 쓰기를 전면 차단. 문서 수가 많을수록 무중단 배포 SLA 위반 가능성 | `V037__kb_retry_failed_status.sql` 마지막 `CREATE INDEX` | 인덱스 생성만 별도 마이그레이션(`V037b__...`) + `executeInTransaction=false`로 분리하거나 오프-피크 시간 적용 |
| 2 | 동시성/보안 | **`StuckDocumentRecoveryService` 다중 인스턴스 동시 부팅 시 이중 처리 경쟁 조건**: SELECT→UPDATE→Queue add 사이에 원자성이 없어 두 인스턴스가 동일 문서를 동시에 `reEmbed=true`로 처리. `doExtract` 내 chunk DELETE→재삽입 중 다른 워커가 청크를 삭제하면 청크 유실 가능 | `stuck-document-recovery.service.ts:79-96` | `FOR UPDATE SKIP LOCKED` 또는 `UPDATE ... WHERE status='processing' RETURNING id`로 SELECT+UPDATE 원자화하여 실제 업데이트된 행만 큐잉 |
| 3 | 성능/보안 | **`withTimeout` race — 고아 HTTP 소켓 누적**: 타임아웃 시 내부 HTTP 요청이 계속 진행되어 재시도 3회 × 동시 청크 처리(pLimit 3) 환경에서 최대 12개 Dangling 요청이 최대 90s간 연결 점유. 대용량 환경에서 연결 풀 고갈 가능 | `llm.service.ts:84-88`, `embedding.service.ts:EMBED_TIMEOUT_MS`, `graph-extraction.service.ts:GRAPH_CHUNK_TIMEOUT_MS` | 단기: `http.globalAgent.maxSockets` 상한 설정. 중기: 후속 PR에서 `LLMClient.chat/embed`에 `AbortSignal` 전파 구현(plan 문서에 이미 예정) |
| 4 | 데이터베이스/동시성 | **`retryFailedDocuments` UPDATE ↔ Queue addBulk 비원자성**: UPDATE 성공 후 `addBulk`가 실패하면 문서가 `pending` 상태로 방치. `StuckDocumentRecoveryService`는 `processing`만 회수하므로 `pending` 고아 문서는 영구 처리 불가 | `knowledge-base.service.ts:retryFailedDocuments` | `addBulk` 실패 시 해당 문서 상태를 다시 `failed`로 롤백, 또는 부트스트랩 회수 대상에 `pending + last_attempted_at IS NOT NULL + threshold` 조건 추가 |
| 5 | 성능/데이터베이스 | **StuckDocumentRecoveryService N+1 DB·큐 호출**: 회수 대상 문서마다 순차 `UPDATE`와 `queue.add`를 별도 실행. 부팅 시 stuck 문서 수에 비례해 기동 지연이 선형 증가 | `stuck-document-recovery.service.ts:90-127` | `UPDATE ... WHERE id = ANY($1::uuid[])` 배치 UPDATE + `addBulk` 단일 호출로 통합 |
| 6 | 보안 | **WebSocket 채널 서버 측 인가 미확인**: `ws.subscribe(\`kb:${docId}\`)`에서 사용자 ↔ documentId 소유 관계 검증 없이 구독 시, 타 워크스페이스 document ID를 아는 공격자가 LLM 오류 메시지를 수신 가능 | `use-kb-events.ts:98-100`, WebsocketService | subscribe 핸들러에서 JWT workspaceId ↔ document.knowledgeBaseId.workspaceId 대조 로직 존재 여부 검증 |
| 7 | 보안 | **`error_message` TEXT 컬럼 길이 미제한**: `sanitizeLlmErrorMessage`가 URL/키를 걸러주지만 최대 길이 제한 여부가 불명확. LLM provider 비정상 응답 시 수MB 텍스트가 저장될 수 있음 | `V037__kb_retry_failed_status.sql:30,34` (`embedding_error_message TEXT`, `graph_error_message TEXT`) | DB 컬럼에 `length: 2000` 제약 또는 `sanitizeLlmErrorMessage` 내 `slice(0, 2000)` 강제 적용 |
| 8 | API 계약/아키텍처 | **`retryFailed` 엔드포인트 body DTO 부재**: `@Body() body: { scope?: ... }` 인라인 타입으로 class-validator 없음, OpenAPI `@ApiBody()` 미선언, 수동 `includes()` 체크가 유일한 가드, `BadRequestException`이 컨트롤러에서 직접 throw되어 레이어 책임 경계 모호 | `knowledge-base.controller.ts:252-271` | `RetryFailedBodyDto` 클래스에 `@IsOptional()`, `@IsIn(['embedding','graph','all'])` 적용, `@ApiBody({ type: RetryFailedBodyDto })` 추가, 컨트롤러 수동 검증 제거 |
| 9 | 아키텍처/성능 | **`doExtract` 내 KB 재조회 — 재시도마다 추가 쿼리**: 부모 메서드에서 이미 KB를 조회했으나 `doExtract` 내부에서 `kbRepository.findOne` 재호출. 3회 재시도 시 총 4회 SELECT, 재시도 사이 KB 설정 변경 시 비결정적 동작 가능 | `graph-extraction.service.ts:doExtract` | `doExtract(documentId, kb: KnowledgeBase)` 형태로 시그니처 변경하여 이미 조회된 KB 객체 전달 |
| 10 | 아키텍처 | **최종 실패 시 DB 이중 쓰기**: 비재시도성 오류 발생 시 `onAttempt`가 `embeddingStatus='error'`로 1차 UPDATE 후 outer catch가 `embeddingStatus='failed'`로 2차 UPDATE. 두 UPDATE 사이 다른 프로세스가 순간적으로 `error` 상태를 관찰 가능 | `embedding.service.ts:onAttempt`, outer catch; `graph-extraction.service.ts` 동일 패턴 | `onAttempt` 콜백에 `willRetry: boolean` 인자 추가, `willRetry=false` 시 outer catch에만 `failed` 처리 위임 |
| 11 | 성능 | **stuck 회수 쿼리 커버 인덱스 부재**: `idx_document_kb_embedding_status`는 `(knowledge_base_id, embedding_status)` 복합 인덱스이나, 회수 쿼리는 `knowledge_base_id` 없이 `embedding_status='processing' AND last_attempted_at < NOW()-X` 조건으로 전체 테이블 스캔 | `stuck-document-recovery.service.ts:65-69`, `V037__kb_retry_failed_status.sql` | `CREATE INDEX idx_document_embedding_processing_stuck ON document(embedding_last_attempted_at) WHERE embedding_status='processing'` 및 graph 동일 partial index 추가 |
| 12 | 성능 | **재시도 jitter 없음 — thundering herd 위험**: 동시에 여러 문서가 LLM timeout을 받으면 동일 backoff 구간(1s/4s/16s) 후 동시 재시도 트리거. rate limit(429)이 원인일 경우 재시도도 연속 실패 | `retry-with-backoff.util.ts:96` | `delay += Math.random() * 0.3 * delay` 형태로 ±30% jitter 추가 |
| 13 | 성능 | **프론트엔드 O(N) 채널 구독**: 문서 N개마다 `kb:${docId}` 채널을 개별 구독. `documentIds` 변경 시 N개 unsubscribe + N개 재구독. 문서 수 100+ KB에서 WebSocket 오버헤드 비선형 증가 | `use-kb-events.ts:83-85` | 백엔드에서 `kb:${knowledgeBaseId}` 단일 채널로 emit하도록 변경, 프론트엔드는 채널 1개만 구독 |
| 14 | 동시성 | **LlmService.withRetry + retryWithBackoff 이중 재시도 레이어**: 내부 `withRetry`가 rate limit 등을 재시도하고 외부 `retryWithBackoff(maxRetries=3)`이 다시 감싸면 실제 LLM 호출 횟수가 배로 증가 가능 | `llm.service.ts:withRetry`, `embedding.service.ts`, `graph-extraction.service.ts` | `retryWithBackoff` 경로에서 `withRetry`의 재시도 대상이 `isRetryableLlmError`와 겹치지 않는지 확인, 겹칠 경우 한쪽 비활성화 |
| 15 | 테스트 | **컨트롤러 테스트 부재**: `GET /:id/embedding-stats`, `POST /:id/retry-failed` 엔드포인트 단위·통합 테스트 없음. 잘못된 scope 시 `BadRequestException` 분기 미검증 | `knowledge-base.controller.ts` (spec 파일 없음) | 두 엔드포인트의 정상 흐름 + 유효성 검증 실패 케이스 컨트롤러 spec 또는 e2e 테스트 추가 |
| 16 | 요구사항 | **재시도 카운트 tooltip 미구현**: `spec/2-navigation/5-knowledge-base.md`에 `embedding_retry_count > 0` 시 hover tooltip으로 `embeddingErrorMessage` + 재시도 카운트 노출 명시. `retryAttemptInfo`/`lastError` i18n 키도 정의되었으나 사용처 없음 | `frontend/src/app/(main)/knowledge-bases/[id]/page.tsx` (문서 목록 뱃지 영역) | 문서 목록 상태 뱃지에 `embeddingRetryCount > 0` 시 Tooltip 컴포넌트 추가, 정의된 i18n 키 활용 |
| 17 | 요구사항 | **`retryFailedDocuments` 배치 크기 제한 없음**: `failed` 문서 수천 건 시 `addBulk` 단일 호출로 Redis/BullMQ에 순간 부하 집중 | `knowledge-base.service.ts:retryFailedDocuments` | 100~500건 단위 청크 처리 또는 API 응답 후 background job으로 분산 |
| 18 | 문서 | **plan 문서 체크박스 미갱신**: PR1~PR5가 모두 `[ ]`로 표시되어 구현 완료 상태와 불일치. CLAUDE.md 규약("작업이 끝나면 결과에 맞춰 갱신") 위반 | `plan/in-progress/rag-kb-retry-failure-recovery.md:20-25` | 완료 항목 `[x]` 갱신, 모든 항목 완료 시 `git mv`로 `plan/complete/`로 이동, `embedding-progress-box.tsx` 파일 목록에서 제거 |
| 19 | 데이터베이스 | **CHECK 제약 추가 시 테이블 전체 스캔 락**: `ADD CONSTRAINT CHECK` 실행 시 `ACCESS EXCLUSIVE` 락 획득하며 기존 행 전량 검증 | `V037__kb_retry_failed_status.sql` | 대규모 테이블이라면 `ADD CONSTRAINT ... CHECK (...) NOT VALID` 후 별도 단계에서 `VALIDATE CONSTRAINT` 실행 |
| 20 | 보안/의존성 | **`isRetryableLlmError` `/not found/i` 패턴 오분류 위험**: DNS 실패 메시지("Host not found: api.openai.com")가 패턴에 매칭되면 재시도 가능한 네트워크 오류를 즉시 `failed`로 전환 | `retry-with-backoff.util.ts:NON_RETRYABLE_PATTERNS` | `/\b404\b/` 또는 `/\bnot found\b.*404/i`로 패턴 좁히기 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 범위 | **`retryAttemptInfo`/`lastError` i18n 키 현재 사용처 없음**: 툴팁 미구현으로 인한 dead i18n key (WARNING #16과 연관) | `en.ts:1698-1699`, `ko.ts:1698-1699` | 툴팁 구현 시 함께 사용하거나 구현 전까지 제거 |
| 2 | 유지보수 | **`EmbeddingStatus`/`GraphExtractionStatus` 동일 유니온 타입 중복 선언**: 5개 리터럴 동일 유니온이 두 곳에 별도 선언. 한쪽만 값 추가 시 동기화 문제 | `document.entity.ts`, `knowledge-bases.ts` | `ProcessingStatus = 'pending' \| 'processing' \| 'completed' \| 'error' \| 'failed'` 공통 타입으로 정의 후 alias |
| 3 | 유지보수 | **백오프 공식 매직 넘버 `4` 노출**: `Math.pow(4, attemptIdx)` 지수 밑이 하드코딩 | `retry-with-backoff.util.ts:Math.pow(4, attemptIdx)` | `const BACKOFF_BASE = 4` 상수로 추출 |
| 4 | 유지보수 | **재시도 상수(`MAX_RETRIES`, `BASE_DELAY_MS`) 두 서비스 중복**: 현재 동일 값이지만 독립적으로 관리되어 한쪽만 변경 시 정책 불일치 | `embedding.service.ts:14-16`, `graph-extraction.service.ts:29-31` | `retry-with-backoff.util.ts`에 `DEFAULT_RETRY_OPTIONS` export |
| 5 | API 계약 | **`BadRequestException` 에러 응답 형식 불일치**: `throw new BadRequestException({ code: ..., message: ... })`는 `message` 필드에 객체가 중첩되어 표준 NestJS 포맷과 상이 | `knowledge-base.controller.ts:265-268` | DTO + ValidationPipe로 이전하거나 문자열 인수로 통일 |
| 6 | API 계약 | **URL 경로 네이밍 불일치**: 임베딩 통계는 `/embedding-stats` suffix형, 그래프 통계는 다른 패턴 사용 가능성 | `knowledge-base.controller.ts:208` | `/knowledge-bases/:id/stats/embedding`, `/knowledge-bases/:id/stats/graph` 또는 동일 패턴으로 통일 |
| 7 | API 계약 | **vector 모드 KB에 `scope='graph'` 명시 요청 시 조용히 0건 반환**: 의도된 설계이나 클라이언트 실수를 감지 불가 | `knowledge-base.service.ts:391-396` | `scope='graph'`를 명시한 경우 `400 BAD_REQUEST` 또는 응답에 warning 힌트 포함 |
| 8 | 성능 | **`getEmbeddingStats` 두 번 쿼리**: KB 존재 확인(1차) + 집계 SELECT(2차). 5s polling 환경에서 불필요한 DB 왕복 | `knowledge-base.service.ts:361-385` | KB와 집계를 JOIN하는 단일 쿼리로 통합 |
| 9 | 성능 | **graph/embedding 이중 폴링**: graph 모드 KB에서 두 통계 쿼리가 각각 5s 폴링으로 10s당 최소 4번 API 호출 | `[id]/page.tsx:169-186` | 단일 `GET /knowledge-bases/:id/stats` 엔드포인트로 통합하거나 WS 이벤트 정상 수신 중 폴링 간격 완화 |
| 10 | 데이터베이스 | **interval 산술 비표준 방식**: `($1::text \|\| ' ms')::interval` 패턴 사용. 파라미터 바인딩 값이라 SQL injection 위험은 없으나 가독성 낮음 | `stuck-document-recovery.service.ts:69`, `75` | `NOW() - make_interval(secs => $1::float / 1000)` 또는 timestamp 직접 바인딩 |
| 11 | 아키텍처 | **`isRetryableLlmError` 모듈 위치 오분류**: LLM 에러 판정 로직이 `knowledge-base/utils/`에 위치해 다른 모듈이 재사용 시 의존 또는 복제 필요. `sanitizeLlmErrorMessage`는 `modules/llm/utils/`에 있어 일관성 위배 | `retry-with-backoff.util.ts` | `modules/llm/utils/retryable-error.util.ts`로 이동 |
| 12 | 테스트 | **`onAttempt` 내부 throw 시 동작 미검증**: `onAttempt` 오류를 무음으로 삼키는 동작 검증 없음 | `retry-with-backoff.util.spec.ts` | `onAttempt`가 reject하는 경우 재시도가 계속 진행됨을 검증하는 테스트 추가 |
| 13 | 테스트 | **`retryWithBackoff` maxRetries=0 엣지 케이스 미검증** | `retry-with-backoff.util.spec.ts` | `maxRetries=0` 시 fn이 1회만 호출되고 즉시 throw됨을 검증 |
| 14 | 테스트 | **`reEmbedAll` 신규 reset SQL 검증 누락**: `embedding_retry_count=0, embedding_error_message=NULL` reset 쿼리가 기존 spec에 미검증 | `knowledge-base.service.spec.ts` | 기존 `reEmbedAll` 테스트에 해당 UPDATE SQL 호출 검증 추가 |
| 15 | 테스트 | **`useKbEvents` 훅 테스트 없음**: WS 연결·구독·cleanup, throttle, documentIds 변경 시 재구독 등 복잡한 비동기 동작 미검증 | `use-kb-events.ts` | `renderHook` + fake-socket으로 subscribe/unsubscribe 흐름 검증 |
| 16 | 의존성 | **BullMQ stalled interval vs 백오프 총 대기 시간 충돌 가능성**: 그래프 추출 최대 처리 window가 381s(≈6.4분)이나 BullMQ 기본 `stalledInterval`(30s)과 충돌 여부 미확인 | `graph-extraction.processor.ts` Worker 옵션 | Worker `lockDuration`을 `GRAPH_CHUNK_TIMEOUT_MS × (MAX_RETRIES+1) + totalBackoff + margin` 이상으로 설정 |
| 17 | 문서 | **환경변수 문서화 누락**: `EMBED_TIMEOUT_MS`, `GRAPH_CHUNK_TIMEOUT_MS`, `STUCK_THRESHOLD_MS`가 하드코딩되어 `.env.example`이나 README에 기본값과 변경 시나리오가 없음 | `embedding.service.ts:15-17`, `graph-extraction.service.ts:29-31`, `stuck-document-recovery.service.ts:48` | `.env.example`에 주석 형태로 기본값과 변경 시나리오 문서화 |
| 18 | 요구사항 | **`graphStats` `pendingDocumentCount`에서 `graph_extraction_status IS NULL` 문서 누락**: `completed + failed + pending ≠ total`이 될 수 있는 엣지 케이스 | `knowledge-base.service.ts:getGraphStats` SQL | pending 카운트에 `OR graph_extraction_status IS NULL` 조건 추가 또는 쿼리 주석에 전제 조건 명시 |
| 19 | 요구사항 | **`embeddingStats` 쿼리 KB 메타데이터 로딩 의존 waterfall**: `enabled: !!kb` 조건으로 KB 로딩 완료 후 통계 fetch 시작 | `page.tsx:embeddingStats useQuery` | `id`가 URL param으로 이미 존재하므로 `enabled: true`로 변경하여 병렬 fetch |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| API Contract | **HIGH** | WebSocket 이벤트 의미론 파괴적 변경, `retryFailed` body DTO 부재 |
| Testing | **HIGH** | `retryFailedDocuments`·`getEmbeddingStats`·`GraphExtractionService` 재시도 테스트 전무 |
| Requirement | **HIGH** | DOWN 마이그레이션 롤백 불가, 재시도 카운트 tooltip 미구현 |
| Database | **MEDIUM** | `CREATE INDEX` 테이블 락, UPDATE+큐 비원자성, N+1 패턴 |
| Security | **MEDIUM** | WS 채널 인가 미확인, HTTP 소켓 누수, error_message 길이 미제한 |
| Performance | **MEDIUM** | N+1 DB 호출, stuck 회수 인덱스 부재, 고아 HTTP 커넥션, jitter 없음 |
| Side Effect | **MEDIUM** | 롤링 배포 충돌, HTTP 소켓 누적, `embedding_error` 이벤트 미발화 |
| Concurrency | **MEDIUM** | 다중 인스턴스 청크 유실 경쟁 조건, Dangling Promise, 이중 retry 증폭 |
| Architecture | **LOW** | `isRetryableLlmError` 모듈 위치 오분류, 이중 DB 쓰기, 재시도 상수 중복 |
| Maintainability | **LOW** | `attemptIndex` 클로저 순서 의존성, 복붙 패턴, 타입 중복 |
| Documentation | **LOW** | plan 문서 미갱신, env 변수 문서화 누락, i18n 키 dead code |
| Scope | **LOW** | i18n 키 사용처 없음, 이중 retry 레이어 미검토 |
| Dependency | **LOW** | 외부 신규 의존성 없음, `withTimeout` import 확인 필요, jitter 부재 |

## 발견 없는 에이전트

모든 13개 에이전트가 하나 이상의 발견사항을 보고하였습니다.

---

## 권장 조치사항

1. **[즉시] DOWN 마이그레이션 롤백 수정** — `failed→error` 역변환 UPDATE를 DOWN 절에 추가하여 롤백 실패 위험 제거
2. **[즉시] 롤링 배포 순서 문서화** — `error→failed` 일괄 UPDATE로 인한 구버전 워커 충돌 방지를 위한 배포 절차 명문화 또는 마이그레이션 단계 분리
3. **[즉시] 핵심 기능 테스트 추가** — `retryFailedDocuments`, `getEmbeddingStats`, `GraphExtractionService` 재시도 시나리오 테스트 없이 배포 시 silent 오동작 위험
4. **[단기] WebSocket 이벤트 계약 정리** — `document:embedding_error`/`document:graph_error`의 새로운 의미를 spec에 명시하고 `use-kb-events.ts`의 dead subscription 정리
5. **[단기] `StuckDocumentRecoveryService` 원자성 보장** — `FOR UPDATE SKIP LOCKED` 또는 `UPDATE ... RETURNING` 패턴으로 다중 인스턴스 청크 유실 경쟁 조건 제거
6. **[단기] `CREATE INDEX` 배포 영향 완화** — 인덱스 생성을 별도 마이그레이션 + `executeInTransaction=false`로 분리
7. **[단기] `retryFailed` DTO 적용** — `RetryFailedBodyDto` + ValidationPipe로 입력 검증 표준화
8. **[단기] 재시도 카운트 tooltip 구현** — spec 요구사항 충족 및 dead i18n 키 활성화
9. **[중기] `withTimeout` AbortSignal 전파** — LLMClient에 AbortSignal 연동으로 고아 HTTP 소켓 누수 해결(plan에 이미 예정)
10. **[중기] stuck 회수 partial index 추가** — `embedding_last_attempted_at` 기준 partial index로 부팅 시 slow query 방지
11. **[중기] `retryWithBackoff` jitter 추가** — thundering herd 방지로 rate limit 환경에서 재시도 성공률 향상
12. **[중기] WebSocket 단일 채널 구조로 전환** — `kb:${knowledgeBaseId}` 단일 채널로 O(N) 구독 오버헤드 제거