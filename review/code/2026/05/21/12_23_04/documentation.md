# 문서화(Documentation) 리뷰

## 발견사항

### 1. README — 불일치: `@workflow/sdk` vs `@clemvion/sdk`

- **[WARNING]** `codebase/packages/sdk/README.md` 와 `package.json` 은 패키지명을 `@workflow/sdk` 로 명시하고 있으나, `plan/complete/external-interaction-api.md` §3.2 에는 `@clemvion/sdk` 로 적혀 있다. consistency check INFO 항목에서도 이 결정이 아직 `@workflow/sdk` 로 확정되었음을 언급하지만, plan 본문에 반영이 누락되어 README 와 plan 간 이름이 다르다.
  - 위치: `codebase/packages/sdk/README.md` 1행, `plan/complete/external-interaction-api.md` §3.2
  - 상세: plan 의 §3.2 가 여전히 `@clemvion/sdk` 를 기록하고 있어, 외부 독자가 어느 이름이 실제 사용되는지 혼동할 수 있다.
  - 제안: plan §3.2 의 `@clemvion/sdk` 를 `@workflow/sdk` 로 정정하거나, consistency check Info 결론과 README 가 이미 `@workflow/sdk` 로 확정되었음을 plan 내 각주로 명시한다.

### 2. README — `cancel` 엔드포인트 URL 부정확

- **[WARNING]** `codebase/packages/sdk/README.md` API 섹션의 `cancel` 설명이 `POST /:id/cancel` 로 상대 경로만 표기되어 있어 앞뒤 메서드 (`interact`, `refreshToken`, `getStatus`) 와 형식이 다르다. `client.ts` 실제 구현은 `POST /api/external/executions/:id/cancel` 이다.
  - 위치: `codebase/packages/sdk/README.md` `ClemvionClient` API 섹션
  - 상세: `interact` 는 전체 경로를 명시하고 있으나 `cancel`, `refreshToken`, `getStatus` 는 `/:id/...` 형태로만 표기되어 있어 base path 를 독자가 유추해야 한다.
  - 제안: `cancel(executionId, token, reason?)` 설명을 `POST /api/external/executions/:id/cancel` 로 통일하고, `refreshToken`, `getStatus` 도 동일하게 전체 경로로 수정한다.

### 3. SDK `client.ts` — `SseEvent` 타입의 `data` 필드 문서 부재

- **[INFO]** `SseEvent.data` 가 `Record<string, unknown>` 으로만 선언되어 있고 어떤 이벤트 타입(`execution.ai_message`, `execution.completed` 등)에서 어떤 필드를 포함하는지 JSDoc 또는 별도 타입이 없다. README 예제에서 `e.data.message` 를 참조하지만 타입 정의에는 이 필드가 드러나지 않는다.
  - 위치: `codebase/packages/sdk/src/client.ts` `SseEvent` 인터페이스
  - 상세: 외부 사용자는 이벤트별 `data` 형태를 스스로 추측해야 한다. README 예제가 유일한 힌트이나 타입 레벨 안전망은 없다.
  - 제안: 이벤트별 페이로드를 discriminated union 으로 정의하거나, 최소한 JSDoc `@example` 과 이벤트명 목록을 `SseEvent` 에 주석으로 추가한다.

### 4. `client.ts` — `subscribeToExecution` 의 SSE 재연결 제한 주석 노출 불충분

- **[INFO]** `subscribeToExecution` JSDoc 에 "Last-Event-Id 자동 재연결은 v1 에서 미지원" 이라고 명시되어 있으나, 이 제한 사항이 README API 섹션에는 누락되어 있다.
  - 위치: `codebase/packages/sdk/src/client.ts` `subscribeToExecution` JSDoc, `codebase/packages/sdk/README.md` `subscribeToExecution` 항목
  - 상세: README 에서 `handlers.lastEventId` 로 재연결 가능하다고 설명하지만 자동 재연결이 지원되지 않는다는 제한은 누락되어 있다.
  - 제안: README 의 `subscribeToExecution` 항목에 "(v1: 자동 재연결 미지원 — 수동 재호출 필요)" 한 줄을 추가한다.

### 5. `signature.ts` — `computeNotificationSignature` 의 사용 목적 주석 모호

