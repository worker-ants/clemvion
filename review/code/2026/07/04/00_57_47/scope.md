# 변경 범위(Scope) Review

## 대상 변경 개요
PR3(crash/재시작 RUNNING 세그먼트 제어된 re-drive, spec §7.1/§7.2/§7.3/§7.5)의 단일 기능 구현. 범위:
- `execution-engine.service.ts`: `recoverStuckExecutions` 를 "stale RUNNING 일괄 FAILED" 에서 "원자 re-claim + rehydration 재구동" 으로 전환. 신규 `reclaimStuckRunningExecution` / `redriveStuckExecution` / `driveStuckRedrive` / `runStuckRecoveryScan`.
- `graph-dispatch.types.ts`: `skipExecutedNodes?: boolean` 옵션 추가(§7.3 완료노드 exactly-once 가드).
- `execution-engine.service.spec.ts`: 위 변경에 대응하는 unit 테스트 갱신/추가.
- `executions.controller.ts`: e2e 전용 `_test/recover-stuck-executions` 엔드포인트(NODE_ENV==='test' 게이팅) 신설.
- `execution-crash-redrive.e2e-spec.ts`: 신규 e2e.
- `plan/in-progress/exec-park-durable-resume.md`, `plan/in-progress/spec-draft-crash-running-redrive.md`: SDD 절차상 스코핑/spec draft 문서.
- `review/consistency/2026/07/03/23_50_01/**`, `review/consistency/2026/07/04/00_12_57/**`: `--spec`/`--impl-prep` consistency-check 산출물(CLAUDE.md 의무 절차).
- `spec/1-data-model.md`, `spec/5-system/3-error-handling.md`, `spec/5-system/4-execution-engine.md`, `spec/conventions/error-codes.md`, `spec/data-flow/3-execution.md`: `WORKER_HEARTBEAT_TIMEOUT` PR3 기간 미발동 명시 + §7.1/§7.2/§7.3/§7.5 개정 + state diagram `running→running` 전이 추가.

전체적으로 하나의 기능(PR3)에 대한 spec→consistency-check→구현→테스트의 SDD 파이프라인 산출물이며, 코드/스펙/plan/리뷰 아티팩트가 모두 이 하나의 변경 의도에 수렴한다. 임의의 무관한 리팩토링·포맷팅·주석 잡음은 발견되지 않았다.

## 발견사항

- **[INFO]** 프로덕션 코드에 신규 test-only 라우트 패턴 도입
  - 위치: `codebase/backend/src/modules/executions/executions.controller.ts` (`@Post('_test/recover-stuck-executions')`), `execution-engine.service.ts` (`runStuckRecoveryScan`)
  - 상세: e2e 가 backend 재시작을 못 시키는 in-network 러너 제약 때문에, `NODE_ENV==='test'` 로만 열리는 신규 프로덕션 엔드포인트를 추가했다. 코드베이스 내 기존 `_test/*` 또는 `NODE_ENV==='test'` 게이팅 컨트롤러 라우트 선례는 없다(신규 패턴). 주석으로 프로덕션 표면이 아님과 사유를 명시하고 있어 은닉된 의도 이탈은 아니나, "구현 대상 기능(re-drive 로직)" 자체를 넘어 "그 기능을 검증하기 위한 신규 프로덕션 API 표면"이라는 부가 변경이 포함된 점은 스코프 관점에서 명시적으로 인지할 가치가 있다. `@ApiExcludeEndpoint()` + 404 폴백으로 위험은 낮음.
  - 제안: 변경 없음(허용 가능한 트레이드오프로 판단). 다만 plan 문서에 이미 "PR4 별도 검토" 로 명시돼 있어 향후 임시 엔드포인트가 방치되지 않도록 후속 추적만 확인.

- **[INFO]** 구 동작(NodeExecution cascade FAILED) 완전 제거와 대응 테스트 삭제
  - 위치: `execution-engine.service.spec.ts` (구 "06 C-2 — 회수된 Execution 의 자식 RUNNING NodeExecution 도 cascade FAILED" 테스트 삭제), `execution-engine.service.ts` `recoverStuckExecutions`
  - 상세: 옛 "일괄 FAILED + 자식 NodeExecution cascade FAILED" 로직/테스트가 통째로 삭제됐다. 새 re-drive 모델에서는 Execution 이 FAILED 로 마킹되지 않으므로 cascade FAILED 자체가 무의미해져 논리적으로 타당한 제거다 — 관련 없는 삭제가 아니라 기능 전환에 따른 필연적 결과.
  - 제안: 조치 불요. 리뷰 기록 목적의 확인 사항.

- **[INFO]** spec 5개 파일 + consistency-check 산출물 16개 파일 동반 커밋
  - 위치: `spec/1-data-model.md`, `spec/5-system/3-error-handling.md`, `spec/5-system/4-execution-engine.md`, `spec/conventions/error-codes.md`, `spec/data-flow/3-execution.md`, `review/consistency/2026/07/03/23_50_01/**`, `review/consistency/2026/07/04/00_12_57/**`, `plan/in-progress/exec-park-durable-resume.md`, `plan/in-progress/spec-draft-crash-running-redrive.md`
  - 상세: CLAUDE.md 규약상 `project-planner` 의 spec 갱신 전 `consistency-check --spec` 의무, `developer` 의 구현 착수 전 `--impl-prep` 의무가 명시돼 있고, 두 실행분 모두 이번 diff 에 포함돼 있다. 이는 "의도 이상의 변경"이 아니라 프로젝트 표준 워크플로 산출물이며, 모든 spec 개정 내용이 `WORKER_HEARTBEAT_TIMEOUT`/§7.1/§7.2/§7.3/§7.5/state-diagram 등 이번 PR3 기능과 1:1 대응한다. 무관한 spec 섹션이나 다른 기능의 spec 변경은 발견되지 않았다.
  - 제안: 조치 불요.

## 요약
리뷰 대상 diff(코드 5개 파일 + e2e 1개 + plan 2개 + consistency 산출물 16개 + spec 5개, 총 28개 파일)는 전부 "PR3: 크래시/재시작 RUNNING 세그먼트 제어된 re-drive" 라는 단일 기능으로 수렴한다. 코드 변경(신규 메서드 3개 + 옵션 필드 1개 + 컨트롤러 엔드포인트 1개)은 목적에 정확히 부합하며, 테스트(unit/e2e) 는 새 동작의 회귀 가드로 작성됐다. 옛 fail-only 로직·테스트 삭제는 기능 전환에 따른 필연적 결과지 무관한 정리가 아니다. spec·plan·consistency-check 산출물 동반은 CLAUDE.md 가 강제하는 SDD 워크플로 그대로이며 스코프 이탈이 아니다. 유일하게 주목할 점은 테스트 편의를 위해 `NODE_ENV==='test'` 게이팅된 신규 프로덕션 라우트를 도입한 것인데, 이는 문서화가 잘 돼 있고 위험도 낮아 INFO 수준으로만 기록한다. 포맷팅/주석/임포트 잡음, 불필요 리팩토링, 기능 확장(over-engineering), 무관 파일 수정은 발견되지 않았다.

## 위험도
NONE
