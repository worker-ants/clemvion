# RESOLUTION — review/code/2026/06/06/18_09_17 (exec-park polish A~C)

ai-review RISK=LOW, Critical 0, Warning 3. + 동시 `--impl-done`(18_09_17, BLOCK:NO) W1/I1. disposition.

## 조치 항목

| # | 분류 | 판정 | 근거/조치 |
|---|---|---|---|
| ai-review W1 / impl-done W1 | SPEC-DRIFT | **조치 완료** | `driveResumeDetached`→`driveResumeAwaited` rename 이 spec 본문에 미반영된 것 — `spec/5-system/4-execution-engine.md`(L128/903/1306/1311) + `spec/data-flow/3-execution.md`(L111/113) 6곳 교체(commit). A1 rename 의 spec 측 완료. |
| ai-review W2 | Testing | **무효(false positive)** | "prod fail-closed describe 가 iext_*/itk_* 양쪽에 중복" 주장이나 실제 1회만 존재(grep count=1, L436). reviewer 가 line range(L1912 — ~470줄 파일에 부재) 환각. 조치 불요. |
| ai-review W3 | Security | **수용(기존 dev 동작)** | dev/test 미설정 시 `'interaction-fallback'` placeholder 서명은 **기존 동작 유지**(신규 도입 아님)이며, 본 PR 의 B2 가 prod 경로를 fail-closed 로 막아 보안 개선. dev 격리 환경 한정 — 수용. |
| ai-review I8 / impl-done I1 | Documentation | **조치 완료** | EIA §8.3 iext 항목에 "NODE_ENV=production secret 미설정 시 생성자 throw(fail-closed)" 계약 명시(commit). B2 spec↔impl 정합. |
| ai-review I1 | Documentation | **수용(유지)** | `driveResumeAwaited` JSDoc 의 "(메서드명은 옛 detach 모델의 잔재 — 현재는 awaited)" 는 명칭 유래를 설명하는 의도적 historical note. 코드 재변경(리뷰-게이트 재무장) 회피 위해 유지. |
| ai-review I2 | Documentation | **수용(유지)** | `ProcessTurnResult` 주석의 "ai-review W11" 추적 태그 — traceability 참조. 동상. |
| 기타 INFO(I3~I7, I9~I11) | 다양 | **수용/후속** | partial-secret 테스트 케이스(I7)·NODE_ENV 캡처 위치(I6)·.env.example 섹션 헤더(I3)·1-ai-agent 괄호 밀도(I10) 등 — 비차단 nitpick, 후속 polish. plan lifecycle 이동(I11/impl-done I5)은 별도. |

## TEST 결과
- lint  : 통과 (eslint 0 error)
- unit  : 통과 (execution-engine 322 + interaction-token 34 — prod-guard 2건 포함)
- build : 통과 (nest build, 0 TS error)
- e2e   : 통과 (dockerized 176 pass, 무회귀 — rename/type/prod-guard 는 e2e 동작 무영향)

## 보류·후속 항목
- I1/I2 주석 polish, I3 .env 섹션 헤더, I6/I7 테스트 보강: 비차단, 후속.
- plan lifecycle: `exec-park-b2a-followup.md`(머지 완료)→`plan/complete/` 이동, `exec-park-durable-resume.md`(umbrella 잔여 有 — in-progress 유지). 별도 정리.
- W-1(--impl-prep) D6 레이블 namespace 분리: 본 변경 무관 pre-existing, 별도.
