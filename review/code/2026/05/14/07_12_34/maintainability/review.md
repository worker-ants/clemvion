## 발견사항

---

### [WARNING] Controller에 provider-specific 변환 로직 혼입

- **위치**: `integrations.controller.ts` +9~+22
- **상세**: `providerMeta` 구성 로직(mallId/appType/clientId/clientSecret 조합)이 Controller에 직접 들어가 있다. OAuth provider가 추가될 때마다 Controller의 분기가 늘어나며, 서비스 레이어의 `begin()`이 이 변환을 모른다는 뜻이기도 하다.
- **제안**: `OAuthBeginDto`에 `providerMeta?: Record<string, unknown>`를 직접 받거나, 변환을 `IntegrationOAuthService.buildProviderMeta(dto)` 같은 서비스 메서드로 이동.

---

### [WARNING] mall_id 정규식이 두 곳에 중복 정의

- **위치**: `integration.dto.ts` +267, `new/page.tsx` +241
- **상세**: `/^[a-z0-9-]{3,50}$/`가 DTO `@Matches` 데코레이터와 프론트엔드 `validateStep` 함수에 각각 하드코딩되어 있다. DTO 주석도 "Mirrors the regex in `IntegrationOAuthService.CAFE24_MALL_ID_PATTERN`"이라고 인정하듯 쓰여 있어 실제로 3곳에 산재한다. 정규식 하나를 바꾸려면 최소 2파일을 동시에 수정해야 한다.
- **제안**: `CAFE24_MALL_ID_PATTERN = /^[a-z0-9-]{3,50}$/` 상수를 공유 위치(예: `mcp-capable-service-types.ts`와 같은 레벨의 `cafe24-constants.ts`)에 두고 DTO·서비스·스펙 문자열 모두 import.

---

### [WARNING] CAFE24_RESOURCES가 프론트와 백엔드에 각각 중복 정의

- **위치**: `integration-configs.tsx` +248~+268, `metadata/types.ts` +65~+82
- **상세**: 18개 리소스 목록이 백엔드 `metadata/types.ts`와 프론트엔드 `integration-configs.tsx`에 각각 별도로 선언되어 있다. 새 리소스를 추가할 때 두 파일을 동시에 수정해야 하며 누락 시 프론트·백 불일치가 발생한다.
- **제안**: 공유 패키지 또는 백엔드 API 응답(`GET /integrations/meta/cafe24/resources`)으로 프론트가 동적으로 가져오거나, 최소한 `CAFE24_RESOURCE_LABELS` 객체의 키를 단일 source로 삼아 프론트에서 재사용하는 방향을 검토.

---

### [WARNING] HandlerDependencies가 provider별 optional 필드 백으로 변질 중

- **위치**: `node-component.interface.ts` +273~+275
- **상세**: `websocketService?`에 이어 `cafe24ApiClient?`가 추가되었고, 주석 자체가 "only the cafe24 node consumes it"이라고 명시한다. 이 패턴을 반복하면 Shopify·Naver 등 다음 통합마다 optional 필드가 하나씩 늘어난다.
- **제안**: `HandlerDependencies`에 `integrationClients?: Record<string, unknown>` 혹은 typed client registry를 도입해 각 통합 클라이언트를 동적으로 주입받는 구조로 전환.

---

### [WARNING] Provider 등록 순서에 묵시적 의존 + 취약한 주석 경고

- **위치**: `ai-agent.component.ts` +21~+36
- **상세**: `Cafe24McpToolProvider`가 `McpToolProvider`보다 **먼저** push되어야 한다는 제약이 배열 순서에만 의존하고 있다. 주석으로 경고하지만 향후 리팩토링에서 순서가 바뀌면 조용히 기능이 깨진다.
- **제안**: Provider에 `priority: number` 속성을 부여하고 `AiAgentHandler`가 정렬 후 사용하거나, `matches()` 충돌 시 명시적 에러를 내도록 해 순서 버그를 조기에 탐지.

---

### [WARNING] normalizeCafe24Fields — 두 가지 shape를 방어적으로 처리

