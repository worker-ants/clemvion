# 변경 범위(Scope) 리뷰 결과

## 발견사항

### INFO: 새 export 타입·인터페이스·함수 추가 — 범위 내
- 위치: `button-interaction.service.ts` 상단 +235줄
- 상세: `ButtonClickPayload`, `isButtonClickPayload`, `ButtonInteractionResolution`, `StructuredInteraction`, `resolveButtonInteraction`, `buildResumedStructuredOutput` 6개 심볼이 추가됐다. 이 모두 `processButtonResumeTurn` 메서드 내부의 인라인 로직을 추출한 것이며, 메서드 본문(-108줄)과 1:1 대응한다. 동작 증가 없이 구조적 분리만 수행했으므로 과도한 기능 확장에 해당하지 않는다.
- 제안: 해당 없음.

### INFO: `StructuredInteraction` 타입에 `form_submitted` / `message_received` 포함
- 위치: `button-interaction.service.ts` 927–930번 라인
- 상세: `StructuredInteraction.type` 유니온에 `form_submitted` / `message_received` 두 값이 포함됐다. 이 파일의 현재 로직은 두 값 중 하나도 생성하지 않는다. 버튼 인터랙션 전용 파일에서 타 상호작용 타입을 같은 인터페이스에 선언하는 것은 범위 확장처럼 보일 수 있다. 단, JSDoc 이 "CONVENTIONS §4.5" 규약을 참조하며 공유 와이어 형태를 표현한 것으로, 별도 파일 분리 없이 이 파일에 정의한 이유가 설명되지 않아 이후 공유 타입 파일로 이동할 여지가 있다. 현재 동작에는 영향 없음.
- 제안: `StructuredInteraction` 을 `shared/` 하위 타입 파일로 분리하는 것을 향후 고려 (선택 사항, 이번 PR 범위 밖).

### INFO: 테스트 파일 임포트 확장 — 범위 내
- 위치: `button-interaction.service.spec.ts` diff 1–8번 라인
- 상세: 기존 `ButtonInteractionService` 단일 임포트에서 `resolveButtonInteraction`, `isButtonClickPayload`, `type ButtonClickPayload` 3개가 추가됐다. 새 `describe('resolveButtonInteraction')` 블록 테스트에서 직접 사용되므로 불필요한 임포트가 아니다.
- 제안: 해당 없음.

### INFO: 새 `describe('resolveButtonInteraction')` 블록 170줄 추가 — 범위 내
- 위치: `button-interaction.service.spec.ts` diff 46–212번 라인
- 상세: 추출된 순수함수 `resolveButtonInteraction`의 격리 단위 테스트다. 상위 `describe('ButtonInteractionService')` 블록에서 이미 통합 경로를 검증하고 있으며, 본 블록은 결정 함수 레벨의 행위 고정을 별도로 수행한다. 추출(리팩토링) 작업의 테스트 보강으로 요청된 범위 내다.
- 제안: 해당 없음.

## 요약

변경 범위 관점에서 이번 PR은 `processButtonResumeTurn` 메서드 내 결정 로직을 순수함수(`resolveButtonInteraction`, `buildResumedStructuredOutput`)로 추출하고, 그에 맞춰 타입(`ButtonClickPayload`, `ButtonInteractionResolution`, `StructuredInteraction`)과 타입가드(`isButtonClickPayload`)를 외부 공개하며, 추출된 함수의 격리 단위 테스트를 추가하는 작업으로 구성됐다. 모든 추가 코드는 추출 전 메서드 내부에 이미 존재하던 로직의 재배치이며, 무관한 파일·영역 수정, 의미 없는 포맷팅 변경, 불필요한 주석 추가/삭제, 관련 없는 임포트 변경은 발견되지 않았다. `StructuredInteraction` 유니온에 이 파일에서 생성하지 않는 타입 값 두 개가 포함된 점은 공유 형태 정의에 해당하며 동작상 문제는 없으나, 향후 공유 타입 파일로 이동을 검토할 여지가 있다.

## 위험도

NONE
