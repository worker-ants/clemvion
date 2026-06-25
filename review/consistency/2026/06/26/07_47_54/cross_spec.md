# Cross-Spec 일관성 검토 — 03 M-1: integration-oauth.service.ts handleInstall/handleMakeshopInstall 보일러플레이트 추출

## 검토 범위

구현 착수 전(--impl-prep) 검토. Target: `integration-oauth.service.ts` 의 `handleInstall`(cafe24)·`handleMakeshopInstall` 에서 동일한 보일러플레이트 4종 — timestamp ±5min 가드, nonce replay 가드, post-install navigation redirect, reauthorize state 생성/save — 을 private helper 로 추출(behavior-preserving). 다음은 명시된 유지 대상: HMAC 검증 빌더(`buildHmacMessage`/`buildMakeshopHmacMessage` 이미 분리)·provider guard(cafe24 recovery·mall_id/app_type, makeshop SSRF·shop_uid mismatch·409 dedup·projection·PKCE)·에러코드 prefix(`CAFE24_*/MAKESHOP_*`)·로그 메커니즘.

---

## 발견사항

### [INFO] timestamp ±5min 가드 로직 — 두 메서드 간 동일, spec 허용

- **target 위치**: `handleInstall` (L1317–1326) / `handleMakeshopInstall` (L1622–1631) — 동일한 `Math.abs(Math.floor(Date.now() / 1000) - timestampSec) > 5 * 60` 패턴
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/4-nodes/4-integration/4-cafe24.md §9.8` "timestamp ± 5분 이외 요청은 재전송 공격 방어 목적으로 즉시 거부"
- **상세**: 두 가드의 수치(5분)·거부 에러 코드(`CAFE24_INSTALL_REPLAY` vs `MAKESHOP_INSTALL_REPLAY`) 는 다르지만 판정 로직은 동일하다. private helper 로 추출할 때 단일 공통 함수에 `windowSec` 파라미터와 `replayErrorCode: string` 을 주입하면 spec 이 규정한 5분 윈도우와 provider 별 에러코드 분리를 동시에 보존할 수 있다. 충돌 없음.
- **제안**: helper 추출 시 `replayErrorCode` 를 주입 인자로 받아 provider 별 코드(rename 금지 — `error-codes.md §2`)가 각 메서드에서 결정되게 한다.

### [INFO] nonce replay 가드 — `installNonceCache.isReplay()` 패턴, spec 공유 명시

- **target 위치**: `handleInstall` (L1416–1432) / `handleMakeshopInstall` (L1697–1712) — 동일한 `this.installNonceCache?.isReplay(...)` + `CAFE24_INSTALL_REPLAY`/`MAKESHOP_INSTALL_REPLAY` 패턴
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/4-nodes/4-integration/4-cafe24.md §9.8` Nonce cache 보호 절 / `/Volumes/project/private/clemvion/spec/4-nodes/4-integration/5-makeshop.md §4` "Replay nonce guard (reuse cafe24 nonce cache)"
- **상세**: makeshop 스펙이 이미 "cafe24 nonce cache 를 재사용 — provider 간 collision 미발생"이라고 명시하므로, 두 메서드가 같은 `Cafe24InstallNonceCache` 인스턴스를 사용하는 것은 spec-compliant. private helper 로 추출해도 에러 코드를 provider 별로 주입하면 충돌 없음.
- **제안**: helper 에 `mallIdKey: string` (cafe24 = `query.mall_id`, makeshop = `query.shop_uid`)과 `replayCode: string` 을 주입 인자로 유지한다.

### [INFO] post-install navigation redirect — provider 별 로그 메시지가 spec 로그 메커니즘 요건의 일부

- **target 위치**: `handleInstall` (L1436–1451) / `handleMakeshopInstall` (L1715–1726)
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/4-nodes/4-integration/4-cafe24.md §9.8` "connected/error/expired → 우리 frontend `${FRONTEND_URL}/integrations/<id>` 로 redirect" / `/Volumes/project/private/clemvion/spec/4-nodes/4-integration/5-makeshop.md §4` "status routing — non-pending rows are post-install navigation"
- **상세**: redirect URL 구성(`${trimmed}/integrations/${target.id}`) 로직은 동일하지만, 로그 메시지("Cafe24 post-install navigation: mall=..." vs "MakeShop post-install navigation: shop_uid=...") 는 provider 명과 필드명이 다르다. 계획 문서(`03-maintainability.md M-1`)가 "로그 메커니즘은 각 메서드에 유지" 로 명시하고 있으므로, redirect URL 반환 로직만 helper 로 추출하고 logger.log 호출은 caller 에 유지해야 한다. redirect URL 반환 자체는 spec 에 정의된 behavior 이므로 충돌 없음.
- **제안**: helper 가 redirect URL 문자열만 반환하고, `this.logger.log(...)` 는 각 메서드에 남긴다.

### [INFO] reauthorize state 생성/save — `stateRepository.create/save` 패턴 공유, PKCE 분기가 makeshop 전용

- **target 위치**: `handleInstall` (L1461–1484) / `handleMakeshopInstall` (L1785–1812) — `stateRepository.create({ mode: 'reauthorize', ... })` + `save`
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/2-navigation/4-integration.md §9.2` OAuthState 엔티티 / `/Volumes/project/private/clemvion/spec/4-nodes/4-integration/5-makeshop.md §9.1` "PKCE S256 challenge"
- **상세**: `stateRecord` 의 공통 필드(state, workspaceId, userId, provider, serviceType, mode, integrationId, requestedScopes, integrationName, scope, expiresAt)는 동일. 차이는 `providerMeta` 구성과 makeshop 의 `code_verifier` 포함 여부. plan 문서 M-1 은 "authorizeUrlBuilder" 주입 방식을 제안하므로, state 생성 helper 는 `providerMeta` 를 caller 가 구성해 주입하면 spec 에 정의된 PKCE 분기가 침범되지 않는다. 충돌 없음.
- **제안**: helper 시그니처를 `createReauthorizeState(params: { workspaceId, userId, provider, ..., providerMeta })` 로 설계해 PKCE verifier 주입 여부를 caller 에서 결정하도록 한다.

