# Cross-Spec 일관성 검토 결과

검토 대상: `spec/5-system/4-execution-engine.md` (구현 완료 후 검토, --impl-done)
변경 범위: `button-interaction.service.ts` 및 `button-interaction.service.spec.ts`

---

## 발견사항

### [INFO] `StructuredInteraction.type` 유니온이 spec 정의와 일치

- target 위치: `button-interaction.service.ts` — `StructuredInteraction` 인터페이스 (line 455–462)
- 충돌 대상: `spec/conventions/node-output.md §4.4 / §4.5`
- 상세: 코드의 `StructuredInteraction.type` 유니온은 `'form_submitted' | 'button_click' | 'button_continue' | 'message_received'` 로 정의된다. `spec/conventions/node-output.md §4.4` 의 `interaction.type` 허용값 (`form_submitted | button_click | button_continue | message_received`) 과 정확히 일치한다. 충돌 없음.
- 제안: 없음. 현행 정합.

---

### [INFO] `interactionData` 필드 — `clickedBy` 누락은 scope 내 의도적 한정

- target 위치: `button-interaction.service.ts` — `resolveButtonInteraction()` 의 `interactionData` 구성 (line 535–539, 562–565, 586–590)
- 충돌 대상: `spec/1-data-model.md §2.14` — `NodeExecution.interaction_data` 필드 정의 `{ interactionType, buttonId?, buttonLabel?, clickedAt, clickedBy }`
- 상세: spec 의 `interaction_data` shape 에는 `clickedBy` 필드가 포함된다. 추출된 `resolveButtonInteraction()` 순수 함수가 산출하는 `interactionData` 에는 `clickedBy` 가 없다. 그러나 이는 이미 기존 코드(`processButtonResumeTurn`)에서도 동일했으므로 이번 diff 가 도입한 변화가 아니다 — 기존 상태를 순수 함수로 추출한 것이며, `clickedBy` 는 호출자(`processButtonResumeTurn`) 가 `interactionData` 와 별도로 조합해 DB 저장할 수 있다. diff 범위만 놓고 보면 이번 변경이 새로운 충돌을 추가하지 않는다.
- 제안: `spec/1-data-model.md §2.14` 의 `clickedBy` 필드가 현재 구현에서 실제로 세팅되는지 별도 검증 필요 (본 diff 범위 외). 기존 버그라면 별도 플랜으로 추적.

---

### [INFO] `previousOutput` legacy 필드 — spec 의 Phase 3 퇴역 예정과 정합

- target 위치: `button-interaction.service.ts` — `buildResumedStructuredOutput()` 내 `previousOutput: prevOutput` 설정 (line 666) 및 코드 주석 (lines 659–662)
- 충돌 대상: `spec/conventions/node-output.md §4.2` — `output.previousOutput` 폐기 예정 기술
- 상세: `node-output.md §4.2` 는 `output.previousOutput` 을 "폐기할 필드"로 지정하되 **"Phase 3 완료 전 과도기 예외: presentation resume 경로(`ButtonInteractionService`)는 재개 출력에 `previousOutput`(nested chain은 strip)을 transitional legacy 필드로 여전히 보존한다 — Phase 3 정리 시 제거 예정 (코드 주석 SoT)"** 라고 명시적으로 예외를 기술한다. 코드 주석(`CONVENTIONS §4.2 explicitly marks it for retirement`) 이 이를 참조하고 있어 spec-코드 정합 유지. 충돌 없음.
- 제안: 없음. 의도된 과도기 상태.

---

### [INFO] `CONVENTIONS §4.5` 주석 참조 — 코드-spec 정합 확인

- target 위치: `button-interaction.service.ts` — `resolveButtonInteraction()` 내 주석 (line 504: `"CONVENTIONS §4.5"`)
- 충돌 대상: `spec/conventions/node-output.md §4.5` — `interaction.data` payload 규격
- 상세: 코드 주석이 `CONVENTIONS §4.5` 를 참조하며 `structuredInteraction` 의 `{type, data, receivedAt}` 형태를 설명한다. spec §4.4 는 `output.interaction` 의 최상위 shape 을 `{type, data, receivedAt}` 으로 정의하고, §4.5 는 `data` 의 type별 payload 를 정의한다. 코드가 생성하는 `button_click` data (`{buttonId, buttonLabel, selectedItem?}`) 와 `button_continue` data (`{buttonId, buttonLabel, url?, selectedItem?}`) 는 각각 spec §4.5 의 정의와 일치한다. 충돌 없음.
- 제안: 없음.

---

### [INFO] `ButtonClickPayload` 타입 — spec 에 정의되지 않은 내부 타입, 하지만 wire-shape 정합

- target 위치: `button-interaction.service.ts` — `ButtonClickPayload` 판별 유니온 (lines 417–419)
- 충돌 대상: `spec/5-system/4-execution-engine.md` — continuation-bus 메시지 타입 목록 (§7.4: `button_click`)
- 상세: `ButtonClickPayload` 는 continuation-bus 가 publish 하는 wire-shape 의 TypeScript 모델화다. spec §7.4 는 `button_click` 를 `ContinuationType` 6종 중 하나로 열거하며, payload shape 은 spec 에서 명시적으로 스키마화되어 있지 않다. 코드의 `{ type: 'button_click'; buttonId?: string }` 형태는 기존 `click as { type; buttonId?; action? }` 캐스팅과 동일한 실질 의미이며, `action?` 필드는 어디서도 읽히지 않아 의도적으로 제외했다는 JSDoc 주석이 명시되어 있다. spec 과 충돌하지 않으나, spec 에 continuation payload 스키마를 명문화할 기회가 있다.
- 제안: 필수 아님. 필요 시 `spec/5-system/4-execution-engine.md §7.4` 에 `button_click` payload shape (`{type, buttonId?}`) 를 추가해 코드-spec 정합 강화.

---

## 요약

이번 diff 는 `ButtonInteractionService.processButtonResumeTurn()` 내부의 버튼 클릭 결정 로직을 `resolveButtonInteraction()` 순수 함수로 추출하고, structured output 구성을 `buildResumedStructuredOutput()` 으로 분리한 리팩토링이다. 외부 contract(API endpoint·HTTP method·요구사항 ID·상태 머신·RBAC)를 변경하지 않으며, 핵심 데이터 모델(`interaction.type` 유니온, `data` payload shape, `previousOutput` 과도기 정책)은 `spec/conventions/node-output.md §4.4·§4.5`, `spec/1-data-model.md §2.14`, `spec/conventions/conversation-thread.md §2.1` 과 정합한다. 발견된 INFO 3건은 모두 기존 코드가 이미 내포하던 상태를 순수 함수 추출 후에도 그대로 유지한다는 점을 확인한 것으로, 이번 변경이 새로 도입한 cross-spec 충돌은 없다.

---

## 위험도

NONE
