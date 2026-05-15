## 리뷰 결과

### 발견사항

---

**[WARNING] `buildTools`의 도구 이름 변경 — 기존 워크플로우 호환성 파괴**
- 위치: `ai-agent.handler.ts` — `buildTools` 메서드
- 상세: 기존 `tool_${nodeId.substring(0, 8)}` 형식에서 `nodeId` (full UUID)로 변경됨. 기존에 저장된 워크플로우의 `toolOverrides[].toolName`이 `tool_` prefix 형식으로 저장된 경우, override 탐색(`toolOverrides.find((o) => o.nodeId === nodeId)`)은 nodeId 기준이라 영향 없지만, 외부 시스템이 도구 이름을 `tool_XXXXXXXX` 형식으로 참조하고 있다면 호환성이 깨짐.
- 제안: 마이그레이션 가이드 또는 기존 형식과의 fallback 여부를 문서화할 것.

---

**[WARNING] `executeSingleTurn`의 조건 분기 — `toolCallCount` 미반영 후 조기 반환**
- 위치: `ai-agent.handler.ts` — `executeSingleTurn`, 조건-only 분기 (Case 1)
- 상세: 조건 tool만 호출된 경우 즉시 반환하는데, 이 시점에 `toolCallCount`는 0임. 즉, 실제로는 LLM이 tool call을 했음에도 `metadata.toolCalls: 0`이 반환됨. `classifyToolCalls`가 호출되기 직전에 `toolCallCount`를 증가시키지 않음.
- 제안: 조건 분기 진입 시 `toolCallCount += classification.conditionToolCalls.length`를 반영하거나, metadata에 실제 tool call 수를 정확히 기록할 것.

---

**[WARNING] `execution-engine.service.ts` — `applyPortSelection` 호출 시 `conversationEnded = true` 설정이 loop 제어 흐름에 미치는 영향**
- 위치: `execution-engine.service.ts` — `waitForAiConversation` (추정)
- 상세: `else if ('port' in resultObj && 'data' in resultObj)` 분기에서 `conversationEnded = true`를 설정함. 기존 `else` 분기(maxTurns reached)와 달리, 이 경우 `setNodeOutput`이 호출된 후 loop가 종료됨. 그런데 `applyPortSelection`의 반환값을 `portRouted as Record<string, unknown>`으로 캐스팅하는데, `applyPortSelection`이 null/undefined를 반환할 수 있는 경우 런타임 오류 없이 null이 저장될 수 있음. `applyPortSelection`의 구현 확인 필요.
- 제안: `applyPortSelection` 반환값 null 체크 추가.

---

**[WARNING] `processMultiTurnMessage` — 조건 트리거 시 `state` 객체 내 `messages` 부분 업데이트 후 반환**
- 위치: `ai-agent.handler.ts` — `processMultiTurnMessage`
- 상세: 조건-only 분기에서 `messages.push({ role: 'assistant', content: result.content || '' })`를 한 뒤 `buildConditionOutput`을 반환함. 이 `messages`는 `state.messages`를 참조(얕은 복사가 아닐 경우)하므로, state 외부에서 messages를 변형하는 부작용이 발생할 수 있음. state가 immutable하게 관리되지 않는다면 호출자 측 state가 오염될 수 있음.
- 제안: `processMultiTurnMessage` 진입 시 `messages`를 `[...state.messages]`로 복사하여 사용 중인지 확인할 것.

---

**[INFO] `ConditionsSection` — `crypto.randomUUID()` 브라우저 호환성**
- 위치: `ai-configs.tsx` — `addCondition`
- 상세: `crypto.randomUUID()`는 HTTPS 또는 localhost 환경에서만 동작함. 개발 환경이 HTTP인 경우 예외 발생. Next.js 환경에서는 일반적으로 문제 없으나, SSR 컨텍스트에서 호출될 경우 Node.js 버전 호환성 확인 필요.
- 제안: 문제 없는 환경이면 INFO로 종료, 아니면 `uuid` 패키지나 폴백 로직 추가.

---

**[INFO] `custom-node.tsx` — `ai_agent` 조건 분기가 `getNodeDefinition` fallback보다 먼저 처리됨**
- 위치: `custom-node.tsx` — `outputs` useMemo
- 상세: 기존 `getNodeDefinition(data.type)?.outputs ?? []` fallback이 `ai_agent` 타입에 대해서는 더 이상 실행되지 않음. `node-definitions/index.ts`의 static 정의(`out`, `timeout`, `error`)와 dynamic 렌더링 결과가 일치하지만, 단일 책임 원점에서 두 곳을 동기화해야 하는 리스크가 생김.
- 제안: node-definitions의 ai_agent 기본 outputs를 dynamic 렌더링의 fallback 소스로 활용하는 구조 검토.

---

**[INFO] `buildMultiTurnFinalOutput` 시그니처 변경 — `endReason` 타입 확장**
- 위치: `ai-agent.handler.ts:697`
- 상세: `'user_ended' | 'max_turns' | 'timeout'`에서 `'condition' | 'error'` 추가. TypeScript union 확장이므로 기존 호출자가 exhaustive switch를 사용하는 경우 컴파일 에러 없이 누락될 수 있음. 외부에서 이 함수를 직접 호출하는 코드(예: 테스트)에서는 `'condition'`과 `'error'`를 명시적으로 테스트하도록 추가됨 — 이는 올바르게 처리됨.
- 제안: endReason을 별도 타입 alias로 추출하여 관리하면 변경 추적이 용이함.

---

### 요약

이번 변경은 AI Agent 노드에 조건(Conditions) 라우팅 기능을 추가하는 것으로, 전반적으로 기존 동작을 깨지 않도록 조심스럽게 설계되어 있습니다. 가장 주의해야 할 부작용은 두 가지입니다: (1) `buildTools`의 도구 이름이 `tool_{short-uuid}`에서 full UUID로 변경되어 이를 문자열로 참조하는 외부 시스템이 있다면 호환성 파괴가 발생하고, (2) `processMultiTurnMessage`에서 `state.messages` 배열을 직접 mutate할 가능성이 있어 호출자 측 상태 오염 위험이 존재합니다. `toolCallCount` 미반영 문제는 메트릭 신뢰도에 영향을 줍니다. 나머지는 INFO 수준으로 즉각적인 위험은 낮습니다.

### 위험도

**MEDIUM**