- **[INFO]** `computeNotificationSignature` 의 JSDoc 에 "보통은 backend 가 자동 서명하므로 사용 빈도는 낮지만" 이라고 적혀 있으나, 이 함수가 실제로 어떤 시나리오(테스트, mock 서버 구축 등)에서 필요한지 구체적인 예가 없다. README 에도 이 함수는 `verifyNotificationSignature` 만 다루고 있어 `computeNotificationSignature` 는 완전히 누락되어 있다.
  - 위치: `codebase/packages/sdk/src/signature.ts` `computeNotificationSignature`, `codebase/packages/sdk/README.md`
  - 상세: 공개 export 임에도 README API 섹션에 등재되지 않았다.
  - 제안: README API 섹션에 `computeNotificationSignature(algorithm, secret, timestampSec, rawBody)` 항목을 추가하고 "테스트 서버 목 구현 시 사용" 이라는 한 줄 설명을 덧붙인다.

### 6. `index.ts` — `SseEvent` 타입 미 export

- **[INFO]** `SseEvent` 인터페이스가 `client.ts` 에 정의되어 있으나 `index.ts` 의 export 목록에 포함되지 않았다. `subscribeToExecution` 의 `onEvent` 콜백을 타이핑하려는 사용자는 `SseEvent` 를 직접 import 할 수 없다.
  - 위치: `codebase/packages/sdk/src/index.ts`
  - 상세: `SseEventHandler` 는 export 되지만 그 인자 타입인 `SseEvent` 는 누락되어 있다.
  - 제안: `index.ts` 의 type re-export 목록에 `SseEvent` 를 추가한다.

### 7. `triggers.ts` i18n — 인라인 주석의 Spec 참조가 충분

- **[INFO]** `externalInteraction` 블록 상단 주석 `// External Interaction API (Spec EIA §4)` 는 적절하게 출처를 명시하고 있어 양호하다. 다만 `notificationSecretRotate: "Secret rotation"` 이 영문 그대로 노출되는데, 이는 의도적 결정이라면 주석으로 명시하면 더 명확해진다.
  - 위치: `codebase/frontend/src/lib/i18n/dict/ko/triggers.ts` line `notificationSecretRotate`
  - 상세: 다른 키들과 달리 한국어 번역 없이 영문 그대로 사용하는 이유가 불명확하다.
  - 제안: 의도적 영문 노출이면 `// UI 레이블 영문 유지 (브랜드 용어)` 형태의 짧은 주석을 추가한다.

### 8. 변경 이력(CHANGELOG) 업데이트 없음

- **[INFO]** 신규 공개 패키지 `@workflow/sdk` 가 추가되었으나 프로젝트 수준의 CHANGELOG 파일이 없거나 업데이트되지 않았다. 패키지 `package.json` 의 `version: 0.1.0` 이 초기 릴리스임을 암시하나, 향후 버전 관리 시 CHANGELOG 부재가 문제가 될 수 있다.
  - 위치: `codebase/packages/sdk/package.json`
  - 상세: 초기 버전(0.1.0)이므로 필수는 아니나, 다음 버전 업 전에 CHANGELOG 관리 방침 확립이 권장된다.
  - 제안: `codebase/packages/sdk/CHANGELOG.md` 를 `0.1.0` 섹션으로 미리 생성하거나, 모노레포 루트의 CHANGELOG 정책에 SDK 를 포함시킨다.

### 9. README — 환경변수 문서화 부재

- **[INFO]** `signature.ts` 예제 코드에서 `process.env.CLEMVION_NOTIFICATION_SECRET` 환경변수를 참조하지만 README 에 이 환경변수에 대한 별도 설명 섹션이 없다.
  - 위치: `codebase/packages/sdk/README.md` "Outbound Notification 서명 검증" 예제
  - 상세: 어디서 이 값을 얻는지(trigger 설정 화면의 secret 값), 어떻게 rotate 하는지에 대한 안내가 없다.
  - 제안: README 에 "환경변수 / 설정" 소섹션을 추가하거나, 예제 주석에 `// trigger 설정 화면의 notification secret` 한 줄을 추가한다.

---

## 요약

`@workflow/sdk` 패키지의 README 는 주요 사용 시나리오 3가지를 예제로 커버하고 있으며, `client.ts` 와 `signature.ts` 의 공개 함수에 JSDoc 이 적절히 작성되어 있다. i18n 파일의 인라인 주석도 Spec 참조를 명시하여 유지보수 맥락을 제공하고 있다. 다만 패키지명(`@workflow/sdk` vs `@clemvion/sdk`) 이 plan 문서와 불일치하고, `cancel`/`refreshToken`/`getStatus` 의 API 경로 표기가 `interact` 와 형식이 다르며, 공개 export 임에도 README 에 누락된 `computeNotificationSignature` 와 `SseEvent` 타입 re-export 누락이 주요 개선 포인트다. 전반적으로 SDK 로서의 기본 문서 구조는 갖추어져 있으나 세부 정확성 측면에서 보완이 필요하다.

---

## 위험도

LOW

STATUS=success
