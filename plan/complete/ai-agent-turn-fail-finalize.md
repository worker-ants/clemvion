---
worktree: ai-agent-turn-fail-finalize-a22724
started: 2026-05-19
owner: developer
---

# AI Agent multi-turn turn 실패 finalize 누락 픽스

## 배경 / 증상

운영에서 LLM 429 (Anthropic / Google / OpenAI rate limit) 가 발생했을 때, AI Agent 노드가 사용자 입력을 받은 시점 (multi-turn resume) 의 LLM chat 호출이 retry 3회 후 throw 됨에도 불구하고 다음 상태가 영구 잔존하는 회귀가 관찰됨:

- `Execution.status = FAILED` (top-level catch 가 처리)
- `NodeExecution.status = WAITING_FOR_INPUT` (이전 turn 의 emit 단계에서 저장된 그대로)
- `finalizeAiNode` 호출 누락 → `execution.node.completed` / `execution.node.failed` 이벤트 emit 누락
- frontend: 헤더는 "실패" 이지만 노드는 "Waiting" + 토큰 0 / 도구 0 (turn 1 `_resumeState` 초기값)

`spec/4-nodes/3-ai/1-ai-agent.md §7.9` 가 **이미** multi-turn 의 LLM 오류 종결 (`port: "error", status: "ended", output.error.{code, message, details}`) 을 명시하고 있으나, `execution-engine.service.ts` 의 multi-turn resume 경로 (`waitForAiConversation` → `handleAiMessageTurn`) 에 turn 내부 throw 를 catch 하는 분기가 없어 spec 을 위반하는 상태.

## consistency-check 결과 (impl-prep, 2026-05-19 11:15)

`review/consistency/2026/05/19/11_15_07/SUMMARY.md` — BLOCK: NO. Critical 없음. WARNING 3건은 모두 구현 결정으로 흡수.

### 채택 결정 (WARNING / INFO 해소)

1. **`buildMultiTurnFinalOutput` 시그니처 확장 (WARNING 1·3)** — 신규 메서드 `buildMultiTurnErrorOutput` 도입 없이, 기존 `buildMultiTurnFinalOutput` 에 optional `errorPayload?: { code: string; message: string; details?: unknown }` 파라미터 추가. `endReason='error'` 시 errorPayload 가 동봉되면 `output.error` 도 함께 set 한다. `output.result.*` (부분 messages / turnCount / endReason) 는 그대로 유지해 spec §7.9 의 "부분 결과 + output.error 병존" 요건을 단일 빌더로 충족. 두 빌더 drift 위험을 차단.
2. **`finalizeAiNode` 확장 파라미터 (WARNING 2)** — `endedWithError: boolean` 대신 `finalStatus: 'COMPLETED' | 'FAILED'` 인자를 추가. DB `NodeExecutionStatus` enum 과 1:1 대응되어 어휘 모호성 제거.
3. **WS 이벤트 단발사 (INFO 7)** — error 종결 시 `execution.node.failed` 단일 이벤트만 발사. `execution.ai_message` 양발사 안 함 (spec §4.4 의 `ai_message` 정의는 "AI 응답 메시지 전달" 로 정상 응답 전용). Execution 전체 실패 이벤트(`execution.failed`) 는 기존 top-level catch 또는 `updateExecutionStatus(failed)` 가 담당.
4. **`handleAiTurnError` async (INFO 6)** — `async handleAiTurnError(...)`. catch 블록은 `await this.handleAiTurnError(...)`.
5. **`output.error.code` UPPER_SNAKE_CASE (INFO 8)** — LLM client (anthropic/openai/google) 이 이미 `LLM_RATE_LIMIT` / `LLM_CONNECTION_ERROR` / `LLM_API_ERROR` 를 정의. catch 시 throw 된 Error 의 `code` 필드 (또는 message includes '429' 시 'LLM_RATE_LIMIT') 를 추출해 그대로 전달. sanitize 는 `output.error.message` 와 `details` 에 한정.
6. **`Execution.error` 복사 (INFO 2)** — `finalizeAiNode` FAILED 분기는 기존 `updateExecutionStatus(failed, nodeExec)` 경로를 그대로 통과. 별도 복사 로직 추가 없음.
7. **ConversationThread 직접 mutate 금지 (INFO 4)** — `handleAiTurnError` 는 thread 에 어떤 turn 도 append 하지 않음. 이전 turn 에서 push 된 `ai_user` turn 은 보존.
8. **continuation bus 미경유 (INFO 3)** — 오류 finalize 는 엔진 내부 동기 경로. `ai_end_conversation` bus 메시지 발행 안 함.
9. **`buildMultiTurnFinalOutput` 출력의 `endReason` 필드 (INFO 1)** — `output.result.endReason` 는 기존 위치 유지. `output.error` 존재 여부로 정상/오류 판별이므로 `endReason='error'` 자체는 부수 진단 정보.

### 후속 (별개 PR — 본 plan 범위 외)

