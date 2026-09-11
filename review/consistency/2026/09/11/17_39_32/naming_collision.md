# 신규 식별자 충돌 검토 — impl-chat-channel-binder-t2 (`--impl-prep`, scope=`spec/5-system/`)

## 검토 범위 메모

`plan/in-progress/impl-chat-channel-binder-t2.md` 는 `spec_impact: none` — spec 문서를 전혀
바꾸지 않는 순수 코드 이동(리팩터) 작업이다. 따라서 "target 문서" 자체는 신규 요구사항 ID·
엔티티·API endpoint·이벤트명을 하나도 새로 부여하지 않는다. 이 체크는 대신 plan 이 예고한
**신규 코드 식별자**(신규 서비스명·신규 파일 경로·신규 함수명)가 기존 코드베이스·spec 상의
동명 또는 유사 개념과 충돌하는지를 검사했다. `spec/5-system/15-chat-channel.md` 등 15개
파일은 번들에서 예산 초과로 생략되어, 관련 부분은 `grep`/직접 조회로 저장소에서 확인했다.

신규 식별자 후보:

- `ChatChannelBinderService` (신규 Nest provider)
- `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` (신규 파일)
- `codebase/backend/src/modules/triggers/trigger-callback-url.ts` (신규 파일)
- `buildTriggerCallbackUrl(baseUrl, endpointPath)` (신규 순수 함수)

## 발견사항

- **[WARNING]** `buildTriggerCallbackUrl` 이 기존 "단일 표준 fallback" 원칙과 다른 축의 base-URL fallback 을 새로 만든다
  - target 신규 식별자: `trigger-callback-url.ts` 의 `buildTriggerCallbackUrl(baseUrl, endpointPath)` — plan 은 "기본값(`http://localhost:3011`)도 이 함수 안에 둔다" 고 명시(`plan/in-progress/impl-chat-channel-binder-t2.md` "설계" 절)
  - 기존 사용처: `codebase/backend/src/common/utils/app-base-url.ts` 의 `getAppBaseUrl()` — 정확히 동일한 패턴(`process.env.APP_URL || 'http://localhost:3011'` + 후행 슬래시 제거)을 캡슐화한 "**단일 진입점**" 이라고 그 파일 자신의 docstring 이 명시한다. 이 유틸은 `integrations.service.ts`·`integration-oauth.service.ts` 6곳 이상에서 이미 사용 중이며, 도입 사유가 바로 "동일 fallback 이 흩어져 일부만 갱신되는 위험"(W-28)이었다.
  - 상세: 이번에 이동 대상이 되는 `triggers.service.ts:1346` 의 기존 `private buildCallbackUrl()` 은 이미 `getAppBaseUrl()` 을 쓰지 않고 `this.configService.get('app.url') ?? 'http://localhost:3011'` 로 **같은 리터럴을 별도 재현**하고 있었다(선재 기술부채, 이번 plan 이 만든 것은 아님). 이번 plan 은 이 로직을 **그대로** 새 파일의 독립 함수로 승격시켜 "신규 이름의 신규 위치"를 하나 더 만든다 — 이름은 다르지만(`buildTriggerCallbackUrl` vs `getAppBaseUrl`) 캡슐화하는 "APP_URL 기본값 + 슬래시 정규화" 개념은 완전히 동일하다. 결과적으로 이 저장소에는 같은 fallback 규칙을 아는 진입점이 **둘**(`getAppBaseUrl` 과 `buildTriggerCallbackUrl` 내부 로직)이 되고, 하나만 바뀌면(예: 포트 변경) 다른 하나가 조용히 stale 해지는 구조가 고착된다. plan 은 "순수 이동이라 동작을 안 바꾼다"는 근거로 이 중복을 그대로 이월하는데, 이는 정당하지만(범위를 벗어난 개선을 이번 PR 에 섞지 않는 것 자체는 맞는 판단), 새 식별자가 기존에 존재하는 "단일 표준" 개념과 이름이 갈려 충돌 인지 자체가 어려워진다는 점은 이번 이동이 새로 만드는 리스크다.
  - 제안: 이름 충돌은 아니므로 즉시 이름을 바꿀 필요는 없지만, `trigger-callback-url.ts` 의 docstring 에 "이 fallback 리터럴은 `common/utils/app-base-url.ts` 의 `getAppBaseUrl()` 과 중복이며 통합 대상"이라는 한 줄 포인터를 남겨 향후 검색(`grep 'localhost:3011'`)으로 두 곳을 함께 찾을 수 있게 할 것을 권장. 통합 자체는 이번 PR 범위(순수 이동) 밖으로 두는 것이 맞다.

