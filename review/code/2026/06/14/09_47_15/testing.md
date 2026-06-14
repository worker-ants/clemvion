# Testing Review — impl-config-auth-gaps

## 발견사항

### [WARNING] bearer_token / basic_auth / hmac type 에 대한 IP Whitelist 전송 경로 미테스트
- 위치: `authentication-form.test.tsx` 전체 (2개 테스트 케이스 모두 `api_key` type 고정)
- 상세: IP Whitelist textarea 는 `formType !== ""` 조건으로 모든 type 공통 노출된다. 테스트는 `api_key` type 의 경우만 검증하므로, `bearer_token`, `basic_auth`, `hmac` type 선택 시 IP Whitelist 배열이 POST body 에 올바르게 포함되는지(또는 비었을 때 미송신인지) 커버되지 않는다. `page.tsx` 의 파싱 로직은 type 과 무관하게 동일 코드 경로를 사용하지만, `openDialogAsApiKey()` 헬퍼를 재사용하는 구조라 다른 type 테스트 추가가 자연스럽지 않다.
- 제안: `bearer_token`(또는 `basic_auth`) type 으로 IP Whitelist 를 입력했을 때 동일하게 배열로 파싱·전송되는지 테스트를 1건 추가한다.

### [WARNING] api_key 헤더 이름 공백 trim 후 빈 문자열인 경우 미테스트
- 위치: `page.tsx` L481-283 (`const header = formApiKeyHeader.trim(); if (header) config.headerName = header;`)
- 상세: 사용자가 헤더 이름 입력 필드를 전부 공백으로 채운 경우 `trim()` 후 빈 문자열이 되어 `config.headerName` 이 포함되지 않는다(백엔드 기본값 의존). 이 경계값 케이스가 테스트되지 않았다. 기존 두 번째 케이스("defaults the header to X-API-Key")는 기본값 그대로 유지한 경우이고, 공백만 입력한 경우는 별개 경로다.
- 제안: `await userEvent.clear(headerInput); await userEvent.type(headerInput, "   ");` 후 `body.config` 에 `headerName` 이 없음을 assert 하는 케이스 추가.

### [INFO] `cleanup()` 을 `beforeEach` 에서 수동 호출하는 패턴
- 위치: `authentication-form.test.tsx` L87 (`beforeEach(() => { ... cleanup(); ... })`)
- 상세: Vitest + `@testing-library/react` 환경에서 `afterEach` 로 `cleanup()` 이 자동 등록된다(`vitest.setup.ts` 또는 `@testing-library/react` 기본 동작). `beforeEach` 에서 수동 `cleanup()` 을 추가 호출하면 각 테스트 시작 전 이전 렌더를 정리하는 효과가 있으나, 이는 `afterEach` 자동 cleanup 이 의도대로 동작하지 않는다는 우려에서 비롯된 방어적 패턴이다. 실제로 `afterEach` 가 작동한다면 이중 호출이 되어 혼란을 줄 수 있다. 프로젝트 내 다른 테스트(`locale-sync.test.tsx`)는 `afterEach` 에 `cleanup()` 을 두고 있다.
- 제안: `beforeEach` 의 `cleanup()` 을 제거하고 `afterEach(() => { cleanup(); ... })` 패턴으로 통일하거나, `@testing-library/react` 의 auto-cleanup 설정을 확인하여 중복 제거.

### [INFO] i18n 신규 키(apiKeyHeaderLabel, ipWhitelistLabel, ipWhitelistHint)에 대한 locale-sync 테스트 추가 불필요 여부 확인
- 위치: `codebase/frontend/src/lib/i18n/__tests__/`
- 상세: 기존 `locale-sync.test.tsx` 와 `i18n.test.ts` 는 새 키에 대한 명시적 검증을 포함하지 않는다. 다만 TypeScript 타입 시스템(`Dict["authentication"]` 인터페이스)이 en/ko 양쪽 파일 모두에서 신규 키 누락 시 컴파일 오류를 내므로, 별도 런타임 테스트 없이 타입 검사가 동등한 보호 역할을 한다. 이는 INFO 수준이다.
- 제안: 현재 타입 보호로 충분하다. 추가 테스트는 필수 아님.

### [INFO] `useLocaleStore.setState({ locale: "en" })` 의존 — 실제 i18n 번역 로드 없이 레이블 매칭
- 위치: `authentication-form.test.tsx` L89
- 상세: 테스트가 `"Header name"`, `"IP whitelist"` 등 영문 레이블로 요소를 찾는데, `useLocaleStore` 를 "en" 으로 강제하는 방식으로 구현했다. `useT()` 훅이 `useLocaleStore` 상태를 직접 읽는 구조이므로 격리는 올바르다. 다만 `locale: "en"` 설정 후 실제로 영문 dict 가 로드되는지, 아니면 훅이 번역 키 자체를 반환하는지 불명확하다. `getByLabelText("Header name")` 이 성공하려면 `t("authentication.apiKeyHeaderLabel")` 이 실제로 `"Header name"` 을 반환해야 한다.
- 제안: 테스트가 통과하는 한 현 구조는 유효하다. 단, `useT` 가 locale 변경을 동기적으로 반영하는지 확인할 것. 만약 locale 설정이 비동기라면 `waitFor` 래핑이 필요할 수 있다.

### [INFO] `getMock` 이 항상 `{ data: { data: [] } }` 를 반환 — 기존 config 목록 있는 시나리오 미테스트
- 위치: `authentication-form.test.tsx` L90
- 상세: 모든 테스트에서 목록이 비어있는 응답만 mock 한다. 실제 운영에서는 기존 config 가 있는 상태에서 새 config 를 생성하는 흐름도 있으나, 현재 테스트의 목적이 "생성 폼 페이로드 검증"에 집중되어 있어 이는 허용 가능한 범위다. 회귀 우려는 낮다.

## 요약

신규 추가된 테스트 파일(`authentication-form.test.tsx`)은 §A.2의 핵심 페이로드 매핑(IP Whitelist 파싱, api_key 헤더 이름 기본값/커스텀) 두 가지를 명확하게 검증하며, apiClient와 role-gate를 적절히 격리하고 QueryClient 를 독립 인스턴스로 구성해 테스트 격리는 양호하다. 다만 IP Whitelist 는 모든 type 공통 기능임에도 `api_key` type 만 테스트하여 bearer_token/basic_auth/hmac 경로가 미검증 상태다. 또한 헤더 이름 공백 입력(trim 후 빈 문자열) 경계값 케이스가 누락되었다. i18n 키 변경(en/ko)은 TypeScript 타입 시스템이 정합을 보장하므로 별도 런타임 테스트 없이도 안전하다. 전반적인 위험도는 중간 수준이며, 두 가지 WARNING 항목 보완 시 테스트 커버리지가 충분해진다.

## 위험도

MEDIUM
