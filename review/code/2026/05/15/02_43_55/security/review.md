## 발견사항

### [INFO] install_token 엔트로피 감소 (256-bit → 128-bit)
- **위치**: `integration-oauth.service.ts` — `randomBytes(16).toString('base64url')`
- **상세**: 32바이트 hex(256-bit)에서 16바이트 base64url(128-bit)로 단축. NIST SP 800-63B 및 OWASP 권장(96-bit 이상)은 충족하나, 기존 대비 엔트로피가 절반으로 감소. 토큰이 단일 사용(callback 성공 시 NULL)되고 rate limit(30 req/min)이 있어 enumeration oracle 위험은 낮음. Spec Rationale에 근거가 명확히 문서화됨.
- **제안**: 현 설계는 허용 가능한 트레이드오프. 단, `followup` 항목 중 IP 기반 rate limiting 추가(현재 global throttle만 존재)를 우선 처리하면 보호 수준이 높아짐.

---

### [WARNING] install_token URL path 노출 — 로그/Referer 유출
- **위치**: `ThirdPartyOAuthController.cafe24Install` — `GET /api/3rd-party/cafe24/install/:installToken`
- **상세**: `install_token`이 URL path에 위치해 nginx access log, CDN 로그, Referer 헤더에 노출됨. 토큰이 단일 사용(소비 후 NULL)이고 TTL 24h가 있어 실제 악용 가능성은 제한적이나, 로그 접근 권한이 있는 내부자 또는 proxy 관리자가 토큰을 사전 사용할 수 있는 구조.
- **제안**: `cafe24-pending-polish-followup.md` Group A에 이미 트래킹 중(`nginx access log 마스킹 또는 query parameter 이동`). 현재 30 req/min throttle이 전역(global)이므로 IP 기반 추가 레이어를 먼저 적용할 것.

---

### [WARNING] HMAC 검증 — timing-safe 구현 미확인
- **위치**: `integration-oauth.service.ts` `handleInstall()` — HMAC 검증 내부
- **상세**: diff에서 `verifyHmacWithMessage` 구현이 보이지 않음. `crypto.timingSafeEqual` 대신 문자열 직접 비교(`===`)를 사용할 경우 타이밍 사이드채널로 유효한 HMAC 값 추론이 이론적으로 가능.
- **제안**: `followup` Group D 항목("verifyHmacWithMessage timing-safe 구현 확인")을 조속히 처리. 구현 내 `crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(provided))` 패턴 사용 여부를 코드 레벨에서 확인.

---

### [WARNING] renderCallbackHtml — OAuth 에러 메시지 XSS 가능성
- **위치**: `ThirdPartyOAuthController.oauthCallback` — catch 블록
- **상세**: `e.response?.message ?? e.message ?? 'OAuth failed'` 값이 `renderCallbackHtml`에 전달됨. 이 값은 OAuth provider(Google, GitHub, Cafe24)가 반환한 에러 메시지에서 유래할 수 있음. `renderCallbackHtml`이 이 문자열을 HTML-escape하지 않는다면 XSS 가능. 단, provider가 `ALLOWED_OAUTH_PROVIDERS` allowlist로 제한되어 있어 provider 파라미터 자체는 안전.
- **제안**: `renderCallbackHtml` 구현에서 에러 문자열의 HTML 이스케이프 처리 여부를 확인. 미처리라면 `error` 문자열을 `encodeHTML()` 등으로 sanitize 후 전달.

---

### [INFO] 오픈 리다이렉트 가능성 검토 필요
- **위치**: `ThirdPartyOAuthController.cafe24Install` — `res.redirect(302, redirectUrl)`
- **상세**: `handleInstall()`이 반환한 `redirectUrl`을 검증 없이 사용. DB에 저장된 `mall_id` 기반으로 Cafe24 authorize URL을 구성하는 구조라면 안전하나, 서비스 레이어가 외부 입력(쿼리 파라미터)에서 redirect URL을 파생한다면 open redirect 벡터가 될 수 있음.
- **제안**: `handleInstall()` 내부에서 생성되는 redirect URL이 항상 Cafe24 공식 도메인(`*.cafe24api.com`)으로 고정되는지 확인. 가능하다면 controller 레벨에서도 URL prefix 검증 추가.

