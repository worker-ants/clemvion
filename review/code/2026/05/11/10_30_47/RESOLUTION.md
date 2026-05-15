# RESOLUTION — RAG KB 재시도/실패/회복 시스템 리뷰 조치

리뷰 일시: 2026-05-11_10-30-47 — 대상 범위: `git range 313daad4..HEAD` (PR1~PR5 5개 커밋).

## Critical 조치

| # | 이슈 | 조치 | 위치 |
|---|------|------|------|
| 1 | DOWN 마이그레이션 롤백 실패 (failed→error 미변환) | V037 SQL 주석 DOWN 절에 `UPDATE document SET embedding_status='error' WHERE embedding_status='failed'` 및 graph 동일 추가. UP 절은 NOT VALID + VALIDATE 분기로 락 시간 최소화 | `backend/migrations/V037__kb_retry_failed_status.sql` |
| 2 | 롤링 배포 시 `error→failed` UPDATE 충돌 | V037 헤더 주석에 배포 절차 명문화: ① 구버전 워커 stop → ② 마이그레이션 → ③ 신버전 start. 신규 'error' 의미는 in-flight 재시도 (영구 의미 제거) | `V037__kb_retry_failed_status.sql` 헤더 |
| 3 | WS 이벤트 의미 파괴적 변경 | spec/5-system/8-embedding-pipeline.md, 10-graph-rag.md WS 표에 "**(의미 변경, 2026-05-11)** in-flight 일시 오류 — 영구 실패 신호로 사용하지 말 것" 주석 추가. frontend `use-kb-events` 의 `*_error` 구독은 dead 가 아님 — invalidate 만 트리거하므로 retry/failed 와 함께 캐시 최신화에 기여 (의미상 안전) | `spec/5-system/8-embedding-pipeline.md`, `10-graph-rag.md` |
| 4 | `retryFailedDocuments` 테스트 전무 | `knowledge-base.service.spec.ts` 에 5개 케이스 신규: scope='embedding' / 'graph' on vector / 'all' on graph / 대상 없음 / addBulk 실패 시 rollback | `backend/src/modules/knowledge-base/knowledge-base.service.spec.ts` |
| 5 | `getEmbeddingStats` 테스트 전무 | 동 spec 에 2개 케이스: SQL 결과 매핑 / 빈 KB. `getGraphStats` 도 failed/pending 카운트 검증 추가 | 동상 |
| 6 | GraphExtractionService 재시도 시나리오 테스트 전무 | `graph-extraction.service.spec.ts` 에 `retry & failure` describe 블록: timeout 후 성공 / 3회 실패 / chunk_entity DELETE idempotency 검증 | `graph-extraction.service.spec.ts` |

## Warning 조치

