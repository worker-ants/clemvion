### 발견사항

해당 없음 — 단, 기존 패턴 유지 여부 확인 결과를 기술한다.

이번 변경의 핵심은 URL namespace 이전(`/api/integrations/oauth/...` → `/api/3rd-party/...`)과 install_token 인코딩 변경(`randomBytes(32).hex` → `randomBytes(16).base64url`)이다. 동시성 관련 코드 경로는 다음과 같이 분석됩니다.

- **`randomBytes(16).toString('base64url')`** — Node.js `crypto.randomBytes`는 동기식이며 thread-safe. 변경 전후 동일한 안전성 보장.
- **`ThirdPartyOAuthController.cafe24Install`** — 컨트롤러는 stateless하게 `oauthService.handleInstall`에 위임. 신규 controller 분리가 공유 상태나 동기화 메커니즘을 변경하지 않음.
- **install_token 조회 → HMAC 검증 → OAuthState 생성** 흐름 — 이 check-then-act 패턴의 비원자성(Cafe24가 동시에 두 번 "테스트 실행"을 호출하면 두 OAuthState가 생성될 수 있음)은 이번 변경 이전부터 존재했으며, 이번 PR은 해당 로직을 그대로 이전했을 뿐 변경하지 않음.
- **`@Throttle({ default: { limit: 30, ttl: 60_000 } })`** — 기존 컨트롤러에서 동일 데코레이터가 이미 적용되어 있었고, 신규 컨트롤러에도 동일하게 적용됨. throttler storage(메모리 또는 Redis) 동작 자체는 변경 없음.

### 요약

이번 변경은 OAuth callback/install 엔드포인트의 URL namespace 이전과 install_token 인코딩 단축(256-bit hex → 128-bit base64url)이 전부다. 동시성 관점에서 새로 도입되거나 악화된 경쟁 조건·데드락·비동기 오류는 없다. install_token 단일 row 조회 후 HMAC 검증까지의 비원자적 패턴은 기존부터 존재하던 설계상 선택이며, 이번 PR 범위 밖이다.

### 위험도

**NONE**