### 발견사항

---

**[WARNING] RolesGuard 역할 계층 미검증 — Admin/Owner 차단 가능성**
- 위치: `auth-configs.controller.ts` L44, `folders.controller.ts` L42
- 상세: `@Roles('editor')` 메타데이터로 가드가 설정되었으나, `RolesGuard`가 `['editor']` 배열을 정확 일치(exact match)로 처리한다면 Admin·Owner 사용자는 모든 write 엔드포인트에서 403을 받게 된다. 역할 계층(`viewer < editor < admin < owner`)이 `RolesGuard` 내부에서 처리되는지 이번 diff에서 확인이 불가하다.
- 제안: `roles.guard.ts`에서 `ROLE_HIERARCHY`(또는 유사 구조)를 통해 `owner/admin`이 `editor` 요건을 만족하는 경로가 구현되어 있는지 확인. 컨트롤러 spec 테스트는 메타데이터 존재만 검증하므로 계층 검증 단위 테스트가 별도로 필요하다.

---

**[WARNING] schedules 페이지 Viewer 테스트 — Delete 버튼 비표시 실제 검증 불가**
- 위치: `schedules-page.test.tsx` L155~169 (Viewer RBAC it 블록)
- 상세: 테스트 설명은 "Add schedule·toggle·**edit·delete** 모두 비표시"라고 명시하지만, `page.tsx`의 Delete 버튼에는 `title` 속성이 없다. Edit 버튼(`title={t("schedules.editTooltip")}`)은 `title*="Edit"` 셀렉터로 검증되지만 Delete(`<Trash2>` 아이콘 버튼)는 아무 검증 없이 통과된다. 즉, Delete 버튼이 실수로 `RoleGate` 밖으로 빠지더라도 테스트는 계속 통과한다.
- 제안: `page.tsx`의 Delete 버튼에 `title={t("schedules.deleteTooltip")}` 속성을 추가하거나, 렌더 결과 내 Trash2 아이콘(`data-testid` 혹은 `aria-label`)을 이용해 존재 여부를 명시적으로 assert한다.

---

**[WARNING] `useWorkspaceStore.getState().reset()` — 스토어에 reset 메서드 존재 여부 미확인**
- 위치: `editor-toolbar-rbac.test.tsx` L74
- 상세: 테스트의 `beforeEach`에서 `useWorkspaceStore.getState().reset()`을 호출하지만, workspace-store에 `reset` 메서드가 정의되어 있는지 이번 diff에서 확인할 수 없다. 해당 메서드가 없으면 테스트는 런타임 오류로 즉시 실패한다.
- 제안: `useWorkspaceStore` 정의에 `reset: () => set(initialState)` 형태의 메서드가 있는지 확인 후, 없다면 `useWorkspaceStore.setState(initialState)`로 교체한다.

---

**[INFO] Viewer의 `saveBeforeRun` 경로에서 save 시도 가능성**
- 위치: `editor-toolbar.tsx` `saveBeforeRun` (diff 외 기존 코드)
- 상세: Viewer는 이름 입력을 할 수 없어 `isDirty`가 true가 되는 정상 경로는 없다. 그러나 `isDirty`가 true인 채로 컴포넌트가 마운트되는 시나리오(예: 이전 세션 상태 복원)에서는 Run 클릭 시 `saveAndInvalidate()`가 호출되어 백엔드가 403을 반환할 수 있다. 기능적으로는 백엔드가 보호하지만 Viewer에게 오류 토스트가 뜨는 UX 문제가 생긴다.
- 제안: `saveBeforeRun`에 `if (!canEdit && isDirty) return false` 또는 `saveAndInvalidate` 호출 조건에 `canEdit &&` 추가.

---

**[INFO] auth-configs Editor CRUD 권한 — 설계 테이블과 경계 모호**
- 위치: `auth-configs.controller.ts`, `plan/stages/05-rbac-enforcement.md`
- 상세: 원래 역할 설계 테이블에서 Editor는 Integration에 대해 "읽기·사용"만 가능하다고 명시되어 있다. auth-configs는 API 키·토큰 등 인증 설정으로, Integration의 일부로 볼 수 있다. 구현은 Editor에게 create/update/regenerate/delete 권한을 부여한다. plan 문서에는 이 사이클에서 editor 적용이 명시되어 있어 의도적인 설계 변경으로 보이지만, PRD 역할 설계 테이블(`spec/`)과의 정합성 업데이트가 없다.
- 제안: 역할 정의 spec 문서(`spec/` 또는 `prd/`)에 auth-configs가 Editor-writable임을 명시하여 설계 테이블과 구현의 일관성을 확보한다.

---

**[INFO] `structuredConfig` 타입 단순화 — 타입 변경 확인 필요**
- 위치: `execution-engine.service.ts` L1514
- 상세: `as Record<string, unknown> | undefined` 캐스트 제거 후 `structured?.config`의 타입이 그대로 흘러들어간다. 이후 `structuredConfig`를 사용하는 코드가 해당 타입을 가정한다면, 타입이 더 넓어지거나 좁아질 수 있다. 기능적 영향은 낮지만 타입 안전성 관점에서 명시적 캐스트 제거가 TS 컴파일 오류를 숨기지 않는지 확인이 필요하다.

---

### 요약

이번 변경은 auth-configs·folders 백엔드 가드와 editor 툴바·triggers·schedules 프론트엔드 RoleGate 적용으로, RBAC 구현 계획(`05-rbac-enforcement.md`)과 전반적으로 일치한다. 읽기 엔드포인트는 Viewer에 개방하고 쓰기 엔드포인트는 Editor+ 이상으로 제한하는 설계 의도가 컨트롤러와 테스트 모두에 명확히 반영되어 있다. 다만 `RolesGuard`의 역할 계층 처리 여부가 이번 diff에서 확인되지 않아 Admin·Owner 사용자의 쓰기 동작이 실제로 허용되는지 검증이 필요하고, schedules 페이지의 Viewer Delete 버튼 비표시 테스트는 title 속성 부재로 실질적 검증이 누락되어 있다. 두 항목은 기능이 올바르게 구현되어 있더라도 테스트가 그것을 보장하지 못하는 상태이므로 보완이 권장된다.

### 위험도

**MEDIUM**