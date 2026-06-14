# 유지보수성(Maintainability) 리뷰 결과

## 발견사항

### [WARNING] 폼 상태 객체를 두 번 수동 조립 — 중복 코드
- 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx` — `handleCreate` (검증 호출부) 와 `createMutation.mutationFn` (페이로드 조립 호출부)
- 상세: `validateAuthConfigForm({ name: formName, type: formType, apiKeyHeader: formApiKeyHeader, hmacHeader: formHmacHeader, hmacAlgorithm: formHmacAlgorithm, username: formUsername, password: formPassword, ipWhitelistRaw: formIpWhitelist })` 와 `buildAuthConfigPayload({ name: formName, type: formType as AuthConfigType, ... })` 가 정확히 동일한 8개 필드를 두 곳에서 독립적으로 조립한다. 새 폼 필드가 추가될 때마다 두 곳을 동시에 수정해야 하며 한 곳을 누락할 위험이 있다.
- 제안: 폼 상태를 한 번 `AuthConfigFormState` 객체로 수집하는 헬퍼(`collectFormState(): AuthConfigFormState`)를 만들고, 검증과 페이로드 조립 모두 그 결과를 재사용한다.

### [WARNING] `buildAuthConfigPayload` 파라미터 이름 `s` — 의미 불명확
- 위치: `codebase/frontend/src/app/(main)/authentication/auth-config-form.ts` L34, L50
- 상세: `buildAuthConfigPayload(s: AuthConfigFormState)` 와 `validateAuthConfigForm(s: AuthConfigFormState)` 에서 파라미터 이름이 단일 문자 `s` 다. 함수 본문이 10줄 이상이고 `s.type`, `s.hmacHeader`, `s.apiKeyHeader` 등 `s`가 반복 등장해 의도 파악에 불필요한 인지 부하가 생긴다.
- 제안: `state` 또는 `formState` 로 변경한다.

### [WARNING] `page.tsx` God Component 심화 — 유지보수 접점 과다
- 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx`
- 상세: 이번 변경으로 `formApiKeyHeader`, `formIpWhitelist` 상태 변수 2개와 검증 분기(`handleCreate` 내 25줄 블록)가 추가되어 이미 비대한 컴포넌트가 더 커졌다. 새 인증 type 이 생길 때마다 이 파일의 상태 선언·`resetForm`·`buildAuthConfigPayload` 호출부·JSX 조건 렌더링 4곳을 모두 수정해야 한다. 이는 이번 PR의 선재 문제이나 변경으로 심화됐다.
- 제안: 생성 폼 상태·로직을 `AuthConfigCreateForm` 컴포넌트(또는 커스텀 훅 `useAuthConfigCreateForm`)로 분리한다. 이번 PR 범위는 아니지만 후속 리팩토링으로 추적해야 한다.

### [INFO] `validateAuthConfigForm` 내 `header` 변수 — 중복 trim 호출
- 위치: `codebase/frontend/src/app/(main)/authentication/auth-config-form.ts` L55-58
- 상세: `validateAuthConfigForm` 에서 `const header = s.apiKeyHeader.trim()` 후 `if (header && !isValidHeaderName(header))` 로 검증하고, `buildAuthConfigPayload` 에서도 `const header = s.apiKeyHeader.trim()` 를 독립적으로 수행한다. trim 결과가 두 함수에 산재한다. 두 함수가 동일 값을 독립적으로 trim 한다.
- 제안: 현 구조에서는 허용 범위이나 `collectFormState` 헬퍼 도입 시 trim 을 한 곳에서 처리할 수 있다.

### [INFO] 테스트 헬퍼 `state()` 이름 — 너무 짧고 범용적
- 위치: `codebase/frontend/src/app/(main)/authentication/__tests__/auth-config-form.test.ts` L44
- 상세: 테스트 파일 내 헬퍼 함수 이름이 `state` 다. 동일 파일 내에서만 쓰이므로 충돌은 없지만 `makeFormState`, `buildState`, `formStateFixture` 등 도메인 맥락이 있는 이름이 더 서술적이다.
- 제안: `makeFormState` 또는 `defaultFormState` 로 변경한다. 경미한 사항이므로 강제하지 않는다.