### [INFO] HMAC 빌더 격리 — plan 문서와 일치, spec §9.7 VERIFY 마킹 보호

- **target 위치**: `handleInstall` (buildHmacMessage 사용) / `handleMakeshopInstall` (buildMakeshopHmacMessage 사용)
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/4-nodes/4-integration/5-makeshop.md §9.7` "설치 HMAC 메시지 구성은 makeshop 공식 문서 미확정분으로 코드에 `VERIFY` 마킹"
- **상세**: plan 문서(`03-maintainability.md M-1`)가 "makeshop HMAC 빌더는 `VERIFY` 미확정이므로 반드시 주입 함수로 격리 — cafe24 식 메시지 구성을 makeshop 에 강제하지 말 것"을 명시적으로 요구한다. cafe24 §9.8 이 규정한 `buildHmacMessage` (raw-encoded 보존)를 makeshop 에 공유 함수로 넣으면 이 격리 요건을 위반한다. 충돌 없음(계획 범위 내 확인 사항).
- **제안**: 추출 후 HMAC 메시지 빌더는 `hmacMessageBuilder: (rawQuery: string) => string` 형태의 주입 인자로 유지한다. 공용 `buildHmacMessage`를 makeshop 경로에서 직접 호출하는 구조 금지.

### [INFO] 에러코드 prefix 유지 — `error-codes.md §2` rename 금지 정책과 일치

- **target 위치**: `handleInstall` 의 `CAFE24_INSTALL_*` / `handleMakeshopInstall` 의 `MAKESHOP_INSTALL_*`
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/conventions/error-codes.md §2` "에러 코드 rename 은 breaking change"
- **상세**: 계획 명세가 "에러코드 prefix(`CAFE24_*/MAKESHOP_*`) 는 각 메서드에 유지"를 이미 포함하므로, 추출 후 helper 가 에러코드 문자열을 내부에서 결정하는 구조는 안 된다. 충돌 없음(정책 준수 확인).
- **제안**: helper 는 에러코드를 파라미터로 받거나, 에러 throw 를 caller 에 남긴다. helper 내부에서 `CAFE24_*` 또는 `MAKESHOP_*` 를 하드코딩해 두 코드를 분기 조건으로 선택하는 구조는 §2 의 rename 정책 의도(코드 값이 클라이언트 계약이므로 중앙화된 분기 지점 생성을 피함)에 어긋난다.

### [INFO] provider guard (cafe24 recovery, mall_id/app_type, makeshop SSRF·shop_uid mismatch·409 dedup·projection·PKCE) — helper 추출 범위 외

- **target 위치**: cafe24 `tryRecoverByMallId` (L1876–1956) / makeshop SSRF guard (L1642–1648) / 409 dedup (L1731–1750) / mall_id projection save (L1750–1782)
- **충돌 대상**: 없음
- **상세**: 계획 문서가 이미 이 로직들을 추출 범위 밖으로 명시("provider guard는 각 메서드에 유지"). spec(`4-cafe24.md §9.8` install_token mismatch recovery, `5-makeshop.md §4` SSRF guard, data-model §2.10 mall_id projection)이 provider 별로 다르게 규정하므로 공통화 대상이 아니다. 충돌 없음.

---

## 요약

이번 리팩토링(03 M-1)은 순수 behavior-preserving 추출이며, target 이 되는 4종 보일러플레이트(timestamp 가드·nonce 가드·post-install redirect·reauthorize state 생성)는 서로 다른 두 spec(`4-cafe24.md §9.8`, `5-makeshop.md §9.7`)이 각각 정의한 동일 행위의 구현 중복이다. 에러코드 prefix 안정성(`error-codes.md §2`), HMAC 빌더 격리(`5-makeshop.md §9.7 VERIFY`), 로그 메커니즘 provider 분리, provider-specific guard 유지 등 계획 문서가 이미 명시한 제약이 기존 spec 과 정확히 일치한다. 추출 후 helper 가 에러코드·HMAC 빌더를 caller 주입으로 받고 redirect URL 반환만 담당하는 구조를 지키면 어떤 spec 영역과도 충돌하지 않는다. 발견사항 전부 INFO 수준(명명 비일관성·동기화 권장)이며 차단 사항 없음.

---

## 위험도

NONE
