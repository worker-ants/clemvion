## 문서화 리뷰

### 발견사항

- **[INFO]** `auth-providers.ts` 파일 수준 주석이 충실함
  - 위치: `frontend/src/lib/api/auth-providers.ts` 전체
  - 상세: 목적, 캐싱 전략, 실패 시 동작을 명확히 설명하는 블록 주석이 작성되어 있음. 모범적인 문서화 수준.
  - 제안: 없음

- **[INFO]** `getEnabledProviders()` 인라인 주석이 적절함
  - 위치: `auth-oauth.service.ts:80`
  - 상세: stub 모드와 실제 자격증명 기준을 설명하는 한 줄 주석이 의도를 잘 전달함.
  - 제안: 없음

- **[INFO]** Swagger `@ApiOperation` 문서가 완비됨
  - 위치: `auth.controller.ts` — `getOauthProviders` 엔드포인트
  - 상세: summary, description, 응답 스키마(enum 포함)가 모두 기술되어 있음. 클라이언트 동작 방침(비어있으면 SSO UI 비표시)도 description에 명시됨.
  - 제안: 없음

- **[INFO]** 스펙 문서(`spec/2-navigation/10-auth-flow.md`)가 구현과 정합함
  - 위치: `spec/2-navigation/10-auth-flow.md` §5.0, §8
  - 상세: API 테이블 추가, 캐싱 정책, 실패 시 안전 기본값, UI 동작 표가 구현 코드와 완전히 일치함. API 엔드포인트 목록에도 신규 엔드포인트가 추가됨.
  - 제안: 없음

- **[INFO]** `LoginFormProps` / `RegisterFormProps` 인터페이스에 JSDoc 없음
  - 위치: `login-form.tsx:38`, `register-form.tsx:43`
  - 상세: `enabledProviders` prop이 optional인 이유와 기본값이 빈 배열인 배경(안전 기본값)을 설명하는 주석이 있으면 유지보수 시 도움이 되나, 단순한 UI prop 수준이므로 필수는 아님.
  - 제안: 필요 시 `/** Server에서 fetch한 활성 OAuth provider 목록. 빈 배열이면 SSO UI 비표시. */` 수준의 JSDoc 추가

- **[WARNING]** `NEXT_PUBLIC_API_URL` 환경변수가 `auth-providers.ts`에도 중복 선언됨
  - 위치: `auth-providers.ts:11`, `login-form.tsx:36`, `register-form.tsx:38`
  - 상세: `const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3011/api"` 가 세 파일에 독립적으로 정의되어 있음. 현재 문서화보다는 코드 구조 문제이나, 이 패턴에 대한 설명이나 공유 상수 파일 경로 안내가 없어 신규 개발자가 왜 공유하지 않는지 파악하기 어려움.
  - 제안: `auth-providers.ts` 주석에 "서버 컴포넌트 전용이므로 클라이언트 컴포넌트와 별도 선언" 설명을 추가하거나, 중앙 상수 파일로 통합

- **[INFO]** `README.md` 업데이트 필요성 — 낮음
  - 상세: 신규 환경변수(`OAUTH_STUB_MODE`, `GOOGLE_CLIENT_ID`, `GITHUB_CLIENT_ID`)가 추가되었으나, 이들이 이미 이전 SSO 커밋(`38687c4`)에서 도입되었을 가능성이 높음. 현재 변경은 기존 변수를 활용하는 것이므로 README 업데이트는 선행 커밋에서 수행되었을 것으로 판단됨.
  - 제안: README의 환경변수 섹션에 `OAUTH_STUB_MODE` 및 `{PROVIDER}_CLIENT_ID` 역할 설명이 없다면 추가 권장

- **[INFO]** 테스트 코드 내 주석이 명확함
  - 위치: `auth-oauth.service.spec.ts:181`, `auth.controller.spec.ts:93`
  - 상세: "stub mode regardless of credentials", "stub mode off" 등 테스트 의도가 명확하게 표현됨. 특히 만료 상태 테스트의 SQL 동작 설명 주석(기존 코드)이 유지되어 있어 우수함.

---

### 요약

전반적으로 문서화 수준이 높습니다. 스펙 문서(`10-auth-flow.md`)가 구현 코드와 정확히 동기화되어 있고, Swagger 어노테이션이 완비되어 있으며, `auth-providers.ts`의 모듈 수준 주석은 목적·캐싱·실패 처리를 간결하게 설명합니다. 유일한 주의 사항은 `API_BASE_URL` 상수가 세 파일에 중복 선언된 것으로, 이 패턴에 대한 설명이 없어 의도 파악이 다소 어렵습니다. `LoginFormProps.enabledProviders`에 간단한 JSDoc을 추가하면 더욱 완성도가 높아지겠으나 필수는 아닙니다.

### 위험도

**LOW**