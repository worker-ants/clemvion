## 성능 코드 리뷰 — OAuth 인증 플로우

---

### 발견사항

- **[WARNING]** `auth_oauth_state` 주기적 퍼지가 매 `beginAuth` 호출마다 실행됨
  - 위치: `auth-oauth.service.ts` `beginAuth()` — `void this.purgeExpired()`
  - 상세: OAuth 시작 요청마다 `DELETE FROM auth_oauth_state WHERE expires_at < now()` 가 fire-and-forget으로 실행됩니다. 트래픽이 몰릴 경우 동일 테이블에 동시에 INSERT(state 저장)와 DELETE(퍼지)가 충돌하여 테이블 락 경합이 발생할 수 있습니다.
  - 제안: BullMQ 주기 잡(예: 5분마다)이나 DB cron job으로 분리하거나, 최소한 `beginAuth` 100회에 1회 정도로 샘플링(`Math.random() < 0.01`)하여 호출 빈도를 낮추세요.

- **[WARNING]** `users` 테이블에 `(oauth_provider, oauth_provider_id)` 복합 인덱스 미존재
  - 위치: `users.service.ts` `findByOauth()`, `V013` 마이그레이션
  - 상세: `findByOauth`는 `{ oauthProvider: provider, oauthProviderId: providerId }` 조건으로 조회하는데, 해당 컬럼에 인덱스가 없으면 전체 테이블 스캔이 발생합니다. V013 마이그레이션에는 `auth_oauth_state` 인덱스만 있고 `users` 테이블 인덱스는 누락되어 있습니다.
  - 제안: 별도 마이그레이션에 `CREATE INDEX idx_users_oauth ON users (oauth_provider, oauth_provider_id);` 추가하세요.

- **[WARNING]** `generateTokens` 내 매번 2회 DB 쿼리 실행
  - 위치: `auth.service.ts` `generateTokens()` — `findOrCreatePersonalWorkspace` + `getMemberRole`
  - 상세: 토큰 발급 시마다 워크스페이스 조회 + 역할 조회 2회의 DB 라운드트립이 발생합니다. OAuth 콜백 전체 흐름에서 최소 5회(state DELETE → findByOauth → findByEmail → workspace 조회 → role 조회)의 순차 DB 호출이 이어집니다. Refresh 시에도 매번 동일하게 실행됩니다.
  - 제안: 워크스페이스 ID와 role은 사용자 생성/변경 시 캐싱하거나, `findOrCreatePersonalWorkspace`가 role을 함께 반환하도록 합쳐 DB 호출 1회를 줄이세요.

- **[INFO]** `redirectUri()` 중복 호출
  - 위치: `auth-oauth.service.ts` `beginAuth()` 및 `exchangeCodeForToken()`
  - 상세: 동일 요청 처리 중 `redirectUri(provider)`가 두 번 호출되며 각각 `configService.get()`을 실행합니다.
  - 제안: `beginAuth`에서 산출한 `redirectUri`를 `exchangeCodeForToken`에 인자로 전달하세요.

- **[INFO]** `configService.get('app.frontendUrl')` 매 콜백 요청마다 호출
  - 위치: `auth.controller.ts` `oauthCallback()` 내 `configService.get('app.frontendUrl')`
  - 상세: `cookieDomain`은 생성자에서 캐싱하는 반면 `frontendUrl`은 매 요청마다 조회합니다.
  - 제안: 생성자에서 `private readonly frontendUrl: string`으로 캐싱하세요.

- **[INFO]** `requireEnv(clientId)` 중복 호출
  - 위치: `auth-oauth.service.ts` `beginAuth()` 및 `exchangeCodeForToken()`
  - 상세: `process.env` 읽기는 저비용이지만 동일 키를 두 번 읽습니다.
  - 제안: `beginAuth`에서 읽은 `clientId`를 `exchangeCodeForToken`에 전달하거나 내부 캐시를 사용하세요.

---

### 요약

전반적으로 OAuth 플로우는 원자적 state 소비(DELETE RETURNING), GitHub 병렬 API 호출(Promise.all), fire-and-forget 퍼지 등 합리적인 설계를 갖추고 있습니다. 다만 세 가지 지점이 성능에 영향을 줄 수 있습니다. ① 트래픽이 높을 때 매 요청마다 실행되는 `purgeExpired`의 테이블 경합, ② OAuth 사용자 증가 시 인덱스 없는 `findByOauth`의 풀스캔, ③ 토큰 발급마다 반복되는 워크스페이스/역할 조회로 인한 Refresh 경로의 DB 부하가 주요 개선 포인트입니다.

---

### 위험도

**MEDIUM**