### [INFO] `ko/authentication.ts` 타입 선언 불일치 — 점진적 타입 안전성 저하
- 위치: `codebase/frontend/src/lib/i18n/dict/ko/authentication.ts`
- 상세: `en/authentication.ts` 는 `export const authentication: Dict["authentication"] = { ... }` 로 명시적 타입을 선언해 새 키 누락 시 컴파일 오류가 발생하지만, `ko` 는 `as const` 만 사용해 타입 검사가 없다. 이번에 추가된 `invalidHeaderName`/`invalidIpWhitelist` 두 키는 수동으로 동기화됐으나, 향후 키 추가 시 `ko` 에서만 누락될 수 있다.
- 제안: `ko/authentication.ts` 에도 `satisfies Dict["authentication"]` 또는 명시적 타입 선언을 추가한다. 이번 PR 범위는 아니지만 낮은 비용으로 타입 안전성을 회복할 수 있다.

### [INFO] `auth-config-form.ts` — `AuthConfigPayload.config` 타입이 `Record<string, unknown>` 으로 느슨
- 위치: `codebase/frontend/src/app/(main)/authentication/auth-config-form.ts` L44-49
- 상세: `AuthConfigPayload` 인터페이스의 `config` 필드가 `Record<string, unknown>` 이다. `hmac` type 이면 `{ header: string; algorithm: string }`, `api_key` 이면 `{ headerName?: string }` 처럼 type 별로 구조가 다르다. 느슨한 타입은 오타나 누락 필드를 컴파일 타임에 잡지 못한다.
- 제안: 판별 유니온 타입(`type AuthConfigPayload = ApiKeyPayload | HmacPayload | ...`)으로 강화하면 타입 안전성과 IDE 자동완성이 개선된다. 현재 규모에서는 오버엔지니어링일 수 있으므로 INFO 수준.

### [INFO] `isValidIpOrCidr` — 매직 넘버 없음, 그러나 주석과 정규식 경계값 분리 가능
- 위치: `codebase/frontend/src/app/(main)/authentication/auth-config-form.ts` L18-26
- 상세: IPv4 CIDR 범위 `0-32`, IPv6 CIDR 범위 `0-128` 이 정규식 리터럴 안에 내재돼 있다. 현재 주석으로 설명되어 있어 허용 범위이나, 정규식이 복잡해 변경 시 오류 유발 가능성이 있다.
- 제안: 정규식을 명명된 상수(`IPV4_CIDR_PATTERN`, `IPV6_CIDR_PATTERN`)로 추출하면 테스트 코드에서도 재사용할 수 있다. 현재 수준에서는 선택 사항.

---

## 요약

이번 변경의 핵심인 `auth-config-form.ts` 신설은 유지보수성 측면에서 긍정적이다. 하드코딩된 기본값을 `AUTH_CONFIG_DEFAULTS` 상수로 단일화하고, 페이로드 조립 로직을 순수 함수로 분리해 테스트 가능성을 높인 방향이 올바르다. 다만 `page.tsx` 에서 동일한 폼 상태 객체를 검증 호출부와 페이로드 조립 호출부 두 곳에서 수동으로 조립하는 중복이 생겼고(`handleCreate` + `mutationFn`), 파라미터 이름 `s` 가 단일 문자여서 가독성이 낮다. `ko/authentication.ts` 의 타입 선언 누락은 선재 문제이나 새 키가 무타입으로 추가될 위험이 있어 저비용 개선이 가능하다. God Component 심화는 이번 PR 범위 밖이지만 별도 리팩토링으로 추적이 필요하다. 전반적으로 신규 로직 자체의 가독성과 구조는 양호하며, 위 지적 사항은 대부분 INFO 수준이다.

---

## 위험도

LOW

STATUS: SUCCESS
