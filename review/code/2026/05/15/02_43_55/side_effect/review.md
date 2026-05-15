## Side Effect 코드 리뷰

### 발견사항

---

**[CRITICAL]** OAuth `redirectUri` 하드코딩 변경 — Google/GitHub 전체 OAuth 연동 즉시 중단 위험
- **위치**: `integration-oauth.service.ts` lines 319, 785, 1046 (diff 기준)
- **상세**: 세 곳의 `redirectUri` 가 `/api/integrations/oauth/callback/...` → `/api/3rd-party/.../callback` 으로 변경됨. 이 값은 OAuth provider의 토큰 교환 요청과 authorization URL 양쪽 모두에 동일하게 삽입된다. Google Cloud Console / GitHub OAuth App 에 **새 URI 가 사전 등록되어 있지 않은 상태에서 배포**되면, Google·GitHub 기반의 모든 신규 통합 연결이 `redirect_uri_mismatch` 오류로 즉시 실패한다. Cafe24 Public 흐름도 동일 서비스 코드를 경유하므로 동일하게 영향받는다. 해당 조치가 plan `Phase 2 - OAuth 콘솔 재등록` 체크리스트에 포함되어 있으나, **배포와 콘솔 등록이 원자적으로 처리되어야 한다는 제약이 배포 절차 어디에도 명시되어 있지 않다**.
- **제안**: 배포 runbook에 "① Google/GitHub OAuth 콘솔에 새 URI 추가 완료 → ② 배포" 순서를 고정. 기존 URI는 삭제하지 않고 **두 URI 를 동시 등록**한 상태에서 배포해 롤백 가능성을 확보.

---

**[WARNING]** 구 컨트롤러 엔드포인트 즉시 제거 — 진행 중인 OAuth flow 또는 Cafe24 등록 App URL 404
- **위치**: `integrations.controller.ts` 제거된 핸들러 (`oauth/install/cafe24/:installToken`, `oauth/callback/:provider`)
- **상세**: 이 두 핸들러는 삭제되고 새 컨트롤러로 이전됐다. 배포 시점 기준으로 구 경로를 Cafe24 Developers "앱 URL"로 등록해 놓은 기존 Private 앱 사용자의 "테스트 실행" 요청이 즉시 404를 받는다. 특히 Cafe24 는 App URL을 character-by-character 비교하므로, 사용자가 수동으로 신규 URL을 재등록하지 않는 한 흐름이 완전히 끊긴다.
- **제안**: plan 체크리스트에 이미 반영된 "기존 Private 앱 등록자 대상 App URL 재등록 안내"를 배포 직후 즉시 발송. 허용 가능하다면 구 경로에 410 Gone + `X-Redirect-Info` 헤더로 신규 경로를 알려주는 단기 shim 을 두는 것도 고려.

---

**[WARNING]** 구 형식 `pending_install` 토큰 — 컨트롤러 레벨에서 묵시적 404
- **위치**: `third-party-oauth.controller.ts` `INSTALL_TOKEN_PATTERN = /^[A-Za-z0-9_-]{22}$/`
- **상세**: 배포 이전에 발급된 64자 hex `install_token` 을 가진 `pending_install` Integration이 DB에 잔존할 경우, Cafe24 "테스트 실행"이 구 App URL(이미 등록된 경우)을 호출하면 서비스 레이어까지 닿지 못하고 컨트롤러에서 404를 반환한다. 이 사용자에게는 흐름이 막혔다는 명시적 안내가 없다.
- **제안**: plan이 "대부분 등록 자체 실패 상태"라고 기술하지만, 배포 전 `pending_install` 상태 행 수를 확인해 0이 아니면 만료 처리 후 배포하거나, 영향받는 사용자에게 사전 안내.

---

**[INFO]** `oauthCallback` 핸들러에 Rate Limit 미설정
- **위치**: `third-party-oauth.controller.ts` `oauthCallback` 메서드
- **상세**: `cafe24Install` 에는 `@Throttle({ default: { limit: 30, ttl: 60_000 } })` 가 적용됐으나 `oauthCallback` 에는 없다. 구 컨트롤러도 동일했으므로 기존 동작과 일치한다.
- **제안**: 현재는 문제없으나, 향후 callback 엔드포인트에 대한 abuse 방어 필요 시 throttle 추가 고려.

---

**[INFO]** `ThirdPartyOAuthController` 라우트 충돌 가능성 검토
- **위치**: `third-party-oauth.controller.ts` 두 `@Get` 데코레이터
- **상세**: `@Get('cafe24/install/:installToken')` (3 세그먼트)과 `@Get(':provider/callback')` (2 세그먼트) 는 세그먼트 수가 달라 NestJS 라우터에서 충돌하지 않는다. 정적 세그먼트 우선 규칙도 올바르게 적용된다. 충돌 없음 확인.

---

### 요약

이번 변경은 `/api/integrations/oauth/...` namespace를 `/api/3rd-party/...`로 이전하고 install_token을 22자 base64url로 단축하는 잘 설계된 리팩터링이다. 구현 내부 로직은 일관성이 있고 신규 컨트롤러의 유효성 검사·에러 처리도 구 컨트롤러와 동등하다. 그러나 `redirectUri` 변경이 Google/GitHub OAuth 콘솔 등록 상태에 외부 의존성을 가지므로, **배포와 OAuth 콘솔 재등록이 순서가 바뀌면 전체 Google·GitHub 통합 연결이 즉시 중단된다**. 이 배포 순서 제약이 코드에 명시되지 않은 점이 가장 높은 위험이다.

### 위험도

**MEDIUM** — 코드 자체의 내부 일관성은 높으나, OAuth 콘솔 재등록과 배포 순서가 원자적으로 관리되지 않을 경우 운영 중단 범위가 Google·GitHub 포함 전체 OAuth 통합으로 확대된다.