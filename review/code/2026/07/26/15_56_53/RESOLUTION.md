# RESOLUTION — review/code/2026/07/26/15_56_53 (6R)

6R SUMMARY 의 **Critical 0 / WARNING 2건(W26·W27)** 전건 조치.

## 조치 항목

| SUMMARY # | 분류 | 조치 | 검증 |
| --- | --- | --- | --- |
| **W26** (3명 수렴) | 문서 배치 | 5R 에서 `markNodeCancelled`(JSDoc+본문)를 기존 `finalizeCancelledExecution` 의 JSDoc **과 그 함수 선언 사이**에 삽입해, 두 `/** */` 가 빈 줄 없이 연속되고 `finalizeCancelledExecution` 이 자기 문서와 47줄 떨어진 고아 상태가 됐다(IDE hover·TypeDoc 은 선언에 가장 가까운 리딩 코멘트를 채택 → W12 문서 사실상 유실). 헬퍼 블록 전체를 `finalizeCancelledExecution` JSDoc **앞**으로 이동해 두 JSDoc 이 각자 자기 함수와 다시 인접하게 했다 | 배치 실측: `markNodeCancelled` JSDoc → `:4566` 선언 / `finalizeCancelledExecution` JSDoc(`:4598~`) → `:4617` 선언. 각 JSDoc 이 자기 함수 바로 위 |
| **W27** | 테스트 | 헬퍼의 **존재 이유**인 불변식 — "`errorEnvelope` 부재 시 `error` 키/필드가 생기지 않는다"(W15/W19 의 executionId 유출 방지) — 을 겨냥한 단언이 없었다. 6R testing 이 실측으로 확인: DB 필드·WS payload 양쪽에 임의의 leaked `error` 를 강제 주입해도 기존 4개 회귀 테스트가 **전부 GREEN**. 추출 후에는 이 단일 지점이 두 호출부의 유일한 방어선이라 결속이 더 중요해졌다.<br>`expect(ne?.error).toBeUndefined()` + `expect(cancelCall?.[3]).not.toHaveProperty('error')` 추가 | **mutation**: `if (errorEnvelope) nodeExecution.error = ...` 을 무조건 대입(leak 주입)으로 치환 → `Received: {"code": "X", "message": "leak"}` **RED** → `cp` 복원 → GREEN |

### 미조치 (의도적 분리 — 전부 INFO)

harness diff-list 갭(6R 까지 반복, 이미 harness 백로그) · mock `save` 가 인자를 참조로 기록해 `save()` 생략을 감지 못함(pre-existing 테스트-더블 성질) · `durationMs` 값 미검증 · `errorEnvelope` 익명 타입 2곳(3번째 사용처에서 승격 검토) · 헬퍼 파라미터 순서가 5R 제안 초안과 다름(초안은 구속력 없고 두 호출부 일관) · 테스트가 `describe('error port routing (§3.2)')` 블록에 위치(pre-existing 조직 문제) · CHANGELOG·plan 미갱신(동형 선례 W12 도 순수 리팩터라 기록 대상 아님 — documentation 확인).

이월 백로그(4R §범위 판정 기준 유지): 선재 spec 파일 구조적 flakiness · `runParallel` 의 `failures` 미소비 · `ParallelExecutor 'stop'` 의 `failures[0]` 우선순위 레이스 · 가드 시퀀스 헬퍼 전면 승격 · shutdown `FAILED` 미감지 · WS 프로토콜 spec 의 `execution.node.cancelled` 생산자·필드 서술(planner 위임).

## TEST 결과

- lint  : 통과 — `run-test.sh lint` PASS (`_test_logs/lint-20260726-161026.log`)
- unit  : 통과 — `run-test.sh unit` PASS (`_test_logs/unit-20260726-161111.log`).
  wrapper 의 `tests=14` 는 내부 패키지 집계라 엔진 스위트 미포함 → 별도 실행:
  `npx jest src/modules/execution-engine/ src/nodes/flow/workflow/` → **43 suites / 1121 tests 전부 통과**
- build : 통과 — `run-test.sh build` PASS (`_test_logs/build-20260726-161211.log`)
- e2e   : 통과 — `run-test.sh e2e` PASS, **46 suites / 259 tests** 전부 통과.
  로그 `_test_logs/e2e-20260726-161432.log` (마지막 코드 변경 이후 실행)

## 수렴 판단

| 라운드 | Critical | Warning | 발견의 성격 |
| --- | --- | --- | --- |
| 1R | 4 | 8 | 가드가 호출자에게 흡수돼 **무력화** · 컨테이너/Parallel **범위 밖** · 커버리지 0 |
| 2R | 1 | 5 | Parallel `'continue'` 가 취소 **흡수** · 컨테이너 노드 **FAILED 오분류** |
| 3R | 0 | 5 | Map **누수** · `executeNode` **미분류** · REST **노출** · flaky |
| 4R | 0 | 6 | **영구 running**(이 PR 이 만든 결함) · retry **오분류** |
| 5R | 0 | 1 | 코드 **중복** |
| 6R | **0** | **2** | **JSDoc 배치 · 단언 부재** |

Critical 은 2R 이후 나오지 않았고, security·side_effect·scope 는 5R·6R 연속 NONE 이다. 발견의 성격이 "동작 결함" → "구조/중복" → "문서 배치·테스트 결속" 으로 단조 감소했다. 이번 라운드 2건도 런타임 동작에 영향이 없는 항목이었고 둘 다 조치했다.

각 라운드의 조치는 다음 라운드가 **mutation 으로 독립 재실측**해 진위를 확인해 왔으며, 이번 W27 은 그 검증 장치 자체(불변식 결속)를 보강한 것이다.
