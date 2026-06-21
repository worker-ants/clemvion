# Code Review 통합 보고서 (fresh — resolution 적용 후 재리뷰)

리뷰 세션: `review/code/2026/06/21/20_21_02` · 범위 `--range a2e488e7..HEAD` (resolution fix 71fd0f02 커버)

## 전체 위험도
**MEDIUM** — database 2건(LOWER 인덱스, 트랜잭션 분리) + requirement 1건(resend SPEC-DRIFT) WARNING. **Critical 없음.** 1차(18_29_37) 10개 WARNING 전부 해소 확인(concurrency/testing/side_effect/api_contract reviewer 가 W4~W10 resolved 확인).

## Critical 발견사항
없음.

## 경고 (WARNING)
| # | 카테고리 | 발견사항 | 처리 |
|---|----------|----------|------|
| W1 | Database | `emailTakenByOther` `LOWER(u.email)` 표현식 인덱스 부재 → 대용량 시 seq scan (이메일 변경·rare path) | **보류(follow-up)** — 저빈도 경로 micro-opt. `plan/in-progress/email-change-followup-email-lower-index.md` 로 추적 |
| W2 | Database | `verifyEmailChange` 이메일 교체·`revokeAllFamilies` 별도 트랜잭션 | **수용** — best-effort per Rationale 2.3.C, 운영 중 change-password 와 동일 패턴. W5 resolution 으로 revoke 실패 예외 전파(관측 가능) 확보. 리뷰어도 "즉각 차단 아님" 명시 |
| W3 | SPEC-DRIFT | `resendEmailChange` 메일 실패 시 rollback 미적용(requestEmailChange 와 비대칭) — UX 상 의도적(rollback 시 pending 제거로 UX 악화) | **spec 반영** — §1.1.B 에 "resend 발송 실패 시 토큰 갱신 유지, 재시도로 해소" 명시. 코드 유지 |

## 참고 (INFO) — 주요
| # | 카테고리 | 처리 |
|---|----------|------|
| I1 | SPEC-DRIFT | requestEmailChange 발송 실패 롤백 — spec §1.1.B 에 함께 명시(W3 과 동반) |
| I2 | Security | resend rate-limit — **이미 @Throttle 5/min 적용됨(L264)**, 리뷰어 false-negative. 조치 불요 |
| I3 | Security | 이메일 정규화(trim/lower) — DTO @IsEmail 로 사실상 필터, INFO 비차단 |
| I4 | Security | verifyEmailChange 로그 oldEmail — 운영 로그 한정, 비차단 |
| I5/I6 | Performance | findById 중복 SELECT (rare path) — 비차단 |
| I7/I8 | Architecture | isUniqueEmailViolation/MessageResponseDto 위치 — 재사용 시 추출, 비차단 |
| I9~I13 | Maintainability/Doc | 주석/JSDoc — 비차단 nit |
| I14 | Doc | data-flow/2-auth.md 시퀀스 — planner follow-up(비차단) |
| I16~I21 | Testing | isUniqueEmailViolation 분기·frontend verify/card 테스트·e2e resend/선점 — 비차단(핵심 경로는 e2e+unit 커버됨) |

## 에이전트별 위험도
| 에이전트 | 위험도 |
|----------|--------|
| security/performance/architecture/scope/side_effect/maintainability/concurrency/api_contract/documentation/requirement/testing | NONE~LOW |
| database | MEDIUM (W1 보류, W2 수용) |

## 결론
Critical 0. 1차 10 WARNING 전부 해소. 신규 3 WARNING 은 보류(W1)/수용(W2)/spec반영(W3)으로 처리 — **codebase 코드 변경 없이** RESOLUTION 으로 수렴(재리뷰 루프 회피). 상세 RESOLUTION.md.
