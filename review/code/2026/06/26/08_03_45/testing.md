# Testing Review — integration-oauth.service.ts (M-1 refactor)

## 발견사항

### [INFO] 새 private helper 4종은 직접 단위 테스트 없이 통합 경로로만 검증됨
- 위치: `assertInstallTimestampFresh`, `assertInstallNonceNotReplayed`, `buildIntegrationDetailRedirectUrl`, `persistReauthorizeState`
- 상세: 4개의 private helper는 `handleInstall`/`handleMakeshopInstall` 을 통해 간접 테스트된다. TypeScript private 접근 제한으로 직접 단위 테스트는 불가하지만, 각 helper의 분기 경로가 상위 caller 테스트에서 전부 커버되는지 개별 확인이 필요하다. 현재 caller 수준 테스트는 happy path와 일부 실패 경로를 포함하고 있어 behavioral regression은 잡히나, 리팩터 의도(중복 추출)가 맞는지 검증하는 명시적 단위가 없다.
- 제안: behavior-preserving 리팩터이므로 현행 구조(caller 레벨 통합 테스트)로 충분하다. 단, 아래 커버리지 갭 항목들은 보완이 필요하다.

### [WARNING] `assertInstallTimestampFresh` — NaN(비숫자) 타임스탬프 경로 테스트 누락
- 위치: `integration-oauth.service.cafe24.spec.ts`, `integration-oauth.service.makeshop.spec.ts` — `handleInstall` / `handleMakeshopInstall` describe 블록
- 상세: 현재 cafe24 spec(line 915)은 stale timestamp(400초 초과)만 테스트하고, makeshop spec(line 281)도 동일하게 10분 초과 케이스만 테스트한다. `assertInstallTimestampFresh` 내부의 `isNaN(timestampSec)` 분기(빈 문자열, 알파벳 포함 값, `undefined` 를 string으로 전달 등)는 어느 spec에도 테스트가 없다. 프로덕션에서 query param이 누락되거나 악의적으로 비숫자 값이 전달될 수 있으므로 보안 관련 엣지 케이스다.
- 제안: 두 spec 모두에 `timestamp: 'not-a-number'` / `timestamp: ''` 케이스를 추가해 동일 `CAFE24_INSTALL_REPLAY` / `MAKESHOP_INSTALL_REPLAY` 코드가 반환되는지 검증한다.

### [WARNING] `buildIntegrationDetailRedirectUrl` — `frontendUrl`/`appUrl` 모두 미설정 시 `localhost:3000` fallback 테스트 누락, trailing slash 제거 동작 테스트 누락
- 위치: `integration-oauth.service.cafe24.spec.ts` lines 1219-1265, `integration-oauth.service.makeshop.spec.ts` line 390-402
- 상세: post-install navigation 테스트는 `oauthMock.env.frontendUrl = 'https://app.example.com'`을 설정한 케이스만 다룬다. `frontendUrl`과 `appUrl`이 모두 falsy일 때의 `http://localhost:3000` fallback 분기, 그리고 URL 끝에 슬래시가 있을 때 trailing slash 제거(`replace(/\/$/, '')`)가 올바르게 동작하는지 테스트하는 케이스가 없다. 두 공급자에 공통 helper로 추출되었기 때문에 이 동작이 양쪽에서 일관됨을 보장하는 명시적 테스트가 더욱 중요하다.
- 제안: (1) `oauthMock.env.frontendUrl = ''`, `oauthMock.env.appUrl = ''` 상태에서 `localhost:3000/integrations/<id>` 반환 확인. (2) `oauthMock.env.frontendUrl = 'https://app.example.com/'` (trailing slash 있음)에서 double-slash 없이 생성되는지 확인.

### [WARNING] `assertInstallNonceNotReplayed` — 두 공급자 테스트 모두에서 nonce cache 경로 완전 누락
- 위치: `integration-oauth.service.cafe24.spec.ts`, `integration-oauth.service.makeshop.spec.ts` — `handleInstall` / `handleMakeshopInstall` describe 블록
- 상세: `grep` 결과 두 spec 파일 모두에서 `nonce`, `isReplay`, `installNonceCache` 관련 테스트가 전혀 없다. `Cafe24InstallNonceCache` 자체는 별도 spec(`cafe24-install-nonce-cache.service.spec.ts`)에서 단위 테스트되나, `assertInstallNonceNotReplayed`가 실제 `handleInstall` / `handleMakeshopInstall` 호출 경로에서 올바르게 호출되는지(replay 시 `CAFE24_INSTALL_REPLAY` / `MAKESHOP_INSTALL_REPLAY` throw), 그리고 `installNonceCache` 미주입 시 graceful no-op(skip)되는지를 검증하는 테스트가 없다. 두 공급자가 동일 helper를 공유하는 만큼 cross-provider 동작(makeshop의 `shop_uid`가 `identifier`로 올바르게 전달되는지)도 검증되지 않는다.
- 제안: 각 spec에 `installNonceCache`를 mock으로 주입한 fixture를 추가하고, (1) `isReplay` 가 true 반환 시 replay 에러코드 throw, (2) `installNonceCache` 없이 서비스 생성 시 nonce 단계 skip, (3) `identifier` 파라미터로 cafe24는 `mall_id`, makeshop은 `shop_uid`가 전달됨을 확인하는 케이스를 추가한다.

