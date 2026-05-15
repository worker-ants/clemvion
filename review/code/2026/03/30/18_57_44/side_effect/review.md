### 발견사항

---

**[WARNING] `AuthProvider` — 무한 리다이렉트 루프 가능성**
- 위치: `auth-provider.tsx:40-44`
- 상세: `restoreSession` 실패 시 `router.replace('/login?redirect=...')` 호출 후 `logout()`으로 `isAuthenticated`가 변경됨. 그런데 `/login` 페이지에도 `AuthProvider`가 wrapping되어 있다면 동일 로직이 재실행될 수 있음. `initAttempted` ref로 1회 방어하고 있으나, SSR hydration 후 ref가 리셋되는 경우 루프 발생 가능.
- 제안: `/login` 경로는 `AuthProvider` 외부에 두거나, `pathname.startsWith('/login')` 체크로 초기화 로직 스킵

---

**[WARNING] `AuthProvider` — `setLoading` 의존성 선언 후 실제 미사용**
- 위치: `auth-provider.tsx:16, 41`
- 상세: `setLoading`을 store에서 가져와 `useEffect` 의존성 배열에 포함시켰으나 `restoreSession` 내부에서 실제로 호출하지 않음. `isLoading` 상태가 세션 복원 중에도 갱신되지 않아, `isLoading && !isAuthenticated` 조건의 로딩 스피너가 표시되지 않음.
- 제안: `restoreSession` 시작 시 `setLoading(true)`, 완료 후 `setLoading(false)` 호출 추가

---

**[WARNING] `onNodesChange` — 엣지 필터링에서 `removedIds` 재계산 중복**
- 위치: `editor-store.ts:71-76`
- 상세: `edges` 필터링 내부 콜백에서 매 엣지마다 `filteredChanges.filter(c => c.type === 'remove').map(c => c.id)`를 반복 실행함. 엣지 수가 많을 경우 O(n×m) 연산 발생. 의도하지 않은 성능 부작용.
- 제안: `const removedIds = new Set(filteredChanges.filter(...).map(...))` 를 필터 외부로 추출 후 `removedIds.has(e.source)` 로 변경

---

**[WARNING] `WorkflowCanvas` — `deleteKeyCode` 활성화로 ReactFlow 내장 삭제 동작 복원**
- 위치: `workflow-canvas.tsx:172`
- 상세: 기존 `deleteKeyCode={null}`에서 `["Delete", "Backspace"]`로 변경함. `onNodesChange`에서 `manual_trigger` 노드의 `remove` change를 필터링하므로 트리거 삭제는 막히지만, 엣지 삭제는 `onEdgesChange`를 통해 제한 없이 실행됨. 의도된 동작인지 확인 필요.
- 제안: 엣지 삭제 동작이 의도된 것이라면 무관. 아니라면 `onEdgesChange`에도 보호 로직 추가 검토

---

**[INFO] `LoginForm` — 로그인 성공 후 user fetch 실패 시 accessToken만 설정된 채 라우팅**
- 위치: `login-form.tsx:62-70`
- 상세: `usersApi.getMe()` 실패 시 catch 블록이 아무 처리 없이 넘어가고 `router.push('/dashboard')` 실행됨. `setAuthenticated`가 호출되지 않아 auth store에 user 정보 없이 인증된 것처럼 동작. `AuthProvider`가 복원을 담당하므로 기능상 문제는 없으나, 첫 렌더에서 user가 null인 상태가 잠깐 노출될 수 있음.
- 제안: catch 블록에서 `setLoading(false)` 또는 `AuthProvider`가 즉시 복원할 수 있도록 흐름 명확화

---

**[INFO] `Sidebar` — `handleLogout`이 async이지만 오류 시 logout/redirect는 항상 실행**
- 위치: `sidebar.tsx:50-56`
- 상세: API logout 실패를 catch하고 클라이언트 logout을 강제 실행하는 의도는 올바름. 다만 `router.push('/login')` 이후 컴포넌트가 unmount될 경우 `logout()` store 액션의 상태 업데이트가 리액트 경고를 유발할 수 있음.
- 제안: `logout()` → `router.push('/login')` 순서로 변경 (store 업데이트 선행 후 라우팅)

---

**[INFO] `NodeSettingsPanel` — `SettingsTab`에서 `nodeConfig`와 `CodeTab`의 JSON이 분리된 상태 관리**
- 위치: `node-settings-panel.tsx:SettingsTab, CodeTab`
- 상세: Settings 탭에서 저장한 config와 Code 탭에서 JSON으로 직접 편집한 config가 각자 독립된 로컬 state로 관리됨. 한 탭에서 저장 후 다른 탭으로 전환하면 최신 상태가 반영되지 않는 부작용 발생 가능.
- 제안: 두 탭이 store에서 직접 config를 읽어오도록 단일 소스 유지 또는 탭 전환 시 store에서 재초기화

---

**[INFO] `users.module.ts` — `UsersController` 등록으로 전역 라우팅 변경**
- 위치: `users.module.ts:7`
- 상세: `GET /users/me` 엔드포인트가 새로 노출됨. 기존에 없던 라우트가 추가되는 것이므로 부작용 범위는 제한적이나, 글로벌 인증 가드 적용 여부에 따라 의도치 않은 접근 허용 가능성 존재. (`@UseGuards(JwtAuthGuard)` 컨트롤러 레벨 적용으로 해소됨)

---

### 요약

가장 주목할 부작용은 `AuthProvider`의 `setLoading` 미호출로 인한 로딩 스피너 미표시와, 세션 복원 실패 시 `/login` 페이지가 `AuthProvider` 내부에 포함되어 있을 경우 발생할 수 있는 리다이렉트 루프 가능성이다. `editor-store.ts`의 엣지 필터링 내 `removedIds` 중복 계산은 성능 부작용이나 현실적인 노드 수에서는 미미하다. `SettingsTab`과 `CodeTab`의 분리된 config 상태 관리는 탭 전환 시 변경사항 손실을 야기할 수 있는 UX 부작용이다. `deleteKeyCode` 재활성화로 인한 엣지 삭제 동작 복원은 의도 확인이 필요하다. 전반적으로 전역 상태 오염이나 파일시스템/네트워크 의도치 않은 호출은 없으며, 공개 API 시그니처 변경도 없다.

### 위험도
**MEDIUM** — `AuthProvider` 리다이렉트 루프 및 `isLoading` 미갱신이 인증 흐름에 실질적 영향을 줄 수 있음