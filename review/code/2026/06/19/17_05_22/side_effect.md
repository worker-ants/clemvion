# 부작용(Side Effect) 리뷰

## 발견사항

### [INFO] `withWorkspace()` 헬퍼가 전달받은 `context` 객체를 직접 변이(mutate)함
- 위치: `execution-engine.service.spec.ts`, diff hunk `@@ -667,9 +672,20 @@` 내 `withWorkspace` 정의
- 상세: `ctx.variables` 를 스프레드로 새 객체에 덮어쓰므로 `variables` 참조 자체는 교체되지만, `ctx` 원본 객체를 in-place 로 변경한다. 테스트 내에서는 `contextService.createContext()` 로 매번 새 인스턴스를 생성하므로 테스트 간 상태 누출은 없으나, 같은 `context` 를 `withWorkspace()` 호출 전후로 다른 변수에 할당해 비교하는 패턴이 추가될 경우 혼란이 생길 수 있다.
- 제안: 변경이 필요하다면 `return { ...ctx, variables: { ...(ctx.variables ?? {}), __workspaceId: 'ws-1' } }` 와 같이 새 객체를 반환하는 것이 부작용을 명확히 피한다. 현재 사용 범위에서는 실질적 문제는 없다.

### [INFO] `withWorkspace()` 동일 구현이 두 스코프에 중복 정의됨
- 위치: (1) `describe('executeInline — Sub-Workflow parent linking')` 블록 내 `withWorkspace` 헬퍼, (2) diff hunk `@@ -12384` 이하 `_callStack` 테스트 케이스 내 인라인 직접 변수 할당 (`context.variables = { ...(context.variables ?? {}), __workspaceId: 'ws-1' }`)
- 상세: 동일 로직이 두 곳에 분산 작성된다. 부작용 자체는 없지만, `__workspaceId` 키 명칭이 바뀔 경우 두 곳을 모두 수정해야 하는 유지보수 부담이 생긴다.
- 제안: `_callStack` 테스트가 속한 describe 에도 동일 `withWorkspace` 헬퍼를 도입하거나, 파일 최상위 헬퍼로 승격하여 중복을 제거한다.

### [INFO] `mockWorkflow` 에 `workspaceId: 'ws-1'` 추가 — 전체 테스트 픽스처의 기본 workspace 고정
- 위치: `execution-engine.service.spec.ts`, diff hunk `@@ -130,6 +130,11 @@`
- 상세: `mockWorkflow` 는 모든 `beforeEach` 마다 `mockWorkflowRepo.findOneBy` 의 기본 반환값으로 쓰인다. `workspaceId: 'ws-1'` 추가는 의도된 변경이며, 명시적으로 `mockResolvedValueOnce` 로 override 하지 않는 모든 테스트의 `findOneBy` 반환에 `workspaceId` 가 포함된다. W-6 fail-closed 검증을 기존 테스트에 통과시키기 위한 필수 수반 변경이다. 향후 `workspaceId` 가 `undefined` 인 edge case 를 검증하는 테스트를 추가할 때 이 기본값을 인지해야 한다.
- 제안: 없음 (의도적 변경, 주석이 충분히 설명함).

### [WARNING] `assertSameWorkspace()` fail-closed 전환 — 미마이그레이션 호출자가 남아 있으면 런타임 차단 발생
- 위치: `execution-engine.service.ts`, diff hunk `@@ -541,21 +541,24 @@` `assertSameWorkspace()` 메서드
- 상세: 변경 전에는 `callerWorkspaceId` 가 `undefined` 이면 warn 로그 후 통과(fail-open)였으나, 변경 후에는 즉시 `WORKFLOW_FORBIDDEN_WORKSPACE` 를 throw 한다. `executeInline` / `executeSync` / `executeAsync` 의 공개 메서드 시그니처 자체는 변경되지 않았으나, 이 세 진입점을 호출하는 핸들러 코드(sub-workflow 노드 핸들러 등)가 `parentWorkspaceId` 또는 `context.variables.__workspaceId` 를 주입하지 않는다면 이전에는 warn 로그만 남고 실행이 계속됐지만 이제는 실패한다. 미마이그레이션 호출자가 한 곳이라도 남아 있으면 프로덕션 장애로 직결된다.
- 제안: 배포 전 로그에서 `[workspace-isolation] Sub-workflow invoked without parentWorkspaceId` 경고가 발생하는 경로가 남아 있는지 확인한다. 관련 핸들러(SubWorkflowHandler 등)의 `parentWorkspaceId` 전달 여부를 별도로 검토한다.

### [INFO] `executeSync` / `executeAsync` 테스트에 `parentWorkspaceId: 'ws-1'` 추가 — 기존 호출자 인터페이스 확인
- 위치: `execution-engine.service.spec.ts`, diff hunk `@@ -1771~1925`
- 상세: `executeSync({ timeoutMs: 0 })` → `executeSync({ timeoutMs: 0, parentWorkspaceId: 'ws-1' })` 변경은 이 메서드의 `options` 타입에 `parentWorkspaceId` 가 이미 존재함을 전제한다. 타입 변경 없이 옵션 필드만 추가하는 방식이므로 기존 호출자(외부 컨트롤러 등)가 `parentWorkspaceId` 를 생략하면 fail-closed 로 인해 차단된다는 점은 [WARNING] 항목과 동일하다. 테스트 파일 자체의 부작용은 없다.
- 제안: 없음 (테스트 변경은 올바름).

## 요약

프로덕션 코드 변경(`assertSameWorkspace` fail-closed 전환)은 `callerWorkspaceId` 가 없는 진입 경로를 이제 명시적으로 차단한다. 이 변경은 보안 강화 목적으로 의도적이며, 공개 메서드 시그니처는 변경되지 않았다. 핵심 부작용 위험은 미마이그레이션 호출자(sub-workflow 핸들러 등)가 `parentWorkspaceId` 를 전달하지 않을 경우 이전 fail-open 경로가 이제 throw 로 바뀐다는 점이다. 이는 의도된 Breaking Change 이지만 배포 전 모든 진입 경로의 마이그레이션 완료 여부를 확인해야 한다. 테스트 파일의 변경은 이 새 제약을 정확히 검증하며, 전역 픽스처(`mockWorkflow.workspaceId`) 추가·`withWorkspace` 헬퍼 중복 이외에 의도하지 않은 부작용은 없다.

## 위험도

LOW