- [x] `spec/5-system/4-execution-engine.md §1.2` 상태머신 다이어그램에 `waiting_for_input → failed` 전이 명시 (project-planner 위임). → PR #216 (commit `c3d8e6fd`) 로 완료.
- [ ] single-turn (spec §7.3) 의 LLM 에러 라우팅은 `node-output-redesign` P0 잔여 범위로 별도 PR. (본 plan 범위 외 — `plan/in-progress/node-output-redesign/ai-agent.md` §10 P0 #208 의 single-turn 부분으로 잔존.)
- [x] 본 plan 완료 후 `plan/in-progress/node-output-redesign/ai-agent.md` 의 multi-turn CRITICAL 체크박스 `[x]` 갱신 (별도 chore commit). → 본 plan 종료와 함께 처리 (208번 항목에 multi-turn 부분 완료 인라인 노트 추가).

## 변경 범위

### 1) `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`

- [x] `handleAiMessageTurn` 의 `handler.processMultiTurnMessage(...)` 호출을 try/catch 로 감싼다.
  - catch 시 `await this.handleAiTurnError(...)` 호출.
  - 반환: `{ resumeState, ended: true, finalStatus: 'FAILED' }` → conversation loop 자연 종료.
- [x] 신규 `private async handleAiTurnError(executionId, node, resumeState, nodeExec, err)`:
  - sanitized `errorPayload` 생성 → `handler.endMultiTurnConversation(state, 'error', errorPayload)` 호출.
  - cache / DB outputData 갱신 (`setStructuredOutput` / `setNodeOutput` + NodeExecution.outputData).
- [x] catch 처리 위치는 `handleAiMessageTurn` 내부 try/catch (engine 의 다른 turn handler 와 일관). conversation loop 는 try/catch 없이 유지.
- [x] `finalizeAiNode` 시그니처에 `finalStatus: 'COMPLETED' | 'FAILED' = 'COMPLETED'` 추가. FAILED 시:
  - `nodeExec.status = NodeExecutionStatus.FAILED` save
  - `NODE_FAILED` emit 후 sentinel throw → Execution.status 전이 + `EXECUTION_FAILED` 발사는 `runExecution` top-level catch 가 단일 진입점으로 담당.
- [x] handleAiMessageTurn 의 반환에 `finalStatus: 'COMPLETED' | 'FAILED'` 신호 추가 → conversation loop 종료 후 `finalizeAiNode(.., finalStatus)` 가 정확한 분기로 호출.

(구현 commit: `50b3f83b` + ai-review 후속 `82383739`, PR #209.)

### 2) `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts`

- [x] `endMultiTurnConversation` 시그니처 확장 — `errorPayload?: { code, message, details? }` optional 인자 추가, `buildMultiTurnFinalOutput` 으로 전달.
- [x] `buildMultiTurnFinalOutput` 시그니처 확장 — 마지막 인자로 `errorPayload?: { code, message, details? }`. `errorPayload` set 시 `output.error = errorPayload` 도 함께 emit, `output.result.*` 부분 결과 유지, `port='error'`·`status='ended'`.
- [x] `output.error.message` / `output.error.details` 에 sanitize 적용 (engine 측 `extractAiTurnErrorPayload` 에서 sanitize 수행 — token/secret echo 차단).
- [x] `meta.lastError` 는 신설하지 않음 (spec §7.9 가 `output.error` 만 명시).

(구현 commit: `50b3f83b`.)

### 3) 테스트

- [x] `ai-agent.handler.spec.ts` — `endMultiTurnConversation(state, 'error', errorPayload)` 검증:
  - `output.error.code === 'LLM_RATE_LIMIT'`, sanitize 된 `message`
  - `output.result.endReason === 'error'`
  - `output.result.messages` / `output.result.turnCount` 부분 결과 보존
  - `port === 'error'`, `status === 'ended'`
- [x] `execution-engine.service.spec.ts` — `handleAiMessageTurn` handler throw 시:
  - `handleAiTurnError` 호출 (spy)
  - `eventEmitter.emitExecution` 가 `NODE_FAILED` 1회 발사 (`AI_MESSAGE` 발사 안 함)
  - 반환 `{ resumeState, ended: true, finalStatus: 'FAILED' }`
  - conversation loop 가 다음 turn 진입 안 함
- [x] `execution-engine.service.spec.ts` — `finalizeAiNode(.., 'FAILED')`:
  - `NodeExecution.status === FAILED` save
  - sentinel throw 후 `runExecution` top-level catch 가 `Execution.status === FAILED` 로 전이
  - 정상 분기 (`finalStatus = 'COMPLETED'`) 회귀 미발생 확인

(구현 commit: `50b3f83b` + `82383739`.)

## 미해결 결정사항

없음. 모든 결정이 위 "채택 결정" 절에 기록됨.

## 완료 (2026-05-21)

본 plan 의 모든 본문 항목 + 후속 §1 항목 완료. 후속 §2 (single-turn LLM 에러 라우팅) 는 본 plan 범위 외로 `node-output-redesign/ai-agent.md` §10 P0 #208 에 잔존.

- PR #209 (`50b3f83b`): 본 plan §1/§2/§3 일괄 반영.
- ai-review 후속 (`82383739`): `82383739` 가 본 plan §1 후속 코드 정리.
- PR #216 (`c3d8e6fd`): 후속 §1 — spec §1.2 상태머신 `waiting_for_input → failed` 전이 명시.
