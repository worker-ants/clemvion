# Architecture Review

## 발견사항

### [INFO] 순수함수 추출 — 단일 책임 원칙 명시적 이행
- 위치: `button-interaction.service.ts` L957–1070 (`resolveButtonInteraction`), L1086–1135 (`buildResumedStructuredOutput`)
- 상세: 기존 `processButtonResumeTurn` 에 인라인으로 존재하던 결정 로직(payload 분기 → port 선택 → 4종 output 구성)이 I/O 의존성 없는 두 순수함수로 분리됐다. `ButtonInteractionService` 는 이제 조율(orchestration)에만 집중하고, 결정(decision)은 함수 경계 밖으로 빠졌다. 이는 SRP를 코드 수준에서 명확히 이행한 설계다.
- 제안: 현 구조 유지. 향후 다른 인터랙션 타입(form 등) 추가 시 동일 패턴(`resolveXxxInteraction` 순수함수 + `XxxInteractionService` 조율 클래스)을 일관되게 적용할 것.

### [INFO] `StructuredInteraction` 인터페이스 분리 — 레이어 공유 타입
- 위치: `button-interaction.service.ts` L926–930
- 상세: `StructuredInteraction` 이 모듈 파일에 `export` 로 정의되어 있다. 현재 이 타입은 ConversationThread, structuredOutputCache 등 여러 소비처가 공유하는 cross-cutting shape임에도 button 모듈 파일에 위치한다. 의존 방향이 button → 공유 타입이어야 하나 현재는 공유 타입이 button 파일에 묶인 형태.
- 제안: 중기적으로 `src/shared/` 또는 `src/nodes/core/` 의 별도 파일(`interaction.types.ts`)로 이동을 검토. 현재 범위에서는 기능적 문제는 없으므로 INFO 수준.

### [INFO] `ButtonClickPayload` 타입 안전성 — non-null assertion 잔류
- 위치: `button-interaction.service.ts` L1481 (`payload.buttonId!`)
- 상세: `ButtonClickPayload` 의 `button_click` 변형은 `buttonId?: string` (optional)으로 정의되어 있으나, `isButtonClickPayload` 가드 통과 후 `buttonId!` 로 non-null assertion이 사용된다. `buttonId` 가 실제로 없는 경우 런타임 에러(`INVALID_BUTTON_ID`) 는 `buttons.find` 에서 자연 발생하나, 타입 시스템 수준의 보증이 느슨하다.
- 제안: `ButtonClickPayload` 의 `button_click` 변형을 `{ type: 'button_click'; buttonId: string }` (required)으로 좁히거나, assertion 이전 명시적 null 검사를 추가하면 타입 계약이 더 명확해진다. 현재는 기능에 영향 없으므로 INFO.

### [INFO] `processButtonResumeTurn` 의 payload 타입 — 외부 경계 캐스팅
- 위치: `button-interaction.service.ts` L1785 (`payload: unknown`), L1832 (`payload as ButtonClickPayload`)
- 상세: 공개 메서드 시그니처는 `payload: unknown` 이고 내부에서 `as ButtonClickPayload` 캐스팅한다. 외부 경계(continuation-bus wire-shape)의 런타임 검증 없이 캐스팅하는 패턴이다. 현재는 `isButtonClickPayload` 가드 + `INVALID_BUTTON_ID` throw 가 실질적 방어 역할을 하지만, 구조적으로는 캐스팅 없이 `payload: ButtonClickPayload` 로 받거나, 외부 경계에서 런타임 parse/validate 후 typed value를 전달하는 것이 더 명확하다.
- 제안: `processButtonResumeTurn(... payload: ButtonClickPayload)` 로 시그니처를 좁히거나, zod/class-validator 등 런타임 스키마 검증을 continuation-bus 수신 지점에 두는 것을 고려.

### [INFO] `buildResumedStructuredOutput` 의 read-timing 커플링 주석
- 위치: `button-interaction.service.ts` L1076–1084 (JSDoc), L1850–1854 (호출부 주석)
- 상세: 함수 JSDoc 과 호출부 모두 "setNodeOutput 호출 후 read-timing 이 동작의 일부" 임을 명시하고 있다. 이는 순수함수처럼 보이지만 실제로는 호출 순서(setNodeOutput → structuredOutputCache 재파생 → buildResumedStructuredOutput)에 암묵적 의존이 있다는 뜻이다. 완전한 순수함수라면 이 순서 의존이 없어야 한다.
- 제안: 현재 설계는 기존 동작 보존을 위한 의도적 선택임이 문서화되어 있어 허용 가능하다. 향후 `setNodeOutput` 이 반환값을 가지도록 리팩토링하면 이 순서 의존을 제거할 수 있다.

### [INFO] `resolveButtonInteraction` 의 6-ary 파라미터 시그니처
- 위치: `button-interaction.service.ts` L1462–1468
- 상세: 함수가 6개의 positional 파라미터를 받는다. 파라미터 수 자체가 문제는 아니나, `buttonItemMap`과 `outputItems` 는 item-level 버튼 경로에서만 의미를 가지는 선택적 컨텍스트로, 하나의 options 객체로 묶으면 호출 가독성이 향상된다.
- 제안: 중기적으로 `{ payload, buttons, buttonItemMap?, outputItems?, cleanNodeOutput, now }` 형태의 options 객체 오버로드 검토. 현재 테스트 파일이 positional 호출을 명시적으로 검증하고 있어 변경 시 테스트도 함께 갱신 필요.

## 요약

이번 변경은 god-class `ExecutionEngineService` 에서 추출된 `ButtonInteractionService` 내의 결정 로직을 두 개의 순수함수(`resolveButtonInteraction`, `buildResumedStructuredOutput`)로 분리한 strangler-fig 리팩터링이다. SRP와 관심사 분리 측면에서 명확한 개선이며, 순수함수에 대한 격리 단위 테스트 추가(`.spec.ts` diff)도 테스트 계층 설계에 부합한다. 발견된 항목은 모두 INFO 수준으로, `StructuredInteraction` 타입의 배치 위치(공유 타입이 버튼 모듈 파일에 위치)와 `payload: unknown → as ButtonClickPayload` 캐스팅 패턴이 중기 개선 후보다. `buildResumedStructuredOutput` 의 read-timing 의존은 의도적으로 문서화된 설계 결정이며 현재 범위에서 허용 가능하다. 아키텍처 위험 요소 없음.

## 위험도

NONE