- **[INFO]** 신규 파일명은 기존 `triggers/` 명명 컨벤션과 정합
  - target 신규 식별자: `chat-channel-binder.service.ts`, `trigger-callback-url.ts`
  - 기존 사용처: `codebase/backend/src/modules/triggers/chat-channel-token-rotator.service.ts`(서비스), `chat-channel-input-rules.ts`(순수 함수, 접미사 없음), `chat-channel-rejection-messages.const.ts`
  - 상세: `triggers/` 디렉터리는 서비스류에 `.service.ts`, 순수 함수/규칙 모듈에는 접미사 없는 kebab-case 를 쓰는 두 패턴이 이미 공존한다(`chat-channel-token-rotator.service.ts` vs `chat-channel-input-rules.ts`). 신규 두 파일은 각각 이 두 패턴에 정확히 부합하며, 동일 디렉터리·전역 검색 모두에서 이름 충돌 없음을 확인했다(`grep -rn "ChatChannelBinderService"`, `find ... -iname "*chat-channel-binder*"`, `find ... -iname "*callback-url*"` 전부 신규 참조만 존재).
  - 제안: 없음 — 컨벤션 준수. 그대로 진행 가능.

- **[INFO]** `setupChatChannel`/`teardownChatChannel` 메서드명은 이동이지 신규 도입이 아님
  - target 신규 식별자: (해당 없음 — 기존 식별자 재사용)
  - 기존 사용처: `codebase/backend/src/modules/triggers/triggers.service.ts:833`(`setupChatChannel`), `:1024`(`teardownChatChannel`) — 이미 private 메서드로 존재하고 `triggers.service.spec.ts` 여러 곳에서 이 이름으로 테스트가 참조된다.
  - 상세: plan 은 "지금의 private 시그니처 그대로" 이동한다고 명시했고 호출부는 `this.chatChannelBinder.setupChatChannel(...)` 형태로만 바뀐다. 이름 자체는 새로 만들어지는 것이 아니라 소유 클래스만 바뀌므로 신규 식별자 충돌 범주에 해당하지 않는다. 다만 클래스 경계를 넘어 이름이 그대로 이동하는 경우이므로, 검색 시 "`setupChatChannel` 이 어디 정의됐나"를 클래스 이름 없이 grep 하면 두 시점(이동 전/후)의 결과가 갈릴 수 있다는 점만 기록해둔다(리뷰 참고용, 조치 불요).

- **[INFO]** OAuth 통합 도메인의 `callbackUrl`/`CallbackUrl` 표기와는 개념적으로 분리되어 충돌 없음
  - target 신규 식별자: `buildTriggerCallbackUrl`
  - 기존 사용처: `codebase/backend/src/modules/integrations/third-party-oauth.constants.ts` 의 `buildCafe24InstallUrl`/`buildMakeshopInstallUrl`/`buildOAuthCallbackUrl`(`callbackUrl: appBaseUrl + '/api/3rd-party/.../callback'`), frontend `cafe24-app-url-card.tsx` 등의 "콜백 URL" 표기
  - 상세: 두 "콜백 URL" 은 서로 다른 바운디드 컨텍스트다 — 하나는 3rd-party OAuth 설치 콜백(제품 통합), 하나는 트리거 webhook 수신 콜백(chat-channel). 함수명이 `buildTriggerCallbackUrl` 로 접두어(`Trigger`)를 갖고 있어 `buildOAuthCallbackUrl` 류와 이름이 겹치지 않으며, 텍스트 검색으로 혼동될 소지도 낮다.
  - 제안: 없음.

## 요약

이번 target(`impl-chat-channel-binder-t2`)은 `spec_impact: none` 인 순수 백엔드 코드 이동이라 spec 레벨 요구사항 ID·엔티티·API endpoint·이벤트명·ENV 키 신규 도입은 없다. plan 이 예고한 4개 신규 코드 식별자(`ChatChannelBinderService`, `chat-channel-binder.service.ts`, `trigger-callback-url.ts`, `buildTriggerCallbackUrl`)를 전수 grep 했고 리터럴 이름 충돌은 없었으며 `triggers/` 디렉터리의 기존 명명 컨벤션(서비스=`.service.ts`, 순수 함수=접미사 없음)에도 정확히 부합한다. 유일하게 짚을 점은 이름 충돌이 아니라 "다른 이름·같은 개념"의 잠재적 혼동으로, 신규 `buildTriggerCallbackUrl` 이 캡슐화하는 `APP_URL` 기본값(`http://localhost:3011`) 로직이 이미 `common/utils/app-base-url.ts` 의 `getAppBaseUrl()`("단일 표준 fallback"으로 명시적으로 설계됨)과 동일한 규칙을 별도 이름으로 재현한다는 것이다. 다만 이는 이번 plan 이 새로 만든 부채가 아니라 기존 `triggers.service.ts` 의 `buildCallbackUrl` 이 이미 갖고 있던 상태를 순수 이동으로 승계하는 것이며, plan 이 "동작 보존"을 이번 PR 의 명시적 경계로 선언했으므로 통합은 범위 밖 후속 과제로 남기는 것이 합리적이다. 신규 식별자 충돌 관점에서 이 target 을 차단할 CRITICAL 은 없다.

## 위험도

LOW
