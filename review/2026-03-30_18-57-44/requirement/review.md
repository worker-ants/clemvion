### 발견사항

**[WARNING]** `AuthProvider`에서 로딩 중 children 렌더링 제어 로직 오류
- 위치: `auth-provider.tsx:50-56`
- 상세: `isLoading`이 초기값 `false`이면 세션 복원 시도 전에 `children`이 즉시 렌더링됨. `initAttempted.current`가 설정되기 전에 인증 없이 보호된 페이지가 잠깐 노출될 수 있음. `isLoading`을 초기 `true`로 설정하거나 `initAttempted` 상태를 반영해야 함.
- 제안: `useAuthStore`의 `isLoading` 초기값을 `true`로 설정하거나 `AuthProvider` 내부에서 초기화 완료 전까지 로딩 스피너를 표시

**[WARNING]** `login-form.tsx`에서 유저 프로필 fetch 실패 시 silent 처리
- 위치: `login-form.tsx:62-70`
- 상세: 로그인 성공 후 `usersApi.getMe()` 실패 시 빈 catch로 무시하고 `/dashboard`로 이동함. 이 경우 `useAuthStore`의 `user`가 `null`인 채로 앱이 동작하며, `AuthProvider`에서도 `isAuthenticated`가 `true`이면 세션 복원을 시도하지 않으므로 사용자 정보 없이 UI가 렌더링될 수 있음.
- 제안: getMe 실패 시 `setAuthenticated` 호출을 건너뛰거나, `AuthProvider`에서 `user === null && isAuthenticated` 케이스를 처리

**[WARNING]** `WorkflowCanvas`에서 키보드 삭제 시 undo 스택 관리 불일치
- 위치: `editor-store.ts:60-90`, `workflow-canvas.tsx:75-80`
- 상세: `deleteKeyCode={["Delete", "Backspace"]}`로 ReactFlow 내장 삭제를 활성화했으나, `onNodesChange`에서 `remove` 타입 변경 시 undo 스택을 push하는 로직과 컨텍스트 메뉴의 `removeNode` 호출 시 `pushUndo()`를 별도로 호출하는 경로가 이중으로 존재함. 컨텍스트 메뉴 삭제는 `removeNode` → `pushUndo` + `onNodesChange(remove)` → 또 `pushUndo`가 발생할 수 있음.
- 제안: `removeNode` 내부에서는 `pushUndo`를 호출하지 않고 `onNodesChange`의 remove 처리에서만 undo를 관리하거나, 반대로 `onNodesChange`에서 remove 시 undo를 push하지 않도록 일원화

**[WARNING]** `NodeSettingsPanel`의 `SettingsTab`에서 노드 전환 시 config 상태 미동기화
- 위치: `node-settings-panel.tsx:113`
- 상세: `key={selectedNodeId}`로 컴포넌트를 리셋하지만 `nodeConfig` 초기값이 `nodeData.config ?? {}`로 설정됨. 저장되지 않은 상태에서 다른 노드로 전환 후 돌아오면 변경사항이 유실되는데, 이는 의도된 동작인지 스펙에서 확인 필요.
- 제안: 의도된 동작이라면 저장 전 이탈 시 경고 표시 검토

**[INFO]** `AuthProvider`에서 `setLoading` 의존성 배열 포함이나 실제 미사용
- 위치: `auth-provider.tsx:44`
- 상세: `useEffect` 의존성 배열에 `setLoading`이 포함되어 있으나 `restoreSession` 함수 내부에서 `setLoading`을 호출하지 않음. `isLoading` 상태가 갱신되지 않아 로딩 스피너가 표시되지 않을 수 있음.
- 제안: `restoreSession` 시작 시 `setLoading(true)`, 완료/실패 시 `setLoading(false)` 호출 추가

**[INFO]** `NodeConfigRenderer`에서 `manual_trigger` 노드 타입에 대한 config 컴포넌트 없음
- 위치: `node-configs/index.tsx` switch 문
- 상세: `SettingsTab`에서 `manual_trigger` 타입의 경우 `isTrigger` 판별로 error handling/disabled 필드를 숨기지만, `NodeConfigRenderer`의 switch에 `manual_trigger` case가 없어 `null` 반환. 이는 현재 스펙상 의도된 동작일 수 있으나 명시적 처리가 없음.
- 제안: `case "manual_trigger": return null;` 명시적 추가로 의도 명확화

**[INFO]** `CodeTab`에서 저장 시 settings 탭의 label/isDisabled/notes/errorPolicy 값 덮어쓰기
- 위치: `node-settings-panel.tsx:237-251`
- 상세: Code 탭에서 JSON을 적용하면 `config` 전체를 교체하므로 Settings 탭에서 설정한 `notes`, `errorPolicy`가 사라짐. 두 탭이 동일한 `config` 객체를 다루면서 서로의 변경을 덮어쓸 수 있음.
- 제안: CodeTab 저장 시 `{ ...currentConfig, ...parsed }` 병합 방식 사용하거나 두 탭의 저장 범위를 명확히 분리

---

### 요약

핵심 기능(인증 상태 복원, 노드 삭제/설정, 사용자 프로필 API)은 대체로 요구사항을 충족하지만, `AuthProvider`의 초기 로딩 상태 관리가 미완성으로 인증 없이 보호된 페이지가 순간 노출될 수 있고, 로그인 후 사용자 정보 fetch 실패를 silent 처리하여 `user === null` 상태로 앱이 동작할 수 있다. 또한 키보드 삭제와 컨텍스트 메뉴 삭제 간 undo 스택 관리 경로가 이중화되어 있으며, Code 탭과 Settings 탭이 동일한 config 객체를 독립적으로 덮어쓰는 구조적 문제가 존재한다.

### 위험도
**MEDIUM**