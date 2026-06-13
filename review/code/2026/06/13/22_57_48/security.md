# 보안(Security) Review

## 발견사항

- **[INFO]** 비밀번호 변경 시 전 세션 revoke + 재발급 (옵션 B) — 보안적으로 올바른 강화
  - 위치: `codebase/backend/src/modules/auth/auth.service.ts` `rotateSessionAfterPasswordChange`, `codebase/backend/src/modules/auth/sessions.service.ts` `revokeAllFamilies`, `codebase/backend/src/modules/users/users.controller.ts` `changePassword`
  - 상세: 비밀번호 변경 성공 시 사용자의 모든 활성 family 를 revoke 하고 현재 디바이스에 새 세션을 재발급한다. OWASP Session Management(비밀번호 변경 시 기존 세션 무효화) 권고와 일치. 탈취 가능한 구 refresh token 을 변경 시점에 전부 회전시켜 이전 controller-only bcrypt 교체 대비 인가 측면이 강화됐다.
  - 제안: 없음 (개선 사항)

- **[INFO]** 권한/인가 검증 경로 보존
  - 위치: `users.service.ts` `changePassword`, `auth.controller.ts` `disable2fa`
  - 상세: 도메인 로직을 controller→service 로 이전(B-2)하면서도 `currentPassword` bcrypt 검증·강도 검증·OAuth-only(`passwordHash` 부재) 차단이 그대로 유지된다. `disable2fa` 의 비밀번호 재확인, `webauthnDelete` 의 `ParseUUIDPipe` 입력 검증도 보존. `@UseGuards(JwtAuthGuard)` 가 컨트롤러 레벨에 유지돼 인증 우회 신규 표면 없음. `rotateSessionAfterPasswordChange`/`revokeAllFamilies` 모두 사용자 부재 시 `UnauthorizedException` 으로 fail-closed.

- **[INFO]** ipAddress 출처가 신뢰 게이트를 통과 — 감사 로그 오염 방어
  - 위치: 전 컨트롤러의 `extractClientIp(req)` + `authContextFromRequest` (`utils/auth-context.ts`)
  - 상세: 감사/이력에 기록되는 IP 는 `extractClientIp` 경유로, 위변조 가능한 `CF-Connecting-IP` 는 `TRUST_CF_CONNECTING_IP` 가 켜진 배포에서만 신뢰한다(기본 off, fail-safe). DRY 통합(C-1)이 두 controller 의 중복 정의를 단일 함수로 합쳐 로직 drift 위험을 줄였고 동작은 동일. 다만 `X-Forwarded-For` 첫 IP 신뢰는 Express `trust proxy` 설정과 프록시 hop 수가 정확해야 위조 불가하다(본 변경 범위 밖의 기존 전제).

- **[INFO]** refresh 쿠키 보안 속성 유지
  - 위치: `users.controller.ts` 가 호출하는 `setRefreshTokenCookie` (`utils/refresh-cookie.ts`)
  - 상세: 재발급 쿠키는 기존 공유 유틸을 그대로 사용 — `httpOnly: true`, `secure: true`, `SameSite`(기본 none + Origin allowlist 보완), `Path=/api/auth` 한정. 신규 평문 토큰 노출이나 쿠키 속성 약화 없음. accessToken 만 응답 본문으로 반환(refresh 는 본문 노출 안 함).

- **[INFO]** 시크릿/암호화/인젝션 신규 위험 없음
  - 상세: 하드코딩된 시크릿 없음(테스트 픽스처의 `OldP@ssw0rd1`·`9.9.9.9` 등은 spec 파일 한정). bcrypt rounds=12 유지(테스트만 round 4 — 무관). SQL 은 모두 TypeORM 파라미터라이즈드(`repository.update`) 또는 e2e 의 파라미터 바인딩(`$1`)으로 인젝션 표면 없음. 감사 `record` 는 best-effort 로 실패를 삼켜 주 동작을 깨지 않으며 민감정보를 에러로 노출하지 않는다.

- **[INFO]** (정보) 동일 PR 외 deferred 항목 — 본 변경 범위 아님
  - 위치: `plan/in-progress/execution-engine-typed-errors.md`
  - 상세: 별도 plan 으로, `buildContinuationErrorAck` 가 내부 `error.message` 를 클라이언트 ack 로 누출할 수 있다는 정보 노출(OWASP A09/민감정보 노출) 우려가 이미 추적 등록됨. 본 리뷰 대상 코드 변경에는 포함되지 않으며 별도 작업으로 분리 결정됨. 추가 조치 불필요(추적 중임을 확인).

## 요약
본 변경은 비밀번호 변경 흐름에 전 세션 revoke + 현재 디바이스 재발급(옵션 B)을 도입하고, user.* 인증 감사 이벤트에 신뢰 게이트(`extractClientIp`)를 통과한 ipAddress 를 동반하며, 중복 IP-추출 로직을 단일 helper 로 통합하는 리팩터다. 모든 변경이 보안을 강화하거나 중립적이며 — 세션 무효화는 OWASP 권고에 부합하고, 인증/인가 게이트·bcrypt 검증·OAuth-only 차단·쿠키 보안 속성·파라미터라이즈드 쿼리가 모두 보존된다. 신규 인젝션·하드코딩 시크릿·취약 암호화·인증 우회 표면은 발견되지 않았다. IP 출처는 위변조 헤더를 기본 불신하는 fail-safe 정책을 따른다. 유일하게 관찰된 정보-노출 우려(execution-engine error message 누출)는 본 변경 범위 밖이며 별도 plan 으로 이미 추적 중이다.

## 위험도
NONE
