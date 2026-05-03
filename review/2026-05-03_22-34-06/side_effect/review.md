## 부작용 코드 리뷰

### 발견사항

---

**[WARNING]** `@UseGuards(RolesGuard)` 컨트롤러 레벨 적용 시 passthrough 동작 의존
- 위치: `auth-configs.controller.ts:42`, `folders.controller.ts:39`
- 상세: `RolesGuard`가 클래스 레벨에 선언되면 `@Roles()` 데코레이터가 없는 메서드(`findAll`, `findOne`, `getUsage`)에도 가드가 실행된다. 현재 구현이 `ROLES_KEY`가 `undefined`일 때 `return true`(passthrough)로 동작한다는 전제가 성립해야 한다. 만약 RolesGuard 구현이 변경되거나 기본 차단 방향으로 바뀌면 읽기 전용 엔드포인트가 갑자기 막힌다.
- 제안: `roles.guard.ts` 내 `if (!requiredRoles) return true;` 분기를 단위 테스트로 명시적으로 커버하거나, 읽기 메서드에 `@Roles()` 없음이 곧 "all authenticated"임을 주석으로 고정한다.

---

**[WARNING]** RBAC 테스트 `beforeEach`에서 Zustand 스토어 미초기화
- 위치: `schedules-page.test.tsx:61-70`, `triggers-page.test.tsx:65-74` (RBAC describe 블록)
- 상세: 페이지네이션 `describe`의 `beforeEach`는 `setRole("editor")`를 호출하지만, RBAC `describe`의 `beforeEach`에는 `useWorkspaceStore` 리셋 호출이 없다. 각 RBAC 테스트 내부에서 `setRole()`을 먼저 호출하므로 정상 통과하지만, 테스트 실패로 `setRole()` 호출 전에 어보트되거나 병렬 실행 시 이전 describe 블록의 스토어 상태가 잔존할 수 있다. `editor-toolbar-rbac.test.tsx`는 `beforeEach`에서 `useWorkspaceStore.getState().reset()`을 올바르게 호출하고 있어 일관성 불일치가 있다.
- 제안: RBAC describe의 `beforeEach`에 `useWorkspaceStore.setState({ workspaces: [], currentWorkspaceId: null, loaded: false })` 또는 `reset()` 호출 추가.

---

**[WARNING]** `EditorToolbar`에서 역할 체크 메커니즘 이중화
- 위치: `editor-toolbar.tsx:57` (`canEdit = useHasRole("editor")`), `editor-toolbar.tsx:295` (`<RoleGate minRole="editor">`)
- 상세: 이름 인라인 편집은 `canEdit` 불리언으로, Save/Delete는 `<RoleGate>`로 각각 다른 방식으로 처리된다. 두 메커니즘이 동일한 `useHasRole` 기반이므로 현재 동작은 동일하지만, 역할 위계 로직이 바뀌면 한 곳만 업데이트되는 드리프트 위험이 있다.
- 제안: 이름 편집도 `<RoleGate>`로 통일하거나, 반대로 모두 `canEdit` 변수로 통일하여 단일 메커니즘을 유지.

---

**[INFO]** `structuredConfig` 타입 어서션 제거
- 위치: `execution-engine.service.ts:1514`
- 상세: `as Record<string, unknown> | undefined` 캐스트 제거는 런타임 동작에 영향 없다. 다만 `structured.config`의 원본 타입이 더 넓은 타입(예: `unknown`)이라면 `structuredConfig`를 하위에서 `Record<string, unknown>`으로 인덱싱하는 코드에서 TypeScript 오류가 새로 발생할 수 있다. 빌드가 통과했다면 실제 타입이 이미 호환 가능한 것이므로 INFO 수준.
- 제안: `structured.config`의 선언 타입을 확인하여 원본에서 이미 `Record<string, unknown>`임을 보장하는 것이 더 명시적.

---

**[INFO]** `cleanup()` 호출 위치가 `beforeEach` 말미
- 위치: `schedules-page.test.tsx:63`, `triggers-page.test.tsx:67`
- 상세: `cleanup()`이 `beforeEach` 마지막에서 이전 테스트의 DOM을 정리한다. 기능적으로 문제없지만 관례상 `afterEach`나 `beforeEach` 첫 줄에 두는 것이 가독성이 높다. `editor-toolbar-rbac.test.tsx`는 `beforeEach` 첫 줄에 `cleanup()`을 올바르게 배치하고 있어 일관성이 없다.

---

**[INFO]** `execution-engine.service.ts` 포맷팅 변경
- 위치: `execution-engine.service.ts:1770-1773`
- 상세: 순수 Prettier 포맷 변경. 의미적 차이 없음.

---

### 요약

이번 변경의 핵심은 NestJS 컨트롤러 2개(`auth-configs`, `folders`)에 `RolesGuard` + `@Roles('editor')` 추가, 프론트엔드 3개 페이지(schedules, triggers, editor-toolbar)에 `RoleGate` 적용이다. 부작용 관점에서 가장 주의할 지점은 컨트롤러 레벨 가드가 `@Roles()` 없는 읽기 메서드에 passthrough를 보장하는지에 대한 명시적 계약 부재이며, 현재 테스트가 이를 간접적으로 검증하고 있어 LOW 위험으로 관리된다. Zustand 스토어 상태 누수 가능성은 테스트 실패 시 디버깅을 어렵게 만들 수 있으나 정상 실행 시에는 문제없다. 런타임 로직 변경 없이 타입 어서션만 제거된 execution-engine 변경은 부작용 없음. 전반적으로 의도하지 않은 상태 변경·전역 변수·네트워크 호출 부작용은 없다.

### 위험도

**LOW**