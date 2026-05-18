### 발견사항

- **[WARNING]** `hasTimezoneDesignator` / `normalizeCafe24IsoTimezone` 중복 구현
  - 위치: `integration-oauth.service.ts` (모듈 내부 함수 `hasTimezoneDesignator`) vs `cafe24-api.client.ts` (파일 내부 함수 `normalizeCafe24IsoTimezone`)
  - 상세: 두 함수 모두 `/Z$|[+-]\d{2}:?\d{2}$/.test(iso)` 동일 정규식으로 TZ designator 유무를 판별하며, TZ-less 이면 `+09:00` 를 부여하는 로직도 동일하다. 이 로직이 Cafe24 고유 quirk 에 대한 단일 책임 처리이므로 `jwt-exp.ts` 와 같은 `modules/integrations/` 경계 안의 별도 파일(예: `cafe24-token-utils.ts`) 로 추출해 두 곳에서 re-use 하는 것이 DRY 원칙과 단일 책임 원칙에 부합한다. 현재 상태에서 정규식 변경 시 두 파일을 동시에 수정해야 한다.
  - 제안: `codebase/backend/src/modules/integrations/cafe24-token-utils.ts` 에 `normalizeCafe24IsoTimezone(iso: string): string` 을 single export 로 추출하고, `integration-oauth.service.ts` 와 `cafe24-api.client.ts` 양쪽에서 import 한다. `hasTimezoneDesignator` private 함수는 제거한다.

- **[WARNING]** `makeFakeJwt` 테스트 헬퍼가 두 spec 파일에 중복 정의됨
  - 위치: `integration-oauth.service.cafe24.spec.ts` 와 `cafe24-api.client.spec.ts` 각각 동일 구현 존재
  - 상세: base64url 변환 + 3-segment JWT 조립 로직이 두 파일에 복붙됐다. `jwt-exp.spec.ts` 에도 같은 패턴의 `makeJwt` 헬퍼가 존재한다 (이름만 다름). 테스트 유틸리티이므로 프로덕션 번들에 영향은 없지만, 테스트 내 JWT 구조가 변경될 경우 세 파일 동시 수정이 필요하고 일관성 불일치 위험이 있다.
  - 제안: `codebase/backend/src/modules/integrations/__test-utils__/make-fake-jwt.ts` 또는 `jest` 설정의 `setupFilesAfterEach` 경로에 공유 헬퍼를 두고 세 spec 파일에서 import 한다.

- **[WARNING]** `Cafe24ApiClient` 가 `jwt-exp.ts` (`modules/integrations/`) 를 직접 import — 레이어 경계 방향 주의
  - 위치: `cafe24-api.client.ts` line: `import { parseJwtExp } from '../../../modules/integrations/jwt-exp.js'`
  - 상세: `nodes/integration/cafe24/` 는 실행 노드 레이어이고, `modules/integrations/` 는 OAuth/토큰 관리 서비스 레이어다. 이미 `cafe24-token-refresh.constants`, `integration-oauth.service` 등에서 같은 방향의 import 가 존재해 기존 아키텍처 관행과 일치하므로 즉각적인 문제는 아니다. 그러나 `parseJwtExp` 는 Cafe24 전용 토큰 파싱 유틸리티이고, `cafe24-api.client.ts` 내에 이미 `normalizeCafe24IsoTimezone` 같은 Cafe24-specific 유틸이 존재하므로, 향후 모듈 경계 정리 시 `parseJwtExp` 를 `nodes/integration/cafe24/` 로 이동하거나, 위 WARNING 의 `cafe24-token-utils.ts` 에 통합하는 방향을 검토할 필요가 있다.
  - 제안: 단기적으로 현재 위치 유지 허용. 중기적으로 Cafe24 전용 토큰 유틸을 `cafe24-token-utils.ts` 한 파일로 모아 import 방향을 단순화한다.

- **[INFO]** `source` 필드 타입이 string literal union — 향후 source 추가 시 분산 수정 필요
  - 위치: `cafe24-token-refresh.constants.ts` — `source: 'proactive' | 'background' | 'reactive_401'`
  - 상세: 현재 3가지 source 가 constants 파일의 union type 으로 정의되어 있고, `cafe24-token-refresh.processor.ts` 에서 `source !== 'reactive_401'` 분기, `cafe24-api.client.ts` 에서 `source === 'reactive_401'` 분기로 각각 하드코딩 비교가 이뤄진다. source 종류가 늘거나 동작이 복잡해지면 분기가 여러 파일에 흩어질 수 있다. 현재 규모에서는 수용 가능하나 열거형(enum) 또는 const object 패턴으로 변경하면 리팩터링 시 안전망이 강해진다.
  - 제안: `CAFE24_REFRESH_JOB_SOURCES = { PROACTIVE: 'proactive', BACKGROUND: 'background', REACTIVE_401: 'reactive_401' } as const` 형태로 constants 파일에 추가하거나, 필요 시 strategy 패턴으로 source 별 동작을 캡슐화한다.

- **[INFO]** `parseTokenExpiresAt` 함수 내 Cafe24 분기 로직 — 단일 책임 원칙 경계선
  - 위치: `integration-oauth.service.ts` `parseTokenExpiresAt` 함수 (provider 분기)
  - 상세: `parseTokenExpiresAt` 가 provider 분기를 직접 담아 Cafe24 전용 precedence 체인을 인라인으로 구현한다. 현재 provider 가 Cafe24 와 그 외 둘뿐이라 허용 범위 내이지만, OAuth provider 종류가 늘면 함수가 비대해질 수 있다. 해결 방향은 명확하며(provider별 normalizer 등록), 현재 구조가 임계에 도달한 것은 아니다.
  - 제안: 당장 리팩터링 불필요. provider 가 3종 이상이 될 시점에 `parseTokenExpiresAtForCafe24(data)` / `parseTokenExpiresAtDefault(data)` 로 분리하거나 provider strategy map 으로 전환한다.

- **[INFO]** `jwt-exp.ts` 는 순수 함수 모듈로 DI 의존성 없음 — 적절한 추상화
  - 위치: `modules/integrations/jwt-exp.ts`
  - 상세: NestJS DI 컨테이너 없이 단독으로 호출 가능한 pure function 으로 설계되어 있으며, 이는 파일 내 주석에서도 명시적으로 의도를 밝히고 있다. OAuth normalizer 와 refresh path 양쪽에서 공유되는 유틸리티에 DI 의존성을 두지 않은 것은 올바른 설계 판단이다.
  - 제안: 현행 유지.

### 요약

이번 변경은 Cafe24 JWT `exp` claim 을 만료 시각 단일 진실로 격상하고, ISO TZ 모호성 fallback 안전망 및 `reactive_401` source 를 통한 워커 short-circuit 무력화 경로를 추가하는 버그픽스 중심의 변경이다. 아키텍처 측면에서 핵심 설계 결정(pure function `parseJwtExp`, source 라벨 기반 라우팅, BullMQ jobId dedup 보완)은 기존 레이어 구조와 일관되고 방어적이다. 주요 우려는 두 곳에 중복 정의된 `hasTimezoneDesignator`/`normalizeCafe24IsoTimezone` 이며, 같은 정규식 로직이 두 파일에 독립 존재해 단일 책임 원칙 위반이자 향후 유지보수 부담이 된다. 테스트 헬퍼 `makeFakeJwt` 역시 세 파일에 분산돼 있어 공유 테스트 유틸 추출이 권장된다. 순환 의존성은 없고 확장성도 source union type 의 enum 화 시점만 관리하면 충분한 수준이다.

### 위험도

LOW
