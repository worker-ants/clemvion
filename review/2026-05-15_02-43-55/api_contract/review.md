### 발견사항

- **[CRITICAL] Breaking change: 구 OAuth 콜백/설치 엔드포인트 즉시 제거, redirect 없음**
  - 위치: `integrations.controller.ts` — `@Get('oauth/callback/:provider')`, `@Get('oauth/install/cafe24/:installToken')` 핸들러 전체 삭제
  - 상세: `/api/integrations/oauth/callback/:provider` 및 `/api/integrations/oauth/install/cafe24/:installToken`이 응답 없이 완전 제거됨. Cafe24 Developers 콘솔에 구 App URL / Redirect URI를 등록해 둔 운영 환경에서는 "테스트 실행" 시 404(라우트 없음)가 즉시 발생한다. 301/302 redirect나 410 Gone 임시 핸들러도 없음. Google Cloud Console / GitHub OAuth App에 구 콜백 URL만 등록된 환경도 동일하게 단절.
  - 제안: 배포 전 OAuth 공급자 콘솔(Cafe24 Developers, Google Cloud Console, GitHub OAuth App)의 Redirect URI를 신규 경로로 **모두 교체**하는 것이 필수 선행 조건. 단계적 배포가 필요하다면 구 핸들러를 일시적으로 `410 Gone`으로 유지하거나, 배포와 콘솔 설정 변경을 동시에 적용하는 atomic 절차를 운영 체크리스트에 명시해야 함.

- **[WARNING] 기존 `pending_install` 행의 64-hex 토큰과 신규 `INSTALL_TOKEN_PATTERN` 불일치**
  - 위치: `third-party-oauth.controller.ts:31` — `const INSTALL_TOKEN_PATTERN = /^[A-Za-z0-9_-]{22}$/`
  - 상세: DB에 잔존하는 `pending_install` 행의 `install_token`은 64자 hex이다. URL 경로 자체가 바뀌었으므로 Cafe24가 구 URL을 호출할 일은 없지만, 만약 사용자가 구 App URL로 Cafe24에 등록 후 아직 "테스트 실행"을 시도하지 않은 케이스라면 신규 경로 + 구 토큰 형식으로 호출이 들어올 수 없어 자연스럽게 TTL 만료 처리된다. Plan에서 "마이그레이션 생략"을 명시하고 있어 의도적 결정이나, **운영 담당자가 구 pending_install 행 수를 확인 후 TTL 만료를 기다리거나 수동 expire 처리하는 절차**가 API 계약 문서에 없음.
  - 제안: 배포 운영 체크리스트에 "기존 `pending_install` 행은 24h TTL로 자연 만료됨 — 수동 처리 불필요" 한 줄 명시.

- **[WARNING] `oauthCallback` 엔드포인트에 throttle 미적용**
  - 위치: `third-party-oauth.controller.ts` — `@Get(':provider/callback')` 핸들러
  - 상세: install 엔드포인트(`cafe24Install`)에는 `@Throttle({ default: { limit: 30, ttl: 60_000 } })`가 적용되어 있으나, OAuth 콜백 핸들러(`oauthCallback`)에는 throttle이 없다. 콜백은 `code` + `state` 파라미터로 토큰 교환을 수행하는 민감한 경로로, replay 가능성은 낮지만 state 탐색 시도에 노출될 수 있음.
  - 제안: `oauthCallback`에도 throttle 적용 고려. OAuth 공급자가 redirect하는 경로이므로 limit을 install보다 완화(예: 60 req/min)해도 충분.

- **[WARNING] 에러 코드명과 실제 동작 범위 불일치**
  - 위치: `spec/2-navigation/4-integration.md §9.4`, `third-party-oauth.controller.ts`
  - 상세: `CAFE24_PRIVATE_APP_ALREADY_CONNECTED`는 spec에서 "`app_type` 무관 — public/private 모두" 거부로 설명이 갱신됐으나, 에러 코드명 자체가 `PRIVATE_APP`을 포함해 클라이언트 파서 입장에서 혼동 유발. API 계약의 에러 코드는 코드명 자체가 의미를 전달해야 함.
  - 제안: `CAFE24_MALL_ALREADY_CONNECTED`로 코드명 변경 검토. 또는 description에 "코드명은 하위 호환 유지 목적으로 변경 않음" 명시.

- **[INFO] URL 구조 비대칭: Cafe24 install은 `cafe24/install/:token`, 콜백은 `:provider/callback`**
  - 위치: `ThirdPartyOAuthController` — `@Get('cafe24/install/:installToken')` vs `@Get(':provider/callback')`
  - 상세: install 엔드포인트는 provider가 경로 고정(`cafe24/install/...`)이고 callback은 파라메트릭(`:provider/callback`)이다. Cafe24에만 install 진입점이 존재한다는 비즈니스 현실을 반영한 의도적 설계이지만, REST 관점에서 같은 컨트롤러 prefix 내에서 라우트 패턴이 혼재함. `:provider/install/:token`으로 일반화도 가능하나 현재 범위(Cafe24 전용)에서는 오버엔지니어링.
  - 제안: 현행 유지 가능. 단 Swagger `@ApiParam` description에 "Cafe24 Private 전용 엔드포인트" 명시로 계약 범위를 문서화.

- **[INFO] `rawQuery` 추출 방식이 reverse proxy 환경에서 불안정할 수 있음**
  - 위치: `third-party-oauth.controller.ts:118` — `const rawQuery = req.url.includes('?') ? req.url.split('?', 2)[1] : ''`
  - 상세: `req.url`은 NestJS/Express에서 reverse proxy를 거치면 path가 재작성될 수 있고, `?` 이전에 `/api/3rd-party/cafe24/install/TOKEN`이 포함된 전체 URL-relative path에서 split하므로 일반적으로는 안전하나, 쿼리에 인코딩된 `?`가 포함된 엣지 케이스에서 HMAC 검증 실패 가능. 구 컨트롤러에서 그대로 이전된 로직임.
  - 제안: `req.query`를 직접 `URLSearchParams`로 재직렬화하거나 `Object.entries(req.query).map(...)` 방식으로 raw query를 재구성하는 것이 더 안전.

---

### 요약

이번 변경의 핵심은 `/api/integrations/oauth/...` → `/api/3rd-party/...` namespace 이전과 `install_token` 형식 단축이다. 신규 `ThirdPartyOAuthController`의 내부 구현(유효성 검증, 에러 포맷, 인증 처리)은 구 컨트롤러와 동일한 수준을 유지하며 `@Public()` 적용, throttle, Swagger 문서화도 적절하다. 그러나 **구 엔드포인트 완전 제거가 즉각적인 breaking change**를 유발한다 — 배포 시점에 Cafe24 Developers / Google / GitHub OAuth 콘솔의 redirect URI가 동시에 교체되지 않으면 모든 OAuth 흐름이 즉시 단절되므로, 배포와 콘솔 설정 변경의 원자적 실행이 이번 API 계약의 가장 중요한 운영 제약 조건이다.

### 위험도
**HIGH** — API 계약 자체의 설계 결함은 없으나, 구 엔드포인트 즉시 제거로 인해 배포 순서가 잘못되면 운영 중인 OAuth 흐름 전체가 단절되는 배포 위험이 존재.