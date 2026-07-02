# 부작용(Side Effect) 리뷰 — 06 C-2 재개 진입 DB 원자 claim

## 발견사항

- **[WARNING]** `claimResumeEntry` 가 `updateExecutionStatus`(§상태전이 단일 choke point)를 우회하는 raw conditional UPDATE 로 `Execution`/`NodeExecution` 을 직접 전이
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:861-916` (`claimResumeEntry`), 대비 `updateExecutionStatus` (라인 6888 이하, `assertTransition` + `segmentStartMs` 부기 로직 포함)
  - 상세: `updateExecutionStatus` 는 JSDoc 에 "상태 전이의 단일 choke point" 로 명시돼 있고 RUNNING 진입/이탈 시 `segmentStartMs` Map 을 자동으로 set/delete 한다. `claimResumeEntry` 는 이 choke point 를 건너뛰고 자체 트랜잭션에서 `manager.createQueryBuilder().update(...)` 로 직접 UPDATE 하면서, `segmentStartMs.set(executionId, Date.now())` 를 수동으로 재구현했다(라인 917). 코드 자체에 "본 헬퍼의 RUNNING 진입 로직 변경 시 `claimResumeEntry` 도 함께 점검할 것"(라인 6768-6772)이라는 자기-참조 경고 주석이 이미 붙어 있어, 두 곳의 부기 로직이 향후 독립적으로 drift 할 위험을 저자도 인지하고 있다. 예: `updateExecutionStatus` 의 RUNNING 진입 분기에 향후 필드(가령 `resumeCount++`)가 추가되면 `claimResumeEntry` 경로는 자동으로 누락된다.
  - 제안: 현재 문서화된 trade-off(원자적 조건부 UPDATE 가 choke point 의 non-atomic ORM save 로는 재현 불가)는 타당하나, `segmentStartMs` 부기처럼 "RUNNING 진입 시 항상 수행돼야 하는 로직"은 별도 헬퍼(`private recordRunningSegmentStart(id)`)로 추출해 두 경로가 공유하도록 하면 drift 위험을 줄일 수 있다.

- **[WARNING]** `assertTransition` 검증 우회 — `claimResumeEntry` 는 `ALLOWED_TRANSITIONS` 상태기계 검증을 거치지 않고 직접 UPDATE
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:864-908`
  - 상세: 기존에는 모든 `Execution.status` 전이가 `updateExecutionStatus` → `assertTransition` 을 통과해야 했다. `claimResumeEntry` 의 조건부 UPDATE(`WHERE status IN ('waiting_for_input','running')`)는 이 검증을 우회한다. spec/rationale 상 "이미 표에 존재하는 전이를 조건부·원자로 수행할 뿐" 이라는 근거가 있고 DB WHERE 절 자체가 사실상 상태 검증 역할을 하므로 치명적이진 않으나, 향후 `ALLOWED_TRANSITIONS` 표가 개정될 때 이 우회 경로가 자동으로 반영되지 않는다는 점은 유지보수 부작용이다. 코드에 이미 경고 주석은 있음(라인 6766-6772) — 리뷰어로서는 이 코멘트가 실제로 최신 상태로 유지되는지가 관건.

- **[INFO]** `nodeExec` 파라미터 in-place mutation — `reparkAiResumeTurn`
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:330-338` (`if (nodeExec) { nodeExec.status = NodeExecutionStatus.WAITING_FOR_INPUT; }`)
  - 상세: 호출자가 전달한 `nodeExec` 객체를 함수 내부에서 직접 변경한다. 이후 동일 객체를 `linkedNodeExec` 로 `driver.updateExecutionStatus` 에 넘기므로 의도된 메커니즘이지만, 호출자 관점에서는 "읽기 전용으로 넘긴 것으로 여겨질 수 있는 객체가 함수 호출 후 상태가 바뀌어 있는" 부작용이다. private 메서드이고 4개 호출 지점(라인 230/290/302/314) 모두 동일 orchestrator 내부이므로 위험은 낮음.
  - 제안: 현재로선 문제 없음(문서화된 의도적 부작용). 다만 향후 호출자가 `nodeExec` 를 mutate 후에도 원본 상태로 재사용할 것이라 가정하면 버그가 될 수 있음 — 회귀 방지 관점에서 참고.

- **[INFO]** `recoverStuckExecutions` 신규 cascade UPDATE(자식 NodeExecution FAILED 처리) — 기존 함수의 부작용 범위 확대
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2608-2641`
  - 상세: 기존 `recoverStuckExecutions` 는 `Execution` 테이블만 UPDATE 했으나, 이번 변경으로 `NodeExecution` 테이블에도 cascade UPDATE 를 수행하도록 부작용 범위가 확대됐다. `execution_id IN (:...ids) AND status = 'running'` 로 정확히 스코프돼 있어(방금 회수된 execution 의 자식만 대상) 안전하게 구현됨 — 의도치 않은 광역 변경 위험은 낮다. 다만 이 메서드는 백그라운드 크론성 recovery job 이라 실패 시 partial write(Execution 은 FAILED 로 마감됐는데 자식 NodeExecution UPDATE 가 실패)가 발생할 수 있다 — 현재 두 UPDATE 가 별도 트랜잭션(순차 실행, 트랜잭션 미공유)이라는 점 확인.
  - 제안: 두 UPDATE 사이 크래시 시 "Execution=FAILED, NodeExecution=RUNNING" 불일치가 일시적으로 남을 수 있으나, 이는 다음 `recoverStuckExecutions` 실행 시 재수렴 가능한 idempotent 설계로 보이므로 CRITICAL 은 아님. 명시적으로 이 재수렴성을 주석에 남기면 향후 리뷰 부담이 준다.