- **위치**: `integration-configs.tsx` +282~+302
- **상세**: `config.fields`가 배열일 수도 있고 객체일 수도 있어 변환 함수가 두 가지 경우를 모두 처리한다. 주석에 "prior version would throw at runtime"이라는 설명이 있어 이 함수가 설계 불일치를 덮고 있음을 시사한다.
- **제안**: `config.fields`의 canonical 타입을 `Record<string, unknown>`으로 확정하고 UI 내부 상태는 별도 local state(`fieldItems`)로 관리. 두 형태가 동시에 존재하는 원인 자체를 제거.

---

### [INFO] OAuthBeginDto에 provider-specific 필드 직접 추가

- **위치**: `integration.dto.ts` +240~+305
- **상세**: `mallId`, `appType`, `clientId`, `clientSecret`가 모든 provider 공용 DTO에 추가되었다. 다음 provider(Shopify 등)가 추가되면 provider별 필드가 계속 증가한다.
- **제안**: `providerMeta?: Record<string, unknown>` 하나로 수렴시키고 provider별 validation은 서비스 레이어 내 strategy로 분리.

---

### [INFO] access_token / refresh_token을 required: true로 service registry에 선언

- **위치**: `service-registry.ts` +92~+105
- **상세**: `access_token`·`refresh_token`은 OAuth 콜백으로 자동 채워지는 시스템 필드인데 `required: true`로 표시되어 있다. credential 폼 렌더링 로직이 이 플래그를 신뢰한다면 사용자에게 직접 입력을 요구하는 UI가 나타날 수 있다.
- **제안**: `hidden: true` 또는 `systemManaged: true` 플래그를 `CredentialField`에 추가하거나, OAuth 자동 주입 필드는 registry에서 아예 제외.

---

### [INFO] MCP_CAPABLE_SERVICE_TYPES_LIST 이중 export

- **위치**: `mcp-capable-service-types.ts` +17~+20
- **상세**: readonly tuple과 그 mutable 복사본(`MCP_CAPABLE_SERVICE_TYPES_LIST`)을 둘 다 export한다. 호출 측에서 `[...MCP_CAPABLE_SERVICE_TYPES]`를 인라인으로 할 수 있어 파일 단위 관심사가 흐려진다.
- **제안**: mutable 배열 export를 제거하고 사용 측에서 spread. 필요하면 TypeScript generic util로 처리.

---

### [INFO] 단일 operation 리소스 파일 다수

- **위치**: `metadata/shipping.ts`(1개), `metadata/design.ts`(1개), `metadata/supply.ts`(1개), `metadata/privacy.ts`(1개)
- **상세**: 파일당 operation이 1개뿐이다. 파일 분리 자체는 확장성을 위한 의도적 선택이나, 현 시점에서는 파일 수 대비 내용이 극히 적어 탐색 비용이 높다.
- **제안**: 지금은 허용 가능한 trade-off이나, 각 파일에 최소 확장 가이드(어디에 operation을 추가하는지 1줄 링크)를 두어 개발자가 엉뚱한 파일을 만드는 일을 방지.

---

## 요약

전체적으로 Cafe24 통합은 잘 구조화되어 있으며, 메타데이터 주도 dispatch·단일 진실 원칙(mcp-capable-service-types.ts, metadata/index.ts)·암호화된 provider_meta 등 설계 결정이 명확하다. 유지보수성의 주요 위험은 세 곳에 집중된다. ① Controller에 provider-specific 변환이 직접 박혀 앞으로 provider가 늘수록 분기가 선형 증가할 구조, ② mall_id 정규식·CAFE24_RESOURCES 목록의 프론트·백 중복으로 변경 시 동시 수정 의무가 발생하는 점, ③ `HandlerDependencies`가 provider별 optional 필드 집합으로 성장하는 패턴이 반복되면 인터페이스가 커플링 지점이 된다는 점이다. 이 세 가지 중 정규식·리소스 목록 중복은 상대적으로 빠르게 수정 가능하고, HandlerDependencies 구조 개선은 다음 provider 추가 전에 registry 패턴으로 전환하는 것이 장기 부채를 막을 수 있다.

## 위험도

**MEDIUM**