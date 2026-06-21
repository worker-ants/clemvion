# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 테스트 커버리지 결함(서비스 레이어 단위 테스트 전무)과 트랜잭션 분리로 인한 보안 불변식 위반 가능성이 주요 위험. 기능 구현 자체는 spec 과 잘 일치하며 보안 설계는 견고함.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `AuthService` 신규 4개 메서드(`requestEmailChange`, `verifyEmailChange`, `resendEmailChange`, `cancelEmailChange`)에 단위 테스트 전무 | `codebase/backend/src/modules/auth/auth.service.spec.ts` | 4개 메서드 describe 블록 추가; UsersService·SessionsService·MailService jest mock 주입 후 각 분기 커버 |
| 2 | Testing | `SessionsService.reauthenticate` 단위 테스트 부재 (null user → UnauthorizedException 경로 미검증) | `codebase/backend/src/modules/auth/sessions.service.spec.ts` | describe 블록 추가: (1) user 없음 → UNAUTHENTICATED, (2) 정상 → verifyReauth 위임 |
| 3 | Testing | `UsersService.emailTakenByOther` 단위 테스트 부재 (대소문자 무시·본인 제외 미검증) | `codebase/backend/src/modules/users/users.service.spec.ts` | Repository mock 으로 대소문자 무시·본인 제외 조건 테스트 |
| 4 | Testing | `MailService` 신규 2개 메서드 단위 테스트 부재 | `codebase/backend/src/modules/mail/mail.service.spec.ts` | 정상 발송·실패 re-throw·CONSOLE 분기 테스트 |
| 5 | Database | `verifyEmailChange` — 이메일 교체 update 와 revokeAllFamilies 가 별도 트랜잭션 → 교체 커밋 후 revoke 실패 시 "전 세션 무효화" 불변식 위반 가능 | `auth.service.ts verifyEmailChange` | 원자화 또는 revoke 실패를 관측 가능한 로그로 처리(비번 변경 Rationale 2.3.C best-effort 정합) |
| 6 | Side Effect | `requestEmailChange` — 메일 발송 실패 시 pending 3필드 DB 잔류 | `auth.service.ts requestEmailChange` | 발송 실패 catch 에서 clearPendingEmailChange 로 롤백 |
| 7 | Side Effect | `verifyEmailChange` — sendEmailChangedNotice 실패를 빈 catch 로 삼킴, 로그 없음 | `auth.service.ts verifyEmailChange` | catch 내 logger.warn 추가 |
| 8 | Concurrency | `requestEmailChange` emailTakenByOther↔update TOCTOU (2번째 사용자 verify 시점 409, UX 저하) | `auth.service.ts requestEmailChange` | update try/catch 또는 트랜잭션 |
| 9 | Requirement | `requestEmailChange` 메일 발송 실패 시 pending 잔존 불일관성 (=W6) | `auth.service.ts` | clearPendingEmailChange 호출 |
| 10 | Side Effect | `verifyEmailChange` — generateTokens 실패 시 이메일 변경·revoke 완료 상태로 토큰 미발급(강제 로그아웃) | `auth.service.ts verifyEmailChange` | 주석 명시 또는 update 엔티티 반환으로 재조회 제거 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 제안 |
|---|----------|----------|------|
| 1 | Security | resend 엔드포인트 rate-limit 없음 | `@Throttle` 추가 (이미 5/min 적용됨 — 재확인) |
| 2 | Security | EmailChangeVerifyDto 토큰 MaxLength 미지정 | `@MaxLength(128)` 추가 |
| 3 | Security | 이메일 정규화 불일치(trim/lower) | DTO `@Transform` 또는 서비스 진입 정규화 |
| 4 | Performance | verifyEmailChange findById 이중 호출 | update 반환 활용 |
| 5 | Performance | requestEmailChange findById 2회 | reauthenticate 가 User 반환 |
| 6 | Performance | emailTakenByOther LOWER 함수 인덱스 없음 | 저빈도라 우선도 낮음 |
| 7 | Requirement | verifyEmailChange updated null 극단 race | update 엔티티 반환 |
| 8 | Requirement | [SPEC-DRIFT] audit-actions §3 user.email_changed 등재 확인 | 이미 등재됨(본 PR docs 커밋) — 해소 |
| 9 | Requirement | totpCode @Length(6,8) vs RFC 6238 6자리 | 기존 TOTP DTO 와 통일(기존 reauth DTO 도 6,8) |
| 10 | Maintainability | 1h TTL 하드코딩 2곳 | 상수 추출 EMAIL_CHANGE_TTL_MS |
| 11 | Maintainability | HTML 이메일 wrapper 중복 | 헬퍼 추출(현행 수용 가능) |
| 12 | Maintainability | API URL 비대칭 | 향후 컨벤션 확정 |
| 13 | Testing | verify/page.tsx 테스트 전무 | verify 테스트 생성 |
| 14 | Testing | profile-info-card pendingEmail 조건부 렌더 테스트 미추가 | 케이스 추가 |
| 15 | Testing | e2e resend 미검증 | resend 시나리오 추가 |
| 16 | Testing | e2e verify 선점 409 미검증 | 케이스 추가 |
| 17 | Documentation | emailChangeExpiresAt JSDoc 누락 | JSDoc 추가 |
| 18 | Documentation | isUniqueEmailViolation 23505 주석 없음 | 주석 추가 |
| 19 | Documentation | api users.ts 빈 body 주석 없음 | 주석 추가 |
| 20 | API Contract | verifyEmailChange ApiUnauthorizedResponse 설명 혼동 | 수정 |
| 21 | API Contract | requestEmailChange 403 Swagger 누락 | @ApiForbiddenResponse 추가 |
| 22 | Database | email_change_expires_at 인덱스(향후 배치) | 배치 도입 시 |
| 23 | Scope | _retry_state.json 커밋 포함 | 팀 gitignore 정책 |

> 주: 워크플로 terminal summary write 차단으로 main 이 멱등 persist. 에이전트별 위험도 요약 표는 원본 반환에서 생략(비차단 정보).
