## 발견사항

### [WARNING] `redirectUri` 생성 로직 3곳 분산 — 경로 변경 시 누락 위험
- **위치**: `integration-oauth.service.ts` lines 322, 785, 1051
- **상세**: 이번 PR 에서 3곳을 모두 올바르게 갱신했지만, 각각 독립된 문자열 리터럴이다. 다음 경로 변경 시 하나라도 빠지면 Google/GitHub OAuth 전체가 무효 URL을 생성한다 (consistency check WARNING #4에서도 "반드시 동시 처리" 로 명시됨).
- **제안**: `IntegrationOAuthService` 내에 private 헬퍼 `callbackUrl(base: string, provider: string)` 를 두어 단일 진실 지점으로 만들 것. cafe24-specific line 1051 은 인자로 `'cafe24'` 를 넘기면 통일 가능.

---

### [WARNING] `INSTALL_TOKEN_PATTERN` 이 생성 로직과 물리적으로 분리
- **위치**: 생성 — `integration-oauth.service.ts:888`, 검증 — `third-party-oauth.controller.ts:27`
- **상세**: 토큰은 서비스에서 `randomBytes(16).toString('base64url')` (22자 base64url)로 만들고, 패턴은 컨트롤러에서 `/^[A-Za-z0-9_-]{22}$/`로 검증한다. 두 파일이 서로를 import하지 않으므로, 토큰 생성 방식이 바뀌어도 컴파일 타임에 불일치를 감지할 수 없다.
- **제안**: 패턴 상수를 `integration-oauth.service.ts`에서 export 하거나, 두 파일이 공유하는 상수 파일(`integration-oauth.constants.ts`)에 `INSTALL_TOKEN_LENGTH = 22` 및 `INSTALL_TOKEN_PATTERN`을 두고 양쪽이 import 하도록 변경.

---

### [INFO] `appUrl` vs `appBaseUrl` 네이밍 불일치
- **위치**: `integration-oauth.service.ts` lines 322/785 (`appUrl`) vs line 1051 (`appBaseUrl`)
- **상세**: 동일한 `process.env.APP_URL || 'http://localhost:3011'` 값을 할당하지만 변수명이 다르다. 동일 파일 내 일관성 부재로 추후 독자가 두 변수가 같은 값인지 확인해야 한다.
- **제안**: 파일 전체에서 `appUrl` 로 통일.

---

### [INFO] 에러 타입 캐스팅 패턴 컨트롤러에 그대로 이전
- **위치**: `third-party-oauth.controller.ts:166–172`
- **상세**: `err as { status?: number; response?: { code?: string; message?: string }; message?: string }` 캐스팅이 기존 `IntegrationsController`에서 복사됐다. 프로젝트 내 동일 패턴이 두 곳에 존재. 지금은 2곳이라 중복이 심각하지 않지만, OAuth controller가 늘어날 경우 확산 위험이 있다.
- **제안**: 단기적으로는 허용 가능. OAuth controller 가 추가될 시점에 `mapNestErrorToResponse(err: unknown)` 유틸 함수로 추출 고려.

---

### [INFO] `makeRes` 목 팩토리 — 테스트 파일 내 적절히 공유됨
- **위치**: `third-party-oauth.controller.spec.ts:6`
- **상세**: 두 describe 블록 외부에 정의되어 공유되고 있어 중복 없음. `status`, `setHeader`, `send`, `json`, `redirect` 각각을 chainable mock 으로 구현한 점도 읽기 좋다.
- **제안**: 현행 유지. 향후 다른 OAuth controller 테스트가 추가될 때 별도 테스트 유틸 파일로 이동 고려.

---

### [INFO] 테스트 내 spec 참조 주석 — 적절한 수준
- **위치**: `third-party-oauth.controller.spec.ts:148`, `integration-oauth.service.cafe24.spec.ts:230`
- **상세**: "16바이트 base64url = 22자 (spec/…)" 형식의 주석이 WHY를 명확히 설명한다. CLAUDE.md "WHY 가 non-obvious 할 때만 주석" 기준에 부합.

---

## 요약

분리 자체(`ThirdPartyOAuthController` 신설, `IntegrationsController`에서 3rd-party 엔드포인트 제거)는 단일책임 원칙에 잘 맞으며 가독성과 구조가 크게 개선됐다. 주요 유지보수 위험은 두 가지로 압축된다: ① `redirectUri` URL 문자열이 서비스 내 3곳에 분산되어 있어 경로 변경 시 누락 가능성이 있고, ② 토큰 생성(서비스)과 패턴 검증(컨트롤러)이 import 관계 없이 분리되어 있어 포맷 변경 시 컴파일 타임 안전망이 없다. 나머지 지적사항은 기존 코드베이스 패턴을 일관되게 따르고 있어 실질적 부담이 낮다.

## 위험도

**LOW** — Critical 없음. WARNING 2건은 다음 경로 변경이 있을 때 위험이 현재화되므로, 지금 또는 이 PR 후속으로 헬퍼 함수 추출을 권장.