# Side Effect Review — AiTurnExecutor 추출 (M-1 3단계)

## 발견사항

### [INFO] `state` 객체 직접 돌연변이 (`delete state.pendingFormToolCall`)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/m1-step3-ai-turn-executor/codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` — `processMultiTurnMessage`, 2241번째 줄, 2266번째 줄
- 상세: `delete state.pendingFormToolCall`로 호출자에게서 받은 `state` 객체를 직접 변경한다. `state`는 caller(엔진)가 DB에서 역직렬화해 전달하는 레코드이며, `delete` 연산이 원본 객체를 mutate한다. 그러나 후속 코드가 `_resumeState: { ...state, ... }` 로 spread하면서 삭제된 키를 덮어쓰지 않으므로 실질적으로는 `_resumeState`에서 `pendingFormToolCall`이 제외되는 의도된 효과를 낸다. 이 변이는 동일 함수 내에서만 가시적이고 반환 전에 완전히 새 객체로 재구성되므로 caller-측 누출 위험은 낮다. 그러나 `state`가 외부 참조를 공유하는 경우(예: 엔진이 동일 state 객체를 캐시하는 경우) 부작용이 전파될 수 있다.
- 제안: `delete state.pendingFormToolCall` 대신 지역 변수(`const nextState = { ...state }; delete nextState.pendingFormToolCall;`)를 사용하거나, `_resumeState` spread 시 `pendingFormToolCall: undefined`(또는 키 제외)로 명시하는 것이 더 방어적이다. 이전 단계(#665 `AiConditionEvaluator`, #668 `AiMemoryManager`) 선례에서는 state 직접 변이가 없었으므로 일관성 측면에서도 개선 여지가 있다.

### [INFO] `process.env.AI_RETRY_STATE_TTL_MINUTES` 읽기 — 런타임 매번 조회
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/m1-step3-ai-turn-executor/codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` — `resolveRetryStateTtlMinutes()` 함수 (615번째 줄)
- 상세: `resolveRetryStateTtlMinutes()`가 module-level 상수가 아니라 `buildRetryState` 호출 시마다 `process.env`를 읽는다. 이는 의도된 설계(핫 리로드 지원 가능)이지만, 애플리케이션 시작 이후 환경 변수를 변경하는 경우 실행 중간에 TTL이 바뀌는 부작용이 생길 수 있다. 실제 운영에서는 환경 변수를 런타임에 바꾸는 경우가 드물므로 실질 위험은 낮다. 기존 핸들러에도 동일하게 존재하던 패턴(verbatim 이동)이라 회귀는 없다.
- 제안: 모듈 로드 시점에 한 번 캐시하거나(`const RETRY_STATE_TTL_MINUTES = resolveRetryStateTtlMinutes();`) 현 패턴을 유지하되 주석으로 의도를 명시한다. 현재 주석에 이미 의도가 잘 서술되어 있다.

### [INFO] `FORM_SUBMITTED_GUIDANCE_MESSAGE` / `FORM_SUBMITTED_MAX_BYTES` 이동 및 re-export
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/m1-step3-ai-turn-executor/codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` — 21~24번째 줄
- 상세: 두 상수가 `ai-agent.handler.ts`에서 `ai-turn-executor.ts`로 이동했고, 핸들러에서 re-export한다. 기존 소비자가 `./ai-agent.handler`에서 import하면 re-export 경로로 계속 작동한다. 그러나 `ai-turn-executor.ts`를 직접 참조하는 신규 코드 또는 테스트가 있다면 `capFormDataBytes` 같은 implementation-detail 함수도 외부에 노출됨을 인지해야 한다(`export function capFormDataBytes`).
- 제안: `capFormDataBytes`는 현재 `export`로 노출되어 있으나 핸들러에서 re-export되지 않는다. 내부 유틸리티라면 `export` 제거 또는 barrel 파일에서 제외 처리를 고려할 수 있다. 기능 부작용은 없다.

### [INFO] `static readonly logger = new Logger('AiTurnExecutor')` — 클래스 정적 필드
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/m1-step3-ai-turn-executor/codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` — 3346번째 줄
- 상세: NestJS `Logger` 인스턴스를 클래스 정적 필드로 선언한다. 이는 모듈 로드 시 단일 인스턴스가 생성되어 공유되는 패턴으로, 기존 `AiAgentHandler`의 패턴과 동형이다. 전역 상태에 해당하지만 Logger는 사이드이펙트가 통제된(로그 출력 전용) 객체이므로 실질 위험은 없다.
- 제안: 현행 유지. 기존 collaborator(AiConditionEvaluator, AiMemoryManager) 선례와 일치한다.

### [INFO] `pushAiThreadTurn` / `appendPresentationInteraction` — ConversationThread 외부 상태 변경
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/m1-step3-ai-turn-executor/codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` — `pushAiThreadTurn`, `pushAiToolResultTurn`, 관련 호출부
- 상세: `conversationThreadService`를 통해 workflow-scoped 외부 상태(ConversationThread)를 변경한다. 이는 spec §2.2가 명시한 의도된 부작용이며, 미주입 시 no-op으로 degrade한다. 기존 핸들러에서 verbatim 이동된 코드이므로 동작 변화 없다.
- 제안: 현행 유지. 명세 정의 부작용이며 graceful degrade로 보호되어 있다.

### [INFO] `executeProviderToolBatch` — `Promise.all` 병렬 실행, 외부 서비스 호출
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/m1-step3-ai-turn-executor/codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` — `executeProviderToolBatch` (1278번째 줄)
- 상세: `Promise.all`로 tool provider를 병렬 호출하며 각 provider가 KB 검색, MCP 서버 호출, render tool 실행 등 외부 서비스 I/O를 수행한다. 이는 기존 핸들러에서 verbatim 이동된 코드이고, EventEmitter를 통해 WebSocket 이벤트를 emit하는 텔레메트리 부작용도 포함된다. 의도된 부작용으로 동작 변화 없다.
- 제안: 현행 유지.

### [INFO] `memoryManager.scheduleMemoryExtraction` — 비동기 enqueue 부작용
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/m1-step3-ai-turn-executor/codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` — `executeSingleTurn` 및 `processMultiTurnMessage`
- 상세: 턴 경계마다 메모리 추출 작업을 비동기 큐에 enqueue한다. hot path를 차단하지 않는 의도된 부작용(spec §6.1 단계 2.7). 기존 핸들러 verbatim 이동.
- 제안: 현행 유지.

## 요약

본 변경은 `AiAgentHandler`의 turn 실행 표면을 무상태 collaborator `AiTurnExecutor`로 추출하는 behavior-preserving 리팩터링이다. 부작용 관점에서 가장 주목할 점은 `processMultiTurnMessage`의 `delete state.pendingFormToolCall` 패턴으로, 호출자로부터 전달받은 `state` 객체를 직접 변이하는 코드이다. 다만 해당 변이는 함수 반환 전에 새 `_resumeState` 객체로 재구성되어 실제 부작용이 caller까지 전파되기 어려운 구조이며, 기존 핸들러 코드에서 verbatim 이동된 것이어서 새로운 회귀를 도입하지는 않는다. 신규로 노출된 `capFormDataBytes` 함수의 public export와 두 상수(`FORM_SUBMITTED_GUIDANCE_MESSAGE`, `FORM_SUBMITTED_MAX_BYTES`)의 re-export 패턴은 공개 API 관점에서 양호하게 처리되어 있다. 환경 변수 `AI_RETRY_STATE_TTL_MINUTES`는 기존과 동일하게 런타임 매 호출 시 조회된다. 전반적으로 의도하지 않은 새로운 부작용은 발견되지 않았으며, 지적된 항목들은 모두 기존 핸들러 코드를 verbatim으로 이동한 데 따른 것이거나 명세에 의해 정의된 의도적 부작용이다.

## 위험도

LOW
