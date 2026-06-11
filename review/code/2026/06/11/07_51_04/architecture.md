# Architecture Review

## 발견사항

### [INFO] `buildOperationCatalog` 헬퍼의 타입 리터럴 유니언이 OCP를 약하게 위반
- 위치: `integrations.service.ts` — `buildOperationCatalog` 함수 시그니처 (`provider: 'cafe24' | 'makeshop'`)
- 상세: provider 유니언을 함수 시그니처에 하드코딩하면 새 provider 추가 시 함수 선언부도 수정해야 한다. 현재 provider는 2개이고 실제 로직 분기가 없어 실질적 위험은 낮지만, 타입이 `string`이어도 충분하며 `getServiceCatalog` 호출부에서 이미 경계 검사가 이루어진다.
- 제안: `provider: string`으로 완화하거나, provider 레지스트리(`INTEGRATION_DERIVED_REGISTRY` 패턴 참조)에서 catalog 빌더를 조회하는 방향으로 일관화. 다만 현재 규모에서는 INFO 수준이다.

### [INFO] `getServiceCatalog` if-chain이 개방-폐쇄 원칙을 부분 위반
- 위치: `integrations.service.ts` `getServiceCatalog()` 메서드 (~L1189–L1206)
- 상세: `if (serviceType === 'cafe24') … if (serviceType === 'makeshop') …` 분기가 provider 추가마다 이 메서드를 수정해야 하는 구조다. 같은 파일에는 `INTEGRATION_DERIVED_REGISTRY`(Map 기반 레지스트리 패턴)가 이미 존재하는데, catalog 조회만 별도 if-chain으로 남아 있어 패턴 불일치가 생긴다.
- 제안: `INTEGRATION_DERIVED_REGISTRY`와 유사한 `CATALOG_REGISTRY: Map<string, () => OperationCatalogDto>` 패턴을 도입하면 `getServiceCatalog`가 `return CATALOG_REGISTRY.get(serviceType)?.() ?? { operations: [] }` 한 줄로 줄어들고 OCP가 준수된다. 현재 provider 수(2)에서는 즉각 리팩터링이 강제되지 않지만 3개 이상 시 부채가 누적된다.

### [INFO] `tryTranslateLabel`의 provider prefix 분기가 프레젠테이션 레이어 내 조건부 라우팅으로 남음
- 위치: `codebase/frontend/src/app/(main)/integrations/[id]/page.tsx` — `tryTranslateLabel` 함수 (~L3557–L3567)
- 상세: `if (catalogKey.startsWith("makeshop.")) … if (catalogKey.startsWith("cafe24.")) …` 분기가 i18n 헬퍼 레이어(`cafe24-extras.ts`, `makeshop-extras.ts`)의 경계를 넘어 페이지 컴포넌트에 남아 있다. provider가 추가될 때마다 이 함수도 수정 대상이 된다. 현재는 2 provider라 관리 가능하지만 헬퍼 레이어로 이 라우팅 로직을 이관하면 페이지 코드에서 provider-aware 분기가 사라진다.
- 제안: `lib/node-definitions/` 레이어에 `resolveOperationLabel(locale, catalogKey): string | null` 단일 함수를 두고, 내부에서 prefix를 보고 각 provider 헬퍼를 호출하도록 중앙화. 페이지는 provider를 알 필요가 없어진다.

### [INFO] `oauthBegin` 컨트롤러 메서드의 provider-specific 분기가 컨트롤러 레이어에 잔류
- 위치: `integrations.controller.ts` `oauthBegin()` 메서드 (~L256–L277)
- 상세: `if (body.service === 'cafe24') { providerMeta = {...} } else if (body.service === 'makeshop') { providerMeta = {...} }` 분기가 컨트롤러에 존재한다. 컨트롤러는 HTTP 바인딩·라우팅 책임만 가져야 하고 provider별 메타 조립 로직은 서비스 또는 별도 팩토리 레이어 책임이다. 이 변경에서 새로 추가된 코드는 아니나, 기존 구조가 아키텍처 기대치에서 벗어나 있음을 명시한다.
- 제안: `buildProviderMeta(service, body)` 헬퍼를 서비스 레이어 또는 별도 파일로 추출해 컨트롤러를 얇게 유지. 단, 이번 PR 변경 범위는 주석 갱신뿐이라 이 항목은 기존 부채의 기록이다.

### [INFO] `INTEGRATION_DERIVED_REGISTRY`와 catalog 빌더 간 패턴 이중성 — 레지스트리 미통합
- 위치: `integrations.service.ts` 상단 `INTEGRATION_DERIVED_REGISTRY` Map vs `getServiceCatalog` if-chain
- 상세: provider별 파생 필드(appType, appUrl)는 Map 기반 레지스트리로 관리되어 확장 시 서비스 클래스 수정 없이 항목 추가만 하면 된다. 반면 catalog 조회는 if-chain으로 남아 동일 패턴을 따르지 않는다. 두 접근 방식이 같은 파일에 공존해 신규 provider를 추가하는 개발자가 어느 패턴을 따를지 혼동할 수 있다.
- 제안: 레지스트리 패턴을 catalog에도 적용해 일관성을 확보. 이 PR에서 `buildOperationCatalog` 헬퍼를 추출한 것은 올바른 방향이며, 다음 단계는 레지스트리화다.

---

## 요약

이번 변경은 `makeshop` provider의 catalog 조회와 프론트엔드 Activity 탭의 i18n 라벨 변환을 추가하는 협소한 기능 확장이다. 전반적인 레이어 책임 분리(controller → service → data)는 잘 지켜지고 있으며, `buildOperationCatalog` 공통 헬퍼 추출과 `INTEGRATION_DERIVED_REGISTRY`의 레지스트리 패턴은 긍정적이다. 다만 `getServiceCatalog`의 if-chain, 프론트엔드 `tryTranslateLabel`의 provider prefix 분기, 컨트롤러의 provider-aware `providerMeta` 조립이 서로 다른 레이어에 산발적으로 존재해 provider 3개 이상이 되면 산탄총 수술(shotgun surgery) 위험이 높아진다. 순환 의존성은 발견되지 않았고, 추상화 수준도 현재 규모에서 적절하다. 발견된 모든 항목이 INFO 수준으로 즉각적 블록 사유는 없다.

## 위험도

LOW
