### 발견사항

**[INFO]** `node-settings-panel.tsx` — `pushUndo`와 `setState`가 별도 호출로 원자성 미보장
- 위치: `node-settings-panel.tsx` `CodeTab.handleSave`, `SettingsTab.handleSave`
- 상세: `useEditorStore.getState().pushUndo()`와 `useEditorStore.setState(...)` 두 번의 별도 store 변이가 발생함. JavaScript 단일 스레드 특성상 실제 race condition은 없지만, 두 호출 사이에 React가 re-render를 트리거할 수 있어 undo 스택과 nodes 상태가 서로 다른 render cycle에서 반영될 수 있음.
- 제안: 두 업데이트를 단일 `setState` 호출로 통합
  ```ts
  useEditorStore.setState((state) => {
    const snapshot = { nodes: [...state.nodes], edges: [...state.edges] };
    return {
      undoStack: [...state.undoStack, snapshot].slice(-MAX_UNDO),
      redoStack: [],
      nodes: state.nodes.map(...),
      isDirty: true,
    };
  });
  ```

**[INFO]** `auth-provider.tsx` — `pathname` 의존성으로 인한 effect 재실행 가능성
- 위치: `auth-provider.tsx:20`, dependency array
- 상세: `pathname`이 의존성 배열에 포함되어 있어 `restoreSession()` 비동기 처리 중 라우트가 변경되면 effect가 재실행됨. `initAttempted.current`가 guard 역할을 하지만, 컴포넌트가 언마운트/리마운트될 경우 ref가 초기화되어 중복 초기화가 발생할 수 있음. 또한 `setLoading`이 의존성 배열에 포함되어 있으나 effect 본문에서 사용되지 않음.
- 제안: `pathname` 의존성 제거(리다이렉트 경로는 ref로 캡처), `setLoading` 제거

**[INFO]** `login-form.tsx` — 로그인 완료 전 페이지 이동으로 인한 상태 공백
- 위치: `login-form.tsx:60-75`
- 상세: `getMe()` 실패 시 `setAuthenticated`가 호출되지 않은 채 `router.push("/dashboard")`가 실행됨. AuthProvider가 재초기화를 시도하지만, 이 사이 짧은 시간 동안 인증 상태 없이 보호된 페이지가 렌더링될 수 있음. `initAttempted.current`가 이미 설정된 경우 AuthProvider가 세션 복구를 시도하지 않을 수 있음.
- 제안: 현재 구조는 의도된 설계로 보이나, `getMe()` 실패 시 `initAttempted.current`를 재설정하거나, 에러 시 네비게이션을 지연하는 방어 로직 추가 고려

**[INFO]** `editor-store.ts` — edges 필터링 내 중복 연산
- 위치: `editor-store.ts` `onNodesChange` 내 edges 필터 콜백
- 상세: `filteredChanges.filter(c => c.type === "remove").map(c => c.id)`가 edges 배열의 각 원소마다 반복 실행됨 (O(n × m)). 동시성 문제는 아니지만, Zustand set 콜백 내에서 불필요한 반복 연산이 발생함.
- 제안: 콜백 외부에서 `removedIds`를 Set으로 미리 계산
  ```ts
  const removedIds = new Set(filteredChanges.filter(c => c.type === "remove").map(c => c.id));
  edges: state.edges.filter(e => !removedIds.has(e.source) && !removedIds.has(e.target)),
  ```

---

### 요약

전체 변경사항은 동시성 관점에서 심각한 이슈가 없습니다. 백엔드(`UsersController`, SQL 마이그레이션)는 stateless 읽기 전용 핸들러와 단일 DDL로 공유 상태 접근이 없으며, 프론트엔드는 Zustand의 단일 스레드 JavaScript 환경과 React의 단방향 데이터 흐름을 따르고 있습니다. 다만 `node-settings-panel`의 이중 store 변이, `auth-provider`의 `pathname` 의존성으로 인한 effect 재실행 가능성, 로그인 직후 상태 공백 등 소규모 async 패턴 개선 여지가 있습니다.

### 위험도
**LOW**