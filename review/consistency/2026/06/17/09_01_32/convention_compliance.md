# 정식 규약 준수 검토 결과

**검토 대상**: `spec/5-system/4-execution-engine.md` (구현 완료 후 검토, diff-base=`claude/engine-split-s1-nodebootstrap`)

**실질 변경 범위**: 신규 파일 3개
- `codebase/backend/src/modules/execution-engine/ai-conversation-helpers.ts`
- `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts`
- `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.spec.ts`

---

## 발견사항

### **[WARNING]** spec `code:` 포인터가 이동한 `classifyLlmError` 를 갱신하지 않음

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §10 (에러 코드 표 하단 주석)
- **위반 규약**: `spec/conventions/error-codes.md` §1 "의미 기반 명명 — 구현 SoT 는 단일 진실 위치에 명시해야" 및 CLAUDE.md "정보 저장 위치 단일 진실 원칙"
- **상세**: `spec/4-nodes/3-ai/1-ai-agent.md:1098` 에 `"구현: ExecutionEngineService.classifyLlmError"` 라고 단일 진실 포인터가 박혀 있다. 이번 diff 에서 `extractAiTurnErrorPayload` (분류·분기 로직)는 `AiTurnOrchestrator` 의 private static 메서드로 이동했으므로 이 포인터가 stale 상태가 됐다. 다른 시스템이 "구현 SoT" 로 이 포인터를 참조하면 잘못된 파일을 찾게 된다.
- **제안**: `spec/4-nodes/3-ai/1-ai-agent.md §10` 의 주석을 `구현: AiTurnOrchestrator.extractAiTurnErrorPayload (ai-turn-orchestrator.service.ts)` 로 갱신.

---

### **[WARNING]** `LLM_CONNECTION_ERROR` 를 "client-layer 누출 코드" 로 매핑하는 테스트가 spec §10 taxonomy 와 어긋남

- **target 위치**: `ai-turn-orchestrator.service.spec.ts` 라인 834~842 — `it('client-layer LLM_CONNECTION_ERROR 코드 누출 시 LLM_CALL_FAILED 로 매핑 + retryable=true', ...)`
- **위반 규약**: `spec/conventions/error-codes.md` §1 "의미 기반 명명 — 코드 이름이 조건의 의미를 기술해야", `spec/4-nodes/3-ai/1-ai-agent.md §10` 에러 코드 표
- **상세**: spec §10 에러 코드 표는 `LLM_CALL_FAILED` / `LLM_RATE_LIMIT` / `LLM_RESPONSE_INVALID` 만을 공식 taxonomy 로 열거한다. `LLM_CONNECTION_ERROR` 는 `spec/5-system/7-llm-client.md §6` 에서 "LLM 클라이언트 계층의 내부 분류 코드"로 정의되며, 이 코드가 핸들러 레이어에 누출될 때 `LLM_CALL_FAILED` 로 정규화하는 것은 올바른 방향이다. 그러나 테스트의 이름이 `'client-layer LLM_CONNECTION_ERROR 코드 누출'` 이라고 표현함으로써 마치 `LLM_CONNECTION_ERROR` 가 일반적으로 발화될 수 있는 공개 코드인 것처럼 오해를 유발한다. spec은 `LLM_CONNECTION_ERROR` 를 "향후 분기 예정(Planned)" 노드 계층 미구현 코드로 명시하며, 노드 출력으로 직접 발행해서는 안 된다. 테스트 커버리지 자체는 유효(정규화 로직 보호)하나 이름이 spec 용어를 오용한다.
- **제안**: 테스트 이름을 `'레거시/미분류 명시 코드(LLM_CONNECTION_ERROR)가 들어왔을 때 LLM_CALL_FAILED 로 정규화 + retryable=true'` 등 spec 용어에 맞는 표현으로 교체. 또는 `spec/4-nodes/3-ai/1-ai-agent.md §10` 의 에러 코드 표에 "클라이언트 계층 `LLM_CONNECTION_ERROR` → 핸들러 레이어에서 `LLM_CALL_FAILED` retryable=true 로 정규화" 규칙을 명문화 (현재는 코드 주석에만 있음).

---

### **[INFO]** `buildConversationMetaFromResumeState` 의 `meta.*` 필드가 `node-output.md Principle 2` 필드명과 불일치

