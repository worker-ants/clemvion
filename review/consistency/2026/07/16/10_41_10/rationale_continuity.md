# Rationale 연속성 검토 — spec/4-nodes/3-ai/ (--impl-prep)

> 검토 대상: 현재 워크트리의 uncommitted diff (주로 `spec/4-nodes/3-ai/1-ai-agent.md` §12.16 신설 + `spec/conventions/node-cancellation.md` 갱신 + `codebase/backend/src/nodes/ai/ai-agent/{ai-turn-executor.ts, llm-call-timeout.ts}` / `codebase/backend/src/nodes/core/node-handler.interface.ts`). orchestrator 가 전달한 payload 는 대상 파일 전체가 아니라 일부(0-common.md, 1-ai-agent.md 앞부분)만 담고 있어 `git diff` + 파일시스템 직접 열람으로 실제 target(uncommitted 변경분)을 재구성해 검토했다.

## 발견사항

- **[CRITICAL] 신설 §12.16 Rationale 이 이미 추적 중인 미해결 invariant 위반(single-turn 에러 라우팅 갭)을 "해결됨"처럼 서술**
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §12.16 "LLM chat 호출 app-level 타임아웃 (defense-in-depth)" — "AI Agent 의 모든 LLM `chat` 호출(single-turn `executeSingleTurn` 2곳 · multi-turn `processMultiTurnMessage` resume 2곳)에 ... 적용한다. ... 이 throw 는 §10 `LLM_CALL_FAILED`(retryable, network timeout 계열)로 귀결된다 — 신규 에러 코드 없음."
  - 과거 결정 출처:
    - `spec/conventions/node-output.md` Principle 3.1 ("Runtime 에러 → `port:'error'` + `output.error`") / Principle 3.2.1 ("LLM 계열 노드(`ai_agent`/`text_classifier`/`information_extractor`)는 `output.error.details.retryable` 필수").
    - `plan/in-progress/node-output-redesign/ai-agent.md` (+ `README.md`) — 이미 2026-05-16 에 검출돼 2026-06-25 재확인까지 여전히 **미해결(체크박스 `- [ ]`) CRITICAL** 로 명시: *"`executeSingleTurn` 의 `llmService.chat` 호출을 `try/catch` 로 감싸 `output.error.{code:'LLM_CALL_FAILED', ...}` + `port:'error'` 반환... 근거: `ai-turn-executor.ts` 첫 chat 호출 · tool-loop chat 호출 — 현 throw 미캡처, spec §7.3."*
  - 상세: 코드를 직접 대조한 결과 위 plan 의 지적이 현재도 그대로 유효하다.
    - `AiTurnExecutor.executeSingleTurn`(`ai-turn-executor.ts`, 이번 diff 가 `timeoutMs` 를 추가한 두 `chat()` 호출부 포함)에는 **어떤 try/catch 도 없다** — `ToolDefinitionPayloadExceededError` 전용 헬퍼(`buildSingleTurnToolsOrError`)만 예외적으로 catch 하며, 일반 chat 실패(5xx/429/auth/그리고 이번에 추가된 timeout)는 전혀 잡히지 않는다.
    - `AiAgentHandler.execute` 도 `executeSingleTurn` 호출을 `try { } finally { cleanup }` 로만 감싸고 catch 가 없다 — 즉 uncaught throw 로 그대로 엔진까지 전파된다.
    - `AiTurnOrchestrator.classifyLlmError`/`extractAiTurnErrorPayload` (429→`LLM_RATE_LIMIT`, 5xx/network/timeout→`LLM_CALL_FAILED` retryable) 는 **오직 multi-turn 의 `handleAiTurnError`(엔진 `ai-turn-orchestrator.service.ts`) 경로에서만** 호출된다. single-turn 경로에는 이 분류기를 참조하는 코드가 전혀 없다 (`ai-turn-executor.ts` / `ai-agent.handler.ts` 어디에도 `'LLM_CALL_FAILED'` 리터럴이 없음 — 형제 노드 `text-classifier.handler.ts`/`information-extractor.handler.ts` 에는 있음).
    - 엔진 쪽에서 uncaught throw 를 받는 실제 지점(`execution-engine.service.ts` 의 노드 dispatch `catch (err: unknown)`, `errorPolicyHandler.handleError` 분기)은 `nodeExecution.error = { message: err.message }` 만 채운다 — `code` 도 `details.retryable` 도 없는 **완전히 다른 실패 봉투**이며, `output.error` 필드 자체가 존재하지 않는다(핸들러가 정상적으로 `return` 하지 못했으므로 `output` 이 조립되지 않음).
    - `ai-turn-executor.spec.ts` 에도 single-turn chat 실패 → `LLM_CALL_FAILED`/`port:'error'` 를 검증하는 테스트가 전혀 없다(전부 multi-turn `endMultiTurnConversation`/`buildMultiTurnFinalOutput` 경로만 커버).
  - 결론: §12.16 이 명시한 "single-turn `executeSingleTurn` 2곳" 은 실제로는 §10/Principle 3.2.1 이 약속하는 `output.error.details.retryable` 분류를 받지 못하고, 엔진 레벨의 무분류 `FAILED` 로 귀결된다. 즉 이번에 새로 도입한 10분 타임아웃이 **single-turn 모드에서 발화하면** — retry 안내 UI(`[다시 시도]` 버튼, §10 "retryable 분류 규칙" 문단이 약속하는 사용자 경험)가 전혀 뜨지 않는 채로 그냥 워크플로우가 실패한다. 이는 새 Rationale 이 (a) 기존에 합의된 invariant(Principle 3.1/3.2.1, D4 "LLM 계열 노드는 throw 대신 return 으로 실패 표면화")를 우회하는 설계를 인지하지 못한 채 서술했고, (b) 이미 별도 plan 에서 CRITICAL 로 추적 중인 미해결 갭을 마치 이 diff 의 범위에서 자동으로 해소된 것처럼("§10 LLM_CALL_FAILED 로 귀결") 오도할 소지가 있다는 점에서 **암묵적 가정 충돌**(점검 관점 4)에 해당한다. multi-turn resume 2곳은 실제로 `classifyLlmError` 를 타므로 claim 이 맞다 — 문제는 **single-turn 2곳**에 한정된다.
  - 제안:
    1. §12.16 문구를 정정 — "multi-turn resume 경로는 `classifyLlmError` 를 거쳐 §10 `LLM_CALL_FAILED`(retryable)로 귀결한다. single-turn 경로는 `plan/in-progress/node-output-redesign/ai-agent.md` 의 미해결 CRITICAL(try/catch 부재)로 인해 현재는 이 분류를 거치지 않고 엔진 레벨 무분류 `FAILED` 로 귀결한다 — 본 타임아웃도 동일 한계를 상속한다" 는 취지로 scope 를 명확히 하거나,
    2. (권장) `executeSingleTurn` 의 `chat()` 두 호출부를 try/catch 로 감싸 §7.3 `output.error` 셰이프로 조립하는 작업을 이번 plan(`ai-agent-tool-payload-budget-followups.md` 항목 B 또는 신규 항목)에 포함시켜, §12.16 의 claim 이 실제로 참이 되도록 구현을 맞춘다. 이 경우 `node-output-redesign/ai-agent.md` 의 해당 체크리스트 항목도 함께 닫는다.

