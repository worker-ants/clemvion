---
worktree: multiturn-error-preserve
started: 2026-05-23
owner: project-planner
---

# Plan — retry_last_turn 백엔드 핸들러 follow-up (Phase D)

> 본 plan 은 `d109dbd3` commit body 에 명시된 follow-up PR 스코프 — WS `execution.retry_last_turn` 서버 핸들러 / `_retryState` DB 영속 정책 정밀화 / 새 NodeExecution spawn.

이 plan 은 코드 리뷰 (review/code/2026/05/23/18_30_48/SUMMARY.md) 의 다음 항목을 추적한다:

## 진행 상태 (2026-05-30)

- ✅ **WARNING #9 (retryable 분류)**: HTTP status 기반 재설계 완료 (`fix(execution-engine)` 45ed6fb7).
- ✅ **spec 정밀화 (#1·#3·#4·#5)**: INVALID_EXECUTION_STATE 코드 / 소비 원자성(트랜잭션 + jsonb key 제거 affected=1) / TTL env / continuation 정책 spec 반영 (`docs(spec)` 2fde08a0 + 정정).
- ✅ **Phase D 기반 구현** (`feat(execution-engine)` 13dde237): `_retryState` 영속(기존 미구현이었음 — handler/adapter/finalize/strip 전수), error code 3종, `RetryLastTurnError`, 엔진 `retryLastTurn()` 의 검증·atomic consume·새 row spawn. 단위 테스트 348 통과, build 통과.
- ✅ **multi-turn loop 재진입 + WS wiring (#2 = 경유 확정, 626b4250)**: continuation bus `retry_last_turn` job type + processor case, WS gateway `execution.retry_last_turn` 핸들러(검증→consume→spawn→publish→ack), worker `applyRetryLastTurn`(ExecutionContext rehydrate → `_retryState`→`_resumeState`(credential 재유도) → 실패 last user message replay 로 turn 재실행 → loop 구동 → finalize), state-machine FAILED→RUNNING. TEST WORKFLOW 전부 통과 (lint/build/e2e 127 / backend unit 5176; 재진입 408 신규).

- 🔲 **남은 한계 (신규 followup 항목)**:
  - **WARNING #10 — 성공 retry 후 downstream 그래프 traversal**: retry 로 대화는 재개되나, AI 노드의 출력 포트에 연결된 하류 노드는 미실행 (성공 종결 시 Execution 을 COMPLETED 로만 마감). 대부분 multi-turn AI 가 terminal 이라 영향 제한적이나, AI 노드 하류가 있는 워크플로는 `resumeFromCheckpoint` 의 reachability/back-edge traversal 을 retry 종결 후에도 돌려야 한다.
  - **WARNING #11 — 재유도 config 의 expression 미평가**: `applyRetryLastTurn` 이 재유도하는 `node.config` 필드(llmConfigId/maxTurns 등)가 `{{expression}}` 이면 재진입 시 미평가. static config 는 정상. 필요 시 재진입 경로에서 expression resolve 추가.

## 추적 항목 (SUMMARY WARNING #1~#5, #7, #8, #9)

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

### WARNING #9 (신규 — 2026-05-30, ✅ 구현 완료) — multi-turn retryable 분류를 HTTP status 기반으로

**사용자 결정 (2026-05-30): 스펙이 SOT.** 단, 코드 조사 결과 **계층이 둘**임을 확인:

- **LLM client SSE 계층**: `LLM_CONNECTION_ERROR` 는 `spec/5-system/7-llm-client.md §6` (221/300행) + user-docs 가 정의한 **정식 spec 코드** — 클라이언트는 spec 준수 상태. **변경 불필요.**
- **AI Agent multi-turn `output.error` 계층** (`spec/4-nodes/3-ai/1-ai-agent.md §10`): 429 → `LLM_RATE_LIMIT`(retryable), 5xx/network/timeout → `LLM_CALL_FAILED`(retryable), 401/403 → `LLM_CALL_FAILED`(non-retryable).

멀티턴 경로는 `LlmService.chat()`(non-streaming)의 **raw provider SDK 에러(`.status`)** 를 받으므로 client 의 `LLM_CONNECTION_ERROR` SSE 코드는 도달하지 않는다. **실버그**: 기존 `extractAiTurnErrorPayload` 는 status 를 보지 않고 `message.includes('429')` 휴리스틱 + `RETRYABLE_CODES={LLM_RATE_LIMIT, LLM_CONNECTION_ERROR}`(후자는 이 경로에서 dead) 로만 분류 → **5xx / network timeout 이 `AI_AGENT_TURN_FAILED`(retryable=false) 로 떨어져 spec §10 위반** (429 만 retryable 로 표기됨).

**구현 (Stage 1)**: `execution-engine.service.ts extractAiTurnErrorPayload` 를 HTTP status 기반으로 재설계 — `extractHttpStatus()` 헬퍼(`.status`/`.statusCode`/`.response.status`) 도입, 429→LLM_RATE_LIMIT(true), 401/403→LLM_CALL_FAILED(false), 5xx/network/timeout→LLM_CALL_FAILED(true), 명시 code(LLM_RESPONSE_INVALID 등) 보존(false), 그 외 AI_AGENT_TURN_FAILED(false). `RETRYABLE_CODES` 집합 제거, retryable 을 status/조건 기반으로 도출. client 누출 대비 `LLM_CONNECTION_ERROR`/errno 는 network 로 매핑. 단위 테스트 추가(status 429/500/503/401/403/502/ECONNRESET/timeout). **client·client spec 무변경** (spec 준수 상태 유지).

## 의존 관계

WARNING #1~#5, #9 는 `project-planner` 에서 spec 확인 후 → 개발자가 구현·테스트 (#9 는 spec 무변경 — 코드만 spec 에 정렬).
WARNING #7, #8 는 Phase D 구현 완료 후 테스트 작성.

## 참고 커밋

- `d109dbd3` — docs(spec): multi-turn AI 에러 시 대화 보존 + retryable 분기 + retry_last_turn (follow-up 명시)
- `de73e3ab` — feat(backend/engine): extractAiTurnErrorPayload — details.retryable 자동 분류 (Phase C-min)
