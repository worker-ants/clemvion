# 요구사항(Requirement) Review

## 발견사항

### [INFO] `ButtonClickPayload.buttonId` optional 선언 + non-null assertion 사용
- 위치: `button-interaction.service.ts` L133 (`const buttonId = payload.buttonId!;`)
- 상세: `ButtonClickPayload` 타입에서 `button_click` 변형의 `buttonId` 가 `buttonId?: string` (optional) 로 선언됐으나, 코드는 바로 `payload.buttonId!` 로 non-null assertion 한다. 만약 클라이언트가 `{ type: 'button_click' }` (buttonId 없음) 를 전송하면 `buttonId` 는 `undefined` 가 되고, `buttons.find((b) => b.id === undefined)` 는 `undefined` 를 반환해 `INVALID_BUTTON_ID` throw 로 이어진다 (동작은 정의됨). 그러나 에러 메시지는 `INVALID_BUTTON_ID: Button undefined not found` 가 된다.
- 관련 spec: 해당 에러 메시지 형식에 대한 spec 본문 정의 없음. 동작 자체(알 수 없는 버튼 → throw)는 spec 과 일치.
- 제안: 위험도가 낮지만, `buttonId` 가 undefined 인 경우 별도 `MISSING_BUTTON_ID` 에러 분기를 두거나 타입을 `buttonId: string` (필수)로 강화해 assertion 제거를 고려.

### [INFO] `button_continue` spec 불일치 — `presentation/0-common.md` 에서 `url` 필수 vs 코드·`node-output.md` 에서 조건부
- 위치: `button-interaction.service.ts` L183–186 (`...(clickedButton.url ? { url: clickedButton.url } : {})`), spec `4-nodes/6-presentation/0-common.md` §4 표 line 131
- 상세: `spec/4-nodes/6-presentation/0-common.md` 의 §4 표는 `button_continue` 의 `data` 를 `{ buttonId, buttonLabel, url }` 로 기술 (url 필수 형태). 반면 `spec/conventions/node-output.md` §4.5 표는 `{ buttonId, buttonLabel, url?, selectedItem? }` (url 조건부). 코드는 `node-output.md` spec 과 일치 (`url` 부재 시 생략). 테스트 `(b2)` 도 url 없는 케이스를 커버.
- 판단: 코드 및 `node-output.md` 는 일관 (조건부), `presentation/0-common.md` 의 표 기술이 오래된 형태. 코드가 옳고 spec(0-common) 만 낡음.
- `[SPEC-DRIFT]` 카테고리: 코드 유지 + spec 반영. 갱신 대상 — `spec/4-nodes/6-presentation/0-common.md` §4 표 line 131의 `button_continue` data shape 를 `{ buttonId, buttonLabel, url?, selectedItem? }` 로 수정해 `node-output.md §4.5` 와 일치시켜야 한다.

### [WARNING] `resolveButtonInteraction` — `buttonId` undefined 경로에서 `INVALID_BUTTON_ID` 메시지가 `undefined` 를 포함
- 위치: `button-interaction.service.ts` L133–138
- 상세: `isButtonClickPayload(payload)` 가 true 이면 `buttonId = payload.buttonId!` 로 non-null assertion 한다. `ButtonClickPayload` 의 `button_click` 변형에서 `buttonId` 는 optional(`string | undefined`). `buttonId` 가 실제로 `undefined` 인 경우 `buttons.find(b => b.id === undefined)` 는 항상 `undefined` 를 반환하므로 `INVALID_BUTTON_ID: Button undefined not found` 로 throw 된다. 이 경우 "알 수 없는 버튼"과 "버튼 ID 누락" 이 동일 에러 코드로 묶여 디버깅이 어렵다. 또한 테스트(spec test)도 `buttonId` 가 undefined 인 button_click payload 케이스를 커버하지 않는다.
- 제안: `isButtonClickPayload` 내부 또는 `resolveButtonInteraction` 진입 시 `payload.buttonId` 가 없을 때 `MISSING_BUTTON_ID` 에러를 별도 throw 하거나, `buttonId` 를 `string` 필수로 변경. 최소한 `buttonId` undefined 경로에 대한 테스트 케이스 추가 권장.

