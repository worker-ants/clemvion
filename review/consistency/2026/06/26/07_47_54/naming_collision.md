# 신규 식별자 충돌 Check — 03 M-1: handleInstall/handleMakeshopInstall 보일러플레이트 helper 추출

## 검토 범위

구현 대상: `integration-oauth.service.ts` 의 `handleInstall`(cafe24)과 `handleMakeshopInstall`(makeshop)에서 동일 보일러플레이트 4종(timestamp ±5min 가드·nonce replay 가드·post-install navigation redirect·reauthorize state 생성/save)을 private helper 로 추출.

spec: `4-cafe24.md §9.8`, `5-makeshop.md §9.7`, `error-codes.md §2`.

---

## 발견사항

### [INFO] 추출 대상 helper 명이 아직 정해지지 않은 상태 — 기존 명칭과 충돌 위험 지점 안내

- **target 신규 식별자**: plan `03-maintainability.md M-1` 의 개선 방안에서 언급된 후보: `IntegrationInstallConfig`(타입), `hmacMessageBuilder`/`errorCodePrefix`/`authorizeUrlBuilder`/`redirectPolicy`(config 필드)
- **기존 사용처**: `integration-oauth.service.ts` 내 기존 private helper 명: `rejectCafe24InvalidScope`, `consumeOAuthState`, `exchangeCodeForToken`, `createPrivatePendingIntegration`, `createMakeshopPendingIntegration`, `findMakeshopPendingByClient`, `findConnectedMakeshopShopIntegration`, `tryRecoverByMallId`, `findAllCafe24RowsForMall`, `findConnectedCafe24MallIntegration`, `purgeExpired`, `logHmacFailure`
- **상세**: target 이 명시적으로 추출할 helper 이름을 선언하지 않았으므로 현 시점에서 이름 충돌을 직접 검출할 수 없다. 단, `IntegrationInstallConfig` 는 현재 코드베이스에 존재하지 않아 신규 도입 가능. `hmacMessageBuilder` 필드명도 신규.
- **제안**: 구현 시 `checkInstallTimestamp`, `checkInstallNonceReplay`, `buildPostInstallRedirectUrl`, `saveReauthorizeState` 등의 helper 명이 후보가 될 수 있다. 이들은 현재 코드에 없으며 충돌 없음. `verifyHmacWithMessage`(기존 모듈 private 함수), `buildHmacMessage`(기존 export), `buildMakeshopHmacMessage`(기존 export)는 plan 에서 "유지"로 명시되어 충돌 없음.

---

### [INFO] `IntegrationInstallConfig` 타입명 — 기존 DTO/인터페이스와의 유사명 확인

- **target 신규 식별자**: plan M-1 개선 방안 1에서 제안된 `IntegrationInstallConfig`
- **기존 사용처**: `codebase/backend/src/modules/integrations/dto/` 하위 DTO 들. `BeginParams`(line 75), `BeginResult`(line 88), `CallbackResult`(line 146), `CallbackContext`(line 162)가 동일 파일에 이미 정의됨. `MakeshopInstallQuery`(line 120), `Cafe24InstallQuery`(line 129)도 기존 export 인터페이스.
- **상세**: `IntegrationInstallConfig`라는 이름은 현재 코드베이스에 없어 신규 도입 가능. `*InstallQuery`(provider-specific 파라미터)와 `*InstallConfig`(파이프라인 주입 설정)는 역할이 달라 의미 충돌 없음.
- **제안**: 이름 충돌 없음. 도입 시 JSDoc 에 "install 파이프라인 공통 설정 주입 객체" 역할을 명시해 `*InstallQuery`(쿼리 파라미터 DTO)와 혼동을 방지 권장.

---

### [INFO] `errorCodePrefix` config 필드명 — error-codes.md §2 rename 금지 정책과 무관

- **target 신규 식별자**: plan M-1 개선 방안에서 언급된 `errorCodePrefix` config 필드
- **기존 사용처**: `error-codes.md §2` "에러 코드 rename 은 breaking change". 기존 에러 코드 리터럴: `CAFE24_INSTALL_REPLAY`, `CAFE24_INSTALL_INVALID_TOKEN`, `CAFE24_INSTALL_INVALID_HMAC`, `MAKESHOP_INSTALL_REPLAY`, `MAKESHOP_INSTALL_INVALID_TOKEN`, `MAKESHOP_INSTALL_INVALID_HMAC` 등.
- **상세**: `errorCodePrefix` 는 config 객체의 **필드명**이며, 실제 에러 코드 **값**(`CAFE24_*`/`MAKESHOP_*`)은 각 provider guard 에 유지된다. config 객체 필드명은 error-codes.md §2 의 "클라이언트 계약" 대상이 아니다 — 내부 JS/TS 식별자이므로 rename 금지 정책이 적용되지 않는다. 실제 throw 에 쓰이는 에러 코드 문자열을 `errorCodePrefix` 로 동적 조합하는 구현은 개별 throw 지점에 고정값을 두는 것보다 타입 안전성이 낮으므로, 고정 에러 코드를 각 provider guard 에 유지하라는 plan 지침(에러코드 prefix rename 금지)과도 일관된다.
- **제안**: `errorCodePrefix` 필드를 config 에 두지 말고, 각 provider 에서 완전한 에러 코드 상수를 직접 throw 하는 기존 패턴 유지 권장. plan M-1 이 이미 "에러 코드 prefix 는 provider 별 유지" 를 명시하고 있어 코드 구조적으로도 정합.

