### 발견사항

- **[INFO]** `process.env.APP_URL` 매 요청마다 읽기
  - 위치: `integration-oauth.service.ts` lines 319, 782, 1051 / `third-party-oauth.controller.ts` `oauthCallback`
  - 상세: `process.env.APP_URL || 'http://localhost:3011'` 가 OAuth begin·install·callback 호출마다 평가된다. Node.js `process.env` 접근은 실제로는 빠르지만, 런타임 중 절대 바뀌지 않는 값을 매번 읽는 패턴이다.
  - 제안: 서비스 생성자나 모듈 상수로 한 번만 resolve해 두면 의도가 명확해진다. 현재 규모에서 측정 가능한 차이는 없음.

- **[INFO]** `ALLOWED_OAUTH_PROVIDERS.includes(provider)` — O(n) 배열 탐색
  - 위치: `third-party-oauth.controller.ts` `oauthCallback`
  - 상세: 현재 providers가 3개(`cafe24`, `google`, `github`)이므로 사실상 O(1)과 동일. 향후 provider 수가 크게 늘어날 경우에만 `Set`으로 교체할 이유가 생긴다.
  - 제안: 현 규모에서는 변경 불필요.

- **[INFO]** `req.url.split('?', 2)[1]` — 요청마다 string 슬라이스 생성
  - 위치: `third-party-oauth.controller.ts` line ~139 `cafe24Install`
  - 상세: 매 install 요청마다 URL 문자열을 분리해 새 문자열을 할당한다. Cafe24 "테스트 실행"은 사용자 인터랙션 빈도라 트래픽이 극히 낮으므로 실질 영향 없음.
  - 제안: 현 규모에서는 변경 불필요.

- **[INFO]** 토큰 단축(`randomBytes(32).hex` → `randomBytes(16).base64url`) — 소폭 긍정적
  - 위치: `integration-oauth.service.ts` line ~891
  - 상세: 생성 엔트로피 절반 감소(32→16 bytes), 결과 문자열 크기 67% 감소(64자→22자). DB 인덱스 키 크기, HTTP URL 길이, 로그 I/O 모두 소폭 감소. 보안 등급(128-bit)은 NIST/OWASP 권장을 유지.
  - 제안: 현재 방향 유지.

### 요약

이번 변경은 URL namespace 재구성과 토큰 단축이 핵심으로, 성능 관점의 신규 위험 요소는 없다. `process.env` 반복 접근과 배열 탐색은 기존 코드베이스에서도 동일하게 존재하던 패턴이며, 현재 트래픽 특성(OAuth install은 사용자 인터랙션 주도, callback은 provider redirect 주도)에서 측정 가능한 영향을 주지 않는다. 오히려 토큰 길이 단축으로 URL·DB 키 크기가 소폭 줄어 긍정적이다.

### 위험도

**NONE**