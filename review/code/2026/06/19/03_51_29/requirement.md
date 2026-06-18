# Requirement Review — button-interaction.service.ts + .spec.ts

## 발견사항

### [INFO] [SPEC-DRIFT] resolveButtonInteraction / buildResumedStructuredOutput / isButtonClickPayload / ButtonClickPayload — spec 문서에 미등재
- 위치: `button-interaction.service.ts` (새로 추가된 module-level exports 전체)
- 상세: `spec/5-system/4-execution-engine.md §1.4` 및 `spec/conventions/node-output.md §4.5` 는 `ButtonInteractionService.processButtonResumeTurn` 의 **행위 결과**(`interaction.type`, `data`, `status: 'resumed'`, `_selectedPort` 라우팅) 를 명시하지만, 이 결과를 산출하는 **순수함수 추출**(`resolveButtonInteraction`, `buildResumedStructuredOutput`) 은 spec 어디에도 기술되지 않는다. 코드 변경은 기존 동작을 리팩터링해 순수함수로 분리한 것이며 의도적이고 합리적인 개선이다.
- 제안: 코드 유지 + spec 반영. `spec/5-system/4-execution-engine.md §Rationale "C-1 god-class strangler-fig 분할"` 또는 C-1 구현 노트에 "processButtonResumeTurn 의 결정 로직은 module-level 순수함수 resolveButtonInteraction / buildResumedStructuredOutput 으로 추출됐다" 한 줄을 추가할 것. 서비스 메서드 공개 시그니처는 변경 없으므로 behavioral spec 갱신은 불필요.

---

### [INFO] ButtonClickPayload 의 `buttonId?: string` optional 처리 — spec 는 `buttonId` 를 필수로 암묵 정의
- 위치: `button-interaction.service.ts` L1241-1242 (`ButtonClickPayload` 타입 정의)
- 상세: `spec/conventions/node-output.md §4.5` 및 `spec/5-system/4-execution-engine.md §§1.4, 7.4` 는 `button_click` 메시지 스키마로 `{ type: ContinuationType, executionId, nodeExecutionId, payload?: unknown }` 을 명시하고, `payload` 에서 `buttonId` 를 필수 필드로 전제한다(`{ buttonId, buttonLabel, … }`). 코드는 `buttonId?` 를 optional 로 선언해 "buttonId 누락 button_click" 케이스를 타입 레벨에서 허용하고, `find(b.id === undefined)` → `INVALID_BUTTON_ID throw` 로 방어적으로 처리한다. 이는 `buttonId!` 비null 단언 제거를 통한 타입 안전 개선으로 **행동은 보존**되며(테스트 케이스 Fix 3 이 이를 못박는다), spec 의 wire-shape 에 어긋나지 않는다. `buttonId` 를 wire 에서 보내지 않는 클라이언트는 이미 INVALID_BUTTON_ID 로 거부된다.
- 제안: INFO 수준. 별도 조치 불필요. spec 의 payload 필드 설명에 "buttonId 누락 시 서버가 INVALID_BUTTON_ID 로 거부한다" 방어 메모를 추가하면 명확성 향상.

---

### [INFO] `buildResumedStructuredOutput` — Array 입력 시 `{ ...array }` spread 동작이 스펙 미정의
- 위치: `button-interaction.service.ts` L1466-1476, `.spec.ts` 테스트 케이스 `(b) Array 입력 fallback`
- 상세: `prevStructured.output` 이 Array 이면 `strip` 분기를 우회해 배열을 `rawPrevOutput` 으로 유지하고, `{ ...(prevOutput as Record) }` spread 시 인덱스 키가 펼쳐진다(`out['0'] === { a: 1 }`). spec(`node-output.md §4.4 status: 'resumed'`) 은 `output` 이 객체임을 암묵적으로 전제하고 배열 케이스를 명시하지 않는다. 이 분기는 프레젠테이션 핸들러가 배열 output 을 반환할 경우(현재 알려진 사례 없음)를 위한 defensive fallback 이다. 버그 가능성보다는 미정의 엣지케이스 보호이므로 INFO.
- 제안: 현재 프레젠테이션 핸들러가 배열 output 을 반환하는 경로가 실제로 존재하는지 확인. 없다면 Array 분기 케이스에 대해 `spec/conventions/node-output.md` 에 "NodeHandlerOutput.output 은 항상 객체" 명시적 제약을 추가하고, 해당 분기를 defensive runtime error 로 전환하는 것을 고려할 수 있다.

