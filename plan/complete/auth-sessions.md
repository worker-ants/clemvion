# 활성 세션·로그인 이력 관리

> 승인된 설계: `/Users/gehrig/.claude/plans/lexical-wiggling-ullman.md`
> 작업 브랜치: `feature/auth-sessions` (main 기준)
> 관련 spec: `spec/5-system/1-auth.md`, `spec/1-data-model.md`, `spec/2-navigation/9-user-profile.md`

## 목표

사용자가 본인의 활성 로그인 세션을 보고, 특정 세션을 강제 종료하고, 로그인 이력을 조회할 수 있게 한다. spec §2.3 "강제 종료 — 사용자가 활성 세션 목록에서 개별 종료 가능" 항목을 실제 구현으로 옮긴다.

## 결정된 정책

- 세션 단위 = `family_id`
- 로그인 이력에 성공·실패 모두 기록
- 모든 revoke 작업에 비밀번호 재확인 (OAuth-only + 2FA 미설정 사용자는 `REAUTH_NOT_AVAILABLE` 로 차단 — 비밀번호 설정 또는 2FA 활성화 후 재시도)
- 신규 페이지 `/profile/sessions`
- 로그인 이력 180일 보존
- Cloudflare 무료 플랜 호환: `CF-Connecting-IP` 우선

## spec 정합

기존 spec(`spec/2-navigation/9-user-profile.md` §6.1, `spec/5-system/1-auth.md` §2.3)에 이미 활성 세션 강제 종료가 정의되어 있으므로 API 경로는 spec 을 따른다.

- `GET    /api/users/me/sessions`
- `POST   /api/users/me/sessions/:familyId/revoke` — DELETE → POST 로 변경(CDN/프록시가 DELETE 바디를 제거하는 호환성 이슈)
- `POST   /api/users/me/sessions/revoke-others`
- `GET    /api/users/me/login-history?limit=&cursor=`

`SessionsController` 는 backend `auth` 모듈에 두되 path 만 `users/me/sessions` 로 매핑.

## 작업 체크리스트

### 문서
- [x] `spec/5-system/1-auth.md` §2.3, §4.1, §4.3, §5 갱신
- [x] `spec/1-data-model.md` 2.18.1 RefreshToken + 2.18.2 LoginHistory + 인덱스
- [x] `spec/2-navigation/9-user-profile.md` 보안 설정·API 표 갱신
- [x] backend Swagger doc — 컨트롤러 데코레이터로 자동 반영, `Sessions` 태그 등록

### Backend
- [x] V040 마이그레이션 (refresh_token 5컬럼 + login_history 테이블 + 인덱스 3개)
- [x] `refresh-token.entity.ts` 컬럼 추가
- [x] `login-history.entity.ts` 신규
- [x] `utils/client-ip.ts` + spec (CF-Connecting-IP 우선)
- [x] `utils/device-label.ts` + spec
- [x] `dto/responses/session.dto.ts`, `login-history.dto.ts`
- [x] `dto/requests/revoke-session.dto.ts` (password + totpCode)
- [x] `types/auth-context.ts` 공통 타입
- [x] `sessions.controller.ts` + `sessions.controller.spec.ts`
- [x] `sessions.service.ts` + `sessions.service.spec.ts` (TOTP·self-revoke 차단 포함)
- [x] `jobs/login-history-pruner.service.ts` + spec (Asia/Seoul, 배치 LIMIT)
- [x] `auth.service.ts`: generateTokens ctx, fire-and-forget record, refresh lastUsedAt 갱신, reuse 감지 이벤트
- [x] `auth.controller.ts`: IP/UA 캡처해 service 전달
- [x] `auth.module.ts`, `app.module.ts`, `main.ts` 등록·`trust proxy: 1`

### Frontend
- [x] `lib/api/sessions.ts` API 래퍼 (POST revoke)
- [x] `app/(main)/profile/sessions/page.tsx` 셸
- [x] `app/(main)/profile/sessions/sessions-panel.tsx` 두 탭 + reauth override
- [x] `components/session-row.tsx`, `revoke-confirm-dialog.tsx`, `login-history-list.tsx`
- [x] `app/(main)/profile/page.tsx` 진입 링크
- [x] i18n `ko.ts`, `en.ts` (`profile.sessions.*`)

### 검증
- [x] backend lint + unit + e2e + build (e2e 는 skip 됨)
- [x] frontend lint + unit + build (1 회귀는 `plan/in-progress/candidate-picker-test-regression.md` 로 분리)
- [x] CF-Connecting-IP curl 검증 — 운영 환경 적용 후 수행 (2026-05-13 사용자 수동 검증 완료)
- [x] ai-review + RESOLUTION.md (`review/2026-05-12_07-41-47/RESOLUTION.md`)

### 후속 follow-up (별도 plan)
- 멀티 인스턴스 환경 prune cron 분산 락 (현재 단일 backend 가정)
- `auth.service.ts` `generateTokens` 옵션 객체 리팩토링 (review WARN #30)
- `refresh()` TOCTOU 트랜잭션 처리 + `revokeFamily`/`revokeOthers` 트랜잭셔널 시퀀스 (review WARN #4, #6)
- frontend i18n: "Loading…" 키 추가, 세션 쿼리 staleTime, `flatMap` useMemo (review INFO)
- `integrations.service` 의 prettier 자동 정리 분리 (review WARN #10)
