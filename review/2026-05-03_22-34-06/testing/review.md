### 발견사항

---

**[WARNING] 백엔드 가드는 메타데이터만 검증 — 실제 403 응답 경로 미테스트**
- 위치: `auth-configs.controller.spec.ts:1–44`, `folders.controller.spec.ts:1–31`
- 상세: `Reflector.get()` 방식으로 `@Roles` 데코레이터 존재 여부만 확인. `@UseGuards(RolesGuard)`가 클래스에 적용된 것, 실제로 Viewer 요청 시 HTTP 403이 반환되는지, `RolesGuard` 내부 로직(workspaceId 추출 → DB 조회 → 역할 비교)은 전혀 커버되지 않음.
- 제안: `@nestjs/testing`의 `createTestingModule`을 사용해 guard를 실제로 실행하는 e2e 스타일 테스트 1~2개 추가. 또는 `RolesGuard` 유닛 테스트를 별도 파일로 작성해 403/통과 시나리오를 커버.

---

**[WARNING] `admin`/`owner` 역할 커버리지 전무**
- 위치: 모든 RBAC 테스트 파일
- 상세: 모든 테스트가 `editor`/`viewer` 두 케이스만 검증. PRD 및 plan에 Owner·Admin·Editor·Viewer 4단계가 정의되어 있으나, `admin`이 `editor`와 동일하게 write 가능한지, `owner`가 추가 권한을 갖는지 테스트 없음. 향후 역할 범위 변경 시 회귀 감지 불가.
- 제안: `it.each`의 cases에 `{ method, expected }` 대신 `{ role, method, shouldPass }` 형태로 확장하거나, 별도 `describe('admin role')` 블록 추가.

---

**[WARNING] EditorToolbar "More 메뉴" 테스트의 버튼 인덱스 의존**
- 위치: `editor-toolbar-rbac.test.tsx:103`, `editor-toolbar-rbac.test.tsx:112`
- 상세: `buttons[buttons.length - 1]`로 More 트리거를 식별. 버튼이 하나라도 추가/제거되면 의도와 다른 버튼을 클릭하게 되며, 이 경우 테스트가 false-positive 또는 false-negative를 낼 수 있음.
- 제안: More 버튼에 `aria-label="More options"` 또는 `data-testid="more-menu-trigger"` 추가 후 `screen.getByRole('button', { name: /more/i })` 또는 `screen.getByTestId()`로 조회.

---

**[WARNING] SchedulesPage RBAC: Delete 버튼 가시성 미검증**
- 위치: `schedules-page.test.tsx:152–177` (Viewer 케이스)
- 상세: Viewer 케이스에서 toggle, edit 버튼은 비표시를 확인하지만, delete 버튼(Trash2 아이콘) 비표시 여부는 검증하지 않음. `RoleGate`로 감싸진 delete 버튼이 실수로 해제되어도 이 테스트는 통과.
- 제안: `expect(document.querySelector('button[title*="Delete" i]')).toBeFalsy()` 또는 trash icon을 가진 버튼 부재 검증 추가.

---

**[WARNING] 워크스페이스 스토어 상태가 describe 간 초기화되지 않음**
- 위치: `schedules-page.test.tsx`의 `SchedulesPage — RBAC` describe, `triggers-page.test.tsx`의 `TriggersPage — RBAC` describe
- 상세: 두 RBAC `describe` 블록의 `beforeEach`에서 `setRole` 미호출. 각 `it` 블록이 명시적으로 `setRole`을 호출하지만, 이전 `describe` 블록에서 설정된 `useWorkspaceStore` 상태가 잔류할 수 있음. 테스트 실행 순서에 따라 결과가 달라지는 취약점.
- 제안: RBAC `describe`의 `beforeEach`에도 `useWorkspaceStore.setState({ workspaces: [], currentWorkspaceId: null, loaded: false })` 또는 store reset 추가.

---

**[WARNING] TriggersPage RBAC: edit/delete 버튼 커버리지 부재**
- 위치: `triggers-page.test.tsx:109–161`
- 상세: trigger 상세 드로어(TriggerDetailDrawer)는 mock 처리되었지만, 행별 edit·delete 버튼(만약 존재한다면)에 대한 RBAC 검증 없음. 현재 triggers/page.tsx에 edit 버튼이 없다면 문제없지만, schedules page와 대비해 일관성 관점에서 누락 가능성 점검 필요.
- 제안: 현재 triggers page UI 상 viewer가 접근 가능/불가능한 모든 CUD 액션을 명시적으로 테스트.

---

**[INFO] `useWorkspaceStore.getState().reset()` 존재 여부 미확인**
- 위치: `editor-toolbar-rbac.test.tsx:73`
- 상세: `beforeEach`에서 `useWorkspaceStore.getState().reset()`을 호출하지만, workspace store에 `reset` 메서드가 실제로 정의되어 있는지 확인 불가. 없을 경우 런타임 오류가 발생하며 테스트 전체가 skip됨.
- 제안: workspace-store 정의를 확인해 `reset` 메서드 존재 여부 검증. 없다면 `useWorkspaceStore.setState(initialState)`로 대체.

---

**[INFO] `it.each` 테스트명의 `$expected` 배열 직렬화**
- 위치: `auth-configs.controller.spec.ts:17`, `folders.controller.spec.ts:15`
- 상세: `$expected`가 `string[]`이므로 테스트 이름이 `create 는 @Roles(editor) 로 가드된다`가 아닌 `create 는 @Roles(["editor"]) 로 가드된다`로 출력될 수 있음. 가독성은 낮지만 기능에 영향 없음.
- 제안: `expected: 'editor'` (단일 문자열)로 변경하거나 test name template을 `'$method 는 editor 역할 필요'`로 단순화.

---

**[INFO] `execution-engine.service.ts` 타입 단언 제거 — 테스트 불필요**
- 위치: `execution-engine.service.ts:1514`
- 상세: `structured?.config ?? undefined`에서 `as Record<string, unknown> | undefined` 캐스트를 제거한 순수 스타일 변경. 기능 변화 없음, 기존 테스트 유효.

---

### 요약

RBAC 구현에 대한 테스트 전략은 백엔드 메타데이터 단위 테스트 + 프론트엔드 스토어 조작 방식으로 일관성 있게 구성되었으나, 세 가지 핵심 갭이 존재한다. (1) 백엔드는 데코레이터 존재만 검증하고 실제 HTTP 403 경로를 검증하지 않으며, (2) admin/owner 역할 케이스가 전무해 역할 계층 변경 시 회귀 감지가 불가능하고, (3) 프론트엔드 테스트 일부가 버튼 인덱스·DOM 쿼리 방식에 의존해 구조 변경에 취약하다. 기능적 회귀 리스크는 낮지만, RBAC처럼 보안에 직결되는 기능에서 guard 실행 경로 미테스트는 장기적으로 해소가 필요하다.

### 위험도

**LOW**