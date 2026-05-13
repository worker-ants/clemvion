# fix-login-history-race

## 현상

`backend/test/session-revocation.e2e-spec.ts` 의 `E. login-history 가 login_success 이벤트를 시간 역순으로 노출` 가 다음과 같이 실패한다.

```
expect(received).toBeGreaterThanOrEqual(expected)
Expected: >= 2
Received:    1
```

setupUser 가 같은 사용자로 2회 로그인하지만 `/api/users/me/login-history` 응답에는 1건만 노출된다.

## 원인 (가설)

`AuthService` · `SessionsService` 의 모든 `loginHistory.record(...)` 호출이 `void ...` 로 fire-and-forget 처리되어 있다. 즉:

1. 클라이언트가 `POST /api/auth/login` 응답을 받기 전에 `record(...)` 의 INSERT 가 완료된다는 보장이 없다.
2. 두 번째 로그인 직후 곧바로 `GET /api/users/me/login-history` 를 호출하면, 두 번째 `record()` 가 PG 에 commit 되기 전에 SELECT 가 다른 connection 으로 실행돼 1 건만 보인다.
3. TypeORM 의 connection pool 은 INSERT 와 SELECT 가 같은 connection 을 쓴다는 보장이 없으므로 visibility 가 갈린다.

`login-history.service.ts#record` 는 이미 내부에서 예외를 swallow 하므로 호출부에서 `await` 해도 인증 흐름에 추가 실패 가능성은 없다 — 단지 응답 전 INSERT durability 만 보장된다.

## 작업 항목

- [x] 원인 분석 (auth.service.ts · sessions.service.ts · login-history.service.ts 정독)
- [x] `void this.loginHistory.record(...)` → `await this.loginHistory.record(...)` 전체 치환 (auth.service.ts 13건, sessions.service.ts 2건)
- [x] `record()` 호출 위치 주석 보강 — "응답 전에 durability 보장이 필요한 audit row" 컨텍스트 명시
- [x] backend lint
- [x] backend unit test
- [x] backend build
- [x] `make e2e-test` 통과 확인
- [x] ai-review (필요 시)
- [x] `plan/complete/` 로 `git mv`

## 영향 범위

- `backend/src/modules/auth/auth.service.ts` — register / verifyEmail / login / loginWithTotp / refresh / forgot-password / reset-password 등 `record()` 가 있는 13곳
- `backend/src/modules/auth/sessions.service.ts` — single revoke / revoke-others 2곳
- 응답 latency 가 `INSERT login_history` 1회만큼 증가 (~1–5 ms). 이미 직전에 `refresh_token` INSERT 가 있어 추가 비용은 미미.