- **[WARNING] "provider 네트워크 지연·모델 stall" 일반 문제를 AI Agent 전용으로만 방어 — TC/IE 의 동일 노출은 미언급**
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §12.16 문제 정의("provider 네트워크 지연·모델 stall 등 다른 사유의 무기한 hang"), `spec/conventions/node-cancellation.md` Anthropic SDK 행.
  - 과거 결정 출처: `spec/4-nodes/3-ai/0-common.md` §10/§0 도입부("LLM 3 노드는 ... wrapper 를 공유", "세 노드 모두 두 필드를 통해 LLM 호출 설정을 선택") — 세 AI 노드가 동일한 `LlmService.chat()` 경유·동일 provider-hang 위험을 공유한다는 전제. `node-cancellation.md` §2.1 Anthropic SDK 행 자체가 "AI 노드 — ai-agent / text-classifier / information-extractor" 를 하나의 행으로 묶어 신뢰성 계약을 서술한다.
  - 상세: §12.16 이 서술하는 원인(provider 네트워크 지연·모델 stall)은 도구 payload 팽창(§12.15, MCP/Cafe24 전용이라 AI Agent 한정이 타당)과 달리 AI Agent 에 국한된 문제가 아니다 — `text_classifier`/`information_extractor` 도 동일하게 `LlmService.chat()` 을 직접 호출하며 (코드 확인: `text-classifier.handler.ts:208`, `information-extractor.handler.ts:520/787/1035` 모두 `signal` 만 전달하고 `timeoutMs` 는 여전히 없음), 특히 IE 는 AI Agent 와 동일한 멀티턴 park/resume 구조를 갖고 있고 `node-cancellation.md` 의 같은 표 행이 "IE 의 resume 경로도 abort 컨텍스트가 없다"는 동일한 gap 을 이미 명시한다. 그럼에도 이번 diff 의 defense-in-depth 백스톱은 AI Agent 에만 배선된다.
  - `plan/in-progress/ai-agent-tool-payload-budget-followups.md` 를 보면 이 스코프 축소가 우발적이 아니라 "AI Agent 도구 payload 예산 가드레일의 후속(항목 B)"라는 계보상 의도된 좁은 스코프임을 알 수 있어 CRITICAL 은 아니지만, spec 의 §12.16 자체에는 이 스코프 결정("왜 TC/IE 는 제외했는가")이 전혀 기록돼 있지 않다 — 합의된 원칙(세 AI 노드가 §0-common 의 공통 규약을 공유한다는 원칙)과 거리감이 있는 결정이 새 Rationale 없이 조용히 좁혀진 사례.
  - 제안: §12.16 말미에 "본 백스톱은 AI Agent 전용이며, TC/IE 는 §12.15 도구 payload 팽창 위험이 구조적으로 없어(MCP 미지원) 이번 스코프에서 제외했다 — 순수 네트워크/모델 stall 위험 자체는 TC/IE 에도 남아있으며 별도 후속으로 추적한다"는 식의 명시적 스코프 근거 한 문장을 추가하거나, `plan/in-progress/ai-agent-tool-payload-budget-followups.md` 의 "후속 백로그"에 TC/IE 확장 항목을 명시적으로 남긴다.

