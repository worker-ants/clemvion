# RESOLUTION — review/code/2026/07/26/15_30_00 (5R)

5R SUMMARY 의 **Critical 0 / WARNING 1건(W25)** 처리. 나머지는 INFO 로 백로그·위임 분리.

## 조치 항목

| SUMMARY # | 분류 | 조치 | mutation 검증 |
| --- | --- | --- | --- |
| **W25** | 코드(리팩터) | `executeNode` catch 의 두 취소 분기(`isAbortError` / `ExecutionCancelledError`)가 복제하던 20여 줄(상태 마킹 · `finishedAt`/`durationMs` 계산 · `save` · `NODE_CANCELLED` emit)을 `markNodeCancelled(nodeExecution, node, context, executionId, errorEnvelope?)` 로 추출했다.<br>· 두 분기의 **유일한 차이인 `errorEnvelope` 유무**를 선택 인자로 표현했다 — `isAbortError` 는 §5.1 봉투를 싣고, `ExecutionCancelledError` 는 **싣지 않는다**(sentinel message 에 executionId 가 있어 client 노출 금지, W15/W19). payload 도 `...(errorEnvelope ? { error: errorEnvelope } : {})` 로 조건부 spread 해 키 자체가 생기지 않게 했다.<br>· `throw` 는 **호출부 책임으로 남겼다** — 각 분기가 다시 던져야 할 원본 에러가 다르고, 헬퍼가 던지면 "무엇을 다시 던지는가" 가 호출부에서 보이지 않는다.<br>· Execution 레벨의 동형 중복을 `finalizeCancelledExecution`(W12)으로 추출한 선례와 같은 패턴이다 | 헬퍼의 `nodeExecution.status = CANCELLED` 제거 → W15 테스트 `Expected: "cancelled" / Received: "running"` **RED** → `cp` 복원 → GREEN |

### 미조치 (의도적 분리)

| 항목 | 처분 | 사유 |
| --- | --- | --- |
| harness diff-list 갭 (5명 지적) | **harness 백로그** | 코드 수정과 리뷰 산출물이 한 커밋에 있을 때 프롬프트 파일 목록에서 소스가 누락된다. 이 PR 의 코드 결함이 아니라 리뷰 파이프라인 문제 |
| `6-websocket-protocol.md:186` 의 `execution.node.cancelled` 서술 (생산자 1개·`error` 상시 존재 전제) | **planner 위임** | `spec/` 는 developer 권한 밖. W19 로 두 번째 생산자가 생겼고 그 경로는 `error` 를 싣지 않는다. 소비자 전부 방어적이라 런타임 무해 |
| `13_47_42/RESOLUTION.md` 의 W17 줄 인용 부정확 | 미조치 | review 산출물 내부 기록 오류, 코드·동작 무영향 |
| `retryCount` 가 실제 재시도 없이도 1 이상 저장 | 미조치 | `isAbortError` 부터 있던 기존 순서, 라우팅 무영향 |
| W19 시나리오 e2e 부재 · `objectContaining` 부분 매치 · CHANGELOG 태그 형식 | 미조치 | 전부 저위험 INFO |
| (이월) 선재 spec 파일 구조적 flakiness · `runParallel` failures 미소비 · Parallel `stop` 우선순위 레이스 · 가드 헬퍼 전면 승격 · shutdown `FAILED` 미감지 | **백로그 유지** | 4R §범위 판정 기준("이 PR 이 만들었거나 이 PR 때문에 새로 도달 가능해졌는가")상 분리 |

## TEST 결과

- lint  : 통과 — `run-test.sh lint` PASS (`_test_logs/lint-20260726-154703.log`).
  추출 직후 prettier 오류 3건이 나 `npx prettier --write` 로 정리한 뒤 통과
- unit  : 통과 — `run-test.sh unit` PASS (`_test_logs/unit-20260726-154314.log`).
  wrapper 의 `tests=14` 는 내부 패키지 집계라 엔진 스위트를 포함하지 않으므로 별도 실행:
  `npx jest src/modules/execution-engine/ src/nodes/flow/workflow/` → **43 suites / 1121 tests 전부 통과**(추출 전후 동일 — 동작 보존 확인)
- build : 통과 — `run-test.sh build` PASS (`_test_logs/build-20260726-154800.log`)
- e2e   : 통과 — `run-test.sh e2e` PASS, **46 suites / 259 tests** 전부 통과.
  `test/node-cancellation-propagation.e2e-spec.ts` PASS(18.949s) 포함.
  로그 `_test_logs/e2e-20260726-155013.log` (마지막 코드 변경 이후 실행)

## 비고 — 5라운드 수렴

| 라운드 | Critical | Warning |
| --- | --- | --- |
| 1R (`11_48_55`) | 4 | 8 |
| 2R (`12_55_55`) | 1 | 5 |
| 3R (`13_47_42`) | 0 | 5 |
| 4R (`14_45_30`) | 0 | 6 |
| 5R (`15_30_00`) | **0** | **1** (본 문서로 조치 완료) |

5R 은 7명 중 **4명이 위험도 NONE**(security · side_effect · requirement · scope)이고, 잔여 1건도 결함이 아니라 이 PR 이 만든 중복의 리팩터였다. 각 라운드의 조치는 다음 라운드가 **mutation 으로 독립 재실측**해 주장의 진위를 확인했다 — 5R testing 은 4R RESOLUTION 의 mutation 주장 2건이 실패 시그니처까지 문자 그대로 일치함을 재현했다.