### [INFO] `buildResumedStructuredOutput` 단위 테스트 없음
- 위치: `button-interaction.service.spec.ts` (전체)
- 상세: `resolveButtonInteraction` 과 `isButtonClickPayload` 는 격리 단위 테스트를 갖추고 있으나, 동일하게 export 된 순수 함수인 `buildResumedStructuredOutput` 에 대한 직접 단위 테스트는 없다. `processButtonResumeTurn` 통합 테스트에서 간접 커버되나, `previousOutput` 체이닝 방지 로직(연속 resume loop 방어), `prevMeta` 보존, `prevConfig` fallback 등 주요 분기가 격리 테스트에서 검증되지 않는다.
- 제안: `buildResumedStructuredOutput` 의 격리 단위 테스트 추가 권장 (특히 `previousOutput` 스트립 반복 케이스, `prevMeta` 보존, `prevStructured` undefined 케이스).

### [INFO] `(d) fallback` 테스트의 `structuredInteraction.data` — 빈 객체 단언
- 위치: `button-interaction.service.spec.ts` L188–198 (테스트 `(d)`)
- 상세: fallback 경로(`non-button_click`)의 `structuredInteraction.data` 는 `{}` 빈 객체로 단언된다. spec `node-output.md §4.5` 는 `button_continue` 의 data shape 를 `{ buttonId, buttonLabel, url?, selectedItem? }` 로 정의하나, fallback 경로에서는 buttonId/label 정보 자체가 없으므로 빈 `data` 는 spec 위반이 아니다 (fallback = payload type 이 `button_click` 가 아님 → button 정보 없음). 동작 정의는 명확하다.
- 제안: 이 경로가 실제 프로덕션 트래픽에서 발생 가능한지 검토 필요. 발생 가능하다면 spec 에 fallback 경로의 `data` 형태를 명시 기술 권장.

### [INFO] `isButtonClickPayload` 타입 시그니처 — `ButtonClickPayload | { type: string }` union 에서 TypeScript discriminated union narrowing 정확성
- 위치: `button-interaction.service.ts` L399–402
- 상세: `ButtonClickPayload = { type: 'button_click'; buttonId?: string } | { type: string }`. 두 번째 멤버(`{ type: string }`)가 첫 번째를 포함하는 상위집합이므로 TypeScript 레벨에서 실제 discriminated union 이 아니다 (두 멤버 모두 `string` 타입 `type` 을 가짐). 런타임에는 `===` 비교로 정상 동작하나, 컴파일러가 두 번째 멤버를 `button_click` 리터럴 타입과 구분하지 못해 첫 번째 멤버에 대한 타입 체크 혜택이 없다. 타입 정확성 문제이며 런타임 동작에는 영향 없음.
- 제안: `{ type: Exclude<string, 'button_click'> }` 또는 두 번째 멤버를 명시 리터럴로 교체해 true discriminated union 구성 (TypeScript 4.x 제약 내에서).

---

## 요약

변경된 두 파일(`button-interaction.service.ts`, `button-interaction.service.spec.ts`)은 의도한 기능(버튼 클릭 결정 로직의 순수 함수 추출 + 격리 단위 테스트 추가)을 전반적으로 충족한다. 4가지 주요 동작 분기(port 버튼 클릭, link 버튼 클릭, item-level 버튼, fallback) 모두 테스트로 커버됐으며, 에러 경로(`INVALID_BUTTON_ID`, `MISSING_BUTTON_CONFIG`)도 검증됐다. `processButtonResumeTurn` 의 상태 전이 로직(`RUNNING` 중복 회피, `nodeExec null` 처리)도 단위 테스트로 못박혔다. 주요 문제로는 (1) `button_click` payload 의 `buttonId` 가 undefined 인 경우 에러 구분 없이 `INVALID_BUTTON_ID` 로 묶이는 엣지 케이스, (2) `buildResumedStructuredOutput` 격리 단위 테스트 부재, (3) `button_continue` data shape 에 대한 두 spec 문서 간 기술 불일치(`0-common.md` 낡음)가 있다. 하나의 SPEC-DRIFT(코드 옳음, spec 갱신 필요)와 런타임 영향 없는 WARNING이 존재하나, 블로킹 수준의 기능 누락은 없다.

## 위험도

LOW
