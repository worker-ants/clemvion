# RESOLUTION — review/code/2026/09/20/22_07_23

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| #1 | 코드(문서, 코드 변경 없음) | `dac9c6a38` | 외부 provider teardown 중복을 plan `이 PR 이 하지 않는 것`에 «신규 e2e 가 chat-channel 경로를 의도적으로 피한다»는 사실과 함께 명시. 그 잔여를 받는 트래커 항목(「트리거 자원 정리의 사후 정리(sweeper) 필요 여부 재판단」, `plan/in-progress/spec-draft-nullable-notation-followups.md`)에 새 불릿으로 등재해 크로스레퍼런스 |
| #2 | 코드(plan/tracker 정정) | `dac9c6a38` | plan 제목·본문 「네 삭제 경로 중 마지막 한 자리」를 실제 범위(트리거·워크플로·워크스페이스 세 자리)로 정정. `SchedulesService.remove()`(`schedules.service.ts:345`, `scheduleRepository.remove` 가 락·재조회 밖에서 호출됨을 직접 읽어 확인)의 같은 결함을 트래커에 새 developer 항목으로 등재, 기존 `TriggersService.remove()` 항목은 이 PR로 해소 표시 |
| #3 | 코드 | `931877519` | 신규 e2e 의 lock key 문자열 리터럴(`lockKey` 헬퍼)을 제거하고 `triggerConfigLockKey` import 로 교체 |
| #4 | 코드 | `4abc730cb` | genuine(비-404) 삭제 실패 시 `logger.error` 가 실제로 호출됨을 단언하는 단위 테스트 추가(형제 `workflows.service.spec.ts` 패턴 복제) |
| #5 | 코드 | `4f4f924ae` | `CHANGELOG.md` 에 형제 커밋(#1369, #1368)과 동일한 3단 구성(문제/고친 것/판별력 실측)으로 트리거 항목 추가 |

## TEST 결과

- lint  : 통과 (50s)
- unit  : 통과 (70s)
- build : 통과 (159s)
- e2e   : 통과 (370/370, 261s, `_test_logs/e2e-20260920-223307.log`)

**뮤테이션 판별력 실측 (SUMMARY#4 신규 테스트)**: `triggers.service.ts` `remove()` `.catch` 블록의
`this.logger.error(...)` 호출부(5줄)를 `cp` 백업 후 주석 한 줄로 치환. `git diff` 로 변경 범위가
의도한 5줄에만 한정됐음을 확인(고유 문자열 앵커 — 이전 뮤턴트가 `update()` 의 동일 문자열까지
지워 440줄·116건 실패로 무효였던 사례를 피함). 재실행 결과 신규 테스트 1건만 RED, 나머지
164건은 GREEN(1 skipped) — 판별력 확인 후 `cp` 로 원복, `git diff` 무출력 확인.

## 보류·후속 항목

- SPEC-DRIFT/spec 결함 없음 — 이번 5건 전부 코드 관련(plan/tracker 문서 정정 포함)로 분류, `spec/**` 변경 없음.
- `SchedulesService.remove()` 자신의 스케줄 행 삭제가 동시 삭제 시 `SCHEDULE_DELETED` 감사를 두 번
  남길 수 있는 같은 결함 — `plan/in-progress/spec-draft-nullable-notation-followups.md` 에
  developer 항목으로 신규 등재(재현 기법은 `trigger-delete-concurrency.e2e-spec.ts` 와 같되, 스케줄
  경로엔 트리거용 advisory lock 이 애초에 걸리지 않는다는 점부터 실측하라고 적음). 이번 세션의
  스코프 밖이라 코드 수정은 하지 않음.
- 외부 provider teardown 중복 호출(WARNING #1) — 코드 수정 대상 아님(형제 PR 들과 동일한 멱등
  전제 유지). 트래커의 sweeper 재판단 항목에 새 불릿으로만 반영.
- `plan/in-progress/trigger-dup-delete.md` 체크리스트의 `/ai-review` 수렴 · `--impl-done` ·
  트래커 항목 해소+`plan/complete/` 이동 세 줄은 이 세션이 처리하지 않음 — 다음 리뷰 라운드(이
  RESOLUTION 이 만든 코드 변경 5건에 대한 fresh review) 또는 main 의 후속 판단 대상.
