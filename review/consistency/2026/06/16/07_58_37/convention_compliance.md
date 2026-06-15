# Convention Compliance Review

**검토 대상**: `spec/2-navigation/6-config.md` — 구현 완료 후 검토 (diff-base 47119617)  
**검토 범위**: diff 구현 코드 (`codebase/frontend/src/app/(main)/authentication/page.tsx`, `__tests__/authentication-form.test.tsx`) 및 target spec 문서의 정식 규약 준수

---

## 발견사항

### [INFO] 구현 코드 내 spec 참조 표기 — `Admin+` vs `admin` 역할 키 혼재
- **target 위치**: diff 내 JSX/테스트 주석 — `spec/5-system/1-auth.md §3.2: Editor/Viewer = R`
- **위반 규약**: 직접 위반 없음. `spec/5-system/1-auth.md §3.2` RBAC 매트릭스와의 구현 정합 참고 사항.
- **상세**: 코드 주석은 `Admin+` (Owner + Admin 포괄 spec 관용어)로 기술하고, 구현은 `useHasRole("admin")` 로 gate 한다. `useHasRole` 이 Owner 역할도 포함하는지(`admin` 만 매칭하는지) 여부에 따라 Owner = 무조건 허용이어야 하는 RBAC 매트릭스 (`Auth Config: Owner = CRUD`)와 정합이 달라질 수 있다. convention 문서 위반은 아니며 구현 내부 정확성 사항이다.
- **제안**: `role-gate.tsx` 의 `useHasRole("admin")` 구현이 Owner 역할을 포함하는지 확인한다. Owner > Admin 계층이라 Owner 가 Admin 역할도 가진다면 정확. 그렇지 않다면 `useHasRole(["owner", "admin"])` 으로 수정이 필요하다. (convention 갱신 불필요 — 구현 수정 사항)

---

### [INFO] `spec/2-navigation/6-config.md` frontmatter `status: partial` — 승격 의무 타이밍 확인 필요
- **target 위치**: `/Volumes/project/private/clemvion/spec/2-navigation/6-config.md` frontmatter 라인 1-14
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §3` — `partial` 의 `pending_plans` 모두 `complete/` 이동 시 `implemented` 승격 의무 (`spec-status-lifecycle.test.ts` 가드)
- **상세**: 현재 `status: partial`, `pending_plans: [plan/in-progress/spec-sync-config-gaps.md]`. 이번 diff 가 해당 plan 의 마지막 항목(Auth Config RBAC UI 가드)을 완료한다면, plan 이 `plan/complete/` 로 이동하는 동일 commit 에서 spec frontmatter 도 `status: implemented` 로 승격해야 하며 `pending_plans` 를 제거해야 한다. 미승격 상태가 지속되면 `spec-status-lifecycle.test.ts` 가드가 빌드 차단을 유발한다.
- **제안**: `plan/in-progress/spec-sync-config-gaps.md` 의 완료 여부를 확인한다. 이번 구현으로 plan 전체가 완료되면 동일 PR 에서: (a) plan → `plan/complete/` 이동, (b) `spec/2-navigation/6-config.md` frontmatter `status: implemented` 승격 + `pending_plans` 제거. 미완료 항목이 남아 있다면 현 상태 유지.

---

### [INFO] `spec/2-navigation/6-config.md §A.4` — toggle·Add·Delete 등 전 mutation 버튼의 Admin+ UI 가드가 spec 본문에 미기술
- **target 위치**: `spec/2-navigation/6-config.md §A.4 권한` 섹션
- **위반 규약**: CLAUDE.md 문서 구조 규약 — 결정의 근거는 해당 spec 문서 끝의 `## Rationale` 에 기록. 본 경우는 Rationale 보다 spec 본문 §A.4 의 누락 기술 문제.
- **상세**: `spec/2-navigation/6-config.md §A.4 권한` 은 "Owner / Admin → Reveal 버튼 노출 + 호출 가능" 만 명시한다. 이번 diff 가 구현한 toggle(isActive)·Add Config·Edit·Regenerate·Delete 버튼에 대한 Admin+ UI 가드는 `spec/5-system/1-auth.md §3.2` RBAC 매트릭스(`Auth Config: Admin+ = CRUD`)에서 유추 가능하나, `spec/2-navigation/6-config.md` 본문에 직접 기술이 없다. 구현 diff 의 JSX 주석이 `§3.2` 를 직접 인용함으로써 의도는 명확하나, spec 본문과 구현 사이 명시적 연결이 없다.
- **제안**: `spec/2-navigation/6-config.md §A.4 권한` 에 "Reveal 외 모든 mutation 액션(Add Config·isActive 토글·Edit·Regenerate·Delete)도 Admin+ 만 노출; Editor·Viewer 는 UI 에서 미노출, API 직접 호출 시 403 `FORBIDDEN`" 구문 추가를 권장한다. spec 쓰기는 `project-planner` 역할로 follow-up 위임.

---

## 요약

`spec/2-navigation/6-config.md` 의 frontmatter 구조(`id`·`status`·`code`·`pending_plans`)는 `spec/conventions/spec-impl-evidence.md` 의 schema 를 준수하며, diff 의 구현(Auth Config 전 mutation 버튼을 `isAdmin` 조건으로 일괄 gate)은 `spec/5-system/1-auth.md §3.2` RBAC 매트릭스(`Auth Config: Admin+ = CRUD, Editor/Viewer = R`)를 정확히 따른다. 명명·출력 포맷·API endpoint 경로·Swagger 데코레이터 등 다른 convention 영역에서는 위반사항이 발견되지 않았다. 발견된 3건은 모두 INFO 수준으로, 구현 정합성 확인 권장·frontmatter 승격 타이밍 확인·spec 본문 보완 권장 항목이다. CRITICAL 또는 WARNING 등급의 convention 직접 위반은 없다.

## 위험도

NONE
