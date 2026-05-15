### 발견사항

**[WARNING] `AuthProvider` 컴포넌트 테스트 없음**
- 위치: `frontend/src/components/auth/auth-provider.tsx`
- 상세: 세션 복구 로직(토큰 갱신 → 유저 프로필 조회 → 인증 상태 설정), 로딩 스피너 렌더링, 인증 실패 시 리다이렉트 등 핵심 흐름이 테스트되지 않음. `initAttempted` ref로 중복 실행 방지 로직도 커버되지 않음.
- 제안:
  ```ts
  it('should restore session on mount and set authenticated state')
  it('should redirect to /login when refresh fails')
  it('should not re-attempt init if already authenticated')
  it('should show loading spinner while restoring session')
  ```

**[WARNING] `NodeConfigRenderer` 및 node-configs 컴포넌트 테스트 없음**
- 위치: `frontend/src/components/editor/settings-panel/node-configs/`
- 상세: 30개 이상의 노드 타입별 설정 컴포넌트(`IfElseConfig`, `HttpRequestConfig`, `AiAgentConfig` 등)에 대한 테스트가 전무. 동적 필드 추가/제거(`addCondition`, `removeCategory`), 조건부 렌더링(`responseFormat === "json"` 시 JSONSchema 노출) 등의 로직이 미검증.
- 제안:
  ```ts
  it('should add/remove conditions in IfElseConfig')
  it('should show JSON schema field only when response format is json')
  it('should render null for unknown node types in NodeConfigRenderer')
  ```

**[WARNING] `WorkflowCanvas` 컨텍스트 메뉴 및 삭제 로직 테스트 없음**
- 위치: `frontend/src/components/editor/canvas/workflow-canvas.tsx`
- 상세: `onNodeContextMenu` 상태 전이, `canDeleteNode` 가드(manual_trigger 삭제 방지), `handleContextMenuDelete`, `closeContextMenu` 등 신규 로직이 테스트되지 않음.
- 제안:
  ```ts
  it('should not allow deleting manual_trigger nodes')
  it('should close context menu when clicking outside')
  it('should delete non-trigger node via context menu')
  ```

**[WARNING] `editor-store` `onNodesChange` 신규 로직 테스트 없음**
- 위치: `frontend/src/lib/stores/editor-store.ts`
- 상세: manual_trigger remove 변경 필터링, remove 시 연결 엣지 동시 제거, undo 스냅샷 생성, `selectedNodeId` 초기화 로직이 스토어 단위 테스트로 검증되지 않음.
- 제안:
  ```ts
  it('should filter out remove changes for manual_trigger nodes')
  it('should remove connected edges when a node is deleted')
  it('should push undo snapshot on node removal')
  it('should clear selectedNodeId when selected node is removed')
  ```

**[WARNING] `sidebar.tsx` 로그아웃 및 유저 메뉴 로직 테스트 없음**
- 위치: `frontend/src/components/layout/sidebar.tsx`
- 상세: `handleLogout`(API 실패 시 클라이언트 로그아웃 진행), 외부 클릭 감지(`handleClickOutside`), 유저 이니셜/이름 표시 등이 테스트되지 않음.
- 제안:
  ```ts
  it('should logout and redirect to /login even when API fails')
  it('should close user menu when clicking outside')
  it('should display user initial and name from auth store')
  ```

**[INFO] `users.controller.spec.ts` - `mockUser` 모듈 수준 생성**
- 위치: `users.controller.spec.ts:12-21`
- 상세: `mockUser`가 `beforeEach` 외부에서 생성되어 테스트 간 변경 시 오염 위험 있음. 현재는 불변 객체라 실질적 문제는 없으나, 가변 필드가 추가될 경우 취약해짐.
- 제안: `const mockUser = () => ({ ... })` 팩토리 함수로 분리하거나 `beforeEach` 내부로 이동.

**[INFO] `login-form.tsx` - 유저 프로필 조회 실패 시 silent catch 테스트 부재**
- 위치: `frontend/src/components/auth/login-form.tsx:63-70`
- 상세: 로그인 성공 후 `usersApi.getMe()` 실패 시 인증 상태 미설정 채로 대시보드로 이동하는 동작이 의도적이지만(AuthProvider가 복구) 테스트로 명시적으로 검증되지 않음.

**[INFO] `node-configs/shared.tsx` - `CheckboxField` id 충돌 가능성**
- 위치: `frontend/src/components/editor/settings-panel/node-configs/shared.tsx:111`
- 상세: `id = cb-${label.toLowerCase()}` 로 생성 시 동일 레이블이 다른 컴포넌트에 존재하면 DOM id 충돌. 테스트 환경에서도 레이블 기반 접근자가 의도치 않은 요소를 참조할 수 있음.

---

### 요약

백엔드 `UsersController` 테스트(`users.controller.spec.ts`)는 정상 케이스, 민감 필드 제외, NotFoundException, 서비스 예외 전파, locale/theme 기본값 등 핵심 시나리오를 충실히 커버하고 있어 양호하다. 반면 프론트엔드 측은 이번에 추가된 `AuthProvider`, 노드 타입별 설정 컴포넌트(30+ 케이스), 컨텍스트 메뉴 기반 삭제 로직, `editor-store` 신규 필터링 로직, 사이드바 로그아웃 플로우 등 기능적으로 중요한 코드 경로에 테스트가 전혀 없는 상태다. 특히 `AuthProvider`의 세션 복구 로직과 `onNodesChange` 필터링은 애플리케이션의 핵심 동작에 직결되므로 테스트 보완이 우선 필요하다.

### 위험도
**MEDIUM**