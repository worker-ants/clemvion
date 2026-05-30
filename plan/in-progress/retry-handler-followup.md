---
worktree: multiturn-error-preserve
started: 2026-05-23
owner: project-planner
---

# Plan — retry_last_turn 백엔드 핸들러 follow-up (Phase D)

> 본 plan 은 `d109dbd3` commit body 에 명시된 follow-up PR 스코프 — WS `execution.retry_last_turn` 서버 핸들러 / `_retryState` DB 영속 정책 정밀화 / 새 NodeExecution spawn.

이 plan 은 코드 리뷰 (review/code/2026/05/23/18_30_48/SUMMARY.md) 의 다음 항목을 추적한다:

## 추적 항목 (SUMMARY WARNING #1~#5, #7, #8)

### WARNING #1 — `_retryState` 소비 원자성 (spec + 구현)

`_retryState` 소비 4단계(lookup → expiresAt 검증 → 신규 NodeExecution spawn → 무효화)가 단일 트랜잭션으로 묶여야 한다는 명시 없음. 동시 retry 시 중복 NodeExecution row 생성 race condition 가능.

**제안**: `SELECT FOR UPDATE` 또는 `UPDATE ... WHERE consumed_at IS NULL RETURNING *` 패턴을 spec에 단일 트랜잭션 의무 요건으로 추가. `project-planner` 에서 `spec/5-system/4-execution-engine.md` 보존 예외 섹션과 `spec/5-system/6-websocket-protocol.md` §4.2 에 명시.

### WARNING #2 — `execution.retry_last_turn` Continuation Bus 경유 여부

`execution.retry_last_turn`이 Continuation Bus 경유 여부가 미명시. 기존 명령들의 레이어 분리 패턴(WS 게이트웨이 사전 검증 → 엔진 실행)이 이 명령에도 적용되는지 불명확.

> **(2026-05-24 갱신)** Continuation Bus 의 표면이 옛 Redis pub/sub 채널 `execution:continuation` 에서 BullMQ 영속 큐 `execution-continuation` 으로 교체됨 — [`workflow-resumable-execution.md`](./workflow-resumable-execution.md) Phase 0 spec 갱신 결과. 본 WARNING #2 의 spec 작성은 BullMQ `execution-continuation` 큐 기준으로 작성해야 한다. 또한 `execution.retry_last_turn` 은 새 NodeExecution row spawn 경로이며 rehydration 경로 (`RESUME_*` 에러 코드) 와는 별개 — [`spec/5-system/4-execution-engine.md §7.5`](../../spec/5-system/4-execution-engine.md#75-resume-after-restart-rehydration) 의 적용 대상이 아님을 §4.2 작성 시 명시.

**제안**: Continuation 큐 경유 여부와 `FAILED` 상태 검증 주체(게이트웨이 vs 엔진)를 `spec/5-system/6-websocket-protocol.md` §4.2 에 명시. `project-planner` 위임. 본 작업은 [`workflow-resumable-execution.md`](./workflow-resumable-execution.md) 의 Phase 0 spec 반영 이후 착수.

### WARNING #3 — `INVALID_EXECUTION_STATE` 사전 검증 요건

`execution.retry_last_turn` 처리 시 Execution 이 `failed` 상태임을 사전 검증해야 한다는 요건 미명시.

**제안**: 에러 코드 표에 `INVALID_EXECUTION_STATE`(또는 `EXECUTION_NOT_FAILED`) 추가 또는 소비 설명에 문구 명시. `project-planner` 위임.

### WARNING #4 — `_retryState` 단일 소비 마킹 방법 정의

`_retryState` 단일 소비 마킹 방법(DB row에서 키 삭제 vs consumed 플래그 vs null-set) 미정의.

**제안**: `_retryState` 소비 시 `NodeExecution.outputData`에서 해당 키를 null-set하거나 제거하는 정책을 spec에 명시. `project-planner` 위임.

### WARNING #5 — `_retryState.expiresAt` TTL SoT 및 cleanup 정책

`_retryState.expiresAt` TTL 기본값(60분)의 단일 진실 위치 미지정. 환경변수 오버라이드 가능 여부 불명확. 만료 row의 DB cleanup 주체·시점 미정의.

**제안**: TTL 기본값과 환경변수 키를 `spec/5-system/4-execution-engine.md` §8 또는 §7에 단일 진실로 명시. cleanup 정책 별도 추가. `project-planner` 위임.

### WARNING #7 — `_retryState` 보존 동작 백엔드 단위 테스트

