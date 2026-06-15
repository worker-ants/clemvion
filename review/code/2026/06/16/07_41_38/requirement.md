### 발견사항

- **[WARNING]** "Add Auth Method" 버튼 RBAC UI 가드 누락
  - 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx` line 263 (`<Button onClick={form.openCreate}>`)
  - 상세: `spec/5-system/1-auth.md §3.2 RBAC 매트릭스` — Auth Config | CRUD | CRUD | R | R — Owner/Admin 만 CRUD 허용. 현재 "Add Auth Method" 버튼은 `isAdmin` 가드 없이 모든 역할에 노출된다. Eye(Reveal)·Pencil(Edit) 버튼에는 `{isAdmin && ...}` 패턴이 적용되어 있으나(lines 518-539) Add 버튼은 누락됐다. Editor/Viewer 가 버튼을 클릭해 create 폼을 열고 제출하면 백엔드 `@Roles('admin')` 에서 403 반환으로 혼란을 준다. 본 diff 가 God Component 분리로 `openCreate` 를 독립 핸들러로 확립했으므로 가드 추가 시점이다. plan(`spec-sync-config-gaps.md` line 62)은 이 항목을 미완료(`[ ]`) 후속 PR 로 명시했다.
  - 제안: `<Button onClick={form.openCreate}>` 를 `{isAdmin && <Button onClick={form.openCreate}>...</Button>}` 로 감싸 spec §3.2 와 일치시킨다.

- **[WARNING]** Regenerate 버튼 RBAC UI 가드 누락 (pre-existing, diff 이전부터)
  - 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx` lines 540–548 (`onClick={() => setRegenerateTarget(config.id)}`)
  - 상세: `spec/5-system/1-auth.md §3.2` 및 `§4.1` — `auth_config.regenerate` 는 Admin+ 전용 액션. Regenerate 버튼은 이번 diff 에서 변경되지 않았으나 `isAdmin` 가드가 없어 Editor/Viewer 에게도 노출된다. Reveal·Edit 에는 이미 `isAdmin` 가드가 있어 패턴은 확립됐으나 Regenerate 는 누락됐다. plan 이 동일 후속 `[ ]` 항목으로 추적 중.
  - 제안: Regenerate 버튼을 `{isAdmin && (...)}` 로 감싸 spec §3.2 와 일치시킨다.

- **[WARNING]** Delete 버튼 RBAC UI 가드 누락 (pre-existing, diff 이전부터)
  - 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx` lines 549–557 (`onClick={() => setDeleteTarget(config.id)}`, `<Trash2 ...>`)
  - 상세: `spec/5-system/1-auth.md §3.2 RBAC 매트릭스` — Auth Config DELETE 는 Owner/Admin 만. Delete 버튼도 동일하게 `isAdmin` 가드가 없다. plan 의 후속 `[ ]` 항목("Add Auth Method·Regenerate·Delete 버튼에 가드 추가")에 명시적으로 포함된 미완료 작업이다. 본 diff 의 consistency reviewers 는 W-1·W-2 만 지적하고 Delete 는 빠뜨렸으나 동일 spec 요건(§3.2) 위반이다.
  - 제안: Delete 버튼(`<Trash2>`)도 `{isAdmin && (...)}` 로 감싸 spec §3.2 와 일치시킨다.

- **[INFO]** spec frontmatter `code:` 에 신규 분리 5파일 미등재
  - 위치: `spec/2-navigation/6-config.md` frontmatter `code:` 섹션 (line 7)
  - 상세: 이번 diff 로 생성된 `auth-config-create-form.tsx`, `auth-config-edit-dialog.tsx`, `auth-config-form-fields.tsx`, `auth-config-types.ts`, `use-auth-config-form.ts` 가 `code:` 배열에 미등재됐다. 현재 `page.tsx` 가 여전히 존재하므로 spec-code-paths.test.ts 가드 즉시 실패는 없으나 `code:` 배열의 SoT 완결성이 저하된다. Consistency checker 3곳(cross-spec I-3, convention-compliance I-1, plan-coherence I-1)이 동일하게 지적했다.
  - 제안: `spec/2-navigation/6-config.md` frontmatter `code:` 에 `codebase/frontend/src/app/(main)/authentication/**` 와일드카드 glob 으로 교체하거나 5파일을 개별 열거한다.

- **[INFO]** plan `spec-sync-config-gaps.md` 의 후속 RBAC 항목이 미완료 상태로 현 PR 에 병행 존재
  - 위치: `plan/in-progress/spec-sync-config-gaps.md` line 62 (`[ ]` 항목)
  - 상세: plan 은 God-split PR 과 RBAC 가드 PR 을 의도적으로 분리했다("별도 작은 PR 로 처리"). 본 PR(God-split)은 리팩토링 범위만 담아야 하며, RBAC 가드 추가는 후속 PR 에서 처리하도록 명시됐다. 현재 일관성 검토 SUMMARY 도 이 결정을 인지하고 있다. 기능 완전성 관점에서 spec §3.2 요건이 이 PR 에서 완전히 충족되지 않는 이유가 plan 에 의해 정당화돼 있다는 점을 기록한다.
  - 제안: 해당 없음(추적 목적 INFO). 단, 후속 PR 이 이 계획에 따라 실제 실행되는지 확인이 필요하다.

### 요약

이번 변경(authentication God Component 분리)은 `spec/2-navigation/6-config.md §A.2` 의 create/edit 폼 구조적 분리를 순수 리팩토링으로 구현하며, 비밀값 편집 차단·type 편집 차단·regenerate 단일 경로 등 Rationale R-2 핵심 invariant 를 컴포넌트 prop 경계로 명확히 강제하고 있다. 그러나 `spec/5-system/1-auth.md §3.2 RBAC 매트릭스` 가 명시하는 "Auth Config CRUD = Admin+" 요건에 대해 UI 레벨 가드가 불완전하다: "Add Auth Method" 버튼(W-1), Regenerate 버튼(W-2), Delete 버튼(이번 reviewer 신규 발견 W-3)에 `isAdmin` 가드가 없어 Editor/Viewer 에게도 노출된다. 이 세 가지는 spec 에 명백히 위반하는 사항이지만, plan 이 의도적으로 "별도 작은 PR" 로 분리했으므로 현 PR 의 코드 구현 범위 내에서는 예상된 미완성이다. 백엔드가 `@Roles('admin')` 으로 fail-closed 강제하므로 실제 권한상승은 없으나 403 혼란·RBAC UI 일관성 위반이 spec 요건 미충족이다.

### 위험도

MEDIUM
