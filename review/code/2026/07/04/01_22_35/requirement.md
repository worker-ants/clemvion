# 요구사항(Requirement) Review — PR3 크래시/재시작 RUNNING re-drive ai-review resolution (fresh)

대상: `4b3a25a3a refactor(execution-engine): PR3 ai-review resolution` (직전 review `review/code/2026/07/04/00_57_47` 의 Warning 10건 조치 커밋). diff base: `15c0bd036`(직전 리뷰 대상 최종 커밋) → `4b3a25a3a`. 관련 spec SoT: `spec/5-system/4-execution-engine.md` §7.1/§7.2/§7.3/§7.5 + Rationale "크래시/재시작 RUNNING 세그먼트 제어된 re-drive".

## 발견사항

- **[INFO]** (positive) `failOrphanRunningNodeExecutions` 신설이 옛 cascade 보장을 정확히 복원 — 기능 완전성/엣지케이스 확인
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2711-2736` (`failOrphanRunningNodeExecutions`), 호출부 `:2795` (`redriveStuckExecution` 내부, `rehydrateContext` **이전**에 호출)
  - 상세: 옛 `recoverStuckExecutions`(PR3 이전, `8ca90903a^` 스냅샷 확인)는 Execution 을 FAILED 로 일괄 마킹하며 그 자식 `NodeExecution(status=RUNNING)` 도 cascade FAILED 처리했다(`error.code='WORKER_HEARTBEAT_TIMEOUT'`). PR3 최초 구현은 Execution 을 재구동 모델로 전환하며 이 cascade 를 통째로 제거해, 재구동된 세그먼트가 COMPLETED 로 종결된 뒤에도 크래시 시점 mid-dispatch 였던 자식 NodeExecution row 가 영구 `running` 상태로 잔존하는 회귀를 낳았다(직전 리뷰 W1). 본 resolution 은 `redriveStuckExecution` 진입 시(`rehydrateContext` 호출 전) 해당 executionId 의 RUNNING NodeExecution 만 골라 FAILED 로 마감한다. `rehydrateContext`(`:1253-1258`)가 `_executedNodes` 복원 시 `status: COMPLETED` 필터만 사용함을 코드로 직접 확인했으므로, orphan RUNNING row 를 rehydrate **이전에** FAILED 로 닫아도 완료 노드 복원(§7.3 "완료 노드 미재실행")에 영향이 없다 — 순서상 안전.
  - 제안: 조치 불요 (양호).

- **[INFO]** unit 커버리지가 RESOLUTION.md 의 W1/W5/W7/W8/W9 claim 과 일치함을 코드로 직접 검증
  - 위치: `execution-engine.service.spec.ts:1153-1466` (`redriveStuckExecution`/`failOrphanRunningNodeExecutions`/`driveStuckRedrive` describe 블록), `executions.controller.spec.ts:101-142` (`triggerStuckRecoveryForTest` 게이팅 3-case)
  - 상세: (a) `redriveStuckExecution` happy-path 테스트가 `orphanSpy`(=`failOrphanRunningNodeExecutions`)가 `executionId` 로 호출됐음을 명시적으로 assert(`:1220`). (b) `driveStuckRedrive` 의 COMPLETED/park/error 3분기가 각각 `updateStatusSpy`/`finalizeSpy`/`emitSpy` 로 정확히 검증됨(`:1405-1465`) — `skipExecutedNodes:true, pointer:0` 파라미터 전달도 함께 확인. (c) execution 부재(`findOneBy null`)·비-RUNNING·비-RehydrationError 실패 3케이스 모두 존재(`:1225-1293`). (d) 컨트롤러 게이팅은 정상/NODE_ENV 오설정/플래그 미설정 3-case 모두 커버(`executions.controller.spec.ts:171-199`). 실제 `npx jest execution-engine.service.spec.ts executions.controller.spec.ts` 실행 결과 358/358 통과 확인.
  - 제안: 조치 불요.

- **[SPEC-DRIFT]** orphan RUNNING `NodeExecution` cascade FAILED 마감 로직이 spec §7.3/§7.5/Rationale 본문 어디에도 명시되지 않음 — 코드가 옳고(옛 보장 복원, 정합성상 필요) spec 갱신이 누락된 사례
  - 위치: 코드 — `execution-engine.service.ts:2711-2736`, `:2789-2795`(주석 "옛 recoverStuckExecutions 의 cascade FAILED 보장을 re-drive 진입 시점으로 옮겨 복원한다"). Spec — `spec/5-system/4-execution-engine.md` §7.3(854-861, "완료 노드 미재실행"/"RUNNING-at-crash 노드 = at-least-once"), §7.5(923-1024, case B rehydration 절차 + "Rehydration 실패 케이스" 표), Rationale "크래시/재시작 RUNNING 세그먼트 제어된 re-drive"(1293-1306). `plan/in-progress/spec-draft-crash-running-redrive.md` 전체(orphan/cascade 문자열 0건).
  - 상세: §7.2 point 3/§7.5 case B 절차는 "완료 노드는 재실행하지 않는다"만 서술하고, **크래시 시점 mid-dispatch 였던(RUNNING-at-crash) 자식 NodeExecution row 자체를 재구동 진입 시 어떻게 마감하는지**는 spec 어디에도 규정돼 있지 않다. §7.3 "RUNNING-at-crash 노드 = at-least-once"(861행)는 그 노드가 **재실행된다**는 것만 말하고, 재실행 전에 옛 RUNNING row 를 FAILED 로 닫는지 여부는 침묵이다. 코드는 (i) 재구동된 노드가 **새 NodeExecution row** 로 실행되고(at-least-once, 새 row 생성은 기존 `runNodeDispatchLoop`/`executeNode` 관용구), (ii) 옛 RUNNING row 를 방치하면 부모 Execution 이 COMPLETED 로 마감된 후에도 그 노드만 영구 orphan `running` 으로 남아 타임라인/진행률 집계가 오염된다는, spec 이 다루지 않는 구체적 정합성 문제를 해결한다. 이 동작 자체는 옛(PR3 이전) 구현이 이미 하던 보장(cascade FAILED)을 재구동 모델에 맞게 복원한 것으로 **명백히 필요하고 올바른 수정**이나, spec §7.3/§7.5 본문에는 "재구동 시 옛 RUNNING NodeExecution row 는 FAILED 로 마감한다"는 문장이 추가돼 있지 않다. `data-flow/3-execution.md:65`("crash 로 orphan 된 RUNNING row 는 §3.3 recoverStuckExecutions 가 부팅 시 §7.5 case B 로 re-drive")도 **Execution** 레벨 orphan 만 언급하고 자식 **NodeExecution** 레벨 orphan cascade 는 언급하지 않는다.
  - 제안: 코드는 유지. `spec/5-system/4-execution-engine.md` §7.3 "완료 노드 미재실행" 항목 또는 §7.5 case B 절차 블록(928행 부근)에 "재구동 진입 시 크래시 시점 mid-dispatch 였던 자식 NodeExecution(RUNNING) row 를 FAILED 로 마감한다(옛 cascade 보장 복원 — 새 row 로 at-least-once 재실행되므로 옛 row 방치 시 orphan running 잔존)" 문장을 `project-planner` 가 반영 필요. Rationale 절(1301행 "잔여 race" 문단 인접)에도 이 cascade 보장이 "완화 (iii) per-node COMPLETED skip" 옆에 병기되면 좋음.

- **[INFO]** W3(이중 게이트) `E2E_TEST_HOOKS` 조치가 컨트롤러 코드·docker-compose·e2e 모두 일관되게 반영됨을 확인
  - 위치: `executions.controller.ts:201`(`process.env.NODE_ENV !== 'test' || process.env.E2E_TEST_HOOKS !== '1'`), `docker-compose.e2e.yml:239-242`(`E2E_TEST_HOOKS: "1"`), `executions.controller.spec.ts:171-199`(3-case)
  - 상세: 단일 env 오설정으로는 프로덕션에 노출되지 않는 이중 게이트가 코드·인프라·테스트 삼자 일치. `@Roles('owner')` 는 `RolesGuard`(`common/guards/roles.guard.ts`) 구현을 직접 확인해, `X-Workspace-Id`/JWT 워크스페이스의 owner 이상만 통과함을 검증 — 코드 주석 "임의 인증 사용자가 아니라 워크스페이스 owner 만 트리거 가능"과 일치(단, 그 워크스페이스가 굳이 stuck execution 소유 워크스페이스일 필요는 없음 — 이 한계는 코드 주석 "recoverStuckExecutions 는 전역 스캔"으로 이미 인지·문서화돼 신규 발견 아님).
  - 제안: 조치 불요.

- **[INFO]** TODO/FIXME/HACK/XXX 계열 미완성 주석 부재
  - 위치: resolution diff 전체(`execution-engine.service.ts`/`.spec.ts`/`executions.controller.ts`/`.spec.ts`)
  - 상세: grep 결과 신규 diff 라인에 TODO/FIXME/HACK/XXX 없음. "PR4 관측성 트랙에서 별도 검토"(컨트롤러 주석), "PR4 BullMQ stalled 로 완결"(zombie race 주석) 등은 이미 spec Rationale 에 동일하게 기록된 의도적 defer 이지 미완성 표시가 아니다.
  - 제안: 조치 불요.

## 요약

직전 리뷰(`00_57_47`, Warning 10건)에 대한 resolution 커밋(`4b3a25a3a`)을 fresh 로 재검증했다. 요구사항 핵심 조치인 W1(`failOrphanRunningNodeExecutions` 신설, orphan cascade 복원)은 코드·주석·unit 테스트가 서로 정확히 일치하며, `rehydrateContext` 가 COMPLETED 행만 필터함을 직접 확인해 호출 순서(orphan 마감 → rehydrate)도 안전함을 검증했다. W3(이중 env 게이트) 도 컨트롤러·docker-compose·controller.spec 3자가 일관되게 반영됐고, `@Roles('owner')`(W2) 도 `RolesGuard` 구현과 부합한다. `npx jest`(execution-engine.service.spec.ts + executions.controller.spec.ts) 358/358 통과, 대상 파일 eslint 신규 에러 0(기존 무관 라인의 warning 22건만 존재)으로 TEST 결과 claim 도 실측 확인했다. 유일한 발견사항은 SPEC-DRIFT 1건 — orphan `NodeExecution` cascade FAILED 마감이라는, 옛 구현에 이미 존재했고 이번에 정확히 복원된 정합성 보장이 `spec/5-system/4-execution-engine.md` §7.3/§7.5/Rationale 본문 어디에도 명문화돼 있지 않다. 코드는 명백히 옳고 필요한 수정이므로 되돌릴 대상이 아니며, spec 본문에 한 문단 추가 반영이 필요하다(project-planner 위임). Critical 은 없다.

## 위험도
LOW
