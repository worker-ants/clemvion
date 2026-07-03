# Resolution — M-4 executeAsync setup 2차 실패 (Option B)

원본 리뷰: `review/code/2026/07/03/22_35_54/SUMMARY.md` (Risk LOW, Critical 0, Warning 2).

## 처리 결과

| 심각도 | 발견 | 위치 | 조치 |
|--------|------|------|------|
| WARNING #1 (maintainability) | `runExecutionFromQueue` catch 와 `executeAsync` catch 의 `failFirstSegmentSetup` 2차 실패 처리 코드(로그 문구 포함) 중복 — 3번째 진입점 추가 시 재복제·동기화 부담 | `execution-engine.service.ts` 2837~·3383~ | **FIXED** — "failFirstSegmentSetup 호출 + 2차 실패 로그 흡수" 쌍을 `private async failFirstSegmentSetupBestEffort(executionId, err)` 헬퍼로 추출. 두 진입점이 위임. 로그 문구 불변이라 기존 W5/W7·신규 M-4 테스트 그대로 PASS |
| WARNING #2 (documentation) | plan 체크박스가 실제 구현 상태 미반영 — M-4 구현 완료됐으나 `[ ] 미착수` | `plan/in-progress/refactor/06-concurrency.md:171` | **FIXED** — M-4 `[x]` + Option B 완료 근거(커밋·검증·헬퍼 추출·A 후속 사유) 기록. README 06 행(완료 10→11·미완 2→1)·합계(82)·각주(102/104) 동기화 |

## INFO (조치 불요 — 기록만)

- **security/database**: `failFirstSegmentSetup` 의 에러 메시지 DB/WS 노출·비원자 read-then-write 는 **기존 계약/패턴 재사용**, 이번 diff 신규 회귀 아님. sub-workflow 경로로 확장했을 뿐. 별도 트랙.
- **architecture**: 3중 예외 흡수(runExecution → executeAsync catch → failFirstSegmentSetup 내부 try/catch)는 의도된 설계. 모니터링이 로그 기반인지 확인 권장(참고).
- **requirement/concurrency**: 외부 `.catch` 는 `failFirstSegmentSetup` 내부 try/catch 가 이미 흡수하므로 프로덕션 사실상 도달 불가 — 큐 경로 대칭성·미래 안전망 가치로 현행 유지. `setImmediate` flush 는 기존 관용구와 일관.
- **performance/side_effect/scope**: 실패 경로 한정 추가 쿼리(hot path 무영향), idempotent guard 로 이중 실행 방지, 단일 목적 diff.

## 재시도 처리

- **testing** / **database** — 초기 Workflow 에서 success 보고됐으나 output 파일 유실 → fresh /ai-review 로 helper refactor 커버 겸 재확인.

## 검증

- lint·unit(backend **7540**)·build·e2e(**226**) PASS (헬퍼 추출 후 재수행). spec 무변경.
- helper refactor 는 로그 문구·호출 계약 불변이라 기존 테스트 회귀 없음.
- fresh /ai-review 로 WARNING 해소 커밋 재검토 예정.
