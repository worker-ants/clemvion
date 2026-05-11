# 활성 세션·로그인 이력 관리

> 승인된 설계: `/Users/gehrig/.claude/plans/lexical-wiggling-ullman.md`
> 작업 브랜치: `feature/auth-sessions` (main 기준)
> 관련 spec: `spec/5-system/1-auth.md`, `spec/1-data-model.md`, `spec/2-navigation/9-user-profile.md`

## 목표

사용자가 본인의 활성 로그인 세션을 보고, 특정 세션을 강제 종료하고, 로그인 이력을 조회할 수 있게 한다. spec §2.3 "강제 종료 — 사용자가 활성 세션 목록에서 개별 종료 가능" 항목을 실제 구현으로 옮긴다.

## 결정된 정책

- 세션 단위 = `family_id`
- 로그인 이력에 성공·실패 모두 기록
- 모든 revoke 작업에 비밀번호 재확인 (OAuth-only → TOTP/이메일 OTP fallback)
- 신규 페이지 `/profile/sessions`
- 로그인 이력 180일 보존
- Cloudflare 무료 플랜 호환: `CF-Connecting-IP` 우선

## spec 정합

기존 spec(`spec/2-navigation/9-user-profile.md` §6.1, `spec/5-system/1-auth.md` §2.3)에 이미 활성 세션 강제 종료가 정의되어 있으므로 API 경로는 spec을 따른다 (plan 원본의 `/auth/sessions` → `/users/me/sessions` 로 정렬).

- `GET    /api/users/me/sessions`
- `DELETE /api/users/me/sessions/:familyId`
- `POST   /api/users/me/sessions/revoke-others`
- `GET    /api/users/me/login-history?limit=&cursor=`

`SessionsController` 는 backend `auth` 모듈에 두되 path만 `users/me/sessions` 로 매핑 (RefreshToken 의존성 유지).

## 작업 체크리스트

### 문서
- [ ] `spec/5-system/1-auth.md` §2.3, §4.1, §5 갱신
- [ ] `spec/1-data-model.md` refresh_token 확장 + login_history 추가
- [ ] `spec/2-navigation/9-user-profile.md` 세션 페이지 항목 추가
- [ ] backend Swagger doc (컨트롤러 데코레이터로 자동 반영)

### Backend
- [ ] V039 마이그레이션 (refresh_token 5컬럼 + login_history 테이블)
- [ ] `refresh-token.entity.ts` 컬럼 추가
- [ ] `login-history.entity.ts` 신규
- [ ] `utils/client-ip.ts` + spec (CF-Connecting-IP 우선)
- [ ] `utils/device-label.ts` + spec
- [ ] `dto/responses/session.dto.ts`, `login-history.dto.ts`
- [ ] `dto/requests/revoke-session.dto.ts`
- [ ] `sessions.controller.ts` + `sessions.service.ts`
- [ ] `jobs/login-history-pruner.service.ts`
- [ ] `auth.service.ts`: generateTokens ctx, recordLoginEvent, refresh의 lastUsedAt 갱신, reuse 감지 이벤트
- [ ] `auth.controller.ts`: IP/UA 캡처해 service 전달
- [ ] `auth.module.ts`, `app.module.ts`, `main.ts` 등록·trust proxy

### Frontend
- [ ] `lib/api/sessions.ts` API 래퍼
- [ ] `app/(main)/profile/sessions/page.tsx` 셸
- [ ] `app/(main)/profile/sessions/sessions-panel.tsx` 두 탭
- [ ] `components/session-row.tsx`, `revoke-confirm-dialog.tsx`, `login-history-list.tsx`
- [ ] `app/(main)/profile/page.tsx` 진입 링크
- [ ] i18n `ko.ts`, `en.ts` + 타입 갱신

### 검증
- [ ] backend lint + unit + e2e + build
- [ ] frontend lint + unit + build
- [ ] CF-Connecting-IP curl 검증
- [ ] ai-review + RESOLUTION.md
