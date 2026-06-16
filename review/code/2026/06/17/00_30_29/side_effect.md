# 부작용(Side Effect) 리뷰

## 발견사항

### [INFO] NodeComponentRegistry.bootstrap — 중복 등록 시 throw 는 의도된 동작이나 호출 횟수 의존성 이동
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/codebase/backend/src/nodes/core/node-component.registry.ts` line 49
- 상세: `bootstrap`이 같은 `type`으로 두 번 호출되면 `throw new Error('Duplicate node component registration: ...')` 로 crash 한다. 옛 경로(ExecutionEngineService.onModuleInit 직호출)와 달리 새 경로(NodeBootstrapService.onModuleInit)에서는 모듈 프로바이더 등록 순서에 따라 NodeBootstrapService의 onModuleInit이 먼저 호출되고, ExecutionEngineService.onModuleInit은 더 이상 `registerHandlers`를 호출하지 않으므로 중복 호출은 발생하지 않는다. 다만 향후 테스트 픽스처나 다른 모듈에서 동일 `NodeComponentRegistry` 인스턴스에 `bootstrap`을 직접 호출하면 부트 실패가 된다. 현재 변경 범위 내에서는 이 경로가 제거됐으므로 실질 위험은 없음.
- 제안: `bootstrap`에 이미 등록 여부 guard 또는 idempotency 옵션을 두는 것을 장기적으로 검토한다. 현 PR 범위에서는 불필요.

### [INFO] WORKFLOW_EXECUTOR 토큰 — 문자열 리터럴, 타입 안전성 경계
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/codebase/backend/src/nodes/core/workflow-executor.interface.ts` line 2548
- 상세: `export const WORKFLOW_EXECUTOR = 'WORKFLOW_EXECUTOR'`는 NestJS 관용 패턴이다. 문자열이므로 다른 모듈이 같은 문자열 토큰을 독립적으로 선언해 충돌할 수 있다. 현재 코드베이스 내 해당 문자열을 사용하는 곳이 `ExecutionEngineModule`의 `provide: WORKFLOW_EXECUTOR` 단 한 곳이고, Symbol 이 아닌 string 토큰은 Nest DI 컨테이너 전역에서 충돌 가능성이 이론적으로 존재한다. 현재 상태에서는 충돌 없음.
- 제안: 미래에 토큰 충돌이 우려되면 `Symbol('WORKFLOW_EXECUTOR')`로 전환 가능. 현 PR 범위에서는 기존 관용 패턴과 일치하므로 무방.

### [INFO] useExisting 바인딩 — ExecutionEngineService가 WORKFLOW_EXECUTOR로도 노출됨
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/codebase/backend/src/modules/execution-engine/execution-engine.module.ts` line 205
- 상세: `useExisting: ExecutionEngineService`는 동일 인스턴스를 두 토큰으로 노출한다. WORKFLOW_EXECUTOR 토큰으로 주입받은 소비자(NodeBootstrapService)가 런타임에 WorkflowExecutor 인터페이스 이상의 메서드(예: executeInline 외부 서비스)를 호출하는 것을 타입 레벨에서 차단하나, 실제 인스턴스는 ExecutionEngineService 전체가 전달된다. 현재 NodeBootstrapService는 workflowExecutor를 `handlerDeps.build(this.workflowExecutor)` 에 그대로 전달할 뿐 직접 호출하지 않으므로 의도치 않은 메서드 호출 부작용은 없다.
- 제안: 해당 없음. 현재 구조로 충분.

### [INFO] NodeBootstrapService.onModuleInit — 등록 타이밍 이동에 따른 onModuleInit 호출 순서 의존
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/codebase/backend/src/modules/execution-engine/node-bootstrap.service.ts` line 1925
- 상세: NestJS는 같은 모듈 내 providers의 `onModuleInit` 호출 순서를 **등록 순서**로만 보장한다. `ExecutionEngineModule.providers` 배열에서 `ExecutionEngineService`(line 172)가 `NodeBootstrapService`(line 200)보다 먼저 등록되어 있으므로, ExecutionEngineService.onModuleInit이 먼저 실행된다. ExecutionEngineService.onModuleInit은 이제 큐 depth provider 등록만 하므로 NodeBootstrapService.onModuleInit이 그 뒤에 bootstrap을 실행해도 경합이 없다. assertConsistency는 `onApplicationBootstrap`(모든 onModuleInit 완료 후)에서 실행되므로 순서 보장이 확실하다.
- 제안: 현재 설계가 Nest 라이프사이클 계약을 올바르게 활용함. 변경 불필요.

### [INFO] nodes.module.ts forwardRef 제거 — 순환 의존 재발 리스크
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/codebase/backend/src/modules/nodes/nodes.module.ts`
- 상세: `forwardRef(() => ExecutionEngineModule)` 제거는 실제 순환이 없음을 확인한 뒤 수행된 것(commit 메시지 설명). ExecutionEngineModule이 NodesModule을 import하지 않으므로 현재 순환 없음이 맞다. 단, 향후 ExecutionEngineModule이 NodesModule을 직접 import하는 변경이 생기면 즉시 Nest 부트 오류로 드러나므로 암묵적 위험은 낮다.
- 제안: 이 변경은 올바름. 추후 PR에서 두 모듈간 의존 방향을 변경할 때 주의.

## 요약

이번 변경은 `ExecutionEngineService`에 집중됐던 노드 핸들러 bootstrap 책임을 `NodeBootstrapService`로 분리하는 순수한 DI 리팩터링이다. 전역 변수·파일시스템·환경 변수·네트워크 호출의 의도치 않은 부작용은 없다. 공개 API(`ExecutionEngineService`의 `execute/executeSync/executeAsync/executeInline` 등) 시그니처는 변경되지 않았고, 내보내는 exports 목록(`execution-engine.module.ts` exports 배열)도 동일하다. `NodeComponentRegistry.bootstrap` 호출 주체만 이동했을 뿐 동일 레지스트리 인스턴스에 동일 순서로 동일 컴포넌트를 등록하므로, 런타임 핸들러 디스패치 결과는 변경 전과 동일하다. 발견된 항목은 모두 INFO 수준이며 실질적 부작용은 확인되지 않는다.

## 위험도

NONE
