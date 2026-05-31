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

- ✅ **WARNING #11 — 재유도 config 의 expression 재평가** (`fix(execution-engine)` 3ca67305): `applyRetryLastTurn` → `buildRetryReentryState` 가 `resolveRetryNodeConfig` 로 `node.config` 의 `{{expression}}` 을 best-effort 평가 (operational 필드 llmConfigId/maxTurns 등). raw fallback 으로 static config 회귀 없음. `rawConfig` echo 는 spec config-echo 정책상 raw 유지. **한계**: 재진입 경로는 원본 nodeInput 을 영속하지 않으므로 (`_retryState` 최소화) `$input.*` 참조는 미해소 — `$node`/`$var`/`$thread`/`$execution`/`$now` 만 해소. 단위 테스트 추가.

- ✅ **spec 텍스트 동기화 4건 (review SUMMARY #6/#7/#8/#9)** (`docs(spec)` ee999466 + `fix` 219d54fb): consistency-check 1차 BLOCK 후 project-planner 가 설계 확정·반영 — #6 `failed→running` Execution-entity 전이(§1.1/§1.2/Rationale, allowRetryReentry opt-in), #7 분류 불가 fallback 을 `LLM_CALL_FAILED` non-retryable 로 통합(§10, classifyLlmError 코드 정렬 — `AI_AGENT_TURN_FAILED` 제거), #8 cancel-during-replay→cancelled(§4.2), #9 config 재평가 정책(§7.9 + §5.5 cross-ref, rawConfig snapshot 직교성). **`/consistency-check --spec` 재검 BLOCK: NO** (`review/consistency/2026/05/30/13_34_40`, LOW). 상세: [`spec-fix-retry-state-transitions.md`](./spec-fix-retry-state-transitions.md).

- ✅ **WARNING #10 (spec 명시 — PR1, 2026-05-30)** — retry 성공 후 downstream traversal 이 일반 노드 `COMPLETED` 와 동일하게 진행됨을 spec 3 개 문서에 명시: `spec/4-nodes/3-ai/1-ai-agent.md §7.9` (재진입 종결 후 graph 진행 단락) + **신규 §12.8** (Rationale 결정 근거), `spec/5-system/6-websocket-protocol.md §4.2` (재진입 종결 후 graph 진행 bullet) + Rationale 끝 cross-ref 단락, `spec/5-system/13-replay-rerun.md §14.3` (retry 직교성 단락) + Rationale 끝 §14.3 보강 단락.

  **직전 "사용자/기획 결정 대기" 분류는 과보수적이었음** — `/consistency-check --spec` 의 rationale-continuity-checker 가 "과거 Rationale 에 downstream 차단 결정이 명시된 적 없음" 을 확인했고, spec 의 "노드 단위 재시도" 표현은 워크플로 Re-run 과의 **단위 구분 의도**였지 downstream 차단 의도가 아니었음이 project-planner 와 합의됨. retry 성공한 노드는 일반 성공 노드와 의미적으로 동일하므로 downstream traversal 은 워크플로 엔진의 **기본 invariant** 적용 (신규 정책 아님). 따라서 본 변경은 무근거 번복이 아닌 표면 명확화.

  **구현 fix 는 PR2** — `execution-engine.service.ts:3427 completeRetryExecution` 의 즉시 Execution.COMPLETED 마감을 일반 graph loop 합류 (`resumeGraphAfterRetry` 헬퍼 신설) 로 교체 (`developer` 위임). 단위·e2e 테스트 추가. 본 PR1 의 spec 변경이 merge 된 직후 착수.

  **frontmatter 정책**: PR1 시점에서 3 개 target spec 파일의 frontmatter `status` 변경 없음 — PR2 (구현 fix) merge 후 `pending_plans:` 등 `spec/conventions/spec-impl-evidence.md §2·§3` 가드 정합 정리.

  **consistency-check 결과**: `review/consistency/2026/05/30/14_48_20/SUMMARY.md` — BLOCK: NO, 위험도 LOW (Critical 0건, Warning 4건 모두 보완 반영, Info 9건).

  **PR2 진행 (2026-05-30 — branch `claude/retry-downstream-traversal-impl-875fca`, base `bc2dd281`)**:
  - `/consistency-check --impl-prep spec/5-system/` 결과: **BLOCK: NO** (`review/consistency/2026/05/30/15_10_30/SUMMARY.md`). 위험도 MEDIUM.
    - **cross-spec W1** (`completed→running` 신규 전이 우려): 본 구현 경로에선 발생 안 함 — `finalizeAiNode(COMPLETED, retryReentry: true)` 가 spawn row COMPLETED + Execution RUNNING 으로 전이한 후 `resumeGraphAfterRetry` 가 graph loop 합류 → 정상 `RUNNING → COMPLETED` 종결. `completed → running` 전이는 우리 흐름에 없음.
    - **convention HIGH** (W2~W4 / C2): 모두 본 PR2 와 무관한 다른 spec 파일 (`1-auth.md` `lower_snake_case` 에러 코드 / `11-mcp-client.md` / `12-webhook.md` frontmatter `spec-only` ↔ 실 구현 갭) 사전 결함. 별 PR 으로 분리.
    - **plan-coherence C1** (worktree 경합): spec PR1 worktree 와 impl PR2 worktree 동시 존재 — PR1 push 후 spec worktree 정리 예정.
  - **구현 방식**: in-process loop 직접 합류 — `resumeGraphAfterRetry` 헬퍼 신설, `resumeFromCheckpoint` (line 976-1337) 의 graph rebuild + traversal loop + completion 패턴을 차용하되 시작 단계 (waitForX 호출) 만 생략하고 completed node 의 outgoing edge 부터 진행. worker processor (continuation job handler) 컨텍스트 안에서 호출 — WS gateway 직접 동기 실행 경로 없음. 새 BullMQ job 발행 없음 (이미 worker context).
  - **frontmatter 정리 결정**: 본 PR2 자체에서는 3 target spec 파일 (`1-ai-agent.md` / `6-websocket-protocol.md` / `13-replay-rerun.md`) 의 frontmatter `status` / `code:` / `pending_plans:` 갱신 안 함. 각 파일이 retry 외에도 광범위한 구현 surface (AI Agent 노드 전체 / WS 프로토콜 전체 / Re-run 기능 전체) 를 가지며, 본 PR2 의 retry downstream traversal 만으로 `spec-only → partial` 승격 책임을 떠안는 건 scope creep. spec 파일별 frontmatter 정리는 별 plan 으로 분리 추적.

## 추적 항목 (SUMMARY WARNING #1~#5, #7, #8, #9) — 정리 (2026-05-30)

| # | 항목 | 상태 | 비고 |
| --- | --- | --- | --- |
| #1 | `_retryState` 소비 원자성 (spec + 구현) | ✅ | spec 정밀화 (`docs(spec)` 2fde08a0) — line 16 / 구현 atomic consume (`feat(execution-engine)` 13dde237) |
| #2 | `execution.retry_last_turn` Continuation Bus 경유 | ✅ | line 18 (`626b4250`) — WS gateway → BullMQ `execution-continuation` 큐 publish → worker handoff |
| #3 | `INVALID_EXECUTION_STATE` 사전 검증 요건 | ✅ | spec 정밀화 (`docs(spec)` 2fde08a0) — WS §4.2 에러 코드 표 등재 |
| #4 | `_retryState` 단일 소비 마킹 (jsonb key 제거) | ✅ | spec 정밀화 (`docs(spec)` 2fde08a0) + 구현 affected=1 가드 |
| #5 | TTL SoT + 환경변수 + cleanup 정책 | ✅ | spec 정밀화 (`docs(spec)` 2fde08a0) — `AI_RETRY_STATE_TTL_MINUTES` env + row 수명 종속 |
| #7 | `_retryState` 보존 백엔드 회귀 가드 | ✅ | `describe('stripControlFields _retryState preservation')` (`execution-engine.service.spec.ts` line ~8712) — `_retryState` 보존, `_resumeState` strip 검증 |
| #8 | `_retryState.expiresAt` TTL 검증 로직 백엔드 테스트 | ✅ | `describe('retryLastTurn (_retryState consume + spawn)')` (line ~7824) — TTL 미만 정상 / 초과 RETRY_STATE_NOT_FOUND / 이미 소비 RETRY_STATE_NOT_FOUND / retryAfterSec 미경과 RETRY_TOO_EARLY / NODE_NOT_RETRYABLE 모두 커버 |
| #9 | retryable 분류 HTTP status 기반 | ✅ | `fix(execution-engine)` 45ed6fb7 — `classifyLlmError` status 기반. 단위 테스트 (status 429/500/503/401/403/502/ECONNRESET/timeout) |

### WARNING #9 (신규 — 2026-05-30, ✅ 구현 완료) — multi-turn retryable 분류를 HTTP status 기반으로

**사용자 결정 (2026-05-30): 스펙이 SOT.** 단, 코드 조사 결과 **계층이 둘**임을 확인:

- **LLM client SSE 계층**: `LLM_CONNECTION_ERROR` 는 `spec/5-system/7-llm-client.md §6` (221/300행) + user-docs 가 정의한 **정식 spec 코드** — 클라이언트는 spec 준수 상태. **변경 불필요.**
- **AI Agent multi-turn `output.error` 계층** (`spec/4-nodes/3-ai/1-ai-agent.md §10`): 429 → `LLM_RATE_LIMIT`(retryable), 5xx/network/timeout → `LLM_CALL_FAILED`(retryable), 401/403 → `LLM_CALL_FAILED`(non-retryable).

멀티턴 경로는 `LlmService.chat()`(non-streaming)의 **raw provider SDK 에러(`.status`)** 를 받으므로 client 의 `LLM_CONNECTION_ERROR` SSE 코드는 도달하지 않는다. **실버그**: 기존 `extractAiTurnErrorPayload` 는 status 를 보지 않고 `message.includes('429')` 휴리스틱 + `RETRYABLE_CODES={LLM_RATE_LIMIT, LLM_CONNECTION_ERROR}`(후자는 이 경로에서 dead) 로만 분류 → **5xx / network timeout 이 `AI_AGENT_TURN_FAILED`(retryable=false) 로 떨어져 spec §10 위반** (429 만 retryable 로 표기됨).

**구현 (Stage 1)**: `execution-engine.service.ts extractAiTurnErrorPayload` 를 HTTP status 기반으로 재설계 — `extractHttpStatus()` 헬퍼(`.status`/`.statusCode`/`.response.status`) 도입, 429→LLM_RATE_LIMIT(true), 401/403→LLM_CALL_FAILED(false), 5xx/network/timeout→LLM_CALL_FAILED(true), 명시 code(LLM_RESPONSE_INVALID 등) 보존(false), 그 외 AI_AGENT_TURN_FAILED(false). `RETRYABLE_CODES` 집합 제거, retryable 을 status/조건 기반으로 도출. client 누출 대비 `LLM_CONNECTION_ERROR`/errno 는 network 로 매핑. 단위 테스트 추가(status 429/500/503/401/403/502/ECONNRESET/timeout). **client·client spec 무변경** (spec 준수 상태 유지).

## 코드 리뷰 후속 추적 (review/code/2026/05/30/11_22_49 — resolution-applier 추가, 2026-05-30)

다음 항목은 ai-review SUMMARY 의 DEFER 분류였으며 **2026-05-30 일괄 해소** (`fix(execution-engine)` 3ca67305, `docs(user-guide)` 352450a3):

- ✅ **W5** — FAILED→RUNNING 전이를 `TransitionOptions.allowRetryReentry` opt-in 으로 한정. ALLOWED_TRANSITIONS 표에서 제거하고 `canTransition(from,to,opts)` 가 opt-in 일 때만 허용. `finalizeAiNode(..., allowRetryReentry)` → `updateExecutionStatus(..., opts)` 로 전달, `applyRetryLastTurn` 만 true. state-machine 단위 테스트 3종 추가.
- ✅ **W6/W7/W13** — `applyRetryLastTurn` SRP 분해: `buildRetryReentryState`(shape 변환 + initialAction) / `completeRetryExecution`(성공 마감) / `failRetryExecution`(실패·취소 마감) 로 추출. 별도 클래스 대신 in-service helper (결합도 유지, 회귀 위험 최소).
- ✅ **W9** — cancel 신호 소실: replay turn(`pendingInitialAction`) 처리 시 cancel-only `pendingContinuations` 핸들러 등록 + `Promise.race` 로 cancel 신호와 race. cancel 이 이기면 `ExecutionCancelledError` → Execution CANCELLED. 정상 경로 무변경. 단위 테스트 추가.
- ✅ **W11** — WS ack 코드 SoT 분리: `ws-error-codes.ts` `WsErrorCode`(UNAUTHENTICATED/FORBIDDEN/NOT_FOUND/INTERNAL_ERROR). `handleRetryLastTurn` 의 리터럴 4곳 대체.
- ✅ **W12** — `extractAiTurnErrorPayload` 분리: `NETWORK_ERRNO_PATTERN`/`NETWORK_MESSAGE_PATTERN` 상수 + `classifyLlmError` private static. 기존 테스트 25종 green 유지.
- ✅ **W14** — user-guide 갱신: retry 거절 코드 3종(`RETRY_STATE_NOT_FOUND`/`NODE_NOT_RETRYABLE`/`RETRY_TOO_EARLY`)을 `05-run-and-debug/run-results` (KO/EN) 에러 코드 표(type=재시도) + "멀티턴 대화 중 오류 발생 시 재시도" 소절에 추가. user-guide-writer sub-agent 위임, 컨벤션 체크리스트 통과.
- ✅ **W15** — `backend-labels.ts` 등재: **불필요로 판단**. 해당 파일은 Zod 스키마 UI 라벨(label/hint/placeholder) 번역 테이블이고, retry 코드는 WS-ack `error.code` (폼 라벨 아님). 사용자 노출은 W14 의 user-guide 문서로 커버.

> **W1/W2 (spec gap) 해소 완료 (2026-05-30)**: WS ack `success` 필드(§4.2) + `_retryState.lastUserMessage`/`lastUserMessageSource`(node-output §4.2.1) 를 spec 에 명시 반영. (원본 escalation draft `spec-fix-retry-ws-ack-fields.md` 는 적용 후 제거.)

## PR2 ai-review 후속 plan (2026-05-30 — review/code/2026/05/30/15_43_30)

PR2 `/ai-review` SUMMARY 에서 도출된 후속 plan 항목 (자동 fix 대상 외 분리):

| # | 항목 | 상태 | 처리 |
| --- | --- | --- | --- |
| #10 | `runNodeDispatchLoop` 추출 (graph traversal loop 약 175라인 중복) | ✅ PR #371 | commit `2a85693b` — `runNodeDispatchLoop(NodeDispatchLoopParams)` 신설. `resumeFromCheckpoint` + `resumeGraphAfterRetry` 공유 |
| #11 | `loadAndBuildGraph` 추출 (graph rebuild 3중 복제) | ✅ PR #371 | commit `2a85693b` — `loadAndBuildGraph(workflowId): ExecutionGraphState` 신설. `runExecution` + `resumeFromCheckpoint` + `resumeGraphAfterRetry` 공유 |
| #14 | parallel 분기 `gatherNodeInput` 중복 호출 (2회→1회) | ✅ PR #371 | commit `2a85693b` — `nodeInput` 변수 재사용 |
| #16 | `nodeExecutionCount` 초기값 1→0 (`MAX_NODE_ITERATIONS=1` 방어) | ✅ PR #371 | commit `2a85693b` 행동 변경 + commit `3fde6b81` 경계 테스트 신규 추가 |
| #13 | `rehydrateContext` + `resumeGraphAfterRetry` 이중 DB 조회 진정한 제거 | ❌ skip — 갭 없음 | 아래 §"PR #371 ai-review 남은 후속" 에서 재검토 결과 false positive 로 확정: `rehydrateContext` (workflow/log/node_execution) vs `loadAndBuildGraph` (node/edge) 가 직교 영역. 추가 fix 가치 없음 |

**네이밍 결정 근거** (consistency-check `review/consistency/2026/05/30/16_54_36` W7/W8):
- `runGraphTraversalLoop` → `runNodeDispatchLoop` — 기존 `GraphTraversalService` (pure reachability) 와 도메인 책임 분리. 본 helper 는 dispatch + blocking wait + 외부 service 호출.
- `GraphState` → `ExecutionGraphState` — execution-engine 도메인 귀속 (knowledge-base `GraphTraversalSummary` 와 의미 분리).

### PR #371 ai-review 남은 후속 (`review/code/2026/05/30/17_21_35`)

> **잔여 상태 동기화 (2026-05-31)**: 아래 표의 W4 buttons/ai_conversation 이 PR #382 (`a60925e8`) 로 완료됐으나 표기가 stale 했던 것을 정정. #13 은 skip 확정. **이 plan 에 남은 진짜 미해결 항목은 2건뿐**: ① W5/I2 (back-edge→waiting node 이중 실행 spec 검토 — project-planner), ② PR3 (HTTP retry e2e — LLM mock 인프라 별 PR). 둘 다 핵심 회귀 가드는 unit 7+ 로 이미 커버되어 차단성 아님.

| 항목 | 상태 | 비고 |
| --- | --- | --- |
| WARNING #13 (이중 DB 조회 진정한 제거) | ❌ skip — **갭 없음** | `rehydrateContext` (workflow/log/node_execution) vs `loadAndBuildGraph` (node/edge) 가 직교 영역. PR #371 ai-review 의 분석이 false positive. 추가 fix 가치 없음 (1 query 절약 가능한 `applyRetryLastTurn:3253` `nodeRepository.findOneBy` 정도) |
| W2 (resume 경로 parallel/background dispatch 테스트) | ✅ PR #378 | commit `8ef5c29c` — 2 시나리오 추가 |
| W4 downstream blocking — form | ✅ PR #379 | commit `ce44acd9` — 1 시나리오 추가. helper 의 `downstreamMetadata` 일반화 동반 |
| W4 downstream blocking — buttons | ✅ PR #382 | commit `a60925e8` — `waitForButtonInteraction` private method spy 패턴으로 분기 도달 회귀 가드 (spec line ~9213). flat/structured 양쪽 캐시는 `mockOutput` 1차 arg `interactionType` + 2차 arg `meta.interactionType` 로 동시 충족 |
| W4 downstream blocking — ai_conversation | ✅ PR #382 | commit `a60925e8` — `waitForAiConversation` spy 패턴으로 분기 도달 회귀 가드 (spec line ~9279). aiHandler 에 `processMultiTurnMessage`/`endMultiTurnConversation` 스텁 추가 |
| W5/I2 (back-edge waiting node 이중 실행 가능성 spec 검토) | ✅ (2026-05-31) | 분석 결과 **버그 아닌 의도된 loop semantics** — graph-level back-edge 순환은 (container body 와 달리) blocking 노드를 합법적으로 포함/타겟할 수 있고, 매 iteration 재프롬프트는 정상. retry 재진입도 동일 귀결. `spec/5-system/4-execution-engine.md §2.1` 에 "graph-level 순환 내 blocking 노드" 절 명문화. `/consistency-check --spec` BLOCK: NO (`review/consistency/2026/05/31/18_06_40`, LOW) |
| PR3 — AI Agent → HTTP retry e2e 시나리오 | 🔲 후속 PR | LLM mock 인프라 (LlmService.chat 429 시뮬레이션) + WS 클라이언트 명령 시뮬레이션이 별 PR scope. 본 PR (#365/#371/#378/#379) 의 unit 7+ 회귀 가드가 핵심 케이스 모두 커버 |

## 의존 관계

WARNING #1~#5, #9 는 `project-planner` 에서 spec 확인 후 → 개발자가 구현·테스트 (#9 는 spec 무변경 — 코드만 spec 에 정렬).
WARNING #7, #8 는 Phase D 구현 완료 후 테스트 작성.

## 참고 커밋

- `d109dbd3` — docs(spec): multi-turn AI 에러 시 대화 보존 + retryable 분기 + retry_last_turn (follow-up 명시)
- `de73e3ab` — feat(backend/engine): extractAiTurnErrorPayload — details.retryable 자동 분류 (Phase C-min)
- `4d2b1a3b` — fix(retry): resolution-applier 코드 픽스 (W3/INFO4/W18/S1/S2/W8/W4/INFO1/INFO3/W16/W17)