---

### [INFO] rawQuery 추출 — URL 파싱 의존
- **위치**: `ThirdPartyOAuthController.cafe24Install:117` — `req.url.split('?', 2)[1]`
- **상세**: Cafe24 HMAC 검증을 위해 raw query string을 추출하는 방식. `split('?', 2)`는 안전하게 동작하며, URL fragment(`#`)는 서버에 전달되지 않으므로 문제없음. 다만 proxy/reverse proxy 환경에서 `req.url`이 full URL을 포함하는 경우 query 추출이 실패할 수 있으나 이는 설정 레벨 이슈.
- **제안**: 이슈 없음. 현재 구현 유지.

---

### [INFO] rate limit — 전역(global) 스로틀 only
- **위치**: `ThirdPartyOAuthController.cafe24Install` — `@Throttle({ default: { limit: 30, ttl: 60_000 } })`
- **상세**: 30 req/min이 전역으로만 적용됨. 단일 IP에서 분당 30회 전부 소비하거나, 복수 IP에서 분산 요청 시 token enumeration 시도가 가능. 128-bit 엔트로피 기반의 실질 위협 수준은 낮으나 보완 여지 있음.
- **제안**: `followup` Group A의 "install endpoint IP 기반 rate limiting 추가" 항목으로 이미 트래킹 중. 처리 우선순위 조정 권장.

---

### [INFO] `@Public()` 엔드포인트의 입력 검증 — 적절히 구현됨
- **위치**: `ThirdPartyOAuthController` — INSTALL_TOKEN_PATTERN, ALLOWED_OAUTH_PROVIDERS
- **상세**: install_token 형식 검증(`/^[A-Za-z0-9_-]{22}$/`)이 controller 경계에서 먼저 수행되어 DB 레이어에 도달하기 전에 무효 입력을 차단. provider allowlist 검증도 정상 적용. 테스트 파일(`third-party-oauth.controller.spec.ts`)이 이 보안 경계를 명시적으로 검증(old 64-hex 거부, 비 base64url 거부, 길이 불일치 거부).
- **제안**: 현재 구현 유지.

---

### [INFO] FRONTEND_URL/APP_URL 미설정 시 fail-closed 동작
- **위치**: `ThirdPartyOAuthController.oauthCallback:143-149`
- **상세**: postMessage `targetOrigin`에 `*`를 fallback으로 사용하지 않고, 환경변수 미설정 시 500 반환으로 fail-closed. 기존 `IntegrationsController`에서 이전된 보안 동작이 신규 컨트롤러에 올바르게 보존됨.
- **제안**: 현재 구현 유지.

---

## 요약

이번 변경은 OAuth 엔드포인트를 `/api/integrations/oauth/...`에서 `/api/3rd-party/<provider>/...`로 이전하고, Cafe24 App URL 100자 한도 대응을 위해 install_token을 256-bit hex에서 128-bit base64url로 단축한 리팩토링이다. 보안 관점에서 신규 `ThirdPartyOAuthController`는 controller 경계의 입력 검증, allowlist 기반 provider 검증, fail-closed postMessage 처리, `@Public()` 엔드포인트 명시 등 핵심 보안 패턴을 올바르게 적용하고 있다. 주요 우려사항은 세 가지: install_token의 URL path 노출(로그 유출, 트래킹 중), HMAC 검증의 timing-safe 구현 미확인, `renderCallbackHtml`로 전달되는 OAuth provider 에러 메시지의 XSS 가능성이다. install_token 엔트로피 감소는 Spec Rationale에 근거가 명확히 문서화된 의도된 트레이드오프이며 NIST/OWASP 기준을 충족한다.

## 위험도

**LOW** — Critical 취약점 없음. WARNING 3건(URL 노출, timing-safe HMAC, renderCallbackHtml XSS)은 모두 완화 조치가 존재하거나 기존 followup에 트래킹 중이며, 즉각적인 구현 블로커가 되지 않음.