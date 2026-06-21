# RESOLUTION — 20_21_02 (fresh review after resolution)

> 1차(18_29_37) 10 WARNING resolution(71fd0f02) 적용 후 fresh 재리뷰. Critical 0, 신규 WARNING 3 (+INFO 21). 1차 10 WARNING 은 본 재리뷰에서 전부 resolved 확인.

## 조치 항목

| SUMMARY # | 분류 | 조치 | 비고 |
|-----------|------|------|------|
| W1 (database, LOWER 인덱스) | 보류(후속) | `plan/in-progress/email-change-followup-email-lower-index.md` 신설 | 저빈도 경로(이메일 변경 한정) micro-opt. 코드 재변경(재리뷰 루프) 회피 위해 분리. register 는 exact-match 라 기존 UNIQUE 인덱스 사용 |
| W2 (database, 트랜잭션 분리) | 수용(won't-fix) | 코드 유지 | best-effort per 인증 Rationale 2.3.C. 운영 중 change-password(`rotateSessionAfterPasswordChange`)와 **동일 패턴**. W5 resolution(71fd0f02)으로 revokeAllFamilies 실패가 예외 전파되어 관측 가능. 리뷰어도 "즉각 차단 아님" 명시 |
| W3 (SPEC-DRIFT, resend 비대칭) | spec 반영 | `spec/5-system/1-auth.md §1.1.B` 에 "request vs resend 메일 발송 실패 처리" 문단 추가 | 코드 유지(UX 상 의도적 — resend 실패 시 토큰 유지가 재시도에 유리). request 는 롤백, resend 는 유지 — 의도 spec 명문화 |
| I2 (security, resend throttle) | 조치 불요 | resend 는 이미 `@Throttle({ttl:60_000,limit:5})` 적용(users.controller L264) | 리뷰어 false-negative |
| I1/I3~I21 | INFO 비차단 | 미조치(보류) | 핵심 경로는 e2e+unit 커버. 주석/perf/정규화/추가 테스트 nit — §보류 항목 |

## TEST 결과

> 본 RESOLUTION 은 **codebase/ 코드 변경 없음**(W1 보류 plan, W2 수용, W3 spec-only, I2 false-negative). 따라서 71fd0f02 의 TEST WORKFLOW 결과가 유효하며 재실행 불요.

- lint  : 통과 (71fd0f02 기준, 0 errors)
- unit  : 통과 (71fd0f02 기준 — backend 7227 / frontend 4515 passed)
- build : 통과 (71fd0f02 기준)
- e2e   : 통과 — 사용자 `docker builder prune` 으로 디스크 확보 후 최종 커밋에서 재실행. **211 passed**(baseline 205 + 이메일 변경 신규 6 케이스: request 성공·동일이메일400·오답401·중복409, verify 성공(email 교체·세션revoke·감사)·만료400, cancel 멱등). log: e2e-20260621-205820.log

## 보류·후속 항목
- W1 → `plan/in-progress/email-change-followup-email-lower-index.md` (LOWER 인덱스 V101).
- INFO I14 (data-flow/2-auth.md 시퀀스·컬럼 반영) → project-planner follow-up (비차단).
- INFO I16~I21 (isUniqueEmailViolation 분기·frontend verify/card 테스트·e2e resend/선점) → 비차단 보강 후보. 핵심 경로(request 검증·verify 성공·세션revoke·감사·cancel)는 기존 e2e+unit 으로 커버.
