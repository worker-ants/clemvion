# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [WARNING] assertSameWorkspace: fail-open → fail-closed 전환으로 인한 기존 호출 경로 잠재적 차단
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `assertSameWorkspace` 메서드 (`if (!callerWorkspaceId)` 분기)
- 상세: 기존에는 `callerWorkspaceId`가 `undefined`일 때 `logger.warn` 후 `return`(통과)이었으나, 이제는 `throw new Error('WORKFLOW_FORBIDDEN_WORKSPACE: ...')`로 변경됐다. 이 메서드는 `executeInline`, `executeSync`, `executeAsync` 세 공개 진입점에서 호출되므로, `callerWorkspaceId`를 공급하지 않는 기존 호출 경로(옛 노드 핸들러, 내부 직접 호출, 외부 통합 코드 등)가 런타임에서 예외를 던지게 된다. 변경 전에는 경고 로그(관측 가능하지만 실행 흐름에 영향 없음)를 남겼으나, 변경 후에는 실행이 즉시 중단(`WORKFLOW_FORBIDDEN_WORKSPACE`)되어 워크플로우 실패로 이어진다. 코드 주석과 테스트는 모든 정당한 진입점이 이미 `__workspaceId`를 주입한다고 주장하나, 실제 `runExecution`/`rehydrateContext` 경로 외부(예: 미마이그레이션 핸들러 코드)에서 누락이 있다면 운영 중 조용히 차단된다.
- 제안: 이 변경을 적용하기 전에 `executeInline`/`executeSync`/`executeAsync`를 호출하는 모든 노드 핸들러(특히 sub-workflow 핸들러)가 `parentWorkspaceId` 또는 `context.variables.__workspaceId`를 항상 공급함을 정적 분석 또는 추가 테스트로 확인할 것. 배포 직후 모니터링에서 `WORKFLOW_FORBIDDEN_WORKSPACE` 에러 빈도를 관찰하고, 예상치 못한 차단이 발생하면 즉시 롤백 경로를 확보해둘 것.

### [INFO] withWorkspace 헬퍼: ExecutionContext 객체 직접 변이(mutate)
- 위치: `execution-engine.service.spec.ts` — `withWorkspace` 함수
- 상세: `ctx.variables = { ...(ctx.variables ?? {}), __workspaceId: workspaceId }`는 전달된 `ctx` 객체의 `variables` 속성을 새 객체로 교체한다. 테스트 파일 내에서만 사용되고 `beforeEach`마다 새 컨텍스트가 생성되므로 실질적 위험은 없다. `withWorkspace` 반환값이 원본 `ctx`와 동일 참조이므로, 이후 `ctx.parentNodeExecutionId = 'outer-parent'` 같은 접근은 의도대로 동작한다.
- 제안: 현재 패턴은 테스트 범위 내에서 안전하다. 필요 시 `withWorkspace`를 순수 함수(새 객체 반환)로 작성하면 명시성이 높아진다.

### [INFO] mockWorkflow 공유 객체에 workspaceId 추가 — 전역 기본값 변경
- 위치: `execution-engine.service.spec.ts` — `mockWorkflow` const 객체 (`workspaceId: 'ws-1'` 추가)
- 상세: `mockWorkflow`는 `describe` 블록 최상위 스코프의 공유 const 객체로, `mockWorkflowRepo.findOneBy`의 기본 반환값으로 사용된다. `workspaceId: 'ws-1'` 추가는 이 기본값이 새 fail-closed 검사를 통과하도록 만든다. 기존 테스트들이 `workspaceId`를 검증하지 않았으므로 직접 영향은 없다. 단, 이 공유 객체는 모든 테스트에서 기본적으로 `ws-1` workspaceId를 노출하게 되므로, 향후 workspaceId 관련 경계 케이스 테스트에서 오판 가능성이 있다.
- 제안: 현재 범위에서 문제없음. 향후 workspaceId 관련 경계 케이스 테스트 추가 시 기본값(`ws-1`)에 의존하지 않도록 명시적 override를 사용할 것.

## 요약

이번 변경의 핵심은 `assertSameWorkspace`의 fail-open → fail-closed 전환이다. 테스트 파일 변경은 이 전환에 대응해 기존 테스트에 workspace 컨텍스트를 공급(`withWorkspace` 헬퍼)하고 새 fail-closed 검증 케이스를 추가한 것으로, 테스트 수준에서는 일관성 있게 수정됐다. 부작용 관점에서 가장 중요한 위험은 프로덕션 서비스 파일의 `assertSameWorkspace` 변경으로, 이전에는 경고 로그(관측 가능하나 무해)를 남기던 경로가 이제 즉시 예외를 던지게 됨에 따라 `callerWorkspaceId`를 공급하지 않는 기존 호출 경로가 있다면 무언의 차단이 발생한다. 코드 주석은 모든 합법적 진입점이 이미 workspace를 주입한다고 주장하며 이를 근거로 fail-closed 전환이 안전하다고 판단하나, 실제 모든 핸들러 코드가 이를 준수하는지에 대한 추가 확인이 권장된다.

## 위험도

MEDIUM