### [WARNING] `persistReauthorizeState` — `expiresAt` 계산, `code_verifier` 전달(makeshop) 상세 검증 제한적
- 위치: `integration-oauth.service.cafe24.spec.ts` line 1203-1210, `integration-oauth.service.makeshop.spec.ts` line 362-371
- 상세: 두 spec 모두 `stateRepo.save` 호출 횟수와 `mode`, `integrationId`, `provider` 정도만 단언한다. `persistReauthorizeState`가 추출된 후 (a) `expiresAt`이 `STATE_TTL_MS`(10분) 이후로 설정되는지, (b) `scope`/`integrationName`/`requestedScopes`가 올바르게 매핑되는지, (c) makeshop의 `providerMeta.code_verifier`가 누락 없이 state row에 포함되는지에 대한 명시적 단언이 없다. `code_verifier` 누락은 PKCE token exchange 실패로 이어지므로 회귀 위험이 높다.
- 제안: makeshop happy-path 테스트(line 332-372)의 state row 검증에 `pm.code_verifier` 의 string 여부 확인(이미 있음, line 369)은 유지하면서, `stateRow.expiresAt > Date.now()`를 시간 범위로 단언하고 `stateRow.requestedScopes` 배열이 원래 scopes와 일치하는지 확인한다.

### [INFO] 리팩터 후 regression 테스트 - 전반적으로 기존 테스트 유효성 보존됨
- 위치: 전체 spec
- 상세: commit message에 "unit(backend 7399 전건; integration-oauth install spec 140 타겟) PASS"가 명시되어 있어 기존 테스트가 리팩터 후에도 통과함이 확인된다. behavior-preserving 추출이므로 기존 오류 코드 리터럴(`CAFE24_INSTALL_REPLAY`, `MAKESHOP_INSTALL_REPLAY` 등) 및 메시지 문자열이 diff에서 변경되지 않았음도 확인된다.

### [INFO] 테스트 격리 — `beforeEach`/`afterEach` 패턴 적절
- 위치: 두 spec 파일 모두
- 상세: `beforeEach`에서 mock repo/service를 재생성하고, `afterEach`에서 `OAUTH_STUB_MODE` 환경변수를 원복한다. 테스트 간 상태 오염 없이 독립 실행 가능한 구조다. 리팩터로 새 helper가 추가되었지만 이 격리 패턴에는 영향 없다.

### [INFO] Mock 적절성 — `stateRepository.create`/`save` mock이 `persistReauthorizeState`의 실제 동작과 근접
- 위치: `makeRepo()` 팩토리 함수
- 상세: `create` mock은 입력 데이터를 그대로 반환하고, `save` mock은 entity를 resolve한다. `persistReauthorizeState` 내부 로직을 충분히 시뮬레이션하며 실제 TypeORM 동작과의 괴리가 크지 않다. 다만 `randomBytes(24).toString('hex')`로 생성되는 `state` 값의 형식 검증(48자 hex string)이 단언되지 않는다.

---

## 요약

M-1 리팩터는 behavior-preserving 추출이며 기존 7399개 unit test가 전건 통과해 회귀 위험은 낮다. 그러나 추출된 4개 private helper 중 `assertInstallNonceNotReplayed`는 두 공급자 spec 모두에서 nonce cache 경로(replay 탐지 및 cache 미주입 graceful skip)가 전혀 테스트되지 않는 명확한 커버리지 갭이 있다. `assertInstallTimestampFresh`의 NaN 분기와 `buildIntegrationDetailRedirectUrl`의 fallback URL/trailing slash 처리도 미검증으로, 두 공급자에 공통 helper를 공유함으로써 발생하는 cross-provider 동작 일관성을 보장하는 테스트가 부족하다. 기능적으로는 기존 캐리어 테스트가 주요 경로를 커버하지만, 위 갭들은 보안 관련 엣지 케이스(`isNaN`, nonce replay)를 포함하므로 보완이 권장된다.

## 위험도

LOW