- **[INFO]** 공개 메서드 시그니처 변경 — `isNodeExecutionWaiting(nodeExecutionId)` → `claimResumeEntry(executionId, nodeExecutionId)`
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:862` / 호출자 `continuation-execution.processor.ts:87`
  - 상세: 순수 조회(SELECT) 메서드가 부작용을 가진(UPDATE 를 수행하는) claim 메서드로 대체됐다 — 메서드명 자체가 이 의미 변화를 반영("waiting 여부 확인" → "재개 진입 소유권 획득 및 상태 전이"). Repository 전역 grep 결과 프로덕션 코드 내 잔존 호출자는 없고, 유일한 호출자(`continuation-execution.processor.ts`)와 테스트가 모두 동기화됐다. 공개 API 이지만 모듈 내부 전용이며 다른 모듈에서 import 하는 곳이 없어 외부 영향 없음.
  - 제안: 문제 없음 — 리네이밍이 의미 변화를 정확히 반영하고 있고 모든 호출자가 갱신됨.

- **[INFO]** `rehydrateAndResume`/`rehydrateContext` status 가드 완화 — RUNNING 상태를 허용값으로 추가
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:719-730`, `:742-753`
  - 상세: 기존에는 `Execution.status !== WAITING_FOR_INPUT` 이면 즉시 reject 하던 가드가, 이제 `WAITING_FOR_INPUT` 또는 `RUNNING` 모두 허용하도록 완화됐다. claim 이 선행되면 이 시점에 이미 RUNNING 이므로 필요한 변경이지만, 가드 완화는 "예상 외 상태 허용 범위 확대"에 해당하는 부작용 카테고리(§1 상태 변경 허용 범위)로 분류할 수 있다. legacy/직접 호출 경로(테스트에서 확인된 것처럼 claim 을 거치지 않고 바로 `rehydrateAndResume` 호출)에서 RUNNING 상태의 execution 이 의도치 않게 재개 대상으로 잡힐 가능성은 있으나, terminal/absent 만 거부하는 방향이므로 실질적으로 위험이 낮고 테스트로 커버됨(positive/negative 케이스 모두).
  - 제안: 문제 없음 — 의도된 변경이며 회귀 테스트(파일 5, RUNNING positive/CANCELLED negative)로 뒷받침됨.

- **[INFO]** 신규 spec 문서(`plan/in-progress/spec-draft-c2-atomic-claim.md`) 및 `review/consistency/**` 산출물 파일 다수 신규 생성
  - 위치: 파일 7-18 (plan/spec draft, consistency check SUMMARY/retry_state/meta 등)
  - 상세: 이들은 프로젝트 워크플로 산출물(plan 추적, consistency-checker 결과)로서 코드 부작용 범주가 아니라 정상적인 문서 생성 흐름이다. side effect 관점에서 문제 없음.

## 요약

이번 변경은 "재개 진입 race" 를 비원자 SELECT 재검증에서 DB 조건부 UPDATE 원자 claim 으로 전환하는 것이 핵심이며, 상태 전이의 단일 choke point(`updateExecutionStatus`/`assertTransition`)를 의도적으로 우회하는 새로운 raw-UPDATE 경로(`claimResumeEntry`)를 도입한다. 이 우회는 JSDoc 에 명시적으로 문서화돼 있고, `segmentStartMs` 부기·claim 실패 시 롤백(`markNodeExecutionFailed` WAITING/RUNNING 양쪽 대상)·recovery cascade(`recoverStuckExecutions` 의 자식 NodeExecution FAILED 처리) 등 파생되는 모든 이차 부작용 지점이 함께 갱신되고 테스트로 커버되어 있어 즉각적인 위험은 낮다. 다만 choke point 우회로 인해 향후 `updateExecutionStatus`/`assertTransition` 로직 변경 시 `claimResumeEntry` 가 독립적으로 drift 할 수 있는 구조적 위험(코드 자체가 인지하고 주석으로 경고)이 남아있다. 공개 메서드 시그니처 변경(`isNodeExecutionWaiting`→`claimResumeEntry`)은 유일한 호출자와 테스트가 모두 동기화되어 외부 영향이 없다.

## 위험도

LOW
