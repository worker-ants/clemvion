### 발견사항

---

**[CRITICAL]** `custom-node.tsx` AI Agent 동적 포트 로직에 대한 테스트 미존재
- 위치: `plan/ai-agent-conditions.md` 구현 목록 8번 — `frontend/src/components/editor/canvas/__tests__/custom-node.test.tsx`
- 상세: 계획 문서에는 해당 파일의 테스트가 명시되어 있으나, diff에 테스트가 전혀 추가되지 않았다. `single_turn` vs `multi_turn` 모드별 포트 구성(조건 포트 + timeout/error/user_ended/max_turns), 조건 없을 때 기본 포트, `conditions` 배열 내 `id`가 비어있는 항목 필터링 등 모든 분기가 미커버 상태다.
- 제안: `custom-node.test.tsx`에 `ai_agent` 타입에 대한 포트 렌더링 시나리오를 추가해야 한다.

---

**[CRITICAL]** `execution-engine.service.ts` 조건 라우팅 분기 테스트 미존재
- 위치: `execution-engine.service.ts` — `else if ('port' in resultObj && 'data' in resultObj)` 블록
- 상세: `waitForAiConversation` 내 조건 감지 후 `applyPortSelection`을 호출하고 `conversationEnded = true`로 설정하는 핵심 분기에 대한 서비스 레벨 테스트가 없다. 핸들러 단위 테스트는 `{ port, data }` 구조를 반환하는 것까지만 검증하지만, 서비스가 이를 올바르게 처리하는지는 검증되지 않는다.
- 제안: `execution-engine.service.spec.ts`에 AI 에이전트가 조건을 반환할 때 올바른 포트로 라우팅되는 통합 테스트를 추가해야 한다.

---

**[WARNING]** `ConditionsSection` 컴포넌트 테스트 전무
- 위치: `frontend/src/components/editor/settings-panel/node-configs/ai-configs.tsx`
- 상세: 조건 추가(`addCondition`), 삭제(`removeCondition`), 수정(`updateCondition`), `crypto.randomUUID()` 호출을 통한 id 생성, 빈 상태 렌더링 등 신규 UI 컴포넌트의 모든 인터랙션 로직에 대한 테스트가 없다.
- 제안: `ai-configs.test.tsx`를 신규 작성하여 각 케이스를 커버해야 한다.

---

**[WARNING]** 혼합 툴 호출(Case 2) 테스트에서 메시지 히스토리 구조 미검증
- 위치: `ai-agent.handler.spec.ts:780` — `should execute normal tools first when condition + normal tools are called together`
- 상세: 첫 번째 LLM 호출 시 조건 툴과 일반 툴이 함께 호출될 때, 조건 툴의 deferral 메시지(`'확인되었습니다...'`)와 일반 툴의 실행 결과가 각각 올바른 `toolCallId`로 메시지 히스토리에 추가되는지 검증하지 않는다. 두 번째 `chat` 호출이 이루어졌다는 것만 확인한다.
- 제안: 두 번째 `llmService.chat` 호출 시 전달되는 `messages` 인자를 검사하여 tool response 메시지 구조가 올바른지 확인하는 assertion을 추가해야 한다.

---

**[WARNING]** `classifyToolCalls` 엣지 케이스 테스트 누락
- 위치: `ai-agent.handler.spec.ts` — conditions 관련 테스트 전반
- 상세: `conditions` 배열이 비어있을 때 모든 툴이 `normalToolCalls`로 분류되는지, `toolCalls`가 비어있을 때 `matchedCondition`이 `null`인지에 대한 직접적인 테스트가 없다. `maxToolCalls` 한도 도달 시 조건 deferral 상태에서 루프가 어떻게 종료되는지도 미커버다.
- 제안: 위 케이스들을 별도 `describe('classifyToolCalls - edge cases')` 블록으로 추가하거나, `execute` 통합 테스트 형태로 보완해야 한다.

---

**[WARNING]** `extractConditionReason` JSON 파싱 실패 케이스 미테스트
- 위치: `ai-agent.handler.ts:extractConditionReason` — `catch { return ''; }` 블록
- 상세: `arguments`가 유효하지 않은 JSON일 때 빈 문자열을 반환하는 fallback 로직이 테스트되지 않는다. `conditionId`가 `toolCalls`에 없을 때의 케이스도 마찬가지다.
- 제안: `should return empty string when condition arguments is invalid JSON` 테스트를 추가해야 한다.

---

**[INFO]** `_multiTurnState` 내부 구현 의존
- 위치: `ai-agent.handler.spec.ts:859` — `should pass conditions to multiTurnState from execute`
- 상세: `result._multiTurnState`를 통해 내부 상태에 직접 접근하는 것은 구현 세부사항에 의존하는 방식이다. 리팩토링 시 테스트가 쉽게 깨질 수 있다.
- 제안: 내부 상태 대신 `processMultiTurnMessage`를 실제로 호출하여 조건이 적용되는지를 행위 기반으로 검증하는 방식이 더 견고하다.

---

**[INFO]** `buildTools UUID naming` 테스트가 `execute`를 통한 간접 검증
- 위치: `ai-agent.handler.spec.ts:665` — `buildTools - UUID naming` describe
- 상세: `buildTools`의 단순한 로직을 검증하기 위해 `execute` 전체를 실행하는 방식은 과도하다. `buildTools`가 `private`이라 직접 호출이 불가한 점은 이해되나, 테스트 의도 대비 복잡도가 높다.
- 제안: `buildTools`의 접근제어를 `protected`로 변경하거나 현행 유지 시 주석으로 테스트 의도를 명시해야 한다.

---

**[INFO]** `buildConditionSystemPromptSuffix` 내용 검증 불완전
- 위치: `ai-agent.handler.spec.ts:745` — `should inject condition instructions into system prompt`
- 상세: 시스템 프롬프트에 `'조건'`이 포함되는지만 확인한다. 실제로 각 조건의 `id`와 `prompt`가 프롬프트에 포함되는지, 조건이 없을 때 suffix가 추가되지 않는지는 테스트되지 않는다.
- 제안: condition의 `id`와 `prompt`가 system message에 포함되는지 assertion을 추가해야 한다.

---

### 요약

핵심 로직인 `ai-agent.handler.ts`의 단위 테스트는 주요 시나리오(단건 조건 라우팅, 혼합 툴, 다중 조건 선택, 정상 출력)를 잘 커버하고 있으며, `node-config-summary` 테스트도 조건 표시 로직을 충분히 검증한다. 그러나 계획 문서에 명시된 `custom-node.tsx` 포트 렌더링 테스트가 전혀 작성되지 않았고, 서비스 레벨의 조건 라우팅 통합 테스트도 누락되어 있으며, 신규 UI 컴포넌트(`ConditionsSection`)에 대한 테스트도 부재하다. 이 세 가지는 런타임 버그가 테스트에서 잡히지 않을 위험이 있는 Critical/Warning 수준의 갭이다.

### 위험도

**HIGH**