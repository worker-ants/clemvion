### 발견사항

- **[WARNING]** `StructuredInteraction` — `PresentationInteractionPayload` 와 동형·중복 정의
  - target 신규 식별자: `export interface StructuredInteraction` (`button-interaction.service.ts:79`)
  - 기존 사용처: `export interface PresentationInteractionPayload` (`codebase/backend/src/modules/execution-engine/conversation-thread/conversation-thread.service.ts:40`)
  - 상세: 두 인터페이스의 shape 가 사실상 동일하다. `PresentationInteractionPayload = { type: string; data?: Record<string, unknown>; receivedAt: string }`. `StructuredInteraction = { type: 'form_submitted' | 'button_click' | 'button_continue' | 'message_received'; data: Record<string, unknown>; receivedAt: string }`. 전자는 `type` 을 `string` 으로, `data` 를 optional 로 두어 확장성을 확보한 반면 후자는 type union 을 closed 하고 `data` 를 required 로 고정했다. `appendPresentationInteraction`(line 529)은 `PresentationInteractionPayload` 를 요구하는데 `StructuredInteraction` 을 그대로 넘기고 있어 TypeScript 에서는 구조적 서브타입으로 허용되지만, 두 명칭이 동일 개념의 서로 다른 부분 정의로 혼재하면 향후 shape 변경 시 두 곳을 독립적으로 변경해야 하는 drift 위험이 생긴다. `spec/conventions/node-output.md §4.4` 의 `interaction` 필드 shape 를 코드로 표현하는 canonical 타입이 `PresentationInteractionPayload` 이고, 신규 `StructuredInteraction` 은 그 역할을 중복 정의하는 셈이다.
  - 제안: `StructuredInteraction` 을 신규 독립 타입으로 두지 말고 `PresentationInteractionPayload` 를 재사용하거나, `PresentationInteractionPayload` 를 제네릭으로 타이트닝해 `StructuredInteraction` 을 `PresentationInteractionPayload` 의 type alias 로 만들 것. 최소 대안: `conversation-thread.service.ts` 의 `PresentationInteractionPayload` 에 union 을 추가하고 `StructuredInteraction = PresentationInteractionPayload` 로 re-export.

- **[INFO]** `ButtonClickPayload` — 기존 인라인 캐스팅을 named type 으로 공식화, 충돌 없음
  - target 신규 식별자: `export type ButtonClickPayload` (`button-interaction.service.ts:42`)
  - 기존 사용처: 기존 코드에서 `payload as { type: string; buttonId?: string; action?: string }` 형태로 인라인 캐스팅만 했었음 (diff 의 `-click` 변수 참조). 별도 named type 없었음.
  - 상세: 충돌 없음. `ButtonInteractionData`(`button.types.ts:24`)는 다른 shape(`interactionType`, `clickedAt` 포함)으로 혼동 위험이 낮다. 그러나 `action?` 필드가 인라인 캐스팅에 있었는데 신규 판별유니온에서는 의도적으로 제외됨 — 주석으로 설명되어 있어 정보 소실이 문서화됐다.
  - 제안: 이슈 없음. 단, `ButtonInteractionData`(`button.types.ts`)와의 개념 분리(wire-shape vs. legacy DB shape)를 공개 주석에 명시적으로 언급하면 혼동 방지에 도움이 된다.

- **[INFO]** `ButtonInteractionResolution` — 코드베이스 전체에서 신규 도입, 충돌 없음
  - target 신규 식별자: `export interface ButtonInteractionResolution` (`button-interaction.service.ts:67`)
  - 기존 사용처: 없음. 유사 명칭(`ButtonInteractionData`, `PresentationInteractionPayload`) 과 개념 분리가 명확함.
  - 상세: 충돌 없음.
  - 제안: 이슈 없음.

- **[INFO]** `resolveButtonInteraction` / `buildResumedStructuredOutput` / `isButtonClickPayload` — 모듈 외부 참조 없음, 충돌 없음
  - target 신규 식별자: 세 함수 모두 `button-interaction.service.ts` 에서 `export function` 으로 도입.
  - 기존 사용처: 코드베이스 전체(`codebase/**/*.ts`) 어디서도 이 이름으로 선언된 함수가 없음. 테스트 파일에서 import 해 사용하는 것이 전부.
  - 상세: 충돌 없음.
  - 제안: 이슈 없음.

---

### 요약

신규 식별자 충돌 관점에서 주요 위험은 `StructuredInteraction` 과 기존 `PresentationInteractionPayload` 의 의미·shape 중복이다. 두 타입이 동일 개념(spec node-output §4.4 `interaction` 필드)을 각기 다른 타이트닝 수준으로 중복 정의해 향후 shape drift 위험을 낳는다. 단, 현재 TypeScript 구조적 서브타입으로 컴파일 오류 없이 통과되고 런타임 충돌은 없으므로 치명적 차단은 아니다. 나머지 신규 식별자(`ButtonClickPayload`, `ButtonInteractionResolution`, 세 순수함수)는 기존 사용처와 충돌하지 않는다.

### 위험도

LOW
