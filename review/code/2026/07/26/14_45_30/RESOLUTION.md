# RESOLUTION — review/code/2026/07/26/14_45_30 (4R)

4R SUMMARY 의 **Critical 0 / WARNING 6건(W19~W24)** 처리. 4건 조치, 1건 백로그 분리, 1건 프로세스 수용.

## 조치 항목

| SUMMARY # | 분류 | 조치 | mutation 검증 |
| --- | --- | --- | --- |
| **W19** | 코드 + 테스트 | `executeNode` 의 `ExecutionCancelledError` 분기가 **아무것도 하지 않고 재throw** 하던 것을 `isAbortError` 분기와 대칭으로 고쳤다 — `NodeExecutionStatus.CANCELLED` 마킹 + `finishedAt`/`durationMs` + `NODE_CANCELLED` emit. **내부 message(executionId 포함)는 payload 에 싣지 않아** W15 의 노출 차단 취지를 유지한다. `ParkReleaseSignal` 을 복제한 것이 원인이었는데, park 은 재개돼 누군가 row 를 마감하지만 취소는 재개되지 않아 노드가 영구 `running` 으로 잔류했다.<br>테스트도 강화: 옛 단언 `not.toBe(FAILED)` 는 `lastNodeExecSave` 가 최초 RUNNING save 를 반환해 **RUNNING 인 채로도 참**이었다(vacuous). `toBe(CANCELLED)` + `finishedAt` + `NODE_CANCELLED` emit + 내부 message 미노출로 양성 단언 전환 | CANCELLED 마킹 제거 → **`Expected: "cancelled"` / `Received: "running"` RED** → 복원 GREEN |
| **W20** | 코드 + 테스트 | `executeWithRetry` 의 재시도 제외 판정에 `ExecutionCancelledError` 추가. 기존엔 `isAbortError` 뿐이었는데 이 sentinel 은 `name` 이 `'AbortError'` 가 아니라 걸리지 않아, `errorHandling.policy:'retry'` 노드에서 취소가 **최대 3회 재호출 + 백오프(최대 7초)** 를 거친 뒤에야 수렴했다. 신규 회귀 테스트 추가 | 제외 조건 제거 → **호출 4회(1+재시도 3) RED** → 복원 GREEN |
| **W21** | 문서 | JSDoc 2곳 정정 — (a) `CONTAINER_CANCEL_CHECK_THROTTLE_MS` 의 "best-effort" 근거 인용을 §5 → **§2.2**(3R 이 plan 에서만 고치고 동일 문장이 있는 소스는 놓쳤다), (b) `containerCancelCheckedAtMs` 의 "누수 방지" 서술을 정리 지점 2곳 → **3곳**(W14 반영) | — (문서) |
| **W22** | 문서 | `CHANGELOG.md` 에 항목 6~9 추가 — W14(Map 누수)·W15/W19(Sub-Workflow 오분류·영구 running)·W20(retry 오분류)·W16(retry-turn `error` 노출) | — (문서) |
| **W23** | **백로그 분리** | 대형 단일 spec 파일의 구조적 flakiness(64회 중 2회, 원인은 선재 real-timer 헬퍼 `flushResumeDrive` — 파일 자체 주석이 위험을 명시). **이 PR 이 만든 것이 아니고** 해소는 spec 파일 분할 규모라 편입하지 않는다 | — |
| **W24** | **프로세스 수용** | scope 의 지적(diff 밖 발견이 명시 triage 없이 해소 사이클에 편입됨)을 수용해 SUMMARY 에 **§범위 판정** 절을 신설, 이번 라운드 전 발견을 편입/분리로 명시 구분했다. 기준: **"이 PR 이 만들었거나, 이 PR 때문에 새로 도달 가능해졌는가"** | — |

### 미조치 (의도적 백로그)

W23 외에 `runParallel` 의 `failures` 미소비, `ParallelExecutor 'stop'` 의 `failures[0]` 우선순위 레이스, 가드 시퀀스 헬퍼 승격(W8), shutdown `FAILED`(SERVER_INTERRUPTED) 미감지 — 전부 위 기준상 분리. **spec 본문 갱신은 developer 권한 밖**이라 `spec-update-node-cancellation-shutdown-classification.md` "추가 위임 (2026-07-26 #6)" 로 planner 위임 유지.

## TEST 결과

- lint  : 통과 — `run-test.sh lint` PASS (`_test_logs/lint-20260726-151804.log`)
- unit  : 통과 — `run-test.sh unit` PASS (`_test_logs/unit-20260726-151854.log`).
  wrapper 의 `tests=14` 는 내부 패키지 집계라 엔진 스위트를 포함하지 않으므로 별도 실행:
  `npx jest src/modules/execution-engine/ src/nodes/flow/workflow/` → **43 suites / 1121 tests 전부 통과**
- build : 통과 — `run-test.sh build` PASS (`_test_logs/build-20260726-151954.log`).
  최초 시도에서 **TS2358**(`lastError` 의 선언 타입이 `Error | undefined` 라 `instanceof` 좌변 불가)로 실패해 `err`(unknown) 로 판정하도록 고친 뒤 통과 — lint 의 prettier 오류 1건도 같이 해소
- e2e   : 통과 — `run-test.sh e2e` PASS, **46 suites / 259 tests** 전부 통과.
  `test/node-cancellation-propagation.e2e-spec.ts` PASS(18.907s) 포함. 로그 `_test_logs/e2e-20260726-152314.log` (마지막 코드 변경 이후 실행)

## 비고 — 이번 라운드에서 드러난 자기 검증 실패 2건

기록해 둘 가치가 있다. 두 건 모두 **mutation 을 돌리지 않았다면 "커버됨" 으로 잘못 보고**됐을 것이다.

1. **W15 테스트가 vacuous 했다** — `not.toBe(FAILED)` 는 노드가 RUNNING 인 채로도 참이라, 정작 W19(영구 running)라는 진짜 결함을 가렸다. 부정 단언(`not.toBe`)이 아니라 양성 단언(`toBe`)이었어야 했다.
2. **W20 테스트가 두 번 vacuous 했다** — (a) retry 설정을 `errorHandling` 평면에 뒀는데 실제 스키마는 `errorHandling.retryConfig` **중첩**이라 재시도 루프에 진입조차 못 했고, (b) 그걸 고친 뒤에도 재시도가 `sleep` 을 낀 **detached** 실행이라 단언이 재시도 전에 돌아 여전히 통과했다. 실제 타이머를 흘려보낸 뒤에야 mutation 이 4회 호출로 RED 를 냈다.

또한 빈 리뷰 세션 디렉토리(`review/code/2026/07/26/14_45_29/`, `_prompts`+`_retry_state.json` 만 있고 SUMMARY 없음)를 발견해 삭제했다 — 남겨두면 push 게이트가 "SUMMARY pending" 으로 **잘못 통과**시킨다.
