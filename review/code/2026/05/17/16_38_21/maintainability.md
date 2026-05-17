### 발견사항

- **[INFO]** 테스트 픽스처 객체의 반복 중복
  - 위치: `apply-execution-snapshot.test.ts` — 신규 4개 테스트 케이스 (ai_conversation hydration)
  - 상세: 4개 테스트 모두 `nodeExecutions` 배열 안에 `{ id: "ne-ai-1", executionId: "exec-1", nodeId: "ai-agent-node", nodeType: "ai_agent", status: "waiting_for_input", startedAt: "2026-04-01T00:00:00Z", outputData: { ... } }` 구조를 거의 동일하게 인라인으로 반복한다. `outputData` 내용만 다를 뿐 외부 껍데기가 4번 중복된다.
  - 제안: `createAiConversationNodeExec(outputDataOverrides?: Partial<...>)` 같은 작은 팩토리 헬퍼를 추가해 공통 필드를 한 곳에서 관리하면 테스트 추가 시 실수 여지가 줄고 향후 필드 변경 시 한 곳만 수정하면 된다.

- **[INFO]** 테스트 케이스 이름과 검증 의도 간 미세한 불일치
  - 위치: `apply-execution-snapshot.test.ts`, 라인 232-273 (네 번째 신규 케이스)
  - 상세: 케이스 설명이 "messages 가 비어있으면 setConversationMessages 호출 안 함"인데, 실제로 `setConversationMessages` 호출 여부를 `vi.spyOn` 등으로 직접 검증하지 않고 부수 효과(`conversationMessages` 배열이 비어있음, `selectedConversationItemIndex` 보존)만 확인한다. 의도(함수 비호출)와 검증 방식(상태 불변) 사이에 표현 간격이 있어 미래 독자가 "왜 spy 없이 검증하는가"를 주석 없이 이해하기 어렵다.
  - 제안: 케이스 이름을 "messages 가 비어있으면 conversationMessages 와 selectedConversationItemIndex 가 변경되지 않음"처럼 실제 검증 방식을 반영하거나, 인라인 주석 한 줄로 "spy 대신 상태 불변으로 대리 검증" 의도를 남긴다.

- **[INFO]** `apply-execution-snapshot.ts` 내 `useExecutionStore.getState()` 중복 호출
  - 위치: `apply-execution-snapshot.ts`, ai_conversation 분기 (라인 1155 기준 전체 파일 컨텍스트)
  - 상세: `pauseForConversation` 호출 직후 `useExecutionStore.getState().conversationMessages.length === 0` 조건을 다시 평가한다. 함수 진입부에서 이미 `const store = useExecutionStore.getState()` 로 구조분해한 뒤 `setConversationMessages` 를 추출했으나, 조건 확인용 `.getState()` 는 별도 호출이다. `pauseForConversation` 가 내부적으로 store 를 변경하므로 재조회가 의도적임은 이해되나, 그 이유가 코드에 드러나지 않아 불필요한 중복처럼 읽힌다.
  - 제안: 인라인 주석으로 "pauseForConversation 이 store 를 변경하므로 최신 state 재조회" 의도를 명시하거나, 해당 체크를 `pauseForConversation` 호출 전으로 이동할 수 있다면 초기 `store` 변수를 재사용한다.

- **[WARNING]** `inferInteractionTypeFromNodeType` 의 `nodeType` 분기가 문자열 상수 열거 방식
  - 위치: `apply-execution-snapshot.ts`, `inferInteractionTypeFromNodeType` 함수
  - 상세: `"carousel"`, `"chart"`, `"table"`, `"template"`, `"ai_agent"`, `"information_extractor"` 등 노드 타입 문자열이 함수 본문에 직접 하드코딩되어 있다. 지원 노드 타입이 추가될 때마다 이 함수와 다른 곳(예: 모의 객체 정의의 `defs` 맵, 테스트 픽스처)을 각각 수동으로 갱신해야 한다.
  - 제안: 이 변경의 범위가 아니므로 즉각 수정 필요성은 낮지만, 노드 타입 상수를 공용 enum 또는 `as const` 객체로 추출해 단일 진실 원천(single source)으로 관리하면 향후 유지보수성이 높아진다.

- **[INFO]** 테스트 파일 내 동일한 `describe` 블록 주석 블록이 두 번 등장
  - 위치: `apply-execution-snapshot.test.ts`, 라인 70-74 (diff 내)와 라인 611-615 (전체 파일 컨텍스트)
  - 상세: ai_conversation hydration 배경을 설명하는 동일한 다섯 줄 주석이 diff 구간과 전체 파일 컨텍스트 양쪽에 나타난다. 이는 diff 중복 표시 방식의 산물로, 실제 파일에는 한 번만 존재한다. 단, 주석이 첫 번째 ai_conversation 케이스 바로 위에 위치하고 이후 케이스들은 주석 없이 이어지는 구조여서, 추가된 4개 케이스 전체에 대한 공통 설명 역할을 첫 케이스가 암묵적으로 담당하고 있다.
  - 제안: 실제 파일 내 중복이 아니므로 코드 변경은 불필요하다. 다만 이후 케이스를 추가할 때 동일 블록 주석을 붙이지 않도록 확인한다.

- **[INFO]** `createExec` 헬퍼의 반환 타입 `Record<string, unknown>` 가 느슨함
  - 위치: `apply-execution-snapshot.test.ts`, `createExec` 함수 정의 (라인 299-315)
  - 상세: 테스트 팩토리 `createExec` 가 `Record<string, unknown>` 를 반환한다. `applyExecutionSnapshot` 의 실제 파라미터 타입(`ExecutionData | null | undefined`)과 다르며, 테스트에서 타입 오류를 숨길 수 있다. 이는 기존 코드 문제이고 이번 변경에서 악화되지 않았다.
  - 제안: 반환 타입을 `ExecutionData` 혹은 `Partial<ExecutionData>` 로 좁히면 픽스처와 실 타입 간 불일치를 컴파일 타임에 잡을 수 있다.

### 요약

이번 변경(`apply-execution-snapshot.ts` ai_conversation 분기 hydration 추가 + 테스트 4건)은 유지보수성 측면에서 전반적으로 양호하다. 구현 변경 자체는 11줄로 최소화되어 있고, 기존 함수 구조와 주석 패턴을 일관되게 따른다. `parseHistoryMessages` 재사용과 "비어있을 때만 시드" 가드는 WS 경로와의 대칭성을 명시적으로 유지해 코드 의도가 명확하다. 다만 테스트 4개 케이스에서 `nodeExecutions` 픽스처 껍데기가 반복되어 중복이 발생하고, `inferInteractionTypeFromNodeType` 의 하드코딩된 노드 타입 문자열은 기존부터 존재하는 장기 유지보수 위험이다. 함수 길이, 중첩 깊이, 순환 복잡도는 모두 수용 가능한 수준이며, 기존 코드베이스의 스타일·패턴을 충실히 준수한다.

### 위험도

LOW
