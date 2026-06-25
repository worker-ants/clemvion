# 유지보수성(Maintainability) 리뷰

## 발견사항

### 발견사항 1
- **[INFO]** `assertInstallNonceNotReplayed` 파라미터 객체의 `identifier` 필드명이 내부에서 `mallId`로 매핑됨 — 추상화 누수
  - 위치: `/codebase/backend/src/modules/integrations/integration-oauth.service.ts` L1349-1368 (`assertInstallNonceNotReplayed` 구현부)
  - 상세: helper 가 `params.identifier` 를 `installNonceCache.isReplay({ mallId: ... })` 의 `mallId` 에 매핑한다. `identifier` 는 의도적으로 provider-agnostic 하게 명명했으나, 캐시 API 가 `mallId` 라는 Cafe24-specific 이름을 노출하고 있어 MakeShop `shop_uid` 를 `mallId` 로 전달한다는 사실이 호출자의 인자 이름만으로는 명확하지 않다. 주석(L1344-1346)이 이를 설명하고 있으나, `Cafe24InstallNonceCache.isReplay` API 가 도메인 중립 이름(예: `storeId`)으로 리팩토링되기 전까지 인지 부담이 남는다.
  - 제안: 현 범위(M-1)에서는 수용 가능하다. 향후 `Cafe24InstallNonceCache` 인터페이스를 `InstallNonceCache<{ storeId: string }>` 형태로 일반화할 때 함께 해소할 것.

### 발견사항 2
- **[INFO]** `buildIntegrationDetailRedirectUrl` 내 매직 문자열 `'http://localhost:3000'`
  - 위치: L1377-1382 (`buildIntegrationDetailRedirectUrl`)
  - 상세: 폴백 기본값 `'http://localhost:3000'` 은 리팩토링 이전 원본 코드에서 그대로 이전된 값이다. 동일한 리터럴이 `handleInstall` 과 `handleMakeshopInstall` 두 곳에서 이제 이 단일 helper 로 통합되었으므로 중복은 해소됐다. 그러나 상수로 추출되어 있지 않아 값의 의미를 코드에서 바로 파악하기 어렵다.
  - 제안: 파일 상단의 상수 섹션에 `const FALLBACK_FRONTEND_URL = 'http://localhost:3000';` 을 추가하거나, `oauthEnv` 타입의 기본값 처리를 `emptyOAuthEnvConfig()` 로 일원화하여 helper 내에서 폴백을 직접 하드코딩하지 않도록 개선한다.

### 발견사항 3
- **[INFO]** `persistReauthorizeState`에서 `provider`와 `serviceType`이 모든 현재 호출자에서 동일 값으로 전달됨
  - 위치: L1392-1416 (`persistReauthorizeState`), 호출부 L1564-1570 (cafe24), L1872 부근 (makeshop)
  - 상세: cafe24 호출부에서 `provider: 'cafe24', serviceType: 'cafe24'`, makeshop 호출부에서 `provider: 'makeshop', serviceType: 'makeshop'` 으로 항상 동일하다. 현재 설계상 두 필드를 분리하는 것은 미래 확장을 위한 의도적 결정으로 보이며(JSDoc 이 cafe24/makeshop shape 를 명시), 동작 상 문제는 없다. 다만 현재 코드만 보면 두 파라미터가 왜 분리되는지 설명이 없어 불필요한 중복처럼 보일 수 있다.
  - 제안: JSDoc 또는 인라인 주석에 `serviceType` 과 `provider` 가 현재는 동일하지만, multi-service-type provider(예: cafe24 private vs public) 지원을 위해 분리 유지한다는 의도를 한 줄 추가한다.

### 발견사항 4
- **[INFO]** `assertInstallTimestampFresh` 내 `5 * 60` 계산식 — 인라인 매직 넘버
  - 위치: L1333 (`assertInstallTimestampFresh` 구현부)
  - 상세: `5 * 60` 은 5분을 초 단위로 표현한 것으로 의미가 명확하지만, 파일 상단의 `STATE_TTL_MS = 10 * 60 * 1000` 패턴처럼 명명 상수로 추출하면 일관성이 높아진다. JSDoc(L1321-1325)에 ±5min 이 명시되어 있어 현재도 이해는 가능하다.
  - 제안: `const INSTALL_TIMESTAMP_WINDOW_SEC = 5 * 60;` 상수를 추출하거나, 최소한 주석(`// 5 minutes`)을 인라인으로 추가한다. 기존 `STATE_TTL_MS` / `RECOVERY_CANDIDATE_LIMIT` 패턴과 일관성 유지.

### 발견사항 5
- **[INFO]** 섹션 구분 주석 블록이 파일 내에 두 번 나타남 (L1301-1319 와 L1684-1694)
  - 위치: L1301-1319, L1684-1694
  - 상세: `// Shared install-flow boilerplate (M-1)` 배너 주석이 두 위치에 있다. L1301-1319 가 helper 메서드들 바로 앞의 실제 위치이고, L1684-1694 는 파일 뒤쪽 `handleMakeshopInstall` 섹션 앞에 잘린 채 등장한다. 리팩토링 중 파일 내 이동이나 분할 과정에서 생긴 흔적으로 보인다. 실제 helper 메서드는 L1301 블록 직후에 배치되어 있어 L1684 블록은 불필요하거나 MakeShop 섹션 경계 표시로 의도한 것이라면 내용을 달리해야 한다.
  - 제안: L1684 부근의 중복 배너를 제거하거나, MakeShop 섹션 전용 배너(`// MakeShop install flow`)로 교체한다.

## 요약

이번 변경은 `handleInstall`(cafe24)과 `handleMakeshopInstall`(makeshop)에 걸쳐 반복되던 보안 보일러플레이트 4종을 private helper 4개로 추출한 behavior-preserving 리팩토링이다. 가독성과 중복 제거 측면에서 명확한 개선이며, 각 helper 의 JSDoc(번호 마킹 ①~⑥), 섹션 배너 주석, 호출부의 인라인 설명이 의도를 잘 전달한다. provider-specific 분기(HMAC 빌더 선택, 에러코드 prefix, SSRF/dedup 가드 등)를 helper 로 올리지 않고 caller 에 유지한 결정도 로컬 감사 가능성을 명확히 보존한다. 발견된 항목은 모두 INFO 수준으로, 하드코딩된 폴백 URL 상수화, 중복 배너 주석 정리, `identifier`→`mallId` 매핑 추상화 등 소규모 개선 기회이며 기능 동작이나 보안에는 영향이 없다.

## 위험도

LOW
