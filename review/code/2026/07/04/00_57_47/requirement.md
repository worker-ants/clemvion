# 요구사항(Requirement) Review — PR3 크래시/재시작 RUNNING 세그먼트 제어된 re-drive

대상 커밋: `11c7b2ff5`(feat) + `15c0bd036`(e2e 안정화). 관련 spec: `spec/5-system/4-execution-engine.md §7.1/§7.2/§7.3/§7.5`, `spec/data-flow/3-execution.md §3.1/§3.3`, `spec/1-data-model.md §2.13`, `spec/conventions/error-codes.md`, `spec/5-system/3-error-handling.md §1.4`.

## 발견사항

- **[WARNING]** `_test/recover-stuck-executions` 컨트롤러 엔드포인트의 프로덕션 차단 분기(`NODE_ENV !== 'test' → 404`)가 어떤 자동 테스트로도 검증되지 않는다
  - 위치: `codebase/backend/src/modules/executions/executions.controller.ts:205-214` (`triggerStuckRecoveryForTest`)
  - 상세: 이 엔드포인트는 e2e 전용 backdoor 로 설계돼 있고, 실제 안전장치는 `NODE_ENV !== 'test'` 분기의 `NotFoundException` 하나뿐이다. 그러나 `executions.controller.spec.ts` 에 이 메서드/분기에 대한 unit 테스트가 없고, e2e(`execution-crash-redrive.e2e-spec.ts`)는 항상 `NODE_ENV=test` 환경에서 돌기 때문에 오직 "test 모드에서 정상 동작" 경로만 실행된다 — "프로덕션에서 404 로 완전히 숨겨진다"는 이 엔드포인트의 **핵심 안전 계약** 자체는 저장소 어떤 자동 테스트에서도 한 번도 실행되지 않는다. 저장소에 이런 `NODE_ENV` 게이팅 패턴의 선례도 없어(`grep` 결과 이 파일이 유일) 회귀 시 감지할 안전망이 특히 약하다.
  - 제안: `executions.controller.spec.ts` 에 `NODE_ENV` 를 `'production'`/`undefined` 로 설정한 상태에서 `triggerStuckRecoveryForTest()` 호출 시 `NotFoundException` 이 throw 되는지 확인하는 간단한 unit 테스트 추가 권장.

- **[INFO]** case B 재구동이 크래시 시점 RUNNING 이던 노드의 orphan NodeExecution row 를 정리하지 않는다 (data hygiene, 기능적 정합성엔 영향 없음)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `recoverStuckExecutions`/`reclaimStuckRunningExecution`/`redriveStuckExecution`/`driveStuckRedrive` (구 코드는 `recoverStuckExecutions` 가 회수된 Execution 의 자식 RUNNING NodeExecution 을 cascade `FAILED` 처리했으나, 신규 코드는 `Execution.status` 만 다루고 `NodeExecution` 테이블을 건드리지 않는다 — 삭제된 구 유닛테스트 "06 C-2 — 회수된 Execution 의 자식 RUNNING NodeExecution 도 cascade FAILED" 참조, `execution-engine.service.spec.ts` diff L254-270)
  - 상세: `rehydrateContext`(L1234-1279)는 `NodeExecutionStatus.COMPLETED` row 만 조회해 `_executedNodes`/`nodeOutputCache` 를 복원하므로, 크래시 시점에 RUNNING 이던 노드의 orphan row 존재 여부는 재구동 로직 자체엔 영향이 없다(§7.3 at-least-once 로 새 NodeExecution row 가 `createNodeExecution` 을 통해 재생성됨, L7261-7275). 다만 이 orphan RUNNING row 는 영구히 `status='running'` 으로 DB 에 남는다 — 부모 Execution 은 결국 `completed`/`failed`/`cancelled` 로 종결되지만, 그 자식 NodeExecution 하나는 terminal 상태로 전이되지 않은 채 남아 모니터링/감사 쿼리("RUNNING NodeExecution 목록")에서 stale 노이즈로 계속 나타난다. e2e(`execution-crash-redrive.e2e-spec.ts`)는 codeB 의 `node_execution`/`execution_node_log` row 를 **완전히 삭제**한 뒤 크래시를 합성하므로("dispatch 직전 크래시"), 이 시나리오("dispatch 도중 크래시로 orphan RUNNING row 잔존")는 e2e 로도 검증되지 않는다. spec §7.2/§7.3/Rationale 은 "완료 노드 미재실행"·"RUNNING-at-crash 노드 at-least-once 재실행(외부 side-effect 중복 가능)"까지만 명시하고, 그 노드의 **옛 orphan row 자체의 최종 상태**는 언급하지 않는다 — spec 이 이 지점에서 침묵하므로 spec 위반은 아니다.
  - 제안: 기능 결함은 아니므로 이번 PR 을 막을 사유는 아니다. 후속(PR4 관측성 트랙 또는 별도 정리)에서 재구동 시작 시 해당 executionId 의 옛 RUNNING NodeExecution row 를 `FAILED`(또는 `SUPERSEDED` 류 코드)로 정리하는 안을 고려 권장.

## 항목별 점검 요약

