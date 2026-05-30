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

### WARNING #10/#11 — graph traversal loop + graph rebuild 공통 helper 추출

`resumeGraphAfterRetry` 와 `resumeFromCheckpoint` 의 traversal loop (약 160줄) 및
graph rebuild 로직 (약 30줄) 이 사실상 중복된다. `runExecution` 까지 포함하면
graph rebuild 가 3중 복제 상태다. 이 중복은 버그 fix 나 dispatch kind 추가 시
세 곳을 동기화해야 하는 위험을 만든다.

**제안 헬퍼**:
- `private async loadAndBuildGraph(workflowId: string)` — nodes/edges 로드 +
  buildGraph/topologicalSort/buildEdgeIndexes 를 통합. `runExecution`,
  `resumeFromCheckpoint`, `resumeGraphAfterRetry` 가 공유.
- `private async runGraphTraversalLoop(params: { ... })` — traversal while 루프
  전체를 추출. `resumeFromCheckpoint` 와 `resumeGraphAfterRetry` 가 공유.
  파라미터: `startPointer`, `mode('checkpoint'|'retry')`, 기타 traversal 상태.

**우선순위**: 중간 (즉각 버그 아님, 추적된 기술 부채).
**선행 조건**: `resumeFromCheckpoint` 의 재시작 waitForX 단계와 인터페이스 설계 필요.

### WARNING #16 — back-edge MAX_NODE_ITERATIONS=1 엣지 케이스

`nodeExecutionCount.set(completedNode.id, 1)` 초기화 후 back-edge loop 재진입으로
`completedNode` 가 traversal 에서 재방문될 경우 count 가 1+1=2 가 되어
`MAX_NODE_ITERATIONS=1` 설정 환경에서 오작동 가능. 운영 환경 기본값(100)에서는
발생하지 않으나, 초기값을 0으로 두는 방어 코딩을 고려한다.
`resumeFromCheckpoint` 의 동일 패턴과 비교 후 통일된 처리로 수정.

**우선순위**: 낮음 (가설적 케이스, 운영 발생 가능성 낮음).

### WARNING #13/#14 — 성능 최적화 (helper 추출 시 동시 해소)

- `rehydrateContext` + `resumeGraphAfterRetry` 이중 DB 조회 제거: context 에
  nodes/edges 캐시 또는 인자로 전달.
- `parallel` 분기 `gatherNodeInput` 중복 호출 제거: 이미 구한 `nodeInput` 재사용.

**우선순위**: 낮음 (대형 워크플로 tail latency 영향). 공통 helper 추출 시 동시 해소.

## 의존 관계

WARNING #1~#5, #9 는 `project-planner` 에서 spec 확인 후 → 개발자가 구현·테스트 (#9 는 spec 무변경 — 코드만 spec 에 정렬).
WARNING #7, #8 는 Phase D 구현 완료 후 테스트 작성.

## 참고 커밋

- `d109dbd3` — docs(spec): multi-turn AI 에러 시 대화 보존 + retryable 분기 + retry_last_turn (follow-up 명시)
- `de73e3ab` — feat(backend/engine): extractAiTurnErrorPayload — details.retryable 자동 분류 (Phase C-min)
- `4d2b1a3b` — fix(retry): resolution-applier 코드 픽스 (W3/INFO4/W18/S1/S2/W8/W4/INFO1/INFO3/W16/W17)
