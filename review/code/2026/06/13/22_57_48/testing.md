# 테스트(Testing) Review — audit-user-actions (refactor 04 후속)

## 발견사항

### [INFO] 핵심 변경 모두 단위 테스트로 커버됨 — 책임 재배치를 정확히 따라감
- 위치: users.service.spec.ts / auth.service.spec.ts / sessions.service.spec.ts / users.controller.spec.ts
- 상세: B-2(도메인 로직 service 이전), A-1(세션 회전), B-1(ipAddress 감사)의 책임 이동이 테스트에도 그대로 반영됐다. UsersController 테스트는 도메인 검증을 더 이상 직접 단언하지 않고 `changePassword`/`rotateSessionAfterPasswordChange` 위임 호출만 검증(`changeSpy`/`rotateSpy`)하며, 검증 로직 자체는 UsersService 단위 테스트로 이전됐다. 컨트롤러가 mock 의존성에 위임만 하는 thin 구조로 바뀌어 테스트 용이성이 개선됐다.
- 제안: 없음.

### [INFO] UsersService.changePassword 의 분기 4종이 모두 커버됨
- 위치: users.service.spec.ts:1291-1358
- 상세: NotFound(사용자 없음), Unauthorized(OAuth-only passwordHash null), Unauthorized(현재 비밀번호 불일치), BadRequest(강도 위반)의 모든 throw 경로에서 `repo.update` 미호출까지 단언한다. 해피패스는 새 해시가 기존과 다름 + `bcrypt.compare` 재검증으로 실제 해시 동작을 검증해 mock 괴리가 없다. 엣지 케이스 커버리지가 충실하다.
- 제안: 없음.

### [INFO] 회귀 테스트 갱신 적절 — 시그니처 변경에 맞춰 mockReq/mockRes 추가
- 위치: auth.controller.spec.ts, webauthn.controller.spec.ts, users.controller.spec.ts
- 상세: `@Req()`/`@Res()` 파라미터 추가로 모든 핸들러 호출부에 mock 요청을 전달하도록 갱신됐고, 실패 경로(UnauthorizedException/BadRequestException/NotFoundException)에서 `auditLogsService.record` 미호출 단언이 유지돼 회귀 안전망이 보존됐다. `ipAddress` 단언이 새 동작에 맞게 추가됐다.
- 제안: 없음.

### [WARNING] extractClientIp 의 CF-신뢰 게이트가 테스트 격리에 영향 — mockReq 테스트는 env 의존이지만 reset 가드가 없음
- 위치: auth.controller.spec.ts:36-41, webauthn.controller.spec.ts:613-618, users.controller.spec.ts:923-929
- 상세: 세 컨트롤러 spec 의 `mockReq` 는 "CF-신뢰 off 기본 → X-Forwarded-For 첫 IP" 가정으로 `ipAddress: '9.9.9.9'`(또는 7.7.7.7/5.5.5.5)를 단언한다. 그런데 `auth-context.spec.ts` 만 `TRUST_CF_CONNECTING_IP` 를 `afterEach` 로 복원하고, 세 컨트롤러 spec 은 env 가드가 없다. 동일 Jest 워커에서 `TRUST_CF_CONNECTING_IP` 가 설정된 다른 테스트가 leak 되면 `extractClientIp` 가 `cf-connecting-ip` 헤더(부재)를 우선해 IP 단언이 깨질 수 있다. 현재는 헤더에 `cf-connecting-ip` 가 없어 우연히 통과하지만 격리가 env 부재에 암묵 의존한다.
- 제안: 컨트롤러 spec 들이 IP 추출 결과까지 단언하므로, 각 `describe` 상단에 `delete process.env.TRUST_CF_CONNECTING_IP` (또는 `beforeEach`)를 두어 `auth-context.spec.ts` 와 동일하게 env 의존을 명시 고정. 또는 컨트롤러 테스트는 IP 추출 메커니즘을 신뢰하고 `ipAddress: expect.any(String)` 수준으로 완화하고, IP 추출 정확성은 `client-ip`/`auth-context` 단위 테스트에 위임(중복 단언 제거 + 격리 강화).

### [WARNING] rotateSessionAfterPasswordChange 단위 테스트가 revoke→issue 순서를 보장하지 않음
- 위치: auth.service.spec.ts:281-308
- 상세: 해피패스 테스트는 `revokeAllFamilies` 호출과 토큰 반환을 각각 단언하지만, "revoke 가 먼저 일어난 뒤 새 세션이 발급된다"는 순서 불변식은 검증하지 않는다. 구현(auth.service.ts:362-367)은 revoke → findById → generateTokens 순이지만, 만약 순서가 뒤집히면(먼저 발급 후 전체 revoke) 방금 발급한 새 family 까지 revoke 되는 치명적 회귀가 생긴다. 이 순서가 옵션 B의 보안 핵심인데 테스트가 그것을 지키지 못한다.
- 제안: `revokeAllFamilies` 와 `generateTokens`(또는 jwtService.sign) 의 호출 순서를 `invocationCallOrder` 비교 또는 mock 호출 시점 검증으로 단언. 더 강하게는 `revokeAllFamilies` 가 `userId, isRevoked:false` 전부를 대상으로 하므로, 재발급된 토큰이 revoke 대상에 포함되지 않음을 보장하는 통합 관점은 e2e(refresh_token active=1 단언, 파일 18)가 이미 커버 — 단위에서는 순서만 보강하면 충분.

