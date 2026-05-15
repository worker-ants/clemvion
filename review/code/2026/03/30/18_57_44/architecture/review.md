### 발견사항

---

**[WARNING]** `AuthProvider`가 라우팅 로직을 직접 담당 — 책임 혼재
- 위치: `auth-provider.tsx:42-44`
- 상세: `AuthProvider`는 인증 상태 복원 컴포넌트이나, 세션 복원 실패 시 직접 `router.replace`로 리다이렉트를 수행. 라우팅 정책이 레이아웃 컴포넌트와 `AuthProvider` 양쪽에 분산될 경우 일관성 유지가 어려움. 인증 가드는 일반적으로 미들웨어(`middleware.ts`) 또는 별도 `RouteGuard`에서 처리
- 제안: Next.js `middleware.ts`에서 쿠키 기반 세션 검증을 처리하거나, 리다이렉트 로직을 `AuthProvider`에서 분리하여 호출 측(layout)에 위임

---

**[WARNING]** `SettingsTab`이 `useEditorStore.getState()`를 직접 호출 — 레이어 우회
- 위치: `node-settings-panel.tsx:130-147`
- 상세: `handleSave` 내부에서 `useEditorStore.getState().pushUndo()`와 `useEditorStore.setState(...)`를 직접 호출. 컴포넌트가 스토어의 내부 구조에 직접 의존하여 프레젠테이션 레이어가 상태 관리 레이어를 우회함. 동일 패턴이 `CodeTab`에도 반복됨
- 제안: `editorStore`에 `saveNodeSettings(id, data)` 액션을 정의하고 컴포넌트는 해당 액션만 호출

---

**[WARNING]** `onNodesChange`의 엣지 삭제 로직 — 스토어에 도메인 로직 중복
- 위치: `editor-store.ts:67-84`
- 상세: `onNodesChange` 핸들러가 노드 삭제 시 연결된 엣지까지 직접 계산하여 필터링. ReactFlow의 `deleteKeyCode` 활성화와 `onNodesChange`의 수동 엣지 삭제가 공존하여 삭제 경로가 두 곳으로 분기됨 (`removeNode` 액션 vs `onNodesChange`의 remove 처리). 삭제 시 엣지 정리 책임이 단일하지 않음
- 제안: `removeNode` 액션에 엣지 정리를 통합하고 `onNodesChange`의 remove 처리는 해당 액션에 위임

---

**[INFO]** `NodeConfigRenderer`의 switch-case — OCP 위반 가능성
- 위치: `node-configs/index.tsx:55-100`
- 상세: 노드 타입이 추가될 때마다 `switch-case`에 새 분기를 추가해야 함. 현재 노드 수가 30개 이상이며 향후 확장 시 파일이 비대해짐. 그러나 노드 정의(`node-definitions`)가 이미 존재하므로 해당 정의에 config 컴포넌트를 포함시킬 수 있음
- 제안: `getNodeDefinition(type).configComponent` 형태로 노드 정의에 config 컴포넌트를 등록하거나, `Record<string, ComponentType>` 맵으로 교체하여 신규 노드 추가 시 단일 파일만 수정하도록

---

**[INFO]** `LoginForm`에서 직접 `usersApi.getMe()` 호출 — 인증 플로우 분산
- 위치: `login-form.tsx:60-68`
- 상세: 로그인 성공 후 사용자 프로필 페치 로직이 `LoginForm`과 `AuthProvider` 양쪽에 존재. `AuthProvider`는 페이지 로드 시 동일한 패턴(refresh → getMe)을 수행하므로 `LoginForm`의 `getMe` 호출은 `AuthProvider`가 처리할 것을 선제적으로 중복 수행함
- 제안: `LoginForm`은 토큰 저장까지만 담당하고 프로필 페치는 `AuthProvider`에 일임. 또는 인증 초기화를 담당하는 단일 `authService.initSession(token)` 함수로 통합

---

**[INFO]** `users.controller.ts`의 응답 직렬화 — 컨트롤러에 변환 책임
- 위치: `users.controller.ts:16-25`
- 상세: RESOLUTION.md에 "현재 단순 엔드포인트이므로 유지" 판단이 기록되어 있어 팀의 의도가 있음. 다만 `locale ?? 'ko'`, `theme ?? 'light'` 기본값 처리가 컨트롤러에 위치하여 비즈니스 규칙이 프레젠테이션 레이어에 혼재
- 제안: 기본값 처리를 `UsersService.findById` 또는 엔티티 레벨로 이동. 컨트롤러는 순수 라우팅/직렬화만 담당

---

**[INFO]** `sidebar.tsx`의 로그아웃 로직 — 컴포넌트에 비즈니스 로직 포함
- 위치: `sidebar.tsx:46-53`
- 상세: `handleLogout`이 API 호출 + 스토어 초기화 + 라우팅을 모두 직접 수행. `LoginForm`의 로그인 로직과 대칭적으로, 인증 관련 부수 효과가 UI 컴포넌트에 직접 작성됨
- 제안: `useAuth()` 훅이나 `authService.logout()` 함수로 추출하여 UI와 인증 로직 분리

---

### 요약

전체적인 레이어 구조(NestJS 백엔드 모듈 분리, Zustand 스토어, React 컴포넌트)는 합리적으로 설계되어 있으나, 인증 플로우(`LoginForm`, `AuthProvider`, `sidebar`)와 에디터 상태 변경(`SettingsTab`의 직접 `setState`, `onNodesChange`의 엣지 정리)에서 책임이 여러 위치로 분산되는 패턴이 반복됨. 특히 `AuthProvider`가 라우팅 정책까지 담당하고, 로그인·로그아웃 흐름이 컴포넌트마다 다른 방식으로 구현되어 있어 인증 레이어의 응집도 개선이 가장 중요한 아키텍처 과제임. `NodeConfigRenderer`의 switch-case는 현재 동작에는 문제없으나 노드 정의와의 결합 전략 수립이 필요하며, 백엔드의 `UsersController`는 기본값 처리 등 소규모 비즈니스 로직이 컨트롤러에 혼재하는 정도로 즉각적 리스크는 낮음.

### 위험도

**LOW**