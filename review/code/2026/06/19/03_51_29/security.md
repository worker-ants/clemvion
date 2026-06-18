### 발견사항

- **[INFO]** `payload as ButtonClickPayload` 강제 캐스팅 — 입력 타입 검증 미수행
  - 위치: `button-interaction.service.ts`, `processButtonResumeTurn` 메서드, `resolveButtonInteraction(payload as ButtonClickPayload, ...)` 호출부
  - 상세: `processButtonResumeTurn`의 파라미터 `payload: unknown`이 타입 가드 없이 `ButtonClickPayload`로 캐스팅된다. 런타임에 `payload`가 `null`, primitive, 또는 예상 외 구조일 경우 `isButtonClickPayload(payload)` 내부의 `payload.type` 접근이 `TypeError`를 발생시킬 수 있다. 현재 코드는 `payload` 객체 여부를 확인하지 않고 즉시 속성 접근을 시도한다.
  - 제안: 캐스팅 전 `typeof payload === 'object' && payload !== null` 가드를 추가하거나, `isButtonClickPayload`의 입력 타입을 `unknown`으로 받아 내부에서 객체 여부를 먼저 확인하도록 변경.

- **[INFO]** `INVALID_BUTTON_ID` 에러 메시지에 사용자 입력값 직접 포함
  - 위치: `button-interaction.service.ts`, `resolveButtonInteraction` 함수, `throw new Error(\`INVALID_BUTTON_ID: Button ${payload.buttonId} not found\`)`
  - 상세: 에러 메시지에 사용자가 제공한 `buttonId`가 그대로 포함되어 이 에러가 상위 레이어에서 직렬화되어 클라이언트에 노출될 경우 정보 누출로 이어질 수 있다. 다만 buttonId는 일반적으로 민감 정보가 아니며, 현재 코드에서 에러가 WebSocket/HTTP 응답에 직접 직렬화되는지는 이 diff 범위 내에서 확인되지 않는다.
  - 제안: 에러 메시지에서 사용자 입력값 제거 또는 서버 로그 전용으로 처리하고 클라이언트에는 표준화된 코드만 반환하는 패턴 확인.

- **[INFO]** `buttonItemMap`을 통한 배열 인덱스 접근 — 경계 검사 없음
  - 위치: `button-interaction.service.ts`, `resolveButtonInteraction` 함수, `outputItems[itemIndex]`
  - 상세: `itemIndex`가 `buttonItemMap`에서 읽어지는데, 이 값이 음수이거나 `outputItems.length`를 초과하는 경우 `undefined`를 반환한다. JavaScript에서 범위 초과는 에러를 발생시키지 않고 `undefined`를 반환하므로 `selectedItem`이 `undefined`가 되어 `selectedItem !== undefined` 조건 분기에서 제외된다. 현재 로직 흐름상 보안 취약점으로 이어지지는 않지만, 조작된 `buttonItemMap`이 임의 인덱스를 가리킬 경우 의도치 않은 데이터가 노출될 수 있다. `buttonItemMap`이 클라이언트 제어 데이터에서 유래한다면 위험도가 높아진다.
  - 제안: `buttonItemMap` 값의 유효 범위(0 이상, `outputItems.length` 미만) 검증 추가.

- **[INFO]** `structuredOutputCache`에 대한 직접 접근 — 타입 단언
  - 위치: `button-interaction.service.ts`, `processButtonResumeTurn`의 `context.structuredOutputCache?.[node.id]`
  - 상세: 보안 취약점이 아닌 타입 안전성 이슈. `structuredOutputCache`가 optional chaining으로 접근되어 null 안전성은 확보됨.
  - 제안: 해당 없음 (정보성 기록).

- **[INFO]** 테스트 파일에서 하드코딩된 URL (`https://x.test`)
  - 위치: `button-interaction.service.spec.ts`, 테스트 케이스 (b), (b3)
  - 상세: 테스트 픽스처에 사용된 URL로 실제 프로덕션 코드에는 영향 없음. 해당 URL은 테스트 전용이며 실제 네트워크 호출 없음.
  - 제안: 해당 없음 (정보성 기록).

### 요약

이번 변경은 기존 `processButtonResumeTurn` 메서드의 결정 로직을 순수함수(`resolveButtonInteraction`, `buildResumedStructuredOutput`)로 추출하고 타입 정의(`ButtonClickPayload`, `StructuredInteraction`)를 명시화한 리팩터링이다. 신규 기능 추가가 아니므로 공격 표면의 확장은 없다. 보안 관점에서 주목할 사항은 두 가지다: (1) `payload: unknown`을 가드 없이 캐스팅하는 지점에서 null/primitive 입력에 의한 런타임 에러 가능성이 존재하나, 이는 코드 버그 수준이며 실제 악용 가능성은 호출 경로의 상위 레이어 검증에 달려 있다. (2) `buttonItemMap` 인덱스 경계 검사가 없어 조작된 인덱스 값이 들어올 경우 의도치 않은 `outputItems` 항목이 노출될 수 있으나, 이 맵이 DB에서 로드되는 서버-사이드 데이터인지 클라이언트 전달 데이터인지에 따라 위험도가 달라진다. 하드코딩된 시크릿, SQL/XSS 인젝션, 인증 우회, 안전하지 않은 암호화 알고리즘은 발견되지 않았다.

### 위험도

LOW
