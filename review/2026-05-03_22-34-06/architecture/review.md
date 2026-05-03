### 발견사항

---

**[WARNING]** Opt-in guard 패턴 — 컨트롤러 누락 시 무방비 노출 위험

- 위치: `auth-configs.controller.ts:44`, `folders.controller.ts:41`
- 상세: `@UseGuards(RolesGuard)`를 각 컨트롤러에 수동으로 선언하는 방식은, 신규 컨트롤러 작성 시 데코레이터를 빠뜨리면 해당 엔드포인트 전체가 RBAC 없이 노출된다. 현재 가드가 적용된 컨트롤러가 8개 이상으로 증가했고, 향후 추가될 컨트롤러마다 이 규칙을 기억해야 한다는 암묵적 계약이 된다.
- 제안: `APP_GUARD` 프로바이더로 `RolesGuard`를 전역 등록하고, 인증 불필요 엔드포인트에 `@SkipRoles()` 또는 `@Public()` 데코레이터를 붙이는 opt-out 모델로 전환. 이 구조에서는 "추가를 잊으면 열린다" → "추가를 잊으면 막힌다"로 기본값이 바뀐다.

---

**[WARNING]** 역할 계층 검증이 diff에서 확인 불가

- 위치: `RolesGuard` (diff 외부), `@Roles('editor')` 사용처 전체
- 상세: `@Roles('editor')`의 의미는 RolesGuard가 `owner ≥ admin ≥ editor ≥ viewer` 계층을 올바르게 구현했을 때만 성립한다. 만약 가드가 `userRole === 'editor'`처럼 동등 비교를 한다면, owner·admin이 auth-configs·folders 쓰기 엔드포인트에서 403을 받는 심각한 회귀가 발생한다. 현재 metadata-only 스펙 테스트는 이 시나리오를 잡지 못한다.
- 제안: RolesGuard에서 `ROLE_HIERARCHY: Record<WorkspaceRole, number>` 맵으로 숫자 비교하는 방식인지 확인. 아니라면 수정 및 계층 포함 통합 테스트 추가.

---

**[WARNING]** 스펙 테스트가 메타데이터만 검증 — 실제 HTTP 403 미검증

- 위치: `auth-configs.controller.spec.ts`, `folders.controller.spec.ts`
- 상세: `Reflector.get(ROLES_KEY, handler)`로 데코레이터 부착 여부만 확인한다. RolesGuard 자체 버그, JWT 가드 순서 문제, 미들웨어 바이패스 등은 이 테스트로 잡을 수 없다. 프론트엔드 테스트(`schedules-page.test.tsx`)도 UI 가시성만 검증하고 API 레이어 차단은 테스트하지 않는다.
- 제안: supertest 기반 e2e 테스트에서 viewer 토큰으로 `POST /auth-configs`, `PATCH /folders/:id` 호출 시 HTTP 403 반환을 검증하는 케이스 추가.

---

**[INFO]** 동일 컴포넌트 내 명령형·선언형 역할 검사 혼용

- 위치: `editor-toolbar.tsx:57` (`useHasRole`), 동일 파일 내 `<RoleGate minRole="editor">`
- 상세: `canEdit = useHasRole("editor")`(명령형)와 `<RoleGate>`(선언형)가 동일 컴포넌트에서 병용된다. 기능상 문제는 없으나, 새 기여자가 어느 패턴을 선택해야 하는지 판단 기준이 불분명하다.
- 제안: 조건부 JSX 분기(`canEdit ? <A /> : <B />`)는 `useHasRole`, JSX 서브트리 show/hide는 `<RoleGate>`로 용도를 문서화. 현재 사용법은 이 기준에 부합하므로 주석 또는 팀 컨벤션 문서 한 줄이면 충분.

---

**[INFO]** viewer에게 Undo/Redo 버튼이 노출됨

- 위치: `editor-toolbar.tsx` (diff 외부, 변경되지 않은 부분)
- 상세: Save·이름 편집·Delete는 `RoleGate`로 숨겼지만 Undo/Redo 버튼은 viewer에게도 노출된 채 활성 상태다. 캔버스 편집이 막혀 있어 실제로 스택이 비어 있을 것이지만, UX 일관성이 깨진다.
- 제안: `disabled={undoStack.length === 0 || !canEdit}` 조건 추가 또는 `RoleGate`로 래핑.

---

**[INFO]** `structured?.config ?? undefined` 는 항상 `structured?.config` 와 동치

- 위치: `execution-engine.service.ts:1514`
- 상세: 옵셔널 체이닝은 이미 `undefined`를 반환하므로 `?? undefined`는 아무 효과가 없다. 타입 캐스트 제거는 올바른 정리지만 `?? undefined` 부분은 잉여 코드로 남아 있다.
- 제안: `const structuredConfig = structured?.config;`로 단순화.

---

### 요약

이번 변경은 auth-configs·folders 백엔드와 schedules·triggers·에디터 툴바 프론트엔드에 기존 RBAC 인프라를 일관되게 확장한 것으로, 레이어 책임 분리(백엔드 가드 = 실제 강제, 프론트 RoleGate = UX 보조)와 decorator 기반 메타데이터 패턴이 올바르게 적용되어 있다. 핵심 아키텍처 위험은 opt-in guard 모델 하나로, 전역 `APP_GUARD` 등록으로 전환하면 누락 위험이 구조적으로 차단된다. 역할 계층 검증과 HTTP 수준 통합 테스트 부재는 현재 코드가 정상 동작하더라도 리그레션을 놓칠 수 있는 취약점이다.

### 위험도

**LOW**