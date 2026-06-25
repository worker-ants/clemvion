# Requirement Review — M-1 install 흐름 boilerplate 추출

**리뷰 대상**: `codebase/backend/src/modules/integrations/integration-oauth.service.ts`
**커밋**: `f77aeed4015feca561a9ca4673b6c5e3da7997ec`
**변경 유형**: Behavior-preserving refactor (boilerplate 4종 helper 추출)

---

## 발견사항

### **[INFO]** 기능 완전성 — 행동 보존 확인

4개 helper 각각의 이전 인라인 코드와 추출 후 코드를 대조했다.

**assertInstallTimestampFresh**: 이전 코드와 완전 동일. `parseInt(timestamp, 10)`, `isNaN` 검사, `Math.abs(Math.floor(Date.now() / 1000) - timestampSec) > 5 * 60`, `BadRequestException({ code: replayErrorCode, message: '...' })` 모두 보존.

**assertInstallNonceNotReplayed**: 이전 인라인 `if (this.installNonceCache)` 분기를 `if (!this.installNonceCache) return;` 으로 early-return 형태로 변환했으며 동작은 동일. `mallId: params.identifier` 매핑이 정확하다 — cafe24 는 `query.mall_id`, makeshop 은 `query.shop_uid` 를 각각 `identifier` 로 전달하고 이것이 `Cafe24InstallNonceCache.isReplay({ mallId })` 로 연결되어 Redis 키(`cafe24:install:nonce:{mallId}:...`)를 구성한다.

**buildIntegrationDetailRedirectUrl**: `frontendUrl || appUrl || 'http://localhost:3000'` 체인 + trailing slash 제거 로직 완전 보존. spec `${FRONTEND_URL}/integrations/<id>` 형식과 일치.

**persistReauthorizeState**: 이전 인라인 7개 필드(`workspaceId`, `userId`, `provider`, `serviceType`, `mode: 'reauthorize'`, `integrationId`, `requestedScopes`, `integrationName`, `scope`, `providerMeta`, `expiresAt`) 전체 보존 확인. `randomBytes(24).toString('hex')` state 생성 + `stateRepository.create/save` 순서 동일.

- 위치: `integration-oauth.service.ts:1392–1416`
- 상세: behavior-preserving 추출의 의도와 구현이 일치함. 되돌리거나 수정할 사항 없음.

---

### **[INFO]** makeshop nonce 키의 `mallId` 시맨틱 혼용

- 위치: `cafe24-install-nonce-cache.service.ts:51–84`, `integration-oauth.service.ts:1357–1358`
- 상세: `Cafe24InstallNonceCache.isReplay` 의 파라미터가 `mallId: string` 으로 명명되어 있으나, makeshop 경로에서는 `query.shop_uid` 가 그 위치에 들어간다. 이것은 M-1 이전부터 존재하던 코드 (이전 인라인도 동일하게 `mallId: query.shop_uid` 로 호출)이며, 같은 nonce 캐시 서비스를 재사용하는 의도적 설계다 (코드 주석: "Replay nonce guard (reuse cafe24 nonce cache — keyed by value+timestamp+hmac; the hmac differs across providers so cross-provider collision is not a practical concern)"). 본 PR 에서 도입된 문제가 아님.
- 제안: 현 상태 유지. `identifier` 추상화 파라미터명을 도입해 makeshop 에서 `identifier = query.shop_uid` 가 `mallId` 슬롯으로 들어간다는 점을 helper 에서 명시한 점은 오히려 명확성 향상.

---

### **[INFO]** spec fidelity — helper 함수명이 spec 에 없음

- 위치: 신규 helper 선언 4종 (`assertInstallTimestampFresh`, `assertInstallNonceNotReplayed`, `buildIntegrationDetailRedirectUrl`, `persistReauthorizeState`)
- 상세: 해당 helper 들이 구현하는 **동작**은 모두 spec 에 정의되어 있다:
  - ±5분 window: `spec/2-navigation/4-integration.md:853` (`CAFE24_INSTALL_REPLAY` 400, `timestamp ±5분 윈도우 밖`)
  - nonce replay 가드: `spec/4-nodes/4-integration/4-cafe24.md:552` (Nonce cache 보호 절)
  - post-install redirect: `spec/2-navigation/4-integration.md:215` (`${FRONTEND_URL}/integrations/<id>` 302)
  - reauthorize state 행: `spec/2-navigation/4-integration.md §10.2` (state row 생성)
  
  단, **helper 함수명/추출 패턴 자체**는 spec 에 명시적으로 정의되지 않는다 — 이는 내부 구현 세부사항이며 spec 의무 대상이 아님.
- 제안: 해당 없음. spec 불일치 없음.

---

### **[INFO]** `assertInstallNonceNotReplayed` — early-return 시 nonce 기록 누락 없음

- 위치: `integration-oauth.service.ts:1356`
- 상세: `if (!this.installNonceCache) return;` early return 은 원본 `if (this.installNonceCache) { ... }` 와 semantically 동일하다. `installNonceCache` 가 없을 때 nonce 를 기록하지 않는 graceful degradation 정책(`spec/4-nodes/4-integration/4-cafe24.md:552` "Redis 미설정 / 통신 실패 시 graceful degradation")과 일치함.

---

### **[INFO]** `persistReauthorizeState` — `target.createdBy` 를 `userId` 로 사용

- 위치: `integration-oauth.service.ts:1403`
- 상세: 이전 인라인 코드도 동일하게 `userId: target.createdBy` 를 사용했다. 이는 "Integration 을 처음 만든 사용자가 install callback 의 상태 row 소유자가 된다"는 기존 정책 보존이다. 추출로 변경된 사항 없음.

---

### **[INFO]** `persistReauthorizeState` 의 `scopes` 매개변수명 변경

- 위치: `integration-oauth.service.ts:1408`, diff 에서 `requestedScopes: scopes,` → helper 호출 시 `scopes,`
- 상세: helper 파라미터는 `scopes: string[]` 이고 내부에서 `requestedScopes: params.scopes` 로 매핑된다. 호출부에서 `scopes` 변수를 직접 전달하므로 동작 동일. 렌더링 이름 변경뿐 data flow 변화 없음.

---

## 요약

M-1 리팩터링은 `handleInstall`(cafe24)과 `handleMakeshopInstall`(makeshop) 에서 동일하게 반복되던 보안 install 보일러플레이트 4종(`assertInstallTimestampFresh`, `assertInstallNonceNotReplayed`, `buildIntegrationDetailRedirectUrl`, `persistReauthorizeState`)을 private helper 로 추출한 순수 behavior-preserving 변경이다. 각 helper 의 로직은 이전 인라인 코드와 라인 수준에서 동일하게 보존됨을 확인했으며, spec이 정의한 동작(±5분 window, nonce replay 가드, `${FRONTEND_URL}/integrations/<id>` redirect, reauthorize state row 필드 전체)과 일치한다. provider-specific 분기(HMAC 검증, 에러코드 prefix, cafe24 install_token recovery, makeshop SSRF 가드 등)는 의도적으로 각 caller 에 보존되어 있어 로컬 가독성이 유지된다. 기능 완전성·엣지 케이스·에러 시나리오·비즈니스 로직·반환값·spec fidelity 모든 관점에서 문제 없음.

## 위험도

NONE