- **target 위치**: `ai-conversation-helpers.ts` 라인 118~129 — `buildConversationMetaFromResumeState` 반환 객체
- **위반 규약**: `spec/conventions/node-output.md` Principle 2 (LLM 계열 `meta` 필드명 권장표)
- **상세**: Principle 2 표는 LLM 계열 노드의 meta 필드를 `meta.inputTokens`, `meta.outputTokens`, `meta.totalTokens`, `meta.thinkingTokens?`, `meta.toolCalls?` 로 명시한다. `buildConversationMetaFromResumeState` 가 반환하는 객체도 동일 필드명(`inputTokens`, `outputTokens`, `totalTokens`, `thinkingTokens`, `toolCalls`)을 쓴다. 그러나 이 헬퍼가 반환하는 값은 `NodeExecution.outputData.meta` 가 아니라 WS `execution.waiting_for_input` 이벤트의 `nodeOutput` 블록에 포함되는 **클라이언트 소비 메타**다. Spec `spec/5-system/6-websocket-protocol.md §4.4` 는 이 블록의 정확한 필드 계약을 별도로 명시하는데, 두 surface 의 필드명이 일치하는 것은 올바른 정렬이다. 그러나 함수 JSDoc 이 이 값이 **WS 이벤트 페이로드 용도**임을 명확히 밝히지 않아 향후 오용 가능성이 있다.
- **제안**: `buildConversationMetaFromResumeState` 의 JSDoc 에 `@returns WS waiting_for_input 이벤트의 nodeOutput.meta 블록으로 사용됨 (spec/5-system/6-websocket-protocol.md §4.4)` 를 추가해 NodeHandlerOutput.meta 와의 혼동을 예방.

---

### **[INFO]** `AiTurnOrchestrator` 가 spec `code:` 포인터에 등록되지 않음

- **target 위치**: `spec/conventions/interaction-type-registry.md` frontmatter `code:` 목록 (현재 `execution-engine.service.ts` 포함)
- **위반 규약**: `spec/conventions/interaction-type-registry.md §1.1` — `WaitingInteractionType` 단일 진실 위치 표 (Backend 행이 `execution-engine.service.ts` 를 명시)
- **상세**: `interaction-type-registry.md §1.1` 표의 Backend 열은 `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 가 `WaitingInteractionType` 정의의 단일 진실임을 명시한다. 이번 diff 에서 `WaitingInteractionType` 정의는 엔진 서비스 파일에 잔류하므로(코드 주석 "interaction-type-registry.md §1.1 핀에 따라 엔진 파일에 잔류") §1.1 표 자체는 파손되지 않는다. 그러나 동 파일의 `code:` frontmatter 포인터 목록에 `ai-turn-orchestrator.service.ts` 가 WS 이벤트 emit 위치(dispatch 중 `EXECUTION_WAITING_FOR_INPUT` emit)임에도 누락돼 있다. 필수 등록 요건은 아니나 frontmatter 포인터가 구현 위치 추적에 쓰이는 규칙에 비춰 INFO 로 표시.
- **제안**: `spec/conventions/interaction-type-registry.md` 의 `code:` frontmatter 에 `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts` 를 추가.

---

### **[INFO]** spec `code:` 포인터가 engine split 이후도 `execution-engine.service.ts` 단독 참조

- **target 위치**: `spec/5-system/4-execution-engine.md` frontmatter 및 본문 §7.5 구현 포인터
- **위반 규약**: CLAUDE.md "정보 저장 위치 단일 진실 원칙" — spec `code:` 는 구현 파일 위치 추적용
- **상세**: `spec/5-system/4-execution-engine.md` 는 diff-base 이전 상태이므로 이번 검토의 직접 수정 대상이 아니다. 그러나 이번 구현으로 AI 멀티턴 관련 메서드가 `AiTurnOrchestrator` 로 이동했음에도, spec 본문의 `code:` 포인터와 §7.5 "구현: `ExecutionEngineService.*`" 형태 참조가 갱신되지 않았다. 이는 orphan 포인터는 아니나 향후 구현 탐색 시 혼란을 야기할 수 있다.
- **제안**: `spec/5-system/4-execution-engine.md` frontmatter `code:` 에 `ai-turn-orchestrator.service.ts`, `ai-conversation-helpers.ts` 추가. §7.5 관련 "구현: ExecutionEngineService" 참조를 `AiTurnOrchestrator` 로 교체 또는 병기.

---

## 요약

정식 규약 준수 관점에서 이번 변경(AI 멀티턴 orchestrator 분리)은 전반적으로 규약을 잘 따르고 있다. `node-output.md` Principle 3.2.1 (`retryable` 필드 필수·`retryAfterSec` invariant)은 테스트 커버리지(`extractAiTurnErrorPayload` 단위 테스트 블록)로 명시적으로 검증되며, `spec/conventions/interaction-type-registry.md §1.1` 의 `WaitingInteractionType` 단일 진실 위치는 유지됐다. 주된 규약 이탈은 구현 이동 후 spec 내 두 구현 포인터가 stale 상태로 남은 것(`spec/4-nodes/3-ai/1-ai-agent.md §10` 의 `classifyLlmError` 참조, `spec/5-system/4-execution-engine.md` frontmatter)과, 테스트 케이스 이름 하나가 spec `error-codes.md` 의 의미 기반 명명 원칙과 어긋나는 표현을 쓰는 것이다. 두 WARNING 모두 spec 갱신(포인터 수정·테스트명 정정)으로 해소 가능하며, 다른 시스템의 invariant 를 즉각 파괴하는 CRITICAL 수준의 위반은 발견되지 않았다.

## 위험도

LOW