1. **기능 완전성** — 완전. `reclaimStuckRunningExecution`(원자 re-claim) → `redriveStuckExecution`(rehydrate/pre-check) → `driveStuckRedrive`(그래프 forward)의 3단 분리가 spec draft(`plan/in-progress/spec-draft-crash-running-redrive.md`)의 구현 설계와 정확히 일치하고, `runNodeDispatchLoop` 의 `skipExecutedNodes` 가드도 case A(미전달, cycle 재실행 보존)/case B(전달, exactly-once)를 정확히 분기한다.
2. **엣지 케이스** — `reclaimStuckRunningExecution` 이 0건 반환 시 `redriveStuckExecution` 호출 없이 조기 `return`(그러나 `finally` 의 lock 해제는 정상 실행 — JS try/finally 의미론 확인함), `rehydrateContext`/`loadAndBuildGraph` 실패 시 `RehydrationError`/일반 오류 모두 `RESUME_CHECKPOINT_MISSING` 로 수렴, `redriveStuckExecution` 진입 시 재로드한 Execution 이 이미 RUNNING 아니면(동시 cancel 등) 조용히 skip — 모두 유닛 테스트로 커버됨(`execution-engine.service.spec.ts` 새 `describe` 블록, 전부 통과 확인).
3. **TODO/FIXME** — 신규 코드에 TODO/FIXME/HACK/XXX 없음.
4. **의도와 구현 간 괴리** — 없음. JSDoc 주석(예: `recoverStuckExecutions`, `reclaimStuckRunningExecution`, `redriveStuckExecution`, `driveStuckRedrive`)이 실제 구현과 라인 단위로 일치. `redriveStuckExecution`/`driveStuckRedrive` 이름과 책임 분리도 함수명이 시사하는 바("재구동 판단·pre-check" vs "그래프 드라이브")와 정확히 대응.
5. **에러 시나리오** — `redriveStuckExecution` 의 pre-check 단계(rehydrateContext/loadAndBuildGraph) 실패는 `markExecutionCancelled`(RUNNING 상태 포함 대상 — 기존 `claimResumeEntry` 계열과 동형)로 수렴하고, `driveStuckRedrive` 내부 실패는 `finalizeResumedExecutionOutcome` 로 기존 case A 종결 로직을 그대로 재사용한다. fire-and-forget 패턴(`void this.redriveStuckExecution(...).catch(...)`)이 unhandled rejection 을 방어적으로 흡수하는 것도 확인.
6. **데이터 유효성** — `reclaimStuckRunningExecution` 의 조건부 UPDATE(`status='running' AND started_at < threshold`)는 Postgres row-level 잠금으로 두 인스턴스 동시 스캔에도 각 row 는 한쪽만 재점유(WHERE 재평가로 자연 배제) — 코드·주석·테스트 모두 일치.
7. **비즈니스 로직** — §7.3 4중 멱등 계약(jobId dedup·재개진입 원자 claim·완료 노드 skip·per-node DB 재검증)과 §7.5 case A/B 이분이 코드에 그대로 반영. WAITING_FOR_INPUT 제외 로직(레거시 회귀 가드) 그대로 보존.
8. **반환값** — `reclaimStuckRunningExecution`(string[]), `redriveStuckExecution`/`driveStuckRedrive`(void, 모든 경로 try/catch/finally 로 흡수)로 모든 경로에서 정의된 값/부수효과가 있음.
9. **spec fidelity** — `spec/5-system/4-execution-engine.md §7.1/§7.2/§7.3/§7.5` 개정이 이번 PR 코드와 line-level 로 일치 확인(§7.1 "재시작 트리거 PR3 구현" 서술 = `recoverStuckExecutions`/`reclaimStuckRunningExecution` 실제 동작, §7.3 "재개 진입 원자 claim: running→running started_at 조건부 re-claim" = `reclaimStuckRunningExecution` 그대로, §7.5 case B = `redriveStuckExecution`/`driveStuckRedrive` 그대로). `spec/data-flow/3-execution.md` §3.1 mermaid(`running --> running` self-loop)·§3.3 표(re-claim+rehydrate 서술)도 이번 diff 에 포함되어 cross-spec WARNING(직전 consistency-check W3)이 실제로 해소됐다. `spec/1-data-model.md §2.13`·`spec/conventions/error-codes.md`·`spec/5-system/3-error-handling.md §1.4` 의 `WORKER_HEARTBEAT_TIMEOUT` "PR3 기간 미발동" 서술도 코드 동작(이 코드는 새 re-claim 경로 어디에서도 set 되지 않음 — 유닛 테스트 "옛 fail-only 회귀 가드"로 확인)과 일치. 발견된 두 항목은 모두 spec 이 침묵하는 회색지대(§9 항목 INFO) 또는 프로덕션 코드 자체보다 테스트 커버리지 공백(WARNING)이며, spec 본문과 구현 사이의 line-level 불일치는 발견되지 않았다(SPEC-DRIFT 해당 없음).

## 요약

PR3(크래시/재시작 RUNNING 세그먼트 제어된 re-drive)의 구현은 사전에 반영된 spec(`4-execution-engine.md §7.1/§7.2/§7.3/§7.5`, `data-flow/3-execution.md §3.1/§3.3`, `error-codes.md`, `1-data-model.md §2.13`)과 함수 시그니처·상태 전이·에러 코드 발동 조건 수준까지 정확히 일치하며, 새 유닛 테스트 8건 + case B 전용 3건 + dockerized e2e 1건이 핵심 행동(원자 re-claim, 완료 노드 exactly-once skip, RUNNING-at-crash at-least-once 재실행, fail-only 옛 동작 회귀 가드, WAITING_FOR_INPUT 배제)을 모두 회귀 가드하고 있다. 전체 339개 유닛 테스트가 통과했고 신규 코드에 타입 오류가 없음을 확인했다. 발견된 두 항목 — (1) test-only 엔드포인트의 프로덕션 차단 분기가 자동 테스트로 검증되지 않는 커버리지 공백(WARNING), (2) 크래시 시점 RUNNING 이던 노드의 orphan row 가 영구히 정리되지 않는 data-hygiene 성 잔여 이슈(INFO, spec 침묵 영역이라 위반 아님) — 는 모두 이번 PR 의 기능적 정합성이나 spec 준수를 저해하지 않으며 병합을 차단할 사유가 아니다.

## 위험도

LOW
