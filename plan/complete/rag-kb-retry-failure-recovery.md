# RAG KB 임베딩·그래프 추출 재시도/실패/회복 시스템

> 시작: 2026-05-11 — 원본 plan: `/Users/gehrig/.claude/plans/rag-kb-rippling-salamander.md`

## 배경

`그래프 추출 상태` UI 가 한 건이라도 LLM timeout / 워커 crash 등으로 stuck 되면 "57개 문서 추출 완료 / 65" 같은 상태에서 영원히 멈춤. 백엔드 LLM 호출에 timeout 이 없고, 재시도는 rate-limit 만 대응하며, `processing` 상태 stuck 회수 로직이 없어 발생하는 다중 원인 결합.

## 사용자 정책 (2026-05-11 확정)

- 자동 재시도 **3회**, 지수 백오프 **1s / 4s / 16s**
- 적용 범위: **임베딩 + 그래프 추출 둘 다**
- 상태 enum: `'failed'` 신규 — `error` = in-flight 재시도, `failed` = 최종
- UI: 완료/실패 카운트 + 재시도 버튼 + WebSocket 이벤트 구독

## PR 단위 (백워드 호환)

- [x] **PR1 — 데이터 모델**: `V037__kb_retry_failed_status.sql`, `document.entity.ts`, DocumentResponseDto
- [x] **PR2 — Backend 코어**: `retry-with-backoff.util.ts`, LLM `timeoutMs`, EmbeddingService/GraphExtractionService 재시도, WS 신규 이벤트, 유닛 테스트
- [x] **PR3 — 회복·재시도 API**: `StuckDocumentRecoveryService` (OnApplicationBootstrap), `POST /knowledge-bases/:id/retry-failed`, `GET /knowledge-bases/:id/embedding-stats`, `getGraphStats` 확장
- [x] **PR4 — Frontend**: 타입·i18n·STATUS_CONFIG·진행 박스·`use-kb-events`
- [x] **PR5 — 문서**: PRD/Spec 5건 갱신
- [x] **Review 후속 조치**: V037 NOT VALID + V038 partial index, retry jitter / 이중 retry 방지 / willRetry / KB 객체 전달 / error_message cap / Stuck UPDATE...RETURNING + addBulk / RetryFailedBodyDto + chunking + rollback / tooltip / 신규 테스트 / WS 의미 spec 보강

## 핵심 결정사항

- timeout: 임베딩 60s / 그래프 청크 90s
- 재시도 대상: timeout/ECONNRESET/ETIMEDOUT/EAI_AGAIN/socket hang up/429/5xx (비대상: 4xx 4·차원 mismatch·JSON parse)
- 문서 단위 재시도 (청크 단위는 후속 PR)
- 2번째 attempt 부터 `reEmbed=true` 강제 — chunk 깨끗 재시작
- Stuck threshold: 10분 (BullMQ stalledInterval 30s × 2 + 부팅 지연 + 마진)
- `last_attempted_at` (자연어 영문법) — `updated_at`·`created_at` 컨벤션 정렬
- `error → failed` 일괄 마이그레이션 UPDATE 포함 (의미 일관성)
- `LLMClient.chat/embed` 시그니처에 signal 전파는 후속 PR — 1차는 withTimeout race 만

## 영향받는 파일 (요약)

신규
- `backend/migrations/V037__kb_retry_failed_status.sql`
- `backend/src/modules/knowledge-base/utils/retry-with-backoff.util.ts` (+`.spec.ts`)
- `backend/src/modules/knowledge-base/queues/stuck-document-recovery.service.ts` (+`.spec.ts`)
- `frontend/src/lib/websocket/use-kb-events.ts`
- `frontend/src/components/knowledge-base/embedding-progress-box.tsx`

수정 (라인·함수 단위는 원본 plan 참조)
- backend: `document.entity.ts`, `embedding.service.ts`, `graph-extraction.service.ts`, `llm.service.ts`, `knowledge-base.service.ts`, `knowledge-base.controller.ts`, `knowledge-base.module.ts`, `knowledge-base-response.dto.ts`, `websocket.service.ts`
- frontend: `[id]/page.tsx`, `api/knowledge-bases.ts`, `i18n/dict/ko.ts` `en.ts`
- docs: `prd/9-graph-rag.md`, `spec/5-system/8-embedding-pipeline.md`, `spec/5-system/10-graph-rag.md`, `spec/2-navigation/5-knowledge-base.md`, `spec/1-data-model.md`

## 검증 시나리오

1. 임베딩 timeout 시뮬레이션 → 1s/4s/16s 백오프 3회 후 `failed`
2. 첫 시도 timeout 후 두 번째 성공 → `completed`, retry_count=0
3. 백엔드 kill -9 후 재기동 → 10분 전 `processing` 문서 자동 회수
4. UI `[실패 문서 재시도]` 버튼 → failed 문서 재큐잉
5. `failed` 만 남은 KB → `reextract_status='idle'` 자동 회수
6. WS 단절 시 5s polling fallback

## 후속 (이 plan 범위 밖)

- 청크 단위 retry 정밀화 (LLM 비용 최소화)
- LLMClient 인터페이스에 AbortSignal 전파
- env 외부화 (timeout/stuck threshold)
- `metadata.error` JSONB 백워드 호환 코드 정리 (6개월 후)
