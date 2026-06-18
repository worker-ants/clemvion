# Rationale 연속성 검토 결과

검토 모드: 구현 완료 후 (--impl-done)
대상 scope: `spec/5-system/4-execution-engine.md`
검토 대상 변경: `codebase/backend/src/modules/execution-engine/button-interaction.service.ts` + `.spec.ts` diff

---

## 발견사항

### [INFO] `ButtonInteractionService` 에서 순수함수 추출 — spec 무변 원칙과 정합
- target 위치: `button-interaction.service.ts` — `resolveButtonInteraction()`, `buildResumedStructuredOutput()`, `isButtonClickPayload()` 신규 export
- 과거 결정 출처: `spec/5-system/4-execution-engine.md §Rationale "C-1 god-class strangler-fig 분할"`
- 상세: C-1 Rationale 는 "메서드 물리 위치는 spec 이 정의하지 않는 구현 재량 영역"이라고 명시하며, strangler-fig 분할 전체를 "spec 무변"으로 처리한 선례가 있다. 본 변경도 `ButtonInteractionService.processButtonResumeTurn` 의 결정 로직을 동일 파일 내 순수함수(`resolveButtonInteraction`)로 추출한 behavior-preserving 리팩토링이며 메서드 위치 이동(타 서비스 이전 포함)과 동등한 재량 범위다. 위반 없음.
- 제안: 현행 유지. 다만 이 패턴이 향후 다른 서비스(`FormInteractionService` 등)로 확장될 때도 spec 무변 근거(`C-1 결정의 연장`)를 plan 에 명시하면 충분하다.

### [INFO] `StructuredInteraction` 인터페이스 신규 export — spec §1.3 CONVENTIONS §4.5 와 정합 확인
- target 위치: `button-interaction.service.ts` — `export interface StructuredInteraction { type: 'form_submitted' | 'button_click' | 'button_continue' | 'message_received'; data; receivedAt }`
- 과거 결정 출처: `spec/5-system/4-execution-engine.md §1.3` 재개 상태 (CONVENTIONS §4.5) + `interaction.data payload 규격` 표
- 상세: spec §1.3 은 `interaction.type` 값을 `"form_submitted" | "button_click" | "button_continue" | "message_received"` 로 정의하고, `interaction.data` 를 type 별 payload 표로 규정한다. 코드의 `StructuredInteraction` 은 이 spec 형태를 타입으로 구체화한 것이며 네 값 모두 일치한다. `button_continue.data` 에 `{ buttonId, buttonLabel, url?, selectedItem? }` 를 — spec 표의 `{ buttonId, buttonLabel, url?, selectedItem? }` 와 동일하게 — 구성하는 것도 확인됨. 위반 없음.

### [INFO] `buildResumedStructuredOutput` 의 read-timing 보존 문서화 — spec invariant 정합
- target 위치: `button-interaction.service.ts` — `buildResumedStructuredOutput` JSDoc "호출자는 반드시 `setNodeOutput()` 직후의 view 를 `prevStructured` 로 넘긴다 (read-timing 행위)"
- 과거 결정 출처: `spec/5-system/4-execution-engine.md §1.3` "구현 위치 (C-1 분할 후)" 노트 내 암묵적 시퀀스 + `§6.2` 저장 순서 정책
- 상세: 코드 JSDoc 이 spec 의 저장/읽기 순서 정책(`setNodeOutput` → `structuredOutputCache` 갱신 → structured 구성)을 명시적으로 문서화하고 있다. spec 에는 read-timing 을 별도 invariant 항으로 기록하지 않으나, 코드가 그 동작을 명문화함으로써 암묵적 가정을 드러낸 것이다. Rationale 위반 없음 — 오히려 spec 에도 이 read-timing 제약이 반영되면 더 명확해질 것이다.
- 제안: (optional) `spec/5-system/4-execution-engine.md §Rationale "C-1 god-class 분할"` 의 `ButtonInteractionService` 항목에 "결정 로직은 `resolveButtonInteraction` 순수함수로, resumed NodeHandlerOutput 구성은 `buildResumedStructuredOutput` 으로 분리 — read-timing 제약(setNodeOutput 이후 structured view 읽기)은 호출자 책임" 한 줄을 추가하면 spec 추적성이 강화된다. 구현 차단 사안 아님.

### [INFO] `ButtonClickPayload` 판별유니온 — 기각된 `action?` 필드 의도적 제외
- target 위치: `button-interaction.service.ts` — `export type ButtonClickPayload = { type: 'button_click'; buttonId?: string } | { type: string }` (주석: "옛 캐스팅의 `action?` 는 어디서도 읽히지 않으므로 의도적으로 제외")
- 과거 결정 출처: 해당 필드 기각 결정이 `spec/5-system/4-execution-engine.md §Rationale` 에 별도 항으로 기록되어 있지 않음.
- 상세: `action?` 필드는 "기각된 대안"이 아니라 사용 사실 없는 dead field 를 타입에서 생략한 것이다. spec Rationale 에 명시적 기각 기록이 없으므로 "기각된 대안의 재도입" 관점의 위반은 해당 없다. 코드 주석이 근거를 충분히 설명한다.

---

## 요약

본 변경(`button-interaction.service.ts` 에 `resolveButtonInteraction` / `buildResumedStructuredOutput` / `isButtonClickPayload` / `ButtonClickPayload` / `StructuredInteraction` 신규 export + 관련 단위 테스트 확장)은 `spec/5-system/4-execution-engine.md §Rationale` 의 어떤 기각된 대안도 재도입하지 않는다. C-1 분할 Rationale 가 확립한 "메서드 물리 위치는 spec 재량 영역 / behavior-preserving 은 spec 무변" 원칙의 연장이며, `§1.3 CONVENTIONS §4.5` 가 정의한 `interaction.type` 4값 열거와 `interaction.data` payload 형태가 코드의 `StructuredInteraction` 타입과 일치한다. `setStructuredOutput` best-effort 계약(`spec/conventions/execution-context.md §3`)과도 충돌하지 않는다. 발견된 사항은 모두 INFO 수준이며 spec 추적성 보강 제안에 해당한다.

---

## 위험도

NONE