---

### [INFO] `StructuredInteraction.type` 에 `'button_continue'` 포함 — spec §4.5 은 `interaction.type` enum 에 `button_continue` 를 명시
- 위치: `button-interaction.service.ts` L1278-1283 (`StructuredInteraction` 인터페이스)
- 상세: 코드는 `type: 'form_submitted' | 'button_click' | 'button_continue' | 'message_received'` 로 선언한다. `spec/conventions/node-output.md §4.2` (L177) 의 인라인 타입은 `"form_submitted" | "button_click" | "message_received"` 만 나열하고 `button_continue` 가 빠져 있다. 그러나 §4.5 (`interaction.data` payload 규격) 에는 `button_continue` 가 정식 열거 항목으로 포함된다. 이는 §4.2 의 인라인 예시가 오래된 것이며 코드 정의가 §4.5 와 일치한다.
- 제안: `spec/conventions/node-output.md §4.2` 의 인라인 `type` 열거에 `button_continue` 를 추가해 §4.5 와 일관성 확보.

---

### [INFO] `processButtonResumeTurn` 에서 `payload as ButtonClickPayload` 캐스팅 — 런타임 타입 검증 없음
- 위치: `button-interaction.service.ts` L1637 (`resolveButtonInteraction(payload as ButtonClickPayload, ...)`)
- 상세: `payload: unknown` 을 캐스팅 없이 `ButtonClickPayload` 로 단언한다. `isButtonClickPayload` 타입가드가 `resolveButtonInteraction` 내부에서 판별하므로 런타임 동작은 올바르다. 그러나 `payload` 가 `ButtonClickPayload` 형태조차 아닌 값(`null`, 숫자, 배열 등)이 들어오면 `payload.type` 접근 시 TypeError 가 발생할 수 있다. 현재 continuation-bus 의 wire-shape 은 `{ type: string, … }` 을 보장하므로 실질적 위험은 낮지만, 방어 가드가 없다.
- 제안: 선택적 개선으로 `typeof payload === 'object' && payload !== null` 사전 검사를 추가하거나, `resolveButtonInteraction` 인자 타입을 `unknown` 으로 받도록 완화하고 내부에서 가드 적용.

---

## 요약

코드는 `ButtonInteractionService.processButtonResumeTurn` 의 결정 로직을 순수함수(`resolveButtonInteraction`, `buildResumedStructuredOutput`)로 추출하고 타입안전 정리(`buttonId!` 비null 단언 제거)를 수행했다. spec(`spec/conventions/node-output.md §4.5`, `spec/5-system/4-execution-engine.md §§1.4, 7.4, 7.5`) 이 정의하는 행위 컨트랙트(port 선택 규칙: port 버튼→buttonId, link 버튼→'continue', fallback→'continue'; interaction.data shape: button_click `{buttonId,buttonLabel,selectedItem?}`, button_continue `{buttonId,buttonLabel,url?,selectedItem?}`; status: 'resumed'; INVALID_BUTTON_ID / MISSING_BUTTON_CONFIG 에러 throw)와 코드 구현이 line-level 로 일치한다. 새로 추출된 순수함수들은 spec 문서에 미등재(SPEC-DRIFT, INFO 수준)이지만 동작 정확성에 영향은 없다. CRITICAL/WARNING 수준 요구사항 불충족은 발견되지 않았다.

## 위험도

LOW
