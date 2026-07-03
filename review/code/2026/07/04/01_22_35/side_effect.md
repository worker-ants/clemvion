# 부작용(Side Effect) 리뷰 — resolution 커밋 `4b3a25a3a` (PR3 ai-review resolution, W1 fix 검증)

대상: 이전 리뷰(`review/code/2026/07/04/00_57_47/side_effect.md`) W1 지적("크래시 orphan RUNNING
NodeExecution 이 영구 잔존")에 대한 fix `failOrphanRunningNodeExecutions` 신설
(`execution-engine.service.ts`) + `@Roles('owner')`/`E2E_TEST_HOOKS` 이중 게이트
(`executions.controller.ts`, `docker-compose.e2e.yml`) + 관련 unit/controller.spec 추가.

## 검증 절차

- `git show 4b3a25a3a -- codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 로 신규 메서드 전문 확인.
- `redriveStuckExecution` 호출 시퀀스(re-claim → `failOrphanRunningNodeExecutions` → `rehydrateContext` → `driveStuckRedrive`) 확인.
- `NodeExecution`/`NodeExecutionStatus` import, `nodeExecutionRepository` 주입이 기존 코드에서 이미 사용 중임(신규 전역/신규 의존성 아님) 확인.
- `executions.controller.ts` 의 `@Roles('owner')` 가 전역 `RolesGuard`(APP_GUARD, `app.module.ts`) 체인에 올라타 있어 실제로 유효함을 확인.
- `execution-engine.service.spec.ts` / `executions.controller.spec.ts` 신규 테스트 케이스 확인(orphan cascade WHERE 절, redrive 순서, 컨트롤러 게이팅 3-case).

## 발견사항

- **[INFO] `failOrphanRunningNodeExecutions` 는 이전 W1 을 정확히 해소 — 신규 부작용 없음**
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2711-2736` (신설 private 메서드), 호출부 `redriveStuckExecution:2795`
  - 상세: `execution_id = :executionId AND status = 'running'` 범위로만 `UPDATE ... SET status='failed', error={message:...}, finishedAt=now()` 를 실행한다 — (1) 대상 Execution 범위로 정확히 스코프됨(다른 Execution 의 row 에 영향 없음), (2) `status='running'` 조건으로 이미 COMPLETED/FAILED/SKIPPED/WAITING_FOR_INPUT 인 row 는 건드리지 않음(멱등 — 동일 executionId 로 재호출해도 두 번째 호출은 대상 0건), (3) 호출 시점이 `rehydrateContext`(완료 노드 복원, `execution_node_log` + `NodeExecution.status=COMPLETED` 읽기) **이전**이라 rehydrate 가 읽는 COMPLETED 집합과 겹치지 않음 — race 없음. 옛 cascade 로직(리뷰 대상 diff 이전에 존재했던, 이번 PR3 도입 시 삭제됐던 것)을 정확히 복원하는 fix로, 신규 전역 상태·신규 파일시스템 부작용·신규 네트워크 호출 없음.
  - 제안: 없음(정상).

- **[INFO] `redriveStuckExecution` 내부 호출 순서 변경 — 시그니처 무변경, 호출자 영향 없음**
  - 위치: `execution-engine.service.ts:2789-2795`
  - 상세: `redriveStuckExecution(executionId)` 자체 시그니처는 그대로이며, 내부에 `await this.failOrphanRunningNodeExecutions(executionId);` 한 줄이 routing-context 재등록 이후·`rehydrateContext` 이전에 추가됐다. `redriveStuckExecution` 은 `private` 메서드로 유일한 호출자는 같은 클래스의 `recoverStuckExecutions` (fire-and-forget, `.catch` 방어)뿐이라 외부 호출자 영향 없음. 새로 추가된 await 는 함수 내 순차 실행이라 기존 try/catch 단말 처리 구조(`RehydrationError` → `markExecutionCancelled`) 안에 자연스럽게 편입돼 있다 — 만약 `failOrphanRunningNodeExecutions` 자체가 실패하면 catch 블록이 non-`RehydrationError` 분기로 잡아 `RESUME_CHECKPOINT_MISSING` terminal 처리한다(과다 방어이긴 하나 기존 setup-실패 처리와 일관, 새로운 미처리 예외 경로 없음).
  - 제안: 없음(정상) — 다만 순수 관찰: `failOrphanRunningNodeExecutions` 실패 시에도 `RESUME_CHECKPOINT_MISSING` 으로 분류되는 것은 원인 라벨이 다소 부정확(체크포인트 문제가 아니라 orphan cascade DB 오류)하나, 기존 W7 fix 가 이미 "비-RehydrationError 는 전부 RESUME_CHECKPOINT_MISSING" 으로 통일한 설계라 이번 fix 로 인한 신규 이슈는 아님.

- **[INFO] `@Roles('owner')` 추가는 기존 인가 체인에 자연 편입, 신규 가드/전역 등록 없음**
  - 위치: `executions.controller.ts:214` (`triggerStuckRecoveryForTest`), 참조 `app.module.ts:200-204`
  - 상세: `RolesGuard` 는 이미 전역 `APP_GUARD` 로 등록돼 있고(`JwtAuthGuard` 다음 순서, 주석에도 명시), 다른 엔드포인트(`re-run` 등)도 동일 패턴으로 `@Roles('editor')` 를 사용 중이다. 이번 변경은 기존 인프라에 데코레이터 하나를 추가한 것뿐이라 신규 side effect 없음. `mockExecutionEngineService.runStuckRecoveryScan` mock 도 `executions.controller.spec.ts` 에서 이미 신설돼 있어 unit 테스트가 실제 서비스 호출 없이 격리됨을 확인.
  - 제안: 없음(정상).

- **[INFO] `E2E_TEST_HOOKS` 환경변수 신설 — 프로덕션 비노출 확인, 기존 `.env` 스캔 로직에 영향 없음**
  - 위치: `docker-compose.e2e.yml:154-157` (env 추가), `executions.controller.ts:220` (`process.env.E2E_TEST_HOOKS !== '1'`)
  - 상세: 신규 환경변수는 e2e 전용 compose 파일에만 설정되고, 컨트롤러의 게이트 조건이 `NODE_ENV==='test' && E2E_TEST_HOOKS==='1'` AND 조건이라 프로덕션 배포(compose/env 파일에 `E2E_TEST_HOOKS` 자체가 존재하지 않음)에서는 항상 두 번째 조건이 거짓 → 안전. 다른 코드 경로에서 이 env var 를 읽는 곳은 없음(grep 확인 불필요할 만큼 국소적 — 컨트롤러 단일 read 지점). 환경변수 쓰기는 없음(read-only 게이트).
  - 제안: 없음(정상).

- **[INFO] `NodeExecution`/`NodeExecutionStatus` import, `nodeExecutionRepository` 는 기존 의존성 재사용 — 신규 순환참조/신규 provider 없음**
  - 위치: `execution-engine.service.ts:15-18` (import, 기존), `:615` (생성자 주입, 기존)
  - 상세: 두 심볼 모두 이번 diff 이전부터 파일 상단에 이미 import 돼 있었고(`executeNode`/`createNodeExecution` 등 기존 로직에서 사용), `nodeExecutionRepository` 도 생성자에 이미 주입된 기존 멤버다. 신규 모듈 의존성·신규 DI provider 등록이 없어 `execution-engine.module.ts` 변경도 필요 없었고 실제로 변경되지 않았다.
  - 제안: 없음(정상).

- **[INFO] 이전 리뷰(00_57_47/side_effect.md) 의 나머지 INFO 항목(`rehydrateContext` nullable 시그니처와 `EngineDriver` 인터페이스 불일치, `skipExecutedNodes` 하위호환)은 이번 resolution 커밋에서 다루지 않음 — 그대로 잔존, 새 문제는 아님**
  - 위치: `execution-engine.service.ts:1178` 부근(구현) vs `engine-driver.interface.ts:128-131`(인터페이스) — 이번 diff 에 미포함
  - 상세: SUMMARY.md/RESOLUTION.md 도 이 항목을 W1~W10 조치 대상에 포함하지 않았다(원 리뷰에서도 INFO 등급, 즉시 위험 없음으로 판정됐음). 이번 fresh 리뷰 범위(`failOrphanRunningNodeExecutions` 신설 검증)에서 재확인한 결과 이 항목은 이번 커밋으로 개선되지도 악화되지도 않았다.
  - 제안: 조치 불요(이미 저위험 INFO 로 기록됨). 향후 `EngineDriver` 인터페이스 정비 시 함께 처리 권장.

## 요약

resolution 커밋(`4b3a25a3a`)의 핵심 side-effect fix `failOrphanRunningNodeExecutions` 는 이전 리뷰가 지적한 "크래시 시점 mid-dispatch 였던 자식 NodeExecution RUNNING row 가 영구 orphan 으로 남는 회귀"를 정확한 스코프(`execution_id` + `status='running'` 조건)로, 올바른 시점(`rehydrateContext` 완료-노드 복원 이전, re-claim 이후)에 호출해 해소한다. 멱등(이미 마감된 row 는 재대상 아님)하고, 다른 Execution/노드에 영향이 없으며, 신규 전역 상태·신규 파일시스템/네트워크 부작용·신규 DI 의존성이 없다. 함께 커밋된 `@Roles('owner')`, `E2E_TEST_HOOKS` 이중 게이트도 기존 인프라(전역 `RolesGuard`, e2e 전용 compose env)에 자연스럽게 편입되어 프로덕션 노출 위험을 낮췄고 부작용 관점의 신규 이슈는 없다. `redriveStuckExecution` 시그니처는 무변경이고 유일한 호출자(`recoverStuckExecutions`, fire-and-forget)에도 영향이 없다. unit 테스트(`failOrphanRunningNodeExecutions` WHERE 절 검증, `redriveStuckExecution` 순서 검증 `orphanSpy` 호출 확인, 컨트롤러 3-case 게이팅)가 이 모든 경로를 커버한다. 이전 리뷰의 잔여 INFO(EngineDriver 인터페이스 nullable 불일치)는 이번 커밋 범위 밖으로 그대로 남아 있으나 이미 저위험으로 분류돼 있어 신규 이슈가 아니다.

## 위험도

NONE