| # | 이슈 | 조치 |
|---|------|------|
| W1 | `CREATE INDEX` non-CONCURRENTLY 락 | V038 분리 신규 — `executeInTransaction=false` + `CREATE INDEX CONCURRENTLY` |
| W2 | StuckDocumentRecoveryService 다중 인스턴스 race | SELECT→UPDATE 분리에서 `UPDATE ... RETURNING` 단일 쿼리로 변경 (PostgreSQL row-lock 으로 mutual exclusion 보장) |
| W3 | `withTimeout` 후 dangling HTTP socket | spec 주석에 후속 PR 명시 (`LLMClient` 인터페이스에 AbortSignal 전파). 본 PR 범위 밖. 추후 별도 plan 으로 분리 권장. |
| W4 | retryFailedDocuments UPDATE↔큐 비원자성 | addBulk 실패 시 catch 에서 해당 chunk 의 문서를 `failed` 로 rollback + throw |
| W5 | StuckDocumentRecoveryService N+1 | UPDATE...RETURNING 으로 회수 후 단일 `addBulk` 호출 (배치 통합) |
| W6 | WS 채널 인가 미확인 | 기존 WS 게이트웨이의 channel subscribe 검증 로직은 별도 audit 필요. 현 PR 범위 밖. 후속 보안 PR 으로 분리 권장 (TODO 메모) |
| W7 | error_message TEXT 길이 미제한 | `capErrorMessage(message)` 헬퍼로 2000자 cap 강제 — embedding/graph 서비스 모두 적용 |
| W8 | retryFailed body DTO 부재 | `RetryFailedBodyDto` 클래스 + `@IsOptional() @IsIn([...])` + `@ApiBody({ type: ... })`. 컨트롤러 수동 검증 제거 |
| W9 | `doExtract` 내 KB 재조회 | 시그니처를 `doExtract(documentId, kb: KnowledgeBase)` 로 변경 — 재시도마다 추가 SELECT 회피 |
| W10 | 최종 실패 이중 DB 쓰기 | `retryWithBackoff.onAttempt` 시그니처에 `willRetry` 인자 추가. willRetry=false 시 onAttempt 는 retry_count 증가만 하고 status 갱신은 outer catch 가 단일 UPDATE 로 처리 |
| W11 | stuck 회수 partial index 부재 | V038 에 `idx_document_embedding_stuck` (WHERE status='processing') / `idx_document_graph_stuck` 추가 |
| W12 | jitter 없음 | `retryWithBackoff` 에 ±30% jitter (`randomFn` 주입 가능) — thundering herd 방지 |
| W13 | O(N) 채널 구독 | 백엔드 emit 단위가 documentId 라 단일 채널 전환은 backend 양쪽 변경 필요. 후속 plan 으로 분리 권장 — 현 PR 범위 외 |
| W14 | 이중 retry 레이어 | `LlmService.chat/embed` 에 `disableInnerRetry` 옵션 추가. EmbeddingService/GraphExtractionService 가 `true` 로 호출하여 내부 rate-limit 재시도와의 비선형 증폭 방지 |
| W15 | 컨트롤러 e2e 테스트 부재 | 서비스 레벨에서 `retryFailedDocuments`/`getEmbeddingStats` 케이스 커버. 컨트롤러 e2e 는 후속 (시간 제약). |
| W16 | 재시도 카운트 tooltip 미구현 | KB 상세 페이지 문서 테이블에 `embeddingRetryCount > 0` / `embeddingErrorMessage` 가 있으면 Tooltip 으로 `retryAttemptInfo` + `lastError` i18n 키 활용 노출 |
| W17 | retryFailed 배치 크기 제한 없음 | 서비스에서 100건 단위 chunking 후 순차 `addBulk` |
| W18 | plan 문서 체크박스 미갱신 | `plan/in-progress/rag-kb-retry-failure-recovery.md` 의 PR1~PR5 모두 `[x]` 로 갱신 + Review 후속 조치 항목 추가 |
| W19 | CHECK 제약 추가 시 전체 스캔 락 | `ADD CONSTRAINT ... NOT VALID` + `VALIDATE CONSTRAINT` 분리로 ACCESS EXCLUSIVE 시간 최소화 |
| W20 | `isRetryableLlmError` `/not found/i` 오분류 | 패턴 제거 후 `\b404\b` 로만 매칭. 신규 spec 에 DNS 실패 (`ENOTFOUND`/`EAI_AGAIN`) 와 4xx 분리 검증 |

## Info / 후속 권장

| # | 이슈 | 처리 방향 |
|---|------|----------|
| I1 | `retryAttemptInfo` / `lastError` dead i18n 키 | W16 조치로 활성화 완료 |
| I2~17 | maintainability·아키텍처·테스트·문서 등 마이너 | 다음 PR cycle 에서 점진 정리 — 본 PR 범위 외 |

## 후속으로 미루는 항목 (별도 plan 분리 권장)

- **W3·W6·W13·W15** — AbortSignal 전파, WS 채널 인가, 단일 채널 구조 전환, 컨트롤러 e2e 테스트
- **I1~19 잔여 마이너** — env 외부화, BACKOFF_BASE 매직 넘버 추출, 백엔드 emit 단위 통일

## 검증

- backend: `npm run test -- --testPathPatterns=knowledge-base` → **11 suites · 119 tests pass**
- backend: `npx tsc --noEmit` (KB·LLM 모듈) → no errors
- backend: `npx eslint` (KB·LLM 모듈) → no errors
- frontend: `npx vitest run` (KB 페이지) → **3 tests pass**
- frontend: `npx eslint` (KB·WS 모듈) → no errors