### [INFO] e2e 가 실제 DB INSERT 까지 검증 — 가장 강한 보호막
- 위치: test/users-change-password.e2e-spec.ts
- 상세: audit_log.ip_address=X-Forwarded-For(B-1), login_history.session_revoked(family_id NULL, A-1), refresh_token active=1(전 세션 revoke + 재발급) 까지 실 flow→DB로 검증한다. mock 괴리 위험이 가장 큰 부분(IP 추적, bulk revoke, 세션 재발급)을 정확히 짚었다.
- 제안: 없음.

### [WARNING] e2e: 두 번째 테스트(wrong password 401)가 첫 테스트의 부수효과(전 세션 revoke)에 암묵 의존
- 위치: test/users-change-password.e2e-spec.ts:1547-1555
- 상세: 두 테스트가 `beforeAll` 의 동일 `accessToken` 을 공유한다. 첫 테스트가 전 세션을 revoke 하지만 access token(15분)은 유효하다는 전제로 두 번째 테스트가 401(INVALID_PASSWORD)을 기대한다. 만약 첫 테스트가 실패하거나 access token 검증이 refresh 상태에 결합되면 두 번째 테스트의 401 원인이 모호해진다(인증 실패 401 vs 비밀번호 불일치 401 구분 불가). 또한 두 번째 테스트는 첫 테스트에서 이미 비밀번호가 `N3wP@ssw0rd!42` 로 바뀐 상태라 `currentPassword: 'WrongPass!9'` 가 "정말 틀린" 것이 첫 테스트 성공에 종속된다.
- 제안: 두 번째 테스트의 401 단언에 응답 본문 `code === 'INVALID_PASSWORD'` 를 함께 단언해 인증 실패와 구분. 가능하면 독립 사용자로 분리하거나 `it.concurrent` 대신 순서 의존을 주석으로 명시(이미 access token 주석은 있음 — code 단언 추가가 핵심).

### [INFO] 프런트 테스트: setAccessToken 교체 검증 추가 적절
- 위치: frontend change-password.test.tsx:1581-1599
- 상세: 응답 형태 변경(`{success}` → `{accessToken}`)에 맞춰 mock 응답을 `{ data: { data: { accessToken } } }` 중첩으로 갱신하고 `setAccessToken('new-access-token')` 호출을 단언했다. in-memory token 교체라는 옵션 B의 클라이언트 측 핵심 동작을 커버한다.
- 제안: (optional) `setAccessToken` 호출이 `router.push('/profile')` 보다 먼저 일어나는지(토큰 교체 후 네비게이트)는 단언하지 않음 — 순서가 깨지면 새 페이지가 구 토큰으로 요청할 수 있으나 영향은 경미. 현 수준 충분.

### [INFO] auth-context.ts DRY 추출 + 전용 단위 테스트 신규 추가 — 테스트 용이성 개선
- 위치: utils/auth-context.ts + auth-context.spec.ts
- 상세: 두 컨트롤러에 중복되던 inline 함수를 단일 export 함수로 추출하고 XFF-first/userAgent-null 두 케이스를 env 가드와 함께 테스트했다. 적절한 격리(afterEach 복원).
- 제안: (optional) `req.headers` 부재(`?? {}` 분기)와 `user-agent` 배열 헤더 케이스는 미커버 — 경계값이지만 Express 정상 동작에서 드묾.

## 요약
테스트 관점에서 견고한 변경이다. refactor 의 책임 재배치(컨트롤러 thin화, 도메인 로직 service 이전, 세션 회전 위임)가 테스트에도 정확히 반영돼 단위 테스트는 위임 검증, service 테스트는 분기 커버, e2e 는 실 DB INSERT 검증으로 계층이 명확히 분리됐다. UsersService.changePassword 의 4개 throw 경로와 실패 시 audit/rotate 미호출 회귀 단언이 모두 보존돼 커버리지 갭은 적다. 다만 (1) `rotateSessionAfterPasswordChange` 의 revoke→issue **순서 불변식**이 단위 테스트로 보장되지 않아 옵션 B의 보안 핵심 회귀를 잡지 못하고, (2) 컨트롤러 spec 들의 IP 단언이 `TRUST_CF_CONNECTING_IP` env 부재에 암묵 의존하며 reset 가드가 없어 격리가 취약하고, (3) e2e 두 번째 테스트의 401 이 첫 테스트 부수효과에 종속되며 인증 실패 vs 비밀번호 불일치 구분이 없다. 모두 보강 권장 수준이며 차단 사유는 아니다.

## 위험도
LOW
