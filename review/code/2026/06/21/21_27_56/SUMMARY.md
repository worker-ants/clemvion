# Code Review 통합 보고서 (후속 — V101·테스트·data-flow·plan)

세션: `review/code/2026/06/21/21_27_56` · `--branch main` (origin/main..HEAD = 91ea84ea)

## 전체 위험도
**LOW** — Critical 0. WARNING 3건 전부 **신규 테스트 코드 품질**(프로덕션 영향 없음). 회귀 차단 수준 아님.

## Critical
없음.

## 경고 (WARNING) — 전부 테스트 코드
| # | 카테고리 | 발견사항 | 처리 |
|---|----------|----------|------|
| W1 | Testing | resend e2e 가 제목과 달리 `email_change_expires_at` 갱신 미단언 (갱신 누락돼도 통과) | **fix** — expires_at > before 단언 추가 |
| W2 | Testing/Requirement | resend 메일 실패 시 토큰 유지(request 롤백과 비대칭, spec §1.1.B) 테스트 부재 | **fix** — auth.service.spec 에 service-level mock 테스트 추가 |
| W3 | Maintainability | e2e DB seed UPDATE 쿼리 4회 중복 | **fix** — seedPendingEmailChange 헬퍼 추출 |

## 참고 (INFO) — 주요
| # | 항목 | 처리 |
|---|------|------|
| 1 | V101 CREATE INDEX non-CONCURRENTLY ShareLock | 현 규모 미미. 운영 대용량 시 CONCURRENTLY 검토(plan 메모) |
| 2 | EXPLAIN ANALYZE 미수행 | 운영 규모 환경에서 확인 후 plan 기록(비차단) |
| 3 | tFromKo i18n mock 2파일 중복 | (선택) test-util 추출 |
| 4/5 | resend 응답 shape·409 세션 미발급 단언 | (선택) 보강 |
| 6/9 | toast.success·스피너 단언 | (선택) |
| 7 | OAuth-only 403 e2e 미커버 | unit 존재. e2e 시드 가능 시 추가(비차단) |
| 8 | 대소문자 변형 중복 e2e | (선택) |
| 10 | e2e JSDoc 신규 케이스 미반영 | **fix** — JSDoc 갱신 |
| 11 | data-flow §2.3 SMTP 행 이메일 변경 메일 미열거 | **fix** — SMTP 행 보강 |
| 12 | followup plan §할 일 체크박스 형식 | **fix** — [x] 변환 |
| 13/14 | XSS 전제·throttle 경계 | 비차단 |

## 에이전트별 위험도
security NONE · performance LOW(INDEX lock INFO) · requirement LOW(W1/W2) · scope NONE · side_effect NONE · maintainability LOW(W3) · testing LOW · documentation NONE · database LOW(INFO) · api_contract LOW(INFO) · user_guide_sync NONE. (architecture/dependency/concurrency 제외 — 무관)

## 결론
Critical 0. WARNING 3(전부 테스트 코드) fix 예정 + 일부 cheap INFO(10/11/12) 동반 fix. fix 후 RESOLUTION + 최종 fresh review 로 수렴.
