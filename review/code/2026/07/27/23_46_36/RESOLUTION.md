# RESOLUTION — 23_46_36

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| Critical #1 (side_effect) | 코드 | `34f3dd051` | `finalizeGuarded` 멱등 분기 `target===CANCELLED` 일 때 `finishedAt`/`durationMs` 를 SQL `COALESCE(col, :new)` 로 전환해 `stop()` 이 커밋한 취소 시각(T1) 보존, `error` 는 SET 절에서 제외(stale error 재기록도 함께 차단). FAILED/COMPLETED 분기는 무수정. |
| Warning #1 (testing) | 코드(테스트) | `2c5930ded` | `mkLiveExecution(CANCELLED)` + `target=CANCELLED` 조합 회귀 테스트 2건 추가 — COALESCE 표현 단언, fixture 에 사전 채운 stale error 가 SET 절에 실리지 않음을 단언, `affected:0` 대칭(취소 이벤트 skip) 케이스. |
| Warning #7 (documentation) | 코드(주석) | `34f3dd051` | `completeRetryExecution`/`failRetryExecution` JSDoc 최상단에 guarded-skip 계약("동시 cancel 선점 시 저장·emit 모두 skip 가능, `finalizeGuarded` 참조") 한 줄씩 추가. 주석만 변경. |
| Warning #2 (architecture) | defer | — | 멱등 분기의 driver choke point 우회. self-transition capability 신설은 구조 변경이라 이 PR 범위 밖. |
| Warning #3 (security) | defer | — | 멱등 분기 ABA 왕복 창. 발생가능성 낮고 이 PR 이 이미 닫은 창보다 좁음. |
| Warning #4 (concurrency) | defer | — | 기존 plan W1(1차 라운드, `plan/in-progress/retry-turn-terminal-guard.md`)과 동일 건 — 이미 등재됨, 추가 조치 없음. |
| Warning #5 (maintainability) | defer | — | 기존 plan W3(1차 라운드)과 동일 건 — 이미 등재됨, 추가 조치 없음. |
| Warning #6 (maintainability) | defer (plan 신규 등재) | — | 회귀 테스트 `createQueryBuilder` guarded-update mock 리터럴 근접 중복(누적 6곳). `plan/in-progress/retry-turn-terminal-guard.md` § 4차 라운드에 공유 팩토리 후속 기록. |
| Warning #8 (documentation/spec) | defer | — | 기존 plan INFO 13(2차 라운드)과 동일 건, `project-planner` 범위 — 추가 조치 없음. |

## TEST 결과

- lint  : 통과
- unit  : 통과 (backend 412 suites / 8332 tests — 8331 passed + 1 pre-existing skip, 0 failed; frontend 48/48, `@workflow/web-chat` 33/33, `channel-web-chat` 5/5, 내부 공유 packages 123+16+27+14 전부 통과)
- build : 통과 (backend/frontend/`@workflow/web-chat`/`channel-web-chat` + 내부 packages 빌드 + Dockerfile 이미지 빌드 검증 전부 통과)
- e2e   : 통과 (backend jest 46 suites/46, 260 tests/260 + playwright 51 tests/51, 총 314s. 로그: `_test_logs/e2e-20260728-003107.log`)

## 보류·후속 항목

- WARNING #2 (architecture): defer — 멱등 분기의 driver choke point 우회. self-transition capability 신설은 구조 변경이라 이 PR 범위 밖.
- WARNING #3 (security): defer — 멱등 분기 ABA 왕복 창. 발생가능성 낮고 이 PR 이 이미 닫은 창보다 좁음(이론적 왕복 경로).
- WARNING #4 (concurrency): 기존 plan W1(1차 라운드)과 동일 건 — 이미 등재됨.
- WARNING #5 (maintainability): 기존 plan W3(1차 라운드)과 동일 건 — 이미 등재됨.
- WARNING #6 (maintainability): `plan/in-progress/retry-turn-terminal-guard.md` § 4차 라운드에 신규 등재(`createQueryBuilder` mock 팩토리 통합 후속).
- WARNING #8 (documentation/spec): 기존 plan INFO 13(2차 라운드)과 동일 건, `project-planner` 범위.
- INFO #2 (requirement, 신규 등재): `execution.error` 가 성공(COMPLETED) 종결에서도 retry 시작 시점의 옛 실패 메시지를 재기록할 수 있음(이번 diff 신규 회귀 아님) — `plan/in-progress/retry-turn-terminal-guard.md` § 4차 라운드에 등재.
- 후속 (신규 등재): COMPLETED 타깃 멱등 분기도 CANCELLED 와 같은 시각 부풀림 소지 — 이번 라운드는 CANCELLED 로 범위 한정, 후속 라운드에서 대칭 검토 필요. `plan/in-progress/retry-turn-terminal-guard.md` § 4차 라운드에 등재.
- INFO 전체(위 2건 제외): 조치 없음 — 처분표 지시대로 이번 라운드 조치 대상 아님.

## 참고

- 처분표에서 지시한 대로 2R 수정(FAILED 멱등 분기 lifecycle 필드 기록), 3R 수정(`affected` 기반 emit 판정), `resumeGraphAfterRetry` 자연 종결 분기, `ALLOWED_TRANSITIONS` 는 전부 무변경으로 유지했다.
- 커밋: `34f3dd051` (fix — Critical#1 + Warning#7 JSDoc), `2c5930ded` (test — Warning#1). push 는 수행하지 않음.
