# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 발견사항

### [WARNING] auth·세션 흐름 변경 — 07-workspace-and-team 페이지 갱신 누락

- 변경 파일:
  - `codebase/backend/src/modules/auth/auth.controller.ts` — `/auth/refresh` 에 Origin allowlist CSRF 방어 추가 (ForbiddenException 발행)
  - `codebase/backend/src/modules/auth/utils/refresh-cookie.ts` — 쿠키 path `/` → `/api/auth` 축소, SameSite 를 `COOKIE_SAMESITE` env 로 configurable 처리
  - `codebase/backend/src/modules/auth/utils/client-ip.ts` — CF-Connecting-IP 신뢰를 `TRUST_CF_CONNECTING_IP` env 로 게이팅 (기본 off)
  - `codebase/backend/src/modules/auth/sessions.controller.spec.ts`, `client-ip.spec.ts`, `refresh-cookie.spec.ts`, `auth.controller.spec.ts` — 위 변경에 대응하는 테스트

- 매트릭스 항목: `auth-session-flow-change` — "인증·권한·세션 흐름 변경" / trigger glob `codebase/backend/src/modules/auth/**`
  - targets: `codebase/frontend/src/content/docs/07-workspace-and-team/ 의 관련 페이지 + e2e`

- 누락된 동반 갱신:
  - `codebase/frontend/src/content/docs/07-workspace-and-team/security-2fa.mdx` (및/또는 동 디렉토리의 세션 관련 페이지)
  - `codebase/frontend/src/content/docs/07-workspace-and-team/security-2fa.en.mdx`

- 상세: 이번 변경은 refresh 토큰 쿠키의 경로·SameSite 정책·CSRF 방어 동작을 수정한다. 특히 cross-site 배포(`COOKIE_SAMESITE=none` 기본)에서 Origin 이 allowlist 외부이면 `/auth/refresh` 가 403을 반환하는 동작 변화가 발생한다. 배포자가 인증 세션 갱신 실패를 디버깅할 때 영향을 받으며, `07-workspace-and-team/` 의 보안·세션 관련 페이지가 stale 상태가 된다.

- 제안:
  - `security-2fa.mdx` + `.en.mdx` 에 세션 쿠키 정책 변경(경로 한정, SameSite 설정)과 CORS/Origin 검증으로 인한 refresh 동작에 대한 설명을 추가하거나, 별도 세션 관리 페이지를 신설한다.
  - 이 변경이 순수 배포자 설정(사용자 가이드 독자 대상이 아님)에 해당한다고 판단하면, 해당 근거를 PR 본문에 명시하고 README 갱신만으로 커버할 수 있다.

---

### [WARNING] 환경 변수 신규 추가 — README.md 갱신 누락

- 변경 파일: `codebase/backend/.env.example`
  - `ENABLE_SWAGGER_IN_PROD` 신규 주석 추가 (04 M-1 — production Swagger 노출 opt-in)
  - `COOKIE_SAMESITE` 신규 주석 추가 (04 M-5 — refresh 쿠키 SameSite 정책)
  - `TRUST_CF_CONNECTING_IP` 신규 주석 추가 (04 m-3 — CF-Connecting-IP 신뢰 여부)

- 매트릭스 항목: `env-runtime-change` — "환경 변수·기동 방법·런타임 변경 (제품 최종 상태)"
  - targets: `README.md`

- 누락된 동반 갱신: `/Volumes/project/private/clemvion/README.md` — `## 환경 변수` 섹션 및 `### 런타임 환경변수 (k8s ConfigMap/Secret)` 의 Backend 설명

- 상세: README.md 의 `## 환경 변수` §Backend 블록과 `### 런타임 환경변수 (k8s ConfigMap/Secret)` §Backend 설명에 세 개의 신규 보안 환경 변수가 등재되지 않았다. 배포자가 README 를 참고해 환경을 구성할 때 이 옵션들을 놓치면 의도치 않은 보안 동작(production 에서 Swagger 항상 미노출, CF 헤더 무시, SameSite=none 기본 적용)이 발생할 수 있다.

- 제안:
  - `README.md` `## 환경 변수` §Backend 블록의 `# Security` 항목 아래에 세 변수 설명을 추가한다.
  - `### 런타임 환경변수 (k8s ConfigMap/Secret)` §Backend 설명 한 줄에 `ENABLE_SWAGGER_IN_PROD`, `COOKIE_SAMESITE`, `TRUST_CF_CONNECTING_IP` 를 포함시킨다.

---

## 요약

매트릭스 총 18개 trigger 중 변경 파일이 매칭된 trigger 는 2개(`auth-session-flow-change`, `env-runtime-change`)이며, 양쪽 모두 동반 갱신이 누락됐다. 노드 파일(`codebase/backend/src/nodes/**`)이 변경됐으나 해당 변경은 내부 ReDoS 방어 로직 리팩토링(새 노드 추가 없음·필드/라벨/에러코드 변경 없음)이므로 `new-node` / `node-schema-change` / `new-error-code` trigger 에는 매칭되지 않는다. i18n parity 위반, 신규 섹션 디렉토리, warningCode/errorCode 신규 발행은 없다. 누락 2건 모두 WARNING 수준이다.

## 위험도

MEDIUM

STATUS=success ISSUES=2
