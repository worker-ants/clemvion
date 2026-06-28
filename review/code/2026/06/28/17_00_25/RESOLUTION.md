# RESOLUTION — webhook 하드닝 후속 review (17_00_25)

원 SUMMARY: ai-review RISK=LOW, CRITICAL=0, WARNING=1. 동반 `--impl-done`
(review/consistency/2026/06/28/17_00_25, BLOCK:NO, 전 checker NONE).

## 조치 항목

| # | 카테고리 | 발견 | 조치 |
|---|---|---|---|
| ai-review W1 | Testing | `mapHttpErrorLike` 비-413 4xx 분기(`'The request could not be processed.'`) 미검증 | **FIXED**: `http-exception.filter.spec` 에 `{ status: 400 }` 케이스 추가 — generic 메시지 + `VALIDATION_ERROR` 코드 단언. |
| ai-review I15 | Testing | 4xx http-error logger.warn(원문) 호출 미검증 | **FIXED**: 위 비-413 테스트에서 `Logger.prototype.warn` spy 로 원문 로깅 단언. |
| ai-review I16 | Testing | fail-open `logger.error` 호출 미검증 | **FIXED**: guard spec fail-open 테스트에 `Logger.prototype.error` 1회 호출 단언(W2 모니터링 고정). |
| ai-review I10 | Maintainability | `413` 매직 넘버 | **부분**: `HttpStatus.PAYLOAD_TOO_LARGE` 로 교체 시도했으나 `@typescript-eslint/no-unsafe-enum-comparison`(number vs enum) 위반 → `413` 리터럴 + 회피 주석 유지(`getCodeFromStatus` switch 와 동형). |
| ai-review I17 | Documentation | `mapHttpErrorLike` JSDoc CWE-209 미명시 | **FIXED**: JSDoc 에 "반환 message 는 CWE-209 방지 고정 문구" 한 줄 추가. |
| SPEC-DRIFT (ai-review I1·I2 / impl-done I1) | Requirement | 413 고정 message·비-413 4xx 일반 문구 정책 spec 미기재 | **FIXED**: `3-error-handling.md §1.3 PAYLOAD_TOO_LARGE` 에 고정 문구·CWE-209 비-echo 원칙 기재. |
| SPEC-DRIFT (ai-review I3 / impl-done I2) | Rationale | fail-open ERROR 로깅 spec 미기재 | **FIXED**: `12-webhook.md §6` 에 trigger 조회 실패 → error 레벨 로깅(모니터링) 한 문장 추가. |

## 보류·후속 항목 (비차단)

- ai-review I5/I6 (IP fail-open·DB fail-open circuit breaker): 정책 결정 사안, 본 PR 범위 밖(W2 로 가시성은 확보).
- I7 (extractClientIp 잔존 참조): grep 확인 완료 — 외부 참조 없음(컴파일·lint·build 통과).
- I8 (alert storm): 모니터링 시스템의 flapping 억제는 운영 절차.
- I11/I12/I13/I14/I18 (default 메시지 상수 dedup·인라인 타입 추출·env 복원 패턴·중복 주석·삭제 근거 주석): 경미한 유지보수 — 현행/후속.
- impl-prep WARNING(V-09·V-14·SSRF·console.warn·graph_error): 본 변경 무관, 별도 plan 추적.

## TEST 결과

- lint·unit·build·e2e(225) 통과 (`*-171052`·`*-171132`·`*-171228`·`*-171408`).