`_retryState` 보존 동작 백엔드 단위 테스트 부재. `stripControlFields()`가 `_retryState`를 downstream에서 제거하지 않는지, DB에 실제 보존되는지 검증 없음.

**작업**: (a) `_retryState` downstream 보존 검증, (b) retryable error 종결 시 `outputData._retryState` 저장 회귀 가드 추가. `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` 에 추가.

### WARNING #8 — `_retryState.expiresAt` TTL 검증 로직 백엔드 테스트

`_retryState.expiresAt` TTL 검증 로직 백엔드 테스트 전무. WS 명령 서버 측 처리 경로 테스트 없음.

**작업**: (a) TTL 미만 → 정상 spawn, (b) TTL 초과 → `RETRY_STATE_NOT_FOUND`, (c) 이미 소비 → `RETRY_STATE_NOT_FOUND`, (d) `retryAfterSec` 미경과 → `RETRY_TOO_EARLY` 케이스 추가. 백엔드 WS 게이트웨이 / execution-engine 서비스 spec 파일에 추가.

### WARNING #9 (신규 — 2026-05-30) — `LLM_CONNECTION_ERROR` 비-spec 코드 + auth retryable 오분류

**사용자 결정 (2026-05-30): 스펙이 SOT.** spec 에는 `LLM_CONNECTION_ERROR` 코드가 없다 — 에러 코드 SoT 는 `spec/4-nodes/3-ai/1-ai-agent.md §10` (5xx/timeout → `LLM_CALL_FAILED` retryable=true, 401/403 auth → `LLM_CALL_FAILED` retryable=false, 429 → `LLM_RATE_LIMIT`) + `spec/5-system/3-error-handling.md`. 따라서 **코드를 spec 에 맞춘다**.

현행 코드의 2중 문제:

1. **비-spec 코드명**: LLM 클라이언트 3종(`anthropic.client.ts:262,338`, `openai.client.ts:388`, `google.client.ts:68`)이 429 외 모든 stream 오류를 `LLM_CONNECTION_ERROR` 로 emit. 이 코드는 `error-codes.ts` enum 에도, spec 에도 없음 → spec 의 `LLM_CALL_FAILED` 로 정렬해야 함.
2. **auth retryable 오분류 (실버그)**: 클라이언트가 401/403 도 5xx/network 와 동일하게 `LLM_CONNECTION_ERROR` 로 묶고, `execution-engine.service.ts:3824` `RETRYABLE_CODES = {LLM_RATE_LIMIT, LLM_CONNECTION_ERROR}` 가 그걸 retryable=true 로 분류 → **auth 실패가 재시도 가능으로 잘못 표기됨** (spec §10 은 false). 현재는 retry_last_turn 백엔드 핸들러(Phase D)가 없어 사용자 영향은 없으나, Phase D 착수 시 반드시 동반 수정.

**작업**:
- (impl) 클라이언트가 HTTP status 를 구분: 429 → `LLM_RATE_LIMIT`, 401/403 → `LLM_CALL_FAILED`(non-retryable), 5xx/network/timeout → `LLM_CALL_FAILED`(retryable). `LLM_CONNECTION_ERROR` 식별자 제거.
- (impl) `LLM_CALL_FAILED` 한 코드 안에서 auth vs 5xx 를 구분해야 하므로, retryable 판정을 **코드 문자열 기반(`RETRYABLE_CODES`)이 아니라 HTTP status / 명시적 retryable 신호 기반**으로 변경. `extractAiTurnErrorPayload` 의 `RETRYABLE_CODES` 휴리스틱 재설계.
- (test) auth(401/403) → retryable=false, 5xx/timeout → true, 429 → true 백엔드 단위 테스트.
- (주의) `execution-engine.service.ts:3748-3825` 의 주석·`anthropic.client.ts` 등의 `LLM_CONNECTION_ERROR` 리터럴 전수 정리.

## 의존 관계

WARNING #1~#5, #9 는 `project-planner` 에서 spec 확인 후 → 개발자가 구현·테스트 (#9 는 spec 무변경 — 코드만 spec 에 정렬).
WARNING #7, #8 는 Phase D 구현 완료 후 테스트 작성.

## 참고 커밋

- `d109dbd3` — docs(spec): multi-turn AI 에러 시 대화 보존 + retryable 분기 + retry_last_turn (follow-up 명시)
- `de73e3ab` — feat(backend/engine): extractAiTurnErrorPayload — details.retryable 자동 분류 (Phase C-min)
