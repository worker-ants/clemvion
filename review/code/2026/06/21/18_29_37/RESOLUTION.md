# RESOLUTION — 18_29_37

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| W1 | 코드 (Testing) | 71fd0f02 | AuthService 4개 이메일 변경 메서드 단위 테스트 추가 |
| W2 | 코드 (Testing) | 71fd0f02 | SessionsService.reauthenticate 단위 테스트 추가 |
| W3 | 코드 (Testing) | 71fd0f02 | UsersService.emailTakenByOther 단위 테스트 추가 |
| W4 | 코드 (Testing) | 71fd0f02 | MailService 신규 2개 메서드 단위 테스트 추가 |
| W5 | 코드 (Database) | 71fd0f02 | verifyEmailChange revokeAllFamilies 실패 throw 전파로 관측 가능하게, 주석 명시 |
| W6 | 코드 (Side Effect) | 71fd0f02 | requestEmailChange 메일 발송 실패 시 clearPendingEmailChange 롤백 |
| W7 | 코드 (Side Effect) | 71fd0f02 | verifyEmailChange sendEmailChangedNotice 빈 catch → logger.warn 추가 |
| W8 | 코드 (Concurrency) | 71fd0f02 | requestEmailChange TOCTOU 주석 명시 |
| W9 | 코드 (Requirement) | 71fd0f02 | W6 와 동일 수정 — clearPendingEmailChange 롤백 |
| W10 | 코드 (Side Effect) | 71fd0f02 | verifyEmailChange generateTokens 실패 강제 로그아웃 시나리오 주석 |
| INFO#1 | - | (skip) | resend @Throttle 5/min 이미 적용 확인 — 수정 불필요 |
| INFO#2 | 코드 (Security) | 71fd0f02 | EmailChangeVerifyDto @MaxLength(128) 추가 |
| INFO#8 | - | (skip) | audit-actions §3 user.email_changed 이미 PR docs 커밋에서 해소 |
| INFO#10 | 코드 (Maintainability) | 71fd0f02 | EMAIL_CHANGE_TTL_MS 상수 추출 |
| INFO#17 | 코드 (Documentation) | 71fd0f02 | emailChangeExpiresAt JSDoc 추가 |
| INFO#18 | 코드 (Documentation) | 71fd0f02 | isUniqueEmailViolation 23505 PostgreSQL 코드 주석 |
| INFO#20 | 코드 (API Contract) | 71fd0f02 | verifyEmailChange ApiUnauthorizedResponse 설명 명확화 |
| INFO#21 | 코드 (API Contract) | 71fd0f02 | requestEmailChange @ApiForbiddenResponse(REAUTH_NOT_AVAILABLE) 추가 |

## TEST 결과

- lint  : 통과 (0 errors, 132 pre-existing warnings)
- unit  : 통과 (backend 7227 passed, frontend 4515 passed, packages 191 passed)
- build : 통과
- e2e   : 자동 흐름 환경 차단 — Docker VM 내부 디스크 부족 (postgres initdb "No space left on device"; host disk 정상 536Gi 여유. `docker system prune` 이 필요하나 자동 흐름에서 다른 컨테이너에 영향을 미치는 prune 은 미허가)

## 보류·후속 항목

- **e2e 환경 복구 필요**: `docker system prune` 또는 Docker Desktop 디스크 이미지 증설 후 `.claude/tools/run-test.sh e2e` 수동 재실행 권장.
- INFO 기타 (#3 이메일 정규화, #4/#5 findById 이중 호출, #6 LOWER 인덱스, #7 extreme race, #9 totpCode Length, #11 HTML wrapper 중복, #12 API URL 비대칭, #13-16 프런트엔드 테스트, #22 인덱스 추가, #23 _retry_state.json gitignore): INFO 등급, 자동 수정 대상 아님.