- **[INFO] node-cancellation.md 의 "향후 표준 유틸" 방향과의 관계 미기술**
  - target 위치: `spec/conventions/node-cancellation.md` 신설 문장(Anthropic SDK 행 "defense-in-depth timeout" 부분).
  - 과거 결정 출처: 같은 문서 `## Rationale` — "향후 `AbortSignal.any([...])` (Node.js 18+) 또는 `AbortSignal.timeout(ms)` 같은 표준 유틸 활용 가능."
  - 상세: 이번 구현은 표준 `AbortSignal.timeout(ms)` 대신 기존 커스텀 `withTimeout`(Promise.race + 로컬 `AbortController`, `codebase/backend/src/modules/llm/utils/with-timeout.util.ts`)을 재사용한다. §4 의 fetch cascade 패턴과 동형이라 설계 원칙 위반은 아니지만(오히려 §4 선례를 LLM 콜에 자연스럽게 확장한 것), node-cancellation.md 의 Rationale 이 명시적으로 언급한 "향후 표준 유틸" 방향과의 관계(왜 아직 `AbortSignal.timeout` 로 전환하지 않았는지)는 기록돼 있지 않다.
  - 제안: 굳이 본 diff 에서 다룰 필요는 없으나, `withTimeout` 표준화 검토가 있다면 node-cancellation.md Rationale 에 한 줄 추가해 두면 향후 리팩터링 시 "왜 아직 커스텀 유틸을 쓰는가"에 대한 재질문을 방지할 수 있다.

## 요약

이번 diff(§12.16 신설)는 기존 §12.15 도구 payload 가드·기존 에러 코드 taxonomy(§10 `LLM_CALL_FAILED`)·`node-cancellation.md` §4 의 timeout-cascade 패턴과 표면적으로는 잘 정합하며, multi-turn resume 경로에 대해서는 "§10 LLM_CALL_FAILED(retryable)로 귀결"이라는 claim 이 코드로 검증된다(`AiTurnOrchestrator.classifyLlmError` 의 network-message 정규식이 "timed out" 을 매칭). 그러나 같은 claim 을 **single-turn 경로**에도 무차별 적용한 것은 실제 코드와 어긋난다 — `executeSingleTurn` 의 `llmService.chat` 호출은 애초에 try/catch 가 없어 §7.3/Principle 3.2.1 이 요구하는 `output.error.details.retryable` 라우팅을 거치지 않으며, 이는 `plan/in-progress/node-output-redesign/ai-agent.md` 에 2026-05-16 부터 미해결 CRITICAL 로 이미 기록된 사실이다. 신설 Rationale 이 이 기존 결정/추적 항목을 재확인하지 않고 정반대의 결과를 단정적으로 서술한 것이 본 검토의 핵심 이슈다. 부차적으로 이번 defense-in-depth 를 AI Agent 로만 좁힌 스코프 결정도 spec 상에 근거가 남아있지 않다.

## 위험도

HIGH
