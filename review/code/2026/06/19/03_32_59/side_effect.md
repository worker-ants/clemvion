# 부작용(Side Effect) 리뷰 결과

## 발견사항

### 파일 1: button-interaction.service.ts

- **[INFO]** 신규 exported 심볼 추가 — 공개 API 표면 확장
  - 위치: 파일 상단 (라인 ~885-930)
  - 상세: `ButtonClickPayload`, `isButtonClickPayload`, `ButtonInteractionResolution`, `StructuredInteraction`, `resolveButtonInteraction`, `buildResumedStructuredOutput` 6개 심볼이 새롭게 `export` 된다. 기존 `ButtonInteractionService` 클래스 export 는 변경 없음. 추가이므로 기존 import 쪽 breaking change 없음.
  - 제안: 의도된 공개 API 확장이므로 문제 없음. 단, `ButtonInteractionResolution` / `StructuredInteraction` 는 향후 호환 계약이 되므로 필드 제거·재명명 시 별도 검토 필요.

- **[INFO]** `processButtonResumeTurn` 내부 — `cleanNodeOutput` 객체에 `delete` 연산 수행
  - 위치: `processButtonResumeTurn` 내, 라인 ~1813-1815
  - 상세: `const cleanNodeOutput = { ...flatNodeOutput }` 로 얕은 복사 후 `delete cleanNodeOutput.status` / `delete cleanNodeOutput.interactionType` 를 수행한다. 이 패턴은 기존 코드와 동일하게 유지됐으며, 원본 `flatNodeOutput`(= `context.nodeOutputCache[node.id]`)은 변경되지 않는다. `cleanNodeOutput` 은 이후 `resolveButtonInteraction` 에 인자로 넘어가 `updatedOutput.nodeOutput` 참조로 포함되는데, `resolveButtonInteraction` 내부에서 이 객체를 직접 변이하지는 않으므로 부작용 없음.
  - 제안: 현행 구현 적절. 단, `resolveButtonInteraction` 의 향후 수정 시 `cleanNodeOutput` 를 변이하지 않도록 주의.

- **[INFO]** `buildResumedStructuredOutput` — `prevStructured?.output` 참조를 `Object.fromEntries(...)` 로 새 객체 생성
  - 위치: `buildResumedStructuredOutput` 함수, 라인 ~1609-1631
  - 상세: 입력 `prevStructured.output` 에서 `previousOutput` 키만 필터링한 새 객체를 생성한다. 원본 `prevStructured` 객체는 변이하지 않음. 순수 함수 선언과 일치한다.
  - 제안: 문제 없음.

- **[INFO]** `resolveButtonInteraction` — `cleanNodeOutput` 을 `updatedOutput.nodeOutput` 에 참조로 포함
  - 위치: `resolveButtonInteraction` 내부, port 분기 및 fallback 분기 각각
  - 상세: `updatedOutput = { ..., nodeOutput: cleanNodeOutput, ... }` 으로 `cleanNodeOutput` 의 참조를 반환 객체에 포함한다. 이 참조가 호출자에 의해 변이된다면 `updatedOutput.nodeOutput` 이 예기치 않게 변경될 수 있다. 현재 호출자(`processButtonResumeTurn`)에서 `cleanNodeOutput` 을 `resolveButtonInteraction` 호출 이후에 추가로 변이하는 코드는 없으므로 실질적인 부작용은 없다.
  - 제안: 방어적으로 `nodeOutput: { ...cleanNodeOutput }` 로 스프레드할 수 있으나, 현재 코드 흐름상 문제 발생 여지는 낮다.

- **[WARNING]** `resolveButtonInteraction` 에서 `payload as ButtonClickPayload` 캐스팅 — `buttonId` non-null assertion
  - 위치: `resolveButtonInteraction` 내부, 라인 ~1481: `const buttonId = payload.buttonId!`
  - 상세: `isButtonClickPayload` 가 `true` 를 반환한 이후이므로 타입 가드가 `payload.buttonId` 존재를 보장하지는 않는다. `ButtonClickPayload` 의 `button_click` 변형 정의가 `buttonId?: string` (optional)이므로 런타임에서 `buttonId` 가 `undefined` 일 때 non-null assertion `!` 로 억제한다. 이 경우 `buttons.find((b) => b.id === undefined)` 가 실행되어 `clickedButton === undefined` → `INVALID_BUTTON_ID` 를 throw 하므로 동작은 안전하게 실패한다. 그러나 에러 메시지가 `INVALID_BUTTON_ID: Button undefined not found` 가 되어 디버깅에 다소 불명확할 수 있다.
  - 제안: `if (!payload.buttonId) throw new Error('MISSING_BUTTON_ID: buttonId is required for button_click payload')` 를 buttonId 사용 직전에 추가하거나, `ButtonClickPayload` 의 `button_click` 변형을 `buttonId: string` (required) 로 변경하면 의도가 더 명확해진다.

### 파일 2: button-interaction.service.spec.ts

- **[INFO]** 테스트 파일에 새 `import` 추가 (`resolveButtonInteraction`, `isButtonClickPayload`, `ButtonClickPayload`)
  - 위치: 파일 상단 라인 1-8
  - 상세: 테스트 파일에서의 import 확장이므로 프로덕션 코드에는 영향 없음. 기존 `ButtonInteractionService` import 는 유지됨.
  - 제안: 문제 없음.

- **[INFO]** 새 `describe('resolveButtonInteraction', ...)` 블록 추가 — 격리 순수함수 테스트
  - 위치: 파일 라인 ~471 이후 (diff 기준 +170 라인)
  - 상세: 별도 `describe` 블록으로 추가되며 기존 `ButtonInteractionService` describe 블록과 완전히 독립적이다. 공유 상태(전역 변수, `beforeEach` 설정) 없이 각 `it` 블록 내에서 로컬 변수만 사용한다. 부작용 없음.
  - 제안: 문제 없음.

- **[INFO]** `clean()` 팩토리 함수 — `describe` 스코프 내 반복 호출
  - 위치: `describe('resolveButtonInteraction')` 내부 라인 ~702-705
  - 상세: `clean()` 이 매 호출마다 새 객체를 반환하므로 테스트 간 상태 오염 없음.
  - 제안: 문제 없음.

---

## 요약

이번 변경의 핵심은 `processButtonResumeTurn` 내부 결정 로직을 `resolveButtonInteraction` 및 `buildResumedStructuredOutput` 두 순수 함수로 추출하고, 관련 타입(`ButtonClickPayload`, `ButtonInteractionResolution`, `StructuredInteraction`) 및 타입 가드(`isButtonClickPayload`)를 새롭게 `export` 하는 리팩토링이다. 추출된 함수들은 I/O 의존성 없이 값을 반환만 하며 내부에서 전역 상태·파일시스템·네트워크를 변이하지 않는다. `processButtonResumeTurn` 의 부수효과 수행 순서(`setNodeOutput` → `setStructuredOutput` → `appendPresentationInteraction` → DB save → emit)는 리팩토링 전후 동일하게 보존됐다. 기존 `ButtonInteractionService` 클래스 시그니처 및 생성자는 변경되지 않았으므로 호출자 영향 없음. 유일한 경미한 위험은 `payload.buttonId!` non-null assertion 으로, 런타임에서 안전하게 `INVALID_BUTTON_ID` 로 이미 처리되지만 타입 정의를 `required` 로 강화하면 의도가 더 명확해진다.

## 위험도

LOW
