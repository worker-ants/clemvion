### 발견사항

- **[INFO]** `RoleGate`를 테이블 row 반복문 내에서 인스턴스화
  - 위치: `schedules/page.tsx` (schedule row map), `triggers/page.tsx` (trigger row map)
  - 상세: `RoleGate`가 각 row마다 별도 컴포넌트 인스턴스로 마운트되어, 내부에서 `useHasRole` → Zustand store 셀렉터를 row 수만큼 호출함. PAGE_SIZE=20 기준 20개의 store 구독이 생성됨. 역할은 세션 내내 거의 변하지 않는 값이므로, 구독을 N개 유지하는 것은 컴포넌트 트리를 불필요하게 깊게 만든다.
  - 제안: 페이지 컴포넌트 최상단에서 `const canEdit = useHasRole('editor')`를 한 번 읽고, row 내부에서는 `{canEdit && <Button>...</Button>}`으로 처리하여 store 구독을 N→1로 줄인다.

- **[INFO]** `@UseGuards(RolesGuard)`를 클래스 레벨에 적용 → 읽기 전용 엔드포인트도 가드 실행
  - 위치: `auth-configs.controller.ts:44`, `folders.controller.ts:42`
  - 상세: `findAll`, `findOne`, `getUsage`에는 `@Roles()` 데코레이터가 없으나 RolesGuard가 매 요청마다 실행됨. 가드 내부에서 `reflector.getAllAndOverride(ROLES_KEY, [...])` 결과가 `undefined`이면 즉시 통과하는 패턴이 구현되어 있다면 추가 비용은 Reflector 메타데이터 조회 1회(수μs)로 무시 가능한 수준.
  - 제안: 현재 RolesGuard 구현이 이미 fast-path를 포함한다면 무시해도 됨. 만약 role 조회를 위해 DB를 매번 조회하는 경우라면 읽기 메서드에 `@Roles()` 없을 때 DB 조회를 스킵하는 분기 확인 필요.

- **[INFO]** `editor-toolbar.tsx`에서 `useHasRole` 직접 호출과 `RoleGate` 혼용
  - 위치: `editor-toolbar.tsx:57` (`canEdit`), `editor-toolbar.tsx:291, 397` (`RoleGate`)
  - 상세: `canEdit = useHasRole("editor")`를 별도 호출하면서 `<RoleGate minRole="editor">`도 3회 사용. RoleGate 내부에서 `useHasRole`을 재호출하면 동일 값을 4회 셀렉팅함. Zustand 셀렉터는 참조 동일성으로 메모이제이션되어 실제 CPU 비용은 무시 가능하나, 일관성 면에서 `canEdit` boolean을 직접 조건부 렌더링에 사용하면 컴포넌트 트리가 단순해짐.
  - 제안: `canEdit`이 이미 존재하므로 `<RoleGate>`를 `{canEdit && (...)}` 형태로 대체하면 불필요한 컴포넌트 래핑을 제거할 수 있음.

- **[INFO]** `structured?.config ?? undefined` 중복 표현 제거
  - 위치: `execution-engine.service.ts:1514`
  - 상세: 기존 코드에 있던 `as Record<string, unknown> | undefined` 타입 캐스트를 제거한 변경으로, 런타임 동작과 성능은 동일함. `?? undefined` 자체도 `null`을 `undefined`로 정규화하는 용도이나 실행 비용은 0에 가까움. 성능 영향 없음.

---

### 요약
이번 변경은 RBAC 가드 추가와 UI 권한 제어 적용이 목적이며 전반적인 성능 영향은 미미하다. RolesGuard 클래스 레벨 적용은 기존 JWT 인증 가드와 동일한 패턴으로 허용 가능한 수준이고, Reflector 메타데이터 조회는 수μs 내로 완료된다. 가장 눈에 띄는 개선 여지는 테이블 row 내 `RoleGate` 반복 인스턴스화로, 페이지 레벨에서 역할을 한 번만 읽어 boolean으로 전달하면 Zustand 구독 수를 줄이고 컴포넌트 트리를 단순화할 수 있다. 단, 페이지 당 최대 20개 row라는 현실적 규모에서 이 차이가 체감 성능에 미치는 영향은 거의 없다.

### 위험도
**LOW**