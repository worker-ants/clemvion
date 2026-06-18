# Testing Review

## 발견사항

### **[WARNING] `buildResumedStructuredOutput` 함수에 대한 직접 단위 테스트 부재**
- 위치: `button-interaction.service.ts` lines 243-291, `button-interaction.service.spec.ts` 전체
- 상세: `buildResumedStructuredOutput`은 `export function`으로 공개된 순수 함수이며, `previousOutput` 체인 제거 로직(Array.isArray 분기), `prevMeta` 조건부 포함, `prevStructured` undefined 시 `cleanNodeOutput` fallback 등 복잡한 분기를 갖는다. 그러나 스펙 파일은 이 함수를 import하지 않으며 직접 테스트 케이스가 없다. `resolveButtonInteraction`은 6개 케이스 전용 describe 블록을 갖지만 `buildResumedStructuredOutput`은 0개이다.
- 제안: `buildResumedStructuredOutput`에 대한 독립 describe 블록 추가. 최소 커버 케이스: (1) `prevStructured` undefined → cleanNodeOutput fallback, (2) `rawPrevOutput`이 Array인 경우 필터 없이 그대로 통과, (3) `rawPrevOutput`에 `previousOutput` 키 존재 → 제거 보장(반복 재개 체인 방지), (4) `prevMeta` 존재/부재에 따른 결과 shape, (5) port·status·config 보존 검증.

---

### **[WARNING] `buttonId` undefined 시 런타임 동작 테스트 누락**
- 위치: `button-interaction.service.ts` line 133 (`payload.buttonId!`), `resolveButtonInteraction` describe 블록
- 상세: `ButtonClickPayload`의 `button_click` 변형은 `buttonId?: string` (optional)으로 정의되어 있다. 코드는 `payload.buttonId!`로 non-null assertion을 사용하므로, `buttonId`가 `undefined`인 채로 `button_click` type이 들어오면 `buttons.find((b) => b.id === undefined)`가 실행되어 `INVALID_BUTTON_ID`로 throw하거나 예상치 못한 동작이 발생할 수 있다. 현재 테스트는 이 경로를 검증하지 않는다.
- 제안: `resolveButtonInteraction` describe 블록에 `{ type: 'button_click' }` (buttonId 없음) 케이스 추가하여 실제 throw 동작을 확인. 또는 `buttonId`가 falsy일 때의 명시적 가드를 소스에 추가하고 테스트 보강.

---

### **[WARNING] link 버튼 + item-level(selectedItem) 조합 케이스 테스트 누락**
- 위치: `button-interaction.service.ts` lines 170-179 (link 분기의 `selectedItem` 조건부 동봉)
- 상세: link 버튼 분기(`else` 브랜치)에도 `selectedItem !== undefined && { selectedItem }` 스프레드가 존재한다. 그러나 테스트 케이스 `(b)`는 selectedItem 없는 link 버튼, `(b2)`는 url 없는 link 버튼만 다룬다. link + buttonItemMap + outputItems가 모두 제공된 경우 `structuredInteraction.data.selectedItem`과 `updatedOutput.selectedItem`이 동봉되는 경로가 테스트되지 않는다.
- 제안: `(b3) link 버튼 + selectedItem — data.selectedItem 동봉` 케이스 추가.

---

### **[WARNING] `processButtonResumeTurn`의 `buildResumedStructuredOutput` 호출 결과(updatedStructured)에 대한 assertion 없음**
- 위치: `button-interaction.service.spec.ts` processButtonResumeTurn describe 블록 전체
- 상세: 서비스 레벨 테스트에서 `setStructuredOutput` 호출이 spy로 검증되지 않는다. `contextService.setStructuredOutput`이 올바른 인자(interaction 필드, previousOutput 포함 shape, port)로 호출되는지 단언이 없어, `buildResumedStructuredOutput` 통합 경로의 회귀를 서비스 테스트 수준에서 탐지할 수 없다.
- 제안: `button_click(port)` 케이스에서 `jest.spyOn(contextService, 'setStructuredOutput')`을 추가하고, 호출 인자의 `output.interaction.type`, `port`, `status: 'resumed'` 등 핵심 필드를 단언.

---

### **[INFO] `buttonItemMap`에 존재하는 buttonId가 `outputItems` 범위를 벗어나는 케이스 미검증**
- 위치: `button-interaction.service.ts` line 144 (`outputItems[itemIndex]`)
- 상세: `itemIndex`가 `outputItems.length` 이상이면 `outputItems[itemIndex]`는 `undefined`를 반환한다. 이 경우 `selectedItem = undefined`가 되어 조건부 스프레드에서 제외되므로 silent graceful degradation이 일어난다. 의도된 동작인지 명시적으로 테스트로 문서화되어 있지 않다.
- 제안: `buttonItemMap: { pick__item_5: 5 }, outputItems: [{ title: 'A' }]` (인덱스 범위 초과) 케이스를 추가해 `selectedItem` 미동봉을 단언하여 의도 명문화.

---

### **[INFO] `isButtonClickPayload` 타입 가드 테스트에서 `ButtonClickPayload` 타입 오용**
- 위치: `button-interaction.service.spec.ts` lines 66-70 (isButtonClickPayload describe)
- 상세: `{ type: 'something_else' }` 값을 `const p: ButtonClickPayload`로 선언하여 TypeScript 컴파일러가 union의 두 번째 변형(`{ type: string }`)으로 추론하게 한다. 테스트 의도는 명확하나, 타입 주석이 union의 두 번째 변형을 직접 드러내지 않아 "타입이 정확히 무엇인지"를 코드만으로 파악하기 어렵다.
- 제안: 필수 수정 사항은 아니나, `const p = { type: 'something_else' } as ButtonClickPayload`로 명시하거나 주석으로 `// fallback variant` 표기 추가를 고려.

---

### **[INFO] `waitForButtonInteraction`의 `nodeExec null` 경로 테스트 없음**
- 위치: `button-interaction.service.ts` lines 368-385 (`if (nodeExec)` 조건 분기)
- 상세: `nodeExec`가 null인 경우 `updateExecutionStatus`는 `nodeExec ?? undefined`로 undefined를 전달하며 `emitExecution`은 정상 호출된다. 이 경로에 대한 테스트가 `waitForButtonInteraction` describe 블록에 없다. `processButtonResumeTurn`에는 대응 케이스가 있으나 park 경로는 누락.
- 제안: `waitForButtonInteraction`의 `nodeExec null` 케이스 추가하여 `stageDurableResumeSnapshot` 호출과 `emitExecution` 정상 완료를 단언.

---

## 요약

이번 변경의 핵심은 `processButtonResumeTurn` 내부의 결정 로직을 `resolveButtonInteraction` (순수 함수)와 `buildResumedStructuredOutput` (순수 함수)으로 추출한 리팩터링이다. `resolveButtonInteraction`에 대해서는 4개 분기 + type guard + error throw를 망라한 격리 단위 테스트가 신규로 추가되어 행위보존 검증이 충실하다. 그러나 동등하게 공개된 `buildResumedStructuredOutput`에 대한 직접 테스트가 전무하며, 이 함수는 `previousOutput` 체인 방지·Array fallback·meta 조건부 포함 등 비자명한 로직을 포함하므로 테스트 갭이 실질적이다. 서비스 통합 테스트에서는 `setStructuredOutput` 결과에 대한 assertion이 없어 `buildResumedStructuredOutput` 통합 회귀를 탐지할 수 없다. `buttonId: undefined` 입력 경로, link+selectedItem 조합, 인덱스 범위 초과 등 엣지 케이스도 미커버 상태다.

## 위험도

MEDIUM
