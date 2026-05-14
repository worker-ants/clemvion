# Code Review 통합 보고서

## 전체 위험도
**HIGH** — 코드 품질 자체는 양호하나, 구 엔드포인트 즉시 제거 + `redirectUri` 변경이 맞물려 배포 순서가 어긋나면 Google·GitHub·Cafe24 전체 OAuth 흐름이 즉시 단절되는 운영 위험이 존재.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | API 계약 / Side Effect | **배포 원자성 미보장** — `redirectUri`가 `/api/integrations/oauth/callback/...` → `/api/3rd-party/.../callback`으로 변경됐고, 구 엔드포인트가 완전 제거됨. Google Cloud Console·GitHub OAuth App에 신규 URI가 **사전 등록되지 않은 상태에서 배포**되면 모든 신규 통합 연결이 `redirect_uri_mismatch`로 즉시 실패하며, 구 경로를 Cafe24에 등록한 Private 앱 사용자의 "테스트 실행"도 즉시 404를 받음. 배포 runbook에 이 제약이 명시되어 있지 않음. | `integration-oauth.service.ts:322,785,1051` / `integrations.controller.ts` 핸들러 전체 삭제 | ① Google/GitHub OAuth 콘솔에 신규 URI **추가** 완료 → ② 배포. 구 URI는 삭제하지 말고 두 URI를 동시 등록해 롤백 경로 확보. Cafe24 Private 앱 사용자 대상 재등록 안내를 배포 직후 발송. |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | **`renderCallbackHtml` XSS 가능성** — `oauthCallback` catch 블록의 `e.response?.message ?? e.message` (OAuth provider 반환값)가 `renderCallbackHtml`에 전달되는데, HTML-escape 처리 여부가 불확인. | `third-party-oauth.controller.ts` catch 블록 | `renderCallbackHtml` 구현에서 에러 문자열 HTML 이스케이프 처리 확인. 미처리 시 `encodeHTML()` 등으로 sanitize 후 전달. |
| 2 | 보안 | **HMAC timing-safe 구현 미확인** — `verifyHmacWithMessage` 내부가 `crypto.timingSafeEqual` 대신 문자열 직접 비교(`===`)를 사용할 경우 타이밍 사이드채널로 유효 HMAC 추론이 이론적으로 가능. | `integration-oauth.service.ts` `handleInstall()` 내부 | `followup` Group D 항목 조속 처리. `crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(provided))` 패턴 사용 여부 코드 레벨 확인. |
| 3 | 보안 | **`install_token` URL path 로그 노출** — 토큰이 URL path에 위치해 nginx access log·CDN 로그·Referer 헤더에 노출. 단일 사용 + TTL 24h로 실제 악용 가능성은 제한적이나 내부자 또는 proxy 관리자의 사전 사용 구조. | `GET /api/3rd-party/cafe24/install/:installToken` | `followup` Group A 트래킹 항목(nginx 로그 마스킹 또는 query parameter 이동) 우선 처리. |
| 4 | 아키텍처 | **`ThirdPartyOAuthController`가 `IntegrationsModule`에 등록** — URL prefix `/api/3rd-party/`와 모듈 도메인 경계(`integrations`)가 불일치. 향후 provider 추가 시 `IntegrationsModule` 책임이 비대해짐. | `integrations.module.ts:controllers` | `ThirdPartyOAuthModule` 분리 검토. 현재 규모에서는 허용 가능하나 권장. |
| 5 | 아키텍처 | **컨트롤러 내 `process.env` 직접 접근** — `FRONTEND_URL`·`APP_URL`을 컨트롤러에서 직접 읽음. NestJS 레이어 규약 위반이며 테스트에서 환경변수 오염 의존 유발. | `third-party-oauth.controller.ts` `oauthCallback()` | `ConfigService.get<string>('FRONTEND_URL')` 방식으로 교체. |
| 6 | 아키텍처 | **catch 블록 수동 예외 캐스팅** — `err as { status?: number; ... }` 덕 타이핑 캐스팅이 구 컨트롤러에서 그대로 이식됨. `e.status ?? 400` 폴백이 의도치 않은 상태 코드를 반환할 수 있음. | `third-party-oauth.controller.ts:166–172` | `instanceof HttpException` 분기 또는 커스텀 예외 필터(`@UseFilters`) 적용. |
| 7 | 유지보수성 | **`redirectUri` 생성 로직 3곳 분산** — 이번 PR에서 3곳을 모두 갱신했으나 독립 문자열 리터럴. 다음 경로 변경 시 하나 누락 시 해당 provider OAuth 전체 무효. | `integration-oauth.service.ts:322,785,1051` | private 헬퍼 `callbackUrl(base: string, provider: string)` 추출하여 단일 진실 지점 확보. |
| 8 | 유지보수성 | **`INSTALL_TOKEN_PATTERN`과 생성 로직 물리적 분리** — 토큰 생성(서비스)과 패턴 검증(컨트롤러)이 import 관계 없이 분리되어 포맷 변경 시 컴파일 타임 불일치 감지 불가. | 생성: `integration-oauth.service.ts:888` / 검증: `third-party-oauth.controller.ts:27` | 공유 상수 파일(`integration-oauth.constants.ts`)에 `INSTALL_TOKEN_LENGTH`·`INSTALL_TOKEN_PATTERN` 두고 양쪽 import. |
| 9 | 문서 / 계획 | **Plan Phase 2 체크박스 미갱신** — 구현 완료됐음에도 Phase 2 전체 항목이 `[ ]`로 남아 있음. CLAUDE.md plan 라이프사이클 규약 위반. | `plan/in-progress/cafe24-app-url-3rdparty-shorten.md` Phase 2 | Phase 2 완료 항목 `[x]` 갱신. 모든 항목 완료 후 `git mv plan/in-progress/... plan/complete/`. |
| 10 | 테스트 | **미지원 provider 경로 미커버** — `ALLOWED_OAUTH_PROVIDERS` 외 provider 호출 시 400 + error HTML 반환 분기 테스트 없음. | `third-party-oauth.controller.spec.ts` `oauthCallback` describe | `controller.oauthCallback('notexist', ...)` → 400 + `'Unsupported OAuth provider'` 검증 케이스 추가. |
| 11 | 테스트 | **`cafe24Install` 누락 파라미터 부분 커버** — `!mallId \|\| !timestamp \|\| !hmac` 조건에서 `mallId` 누락만 검증. `timestamp`·`hmac` 각 단독 누락 케이스 미커버. | `third-party-oauth.controller.spec.ts:180–203` | `hmac` 누락 케이스 등 나머지 조건 분기 추가. |
| 12 | 테스트 | **서비스 예외 HTTP status 전파 미검증** — `handleInstall`이 `ForbiddenException(403)` throw 시 응답 status 전파 여부 미검증. | `third-party-oauth.controller.ts:138–148` catch 블록 | `mockRejectedValue`로 403·404 케이스 각각 추가. |
| 13 | 테스트 | **23자 토큰 상한 테스트 누락** — 정규식 `{22}$`는 23자도 거부해야 하나 21자 케이스만 테스트됨. | `third-party-oauth.controller.spec.ts:148–167` | `'A'.repeat(23)` 케이스 추가 또는 테스트명을 `'rejects short token with 404'`로 수정. |
| 14 | 요구사항 | **i18n Markdown bold 구문 렌더링 미확인** — `"**copy the full URLs above**"` 등 bold 구문이 i18n 문자열에 추가됐으나, 렌더링 컴포넌트가 Markdown을 처리하지 않으면 `**복사**`가 그대로 노출됨. | `frontend/src/lib/i18n/dict/en.ts:1631`, `ko.ts:1629` | `Cafe24PrivatePendingStep` 컴포넌트의 Markdown 렌더링 여부 확인. 미처리라면 bold 구문 제거 또는 컴포넌트 수정. |
| 15 | API 계약 / DB | **`CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 에러 코드명 불일치** — spec·구현 모두 `app_type` 무관으로 발화함을 명시했으나 코드명에 `PRIVATE_APP` 포함되어 혼동 유발. consistency-checker가 `CAFE24_MALL_ALREADY_CONNECTED` 변경을 권고했으나 미반영. | `spec/2-navigation/4-integration.md §9.4` | followup plan에 코드명 변경 항목 추가. 또는 description에 "코드명은 하위 호환 유지 목적으로 변경 않음" 명시. |
| 16 | API 계약 | **`oauthCallback` throttle 미적용** — install 엔드포인트에는 30 req/min throttle이 있으나 OAuth 콜백(토큰 교환)에는 없음. | `third-party-oauth.controller.ts` `@Get(':provider/callback')` | `@Throttle({ default: { limit: 60, ttl: 60_000 } })` 적용 검토. |
| 17 | Side Effect | **기존 `pending_install` 64-hex 토큰 처리** — 배포 전 발급된 64자 hex 토큰 보유 `pending_install` 행이 잔존할 경우, 신규 패턴(22자)으로 차단되어 사용자에게 안내 없이 흐름이 막힘. | `third-party-oauth.controller.ts:27` `INSTALL_TOKEN_PATTERN` | 배포 전 `pending_install` 행 수 확인. 0이 아니면 TTL 만료 대기 또는 수동 expire 처리 후 배포. 배포 체크리스트에 명시. |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 성능 | `process.env.APP_URL` 매 요청 평가 — 런타임 불변 값이나 매 요청마다 읽힘. 측정 가능한 영향 없음. | `integration-oauth.service.ts:319,782,1051` | 생성자 또는 모듈 상수로 1회 resolve. 현재 규모에서는 불필요. |
| 2 | 의존성 | `base64url` 옵션은 Node.js v16.0.0+부터 지원. NestJS 10+ 환경이라면 사실상 v18+이므로 문제 없음. | `integration-oauth.service.ts:891` | `package.json` `engines.node` 또는 `.nvmrc`에서 `>=16` 확인. |
| 3 | 테스트 | `APP_URL` 단독 설정 시 `targetOrigin` fallback 경로 미검증 (`FRONTEND_URL` 미설정 케이스). | `third-party-oauth.controller.spec.ts` | `FRONTEND_URL` 미설정 + `APP_URL` 설정 케이스 추가. |
| 4 | 테스트 | 구 엔드포인트 제거 회귀 검증 부재 — 구 경로가 404가 되는지 검증하는 통합/e2e 테스트 없음. | `integrations.controller.ts` 삭제된 핸들러들 | plan `cafe24-app-url-3rdparty-shorten.md` e2e 보강 항목에서 처리 예정이나 현재 공백. |
| 5 | 아키텍처 | `ALLOWED_OAUTH_PROVIDERS` 검증이 컨트롤러에 위치 — 비즈니스 규칙이 컨트롤러에 누출됨. | `third-party-oauth.controller.ts` `oauthCallback()` | 컨트롤러 검증 제거, 서비스에서 `BadRequestException` 단일화 검토. |
| 6 | 보안 | install_token 엔트로피 256→128-bit 감소. NIST/OWASP 기준(96-bit 이상) 충족. Spec Rationale에 근거 명시됨. | `integration-oauth.service.ts:888` | IP 기반 rate limiting 추가(현재 global throttle만 존재) 시 보호 수준 향상. |
| 7 | 보안 | `handleInstall()` 반환 redirect URL 검증 부재 — 오픈 리다이렉트 가능성. 현재 Cafe24 공식 도메인으로 고정 구성이라면 안전. | `third-party-oauth.controller.ts` `cafe24Install()` | 서비스 내부에서 redirect URL이 `*.cafe24api.com`으로 고정되는지 확인. |
| 8 | 유지보수성 | `appUrl` vs `appBaseUrl` 네이밍 불일치 — 동일 값(`process.env.APP_URL`)에 다른 변수명 사용. | `integration-oauth.service.ts:322,785,1051` | 파일 전체 `appUrl`로 통일. |
| 9 | 문서 | `oauthCallback` JSDoc의 spec 참조 불완전 — `"spec §10."` 형식으로 파일 경로 누락. | `third-party-oauth.controller.ts:149` | `spec §10.` → `spec/2-navigation/4-integration.md §10.` |
| 10 | 문서 | `integrations.controller.ts` NOTE 주석이 작업 이력 참조 스타일 ("이전됨"). CLAUDE.md 규약 위반. | `integrations.controller.ts:182` | 현재 상태 서술 형태로 교체 ("통합 관리 API 전용 컨트롤러. 3rd-party OAuth는 `ThirdPartyOAuthController` 참조"). |
| 11 | 문서 | consistency review 산출물 파일 trailing newline 누락 (`\ No newline at end of file`). | `review/consistency/` 하위 신규 파일 전체 | 각 파일 말미에 줄바꿈 추가. |
| 12 | 문서 | 테스트 파일 내 한국어/영어 주석 혼용. | `integration-oauth.service.cafe24.spec.ts:231`, `third-party-oauth.controller.spec.ts:137` | 한국어 인라인 주석 영어로 통일. |
| 13 | 요구사항 | Mermaid 다이어그램 주석 리터럴 출력 — `# 22자, 128-bit`가 주석이 아닌 텍스트로 렌더링됨. | `spec/data-flow/integration.md:75` | `Note over Svc: 22자 base64url, 128-bit` 로 분리 또는 괄호 표기. |
| 14 | 요구사항 | 낙후된 주석 잔존 — `// Developers can call our single-row lookup endpoint (V043).` 문맥 불명확. | `integration-oauth.service.cafe24.spec.ts:231` | 해당 주석 제거. |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| API Contract | **HIGH** | 구 엔드포인트 즉시 제거 → 배포 순서 미준수 시 OAuth 전체 단절 |
| Side Effect | **MEDIUM** | `redirectUri` 변경 + OAuth 콘솔 재등록 원자성 미보장 |
| Security | **LOW** | `renderCallbackHtml` XSS 가능성, HMAC timing-safe 미확인, URL path 토큰 노출 |
| Architecture | **LOW** | 모듈-URL 경계 불일치, `process.env` 직접 접근, 예외 캐스팅 패턴 |
| Testing | **LOW** | 미지원 provider / 누락 파라미터 / 예외 전파 / 토큰 상한 케이스 미커버 |
| Maintainability | **LOW** | `redirectUri` 3곳 분산, `INSTALL_TOKEN_PATTERN` 생성-검증 분리 |
| Documentation | **LOW** | Plan 체크박스 미갱신, JSDoc 불완전, NOTE 주석 스타일 |
| Requirement | **LOW** | i18n Markdown 렌더링 미확인, 에러 코드명 불일치, Plan 미갱신 |
| Scope | **LOW** | 미세 범위 초과(spec 정확도 보정), 허용 수준 |
| Database | **LOW** | 포맷 혼재 안전성 확인 (설계 의도), 에러 코드명 불일치 |
| Performance | **NONE** | 측정 가능한 신규 위험 없음 |
| Dependency | **NONE** | 신규 외부 패키지 없음, Node.js 버전 요건 확인 권장 |
| Concurrency | **NONE** | 기존 패턴 유지, 신규 경쟁 조건 없음 |

