### 발견사항

- **[INFO]** 새로운 외부 패키지 없음 — 기존 패키지만 활용
  - 위치: 전체 변경 파일
  - 상세: `@nestjs/common`, `@nestjs/core`, `@nestjs/swagger`는 이미 프로젝트에 있는 패키지. `ApiForbiddenResponse`도 `@nestjs/swagger`에 포함된 심볼이므로 추가 설치 없음.
  - 제안: 현행 유지

- **[INFO]** `RoleGate` + `useHasRole`을 같은 모듈에서 혼용
  - 위치: `editor-toolbar.tsx`
  - 상세: 워크플로우 이름 인라인 편집 여부는 `useHasRole("editor")` 훅으로, Save 버튼·Delete 메뉴는 `<RoleGate>` 컴포넌트로 각각 처리. 두 방법 모두 `@/components/auth/role-gate` 한 모듈에서 export되므로 의존성은 단일 진입점이지만, 접근 방식이 달라 패턴 일관성이 약함.
  - 제안: 분기 렌더링이 간단할 때는 `useHasRole` 훅, 조건부 서브트리 wrapping에는 `<RoleGate>`를 쓰는 것은 실무상 합리적. 다만 팀 컨벤션으로 명문화해두면 유지보수 시 혼선을 줄일 수 있음.

- **[INFO]** 테스트에서 Zustand 스토어를 직접 조작 (`useWorkspaceStore.setState`)
  - 위치: `schedules-page.test.tsx`, `triggers-page.test.tsx`, `editor-toolbar-rbac.test.tsx`
  - 상세: Zustand의 `setState`를 테스트에서 직접 호출하는 방식은 스토어 내부 shape(필드명, 구조)에 결합됨. 스토어 리팩터링 시 테스트가 묵시적으로 깨질 수 있음. 특히 `editor-toolbar-rbac.test.tsx`에서 `useWorkspaceStore.getState().reset()` 호출은 `reset` 액션이 스토어에 실제로 존재하는지 여부에 의존.
  - 제안: `reset` 액션 존재 여부를 확인하거나, `beforeEach`에서 `setState({ workspaces: [], currentWorkspaceId: null, loaded: false })` 방식으로 대체하는 것도 검토.

- **[INFO]** `RolesGuard`를 컨트롤러 레벨에서 `@UseGuards(RolesGuard)`로 선언
  - 위치: `auth-configs.controller.ts:43`, `folders.controller.ts:39`
  - 상세: 기존 다른 컨트롤러들도 동일 패턴을 사용하므로 일관성은 있음. 다만 컨트롤러 단위 등록 방식은 `AppModule` 또는 `main.ts`에서 전역 등록하는 패턴에 비해 각 컨트롤러가 `roles.guard`에 직접 결합됨. 프로젝트 전체 패턴이 컨트롤러 단위 등록으로 통일돼 있으면 문제 없음.
  - 제안: 현행 패턴 유지. 단, 향후 guard 교체·확장 시 수정 대상이 많아질 수 있으므로 전역 등록 방식으로 마이그레이션 가능성을 프로젝트 표준에 기록해 둘 것.

---

### 요약

이번 변경에서 **새로운 외부 의존성은 전혀 추가되지 않았다.** 백엔드는 기존 `@nestjs/common`, `@nestjs/swagger`의 이미 설치된 심볼(`UseGuards`, `ApiForbiddenResponse`)을 추가로 사용하고, 내부 공통 모듈 `../../common/guards/roles.guard`를 auth-configs·folders 컨트롤러에 일관되게 연결했다. 프론트엔드도 기존에 정의된 `@/components/auth/role-gate`와 `@/lib/stores/workspace-store`만 참조한다. 내부 모듈 의존 방향이 공통 레이어(`guards`, `role-gate`, `workspace-store`) → 기능 레이어로 단방향을 유지하고 있어 구조적으로 적절하다. 테스트에서 Zustand 스토어를 직접 조작하는 부분은 스토어 shape 변경 시 잠재적 깨짐 지점이 될 수 있으나, 현재 수준에서는 허용 가능한 관행이다.

### 위험도

**LOW**