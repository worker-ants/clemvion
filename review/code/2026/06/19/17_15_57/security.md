### 발견사항

- **[INFO]** `WORKFLOW_FORBIDDEN_WORKSPACE` 에러 메시지에 `targetWorkspaceId` 포함
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`, `assertSameWorkspace` 메서드
  - 상세: 에러 메시지 `"WORKFLOW_FORBIDDEN_WORKSPACE: Sub-workflow ${targetWorkspaceId} invoked without caller workspace context"` 및 `"WORKFLOW_FORBIDDEN_WORKSPACE: Sub-workflow ${targetWorkspaceId} is not accessible from workspace ${callerWorkspaceId}"` 에 내부 workspace ID와 sub-workflow 식별자가 직접 포함된다. 이 에러가 상위 레이어에서 그대로 클라이언트로 전달될 경우 tenant 격리 경계 정보(workspace ID)가 외부에 노출될 수 있다.
  - 제안: 에러 코드/종류만 포함하는 정형 에러 클래스(예: `WorkflowForbiddenError`)를 사용하고, workspace ID 등 내부 식별자는 서버 로그에만 남기며 클라이언트 응답에서는 제거한다. 에러를 catch하는 상위 레이어가 이미 sanitize하고 있는지 확인 필요.

- **[INFO]** `rehydrateAndResume`에서 에러 로그에 `nodeExecutionId` 노출
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`, `rehydrateAndResume` 메서드 catch 블록
  - 상세: `logger.warn('Rehydration failed', { code: err.code, executionId, nodeExecutionId })` — 주석에서 "BullMQ DLQ Board / 外部ログ集積への情報漏洩防止"를 명시했으나, 이는 서버 로그이므로 현재 수준은 적절하다. 다만 이 structured log가 외부 집계 시스템에 그대로 전달될 경우 `nodeExecutionId`, `executionId`가 노출된다.
  - 제안: 로그 집계 시스템(예: Datadog, ELK) 설정에서 해당 필드를 PII/내부 식별자로 마스킹하는 정책을 별도 문서화한다.

- **[INFO]** `__workspaceId` 가 `context.variables`에 사용자 변수와 동일 네임스페이스로 저장
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (`__workspaceId` 주입), `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` `withWorkspace` 헬퍼
  - 상세: `context.variables.__workspaceId`는 사용자 정의 변수와 동일한 `variables` 맵 안에 `__` prefix 컨벤션으로 보호된다. 만약 사용자 정의 워크플로 내에서 표현식 엔진(`expressionResolver`)이 변수 쓰기를 허용하거나, 노드 핸들러가 `context.variables.__workspaceId`를 임의로 덮어쓸 수 있다면 workspace 격리 우회가 가능하다.
  - 제안: `__workspaceId` 등 시스템 변수(`__*`)에 대한 쓰기 권한을 표현식 엔진 및 핸들러 레벨에서 명시적으로 차단하는 가드를 추가하거나, 시스템 변수를 `variables`와 분리된 별도 필드(`context.systemVariables`)에 저장하여 격리를 구조적으로 보장하는 방안을 검토한다.

- **[INFO]** fail-closed 전환으로 기존 미마이그레이션 경로 차단 가능성 (운영 영향)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`, `assertSameWorkspace` (변경 diff 기준)
  - 상세: 기존 "점진적 도입용 fail-open(로그 후 통과)" 에서 "fail-closed(즉시 거부)"로 전환됐다. 이 변경 자체는 보안 강화이나, 미마이그레이션 호출 경로가 있을 경우 런타임에 `WORKFLOW_FORBIDDEN_WORKSPACE`로 실행이 차단되어 서비스 장애로 이어질 수 있다. 변경 코드 주석에서 "모든 정당한 진입점은 workspace를 넘긴다"고 명시했으므로, 이 불변식이 실제로 모든 진입점에서 보장되는지 정적 분석 또는 통합 테스트로 검증하는 것이 필요하다.
  - 제안: `executeSync`, `executeAsync`, `executeInline`의 모든 호출 지점을 정적 추적하여 `parentWorkspaceId` 또는 `context.variables.__workspaceId` 전달 여부를 확인한다.

### 요약

이번 변경의 핵심은 sub-workflow workspace 격리를 fail-open에서 **fail-closed**로 전환한 것이다(W-6). 보안 관점에서 이는 명백히 올바른 방향이며, 호출자 workspace 컨텍스트가 없을 때 통과시키던 구조적 취약점을 제거한다. 하드코딩된 시크릿이나 인젝션 취약점은 없으며, 인증/인가 로직은 의도적으로 강화됐다. 주의할 점은 `assertSameWorkspace`의 에러 메시지에 내부 workspace ID가 포함되므로 이 에러가 클라이언트까지 그대로 전달되지 않도록 상위 레이어의 에러 sanitization을 확인해야 한다는 것이다. 또한 `context.variables.__workspaceId`가 사용자 변수와 같은 네임스페이스를 공유하므로, 표현식 엔진이나 핸들러에서 시스템 변수 쓰기를 구조적으로 막지 않으면 격리 우회 가능성이 이론적으로 존재한다.

### 위험도

LOW
