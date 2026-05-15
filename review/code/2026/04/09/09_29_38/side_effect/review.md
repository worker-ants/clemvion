## 발견사항

---

**[WARNING] `executionsApi.getById` 반환 타입 변경 — 기존 호출자에 영향**
- 위치: `frontend/src/lib/api/executions.ts`
- 상세: 기존 `getById`는 `AxiosResponse<ExecutionData>` (즉 `{ data: ExecutionData, ... }`)를 반환했으나, 변경 후 `Promise<ExecutionData>`를 직접 반환. `use-execution-events.ts`는 이에 맞춰 `response.data` 제거로 수정되었으나, 프로젝트 전체에서 `getById`를 호출하는 다른 곳이 있다면 런타임 오류 발생.
- 제안: `getById`를 호출하는 모든 파일을 grep으로 확인하고, `use-execution-events.ts` 외 추가 호출자가 없는지 검증 필요.

---

**[WARNING] `execution-store.ts`: `waitingForButtons` 호출 시 `selectedResultNodeId` 자동 변경**
- 위치: `frontend/src/lib/stores/execution-store.ts` — `waitingForButtons`, `waitingForForm`, `waitingForConversation` 액션
- 상세: 세 액션에 `selectedResultNodeId: nodeId` 추가. 사용자가 다른 노드를 수동으로 선택하여 결과를 보고 있는 상태에서 버튼 대기가 발생하면 강제로 포커스가 이동. 기존 동작(UseEffect에서 `selectResultNode(waitingNodeId)` 호출)과 동일하지만, 이제 상태 설정이 중복으로 발생함 — store action과 useEffect 양쪽에서 `selectedResultNodeId`가 설정됨.
- 제안: `useEffect`의 `selectResultNode(waitingNodeId)` 호출과 store 액션 내부의 직접 설정 중 하나를 제거해 중복 상태 변경 방지.

---

**[WARNING] `carousel.handler.ts`: `config.source` 표현식이 미resolve된 문자열로 전달될 경우 데이터 손실**
- 위치: `carousel.handler.ts` — execute 메서드, `const sourceData = config.source`
- 상세: `source`가 표현식 엔진에 의해 사전 resolve된다는 주석이 있으나, 표현식 엔진이 resolve하지 못하거나 `config.source`에 원시 문자열(`"{{ $input }}"`)이 그대로 남아있을 경우 `Array.isArray(sourceData)`가 false가 되고 fallback으로 `input`을 사용. 두 경로가 조용히(silently) 전환되므로 디버깅이 어려움.
- 제안: `sourceData`가 문자열인 경우 경고 로그를 남기거나, 표현식 resolve 실패 시 명시적 에러 처리 추가.

---

**[WARNING] `carousel.handler.ts`: `buttonItemMap` 구조가 `cleanNodeOutput`에 포함되어 다운스트림에 전달됨**
- 위치: `execution-engine.service.ts` — `delete cleanNodeOutput.buttonConfig` 제거 후 `buttonConfig` 보존
- 상세: `cleanNodeOutput`에서 `buttonConfig`를 더 이상 제거하지 않아, `buttonConfig` (and its `buttonItemMap`, `buttonTimeout` 등)가 다운스트림 노드의 입력으로 전달됨. 이는 의도된 변경이나, 다운스트림 노드가 예상치 못한 `buttonConfig` 키를 받게 되어 표현식(`$node["Carousel"].output.buttonConfig`)으로 접근 가능해짐. 기존 워크플로우에서 출력 전체를 사용하는 노드라면 데이터 형태가 달라짐.
- 제안: `_selectedPort`처럼 `buttonConfig`도 다운스트림 입력 단계에서 strip하는 것을 고려하거나, 문서화로 의도를 명시.

---

**[INFO] `execution-engine.service.spec.ts`: `_selectedPort` strip 테스트 수정의 암묵적 의미**
- 위치: `execution-engine.service.spec.ts` L1194
- 상세: 테스트가 `_selectedPort: 'case1'`을 기대하지 않도록 변경됨. 이는 `_selectedPort`가 다운스트림 입력에서 제거된다는 동작을 검증하지만, 동시에 switch/routing 로직이 올바른 포트를 선택했는지 확인하는 어서션이 약화됨. `_selectedPort`가 없더라도 실제로 `case1` 포트로 라우팅되었는지 별도로 검증하는 테스트가 없다면 커버리지 공백.
- 제안: 포트 라우팅 결과를 직접 검증하는 어서션 추가(예: 다음 노드 실행 여부).

---

**[INFO] `ConversationInspector`: `previewOnly` 도입으로 내부 상태(`internalSelectedIndex`)가 외부 `selectedItemIndex`와 독립적으로 관리**
- 위치: `conversation-inspector.tsx`
- 상세: `previewOnly=true`일 때 `effectiveIndex = internalSelectedIndex`를 사용하고, `previewOnly=false`일 때 `effectiveIndex = selectedItemIndex`(prop). 부모가 `selectedItemIndex`를 변경해도 `previewOnly=true` 모드에서는 반영되지 않음. 이는 의도된 분리이나, `previewOnly` prop이 런타임에 변경될 경우 두 상태 간 불일치 발생.
- 제안: `previewOnly`가 정적 값임을 문서화하거나, 변경 시 `internalSelectedIndex` 리셋 로직 추가.

---

**[INFO] `custom-node.tsx`: `showGlobalDivider`와 `showSystemDivider`가 동시에 true일 때 구분선 중복 렌더링**
- 위치: `custom-node.tsx` L248-253
- 상세: `showGlobalDivider`는 `!showSystemDivider && ...` 조건이 있어 논리적으로 상호 배타적이지만, 두 조건이 각각 독립적인 `<div>` 렌더링으로 분리되어 있어 코드 흐름상 두 구분선이 모두 렌더링될 가능성을 시각적으로 파악하기 어려움.
- 제안: `const showDivider = showSystemDivider || showGlobalDivider`로 통합하여 단일 렌더링 포인트 유지.

---

**[INFO] `llm-config.service.spec.ts`: `eslint-disable` 주석 제거 후 `any` 타입 경고 발생 가능**
- 위치: `llm-config.service.spec.ts` L13
- 상세: `// eslint-disable-next-line @typescript-eslint/no-explicit-any` 주석이 제거되었으나 `let mockRepo: Record<string, any>`의 `any`는 그대로 존재. ESLint 규칙이 활성화된 경우 lint 오류 발생.
- 제안: `any` → `jest.Mocked` 타입 또는 구체적 타입으로 교체, 또는 주석 복원.

---

### 요약

이번 변경의 핵심 부작용 위험은 **`executionsApi.getById` 반환 타입 변경**으로, 기존 `AxiosResponse` 래핑을 제거하고 `ExecutionData`를 직접 반환하도록 변경하여 미수정 호출자가 있을 경우 런타임 오류를 유발한다. `use-execution-events.ts`는 함께 수정되었으나 다른 호출자 존재 여부를 반드시 확인해야 한다. `execution-store.ts`에서 waiting 액션 내 `selectedResultNodeId` 직접 설정과 기존 `useEffect` 기반 자동 선택 로직이 중복 실행되는 점도 의도치 않은 이중 상태 변경을 유발할 수 있다. Carousel 핸들러의 `buttonConfig` 보존 결정은 다운스트림 노드 입력 구조를 변경하므로 기존 워크플로우의 표현식 호환성에 영향을 줄 수 있다. 나머지 변경사항은 대체로 의도된 동작이며 부작용 위험도는 낮다.

### 위험도

**MEDIUM**