---

### [INFO] `authorizeUrlBuilder` / `redirectPolicy` — 기존 `resolveOAuthStrategy` + `buildOauthCallbackUrl` 과의 역할 중복 확인

- **target 신규 식별자**: plan M-1 개선 방안의 `authorizeUrlBuilder`, `redirectPolicy` config 필드
- **기존 사용처**: `resolveOAuthStrategy` (line 539, 1485, 1810 — `oauth-providers` 모듈 export), `buildCafe24InstallUrl`/`buildMakeshopInstallUrl`/`buildOauthCallbackUrl` (`third-party-oauth.constants.ts` 에서 import). `getAppBaseUrl()` 유틸.
- **상세**: `authorizeUrlBuilder` 가 `resolveOAuthStrategy(...).buildAuthorizeUrl(...)` 를 wrapping 하는 형태라면 기능 중복이 발생한다. `resolveOAuthStrategy` 는 M-2(이미 완료된 별도 리팩토링)에서 도입된 provider strategy 패턴으로, 각 provider 의 authorize URL 빌더가 이미 strategy 에 캡슐화되어 있다. install 공통 파이프라인이 `resolveOAuthStrategy` 를 직접 호출하는 것이 중복 wrapper 도입보다 의존 레이어가 명확하다.
- **제안**: `authorizeUrlBuilder` 필드 대신 config 에서 provider 식별자(`'cafe24' | 'makeshop'`)를 받고, 파이프라인 내부에서 기존 `resolveOAuthStrategy` 를 호출하는 설계 권장. 이름·인터페이스 충돌은 없으나 기존 strategy 패턴과의 중복을 설계 단계에서 정리하면 유지보수 비용이 낮다.

---

### [INFO] nonce replay 가드 — `Cafe24InstallNonceCache` 파라미터 `mallId` 필드가 makeshop 에서 `shop_uid` 의미로 재사용

- **target 신규 식별자**: 공통 nonce 가드 helper 가 `installNonceCache.isReplay({ mallId, timestamp, hmac })` 를 내부 호출할 때, makeshop 흐름에서는 `mallId` 자리에 `shop_uid` 를 전달하는 현행 패턴 (`handleMakeshopInstall` line 1701–1703)
- **기존 사용처**: `Cafe24InstallNonceCache.isReplay({ mallId, timestamp, hmac })` — `mallId` 파라미터명이 `cafe24-install-nonce-cache.service.ts` 에 고정
- **상세**: 현재 `handleMakeshopInstall` 이 `mallId: query.shop_uid` 로 nonce cache 를 호출하는 구조가 이미 존재(코드 주석 "reuse cafe24 nonce cache — keyed by value+timestamp+hmac"). 공통 helper 로 추출할 경우 이 "의미 불일치(mallId vs shop_uid)" 가 helper 시그니처에 그대로 노출된다. 외부 관찰 가능한 behavior 에는 영향 없으나(Redis 키가 값으로 구분), helper 의 파라미터 타입 문서화가 불명확해질 수 있다.
- **제안**: 공통 helper 의 파라미터를 `identifier` 또는 `shopIdentifier` 로 이름을 중립화하거나, `mallId: cafe24MallId | makeshopShopUid` 용도를 JSDoc 에 명시하는 것을 권장. 기능·동작 충돌은 없음.

---

## 요약

03 M-1 은 `integration-oauth.service.ts` 내부에서 `private` helper 를 추출하는 behavior-preserving 리팩토링이다. target 문서(plan)가 구체적인 helper 이름을 아직 확정하지 않았고, 실제 신규 export 식별자(에러 코드·API 엔드포인트·이벤트명·환경변수)를 도입하지 않으므로 외부 클라이언트 계약에 대한 명명 충돌은 없다. 주의점은 세 가지다: (1) `IntegrationInstallConfig` 타입과 기존 `*InstallQuery` DTO 의 역할 혼동을 JSDoc 으로 방지, (2) `authorizeUrlBuilder` config 필드가 이미 완료된 M-2 strategy 패턴(`resolveOAuthStrategy`)과 중복 추상화 계층을 만들지 않도록 설계 검토, (3) nonce 가드 공통 helper 에서 `mallId` 파라미터 시그니처가 makeshop 의 `shop_uid` 를 흡수할 때 명칭 중립화 권장. 에러 코드(`CAFE24_*`/`MAKESHOP_*`) rename 은 plan 이 이미 금지로 명시하고 있어 충돌 위험 없음.

## 위험도

LOW