---

## 발견 없는 에이전트

**Performance**, **Dependency**, **Concurrency** — 세 에이전트는 이번 변경에서 실질적인 신규 위험을 발견하지 않음.

---

## 권장 조치사항

1. **[즉시 / 배포 전 필수]** Google Cloud Console·GitHub OAuth App에 신규 `redirectUri`(`/api/3rd-party/.../callback`) 추가 등록 완료 후 배포. 구 URI는 즉시 삭제하지 말고 롤백 기간 동안 병행 유지. Cafe24 Private 앱 사용자 대상 App URL 재등록 안내 배포 직후 발송.
2. **[즉시 / 보안]** `renderCallbackHtml` 구현에서 에러 문자열 HTML 이스케이프 처리 확인. 미처리 시 XSS 픽스 선행.
3. **[단기]** `verifyHmacWithMessage`에 `crypto.timingSafeEqual` 사용 여부 확인 (followup Group D).
4. **[단기]** `redirectUri` 3곳을 private 헬퍼로 통합하고, `INSTALL_TOKEN_PATTERN`을 공유 상수 파일로 추출.
5. **[단기]** Plan Phase 2 체크박스 갱신 후 `plan/complete/`로 이동.
6. **[단기]** 테스트 누락 케이스 추가 — 미지원 provider, 누락 파라미터 전체 분기, 서비스 예외 status 전파, 23자 토큰 상한.
7. **[단기]** i18n Markdown bold 렌더링 여부 확인 및 필요시 컴포넌트 수정.
8. **[중기]** `oauthCallback`에 throttle 적용, IP 기반 rate limiting 추가 (followup Group A).
9. **[중기]** `process.env` → `ConfigService`, catch 블록 → 커스텀 예외 필터, `ThirdPartyOAuthModule` 분리 등 아키텍처 정제.
10. **[중기]** `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` → `CAFE24_MALL_ALREADY_CONNECTED` 코드명 변경 또는 하위 호환 유지 방침 문서화.