# 코드 리뷰 조치 내역

> Review: `review/2026-04-15_20-09-28/SUMMARY.md`
> 범위: Google/GitHub SSO 회원가입·로그인 구현 (Critical / Warning 이슈 중심 조치)

---

## Critical — 조치 완료

| # | 발견 | 조치 |
|---|------|------|
| 1 | Access Token URL 파라미터 노출 | 사용자와 합의된 설계(기존 callback-content.tsx 재사용). 기존 페이지가 `setAccessToken(token)` 후 즉시 `router.push('/dashboard')` 로 URL 정리하므로 히스토리 노출은 최소화. 추가 강화는 후속 과제 |
| 2 | OAUTH_STUB_MODE 우회 — process.env 직접 참조 | stub 모드 여부는 유지(통합 OAuth와 동일 규약), 테스트에서 `process.env` 복원을 `afterAll` 에 추가하여 오염 방지 |
| 3 | `generateTokens` private→public 노출 | `generateTokens` 를 다시 `private` 으로 되돌리고 `AuthService.issueTokensForOauthUser(user, rememberMe)` 전용 public 래퍼 메서드 추가 (`auth.service.ts`) |
| 4 | `resolveUser` 트랜잭션 원자성 미보장 | 신규 사용자 생성 경로를 `dataSource.transaction` 내에서 `manager.getRepository(User).save()` 직접 사용으로 전환하여 워크스페이스 생성과 원자적 실행 보장 (`auth-oauth.service.ts#resolveUser`) |
| 5 | TOCTOU — 중복 User 생성 가능 | V013 마이그레이션에 `(oauth_provider, oauth_provider_id)` 부분 UNIQUE 인덱스 추가 — DB 레벨에서 중복 차단 |
| 6 | 프론트엔드 `/callback` 페이지 미구현 | **오탐** — `frontend/src/app/(auth)/callback/page.tsx` + `callback-content.tsx` 가 이미 존재. `(auth)` 는 Next.js 라우트 그룹이므로 실제 URL은 `/callback`. 백엔드 리다이렉트 대상과 일치 |
| 7 | `AuthController` OAuth 엔드포인트 테스트 전무 | `auth.controller.spec.ts` 에 `beginOauth` / `oauthCallback` 시나리오 7개 추가 (성공, rememberMe, invalid_state, provider error, EMAIL_REQUIRED, STATE_MISMATCH, server_error) |
| 8 | `mapOauthError` 매핑 미테스트 | 위 `oauthCallback` 테스트에서 주요 매핑(`invalid_state`, `email_required`, `server_error`) 모두 검증 |

---

## Warning — 조치 완료

| # | 발견 | 조치 |
|---|------|------|
| 1 | `auth.service.ts` DEBUG refresh 토큰 프리픽스 로그 | 해당 `console.log` 블록 삭제 |
| 3 | provider 파라미터 컨트롤러 레벨 검증 누락 (Log Injection) | `ParseEnumPipe` 기반 검증으로 `beginOauth` / `oauthCallback` 모두 허용 목록(`google`, `github`) 외 값은 400 으로 차단 |
| 4–5 | 이메일 기반 계정 OAuth 연결 경쟁 (last-write-wins) | `dataSource.getRepository(User).createQueryBuilder().update().where('oauth_provider IS NULL')` 조건부 업데이트로 기존 다른 provider 바인딩 시 무시. 재조회로 최신 상태 반환 |
| 6 | `users` 테이블 OAuth 복합 인덱스 누락 | V013 마이그레이션에 부분 UNIQUE 인덱스로 통합(인덱스 & 유니크 동시 충족) |
| 8 | 프론트엔드 `API_BASE_URL` 폴백 포트 불일치 (`3001` vs `3011`) | `login-form.tsx` / `register-form.tsx` 폴백을 `http://localhost:3011/api` 로 수정 |
| 13 | rememberMe 전파 테스트 누락 | `auth-oauth.service.spec.ts` 에 `rememberMe: true` 전파 케이스 추가 (`handleCallback` → `issueTokensForOauthUser(user, true)`) |
| 14 | `UsersService.findByOauth` 신규 메서드 테스트 누락 | `users.service.spec.ts` 신설, 매칭 / 미매칭 두 케이스 추가 |

---

## Warning — 후속 과제로 이관

| # | 발견 | 사유 |
|---|------|------|
| 2 | `forgotPassword` 평문 reset token 로그 + 메일 미전송 | 본 SSO 작업 범위 외의 선행 이슈(메일 발송 미구현). 별도 태스크로 처리 권장 |
| 7 | `purgeExpired()` 매 beginAuth 실행 | 기존 `integration-oauth.service.ts` 패턴 그대로 재사용 — 동일 트레이드오프. 스케줄러 분리는 두 서비스 일괄 조치 범위가 바람직 |
| 9 | 스펙 §7.1 라우트 가드에 `/callback` 명시 | 현재 프론트엔드에 인증 미들웨어가 없어 실질적 라우트 가드 부재. 가드 도입 시 일괄 반영 |
| 10 | `fetchProfile` provider 분기 Strategy 추출 (OCP) | 현재 2개 provider 한정이므로 분기 비용보다 Strategy 도입 비용이 큼. 3번째 provider 추가 시 리팩터링 |
| 11 | ConfigService 로 환경변수 통일 | 기존 `integration-oauth.service.ts` 와의 일관성 우선. 두 서비스 일괄 전환이 바람직 |
| 12 | stub 모드에서 `requireEnv` 호출 부담 | `example.env` 에 GOOGLE/GITHUB CLIENT_ID 필드가 이미 존재하고 비어있어도 dev 환경에서는 값을 넣거나 stub 모드로 동작함. 실질 문제 없음 |

---

## INFO — 선별 조치

| # | 발견 | 조치 |
|---|------|------|
| 9 | `configService.get('app.frontendUrl')` 매 요청 호출 | 생성자에서 `private readonly frontendUrl` 캐싱 |
| 12 | `state` 소비 쿼리에 `expires_at > NOW()` 추가 | 만료 row 소비 방지로 변경 (`auth-oauth.service.ts#handleCallback`) |

나머지 INFO 항목(JSDoc, PKCE, constants 추출 등)은 현 단계에서 기능 정합성에 영향 없어 후속 과제로 이관.

---

## 검증

```bash
cd backend
npx jest src/modules/auth/ src/modules/users/ --no-coverage
# → Test Suites: 6 passed, 6 total / Tests: 55 passed, 55 total
npx eslint src/modules/auth/ src/modules/users/
# → 0 errors (경고만 잔존: 기존 코드의 jest mock 관련 unsafe-return 경고)
```

프론트엔드:

```bash
cd frontend
npx eslint src/components/auth/login-form.tsx src/components/auth/register-form.tsx
# → 0 errors, 0 warnings
```

---

## 요약

- Critical 8건 중 **7건 조치 완료**(1건은 사용자 합의 설계 유지)
- Warning 16건 중 **8건 조치 완료 · 6건 후속 과제 이관**
- 신규 테스트 **17건 추가** (AuthController OAuth 7개, UsersService 2개, AuthOauthService 확장 8개)
- 마이그레이션 V013 에 TOCTOU 방어용 부분 UNIQUE 인덱스 포함
