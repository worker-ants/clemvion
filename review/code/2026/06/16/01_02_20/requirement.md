# 요구사항(Requirement) 리뷰 결과

## 점검 대상

`authentication/` God Component 분리 — `useAuthConfigForm` 훅 + `AuthConfigCreateForm` + `AuthConfigEditDialog` + `AuthConfigFormFields` + `auth-config-types.ts` 신규 추출, `page.tsx` 슬림화.

---

## 발견사항

### [INFO] openCreate 가 폼을 초기화하지 않는 의도적 설계

- 위치: `use-auth-config-form.ts` `openCreate` 함수
- 상세: `openCreate()` 는 `setMode("create")` 만 수행하며 폼 필드를 초기화하지 않는다. 주석에 "close 가 초기화 담당" 으로 명시돼 있고 테스트에서도 이를 명시적으로 검증한다. 분리 전 `page.tsx` 의 동작과 bit-identical 하게 유지하는 의도적 결정. 사용자가 생성 후 Done 또는 X 로 닫으면 `close()` 가 초기화하므로 안전하다.

### [INFO] regenerate 성공 후 form.generatedKey 세팅되지만 다이얼로그 미노출

- 위치: `page.tsx` `regenerateMutation.onSuccess` (`if (secret) form.setGeneratedKey(secret)`)
- 상세: regenerate 성공 시 `form.setGeneratedKey(secret)` 를 호출하나, 이때 `form.mode` 는 null 이므로 `AuthConfigCreateForm` 이 렌더링되지 않아 평문이 실제 표시되지 않는다. 분리 전 `page.tsx` 의 기존 동작(`setShowDialog` 를 건드리지 않음)과 동일하므로 리팩토링 회귀 없음. 희귀 경로에서 `openCreate` 이후 stale `generatedKey` 가 노출될 수 있으나, `openCreate` 이 닫힘(→ `close()`) 후에야 이어지므로 `close()` 가 `generatedKey` 를 null 로 초기화하여 실제 문제 없음.

### [WARNING] Regenerate·Delete 버튼 RBAC UI 가드 누락

- 위치: `page.tsx` `RefreshCw`(Regenerate)·`Trash2`(Delete) 버튼
- 상세: `isAdmin &&` 가드가 없어 Editor/Viewer 에게도 Regenerate·Delete 버튼이 노출된다. `spec/5-system/1-auth.md §3.2` 는 `Auth Config` 를 `Editor: R`, `Viewer: R` 로 규정해 CUD 는 Owner/Admin 만 허용한다. 이 문제는 이전 PR(a47e3ea5)에서 Edit 버튼에만 가드를 추가하며 regenerate/delete 를 누락한 것으로, 본 PR 이 도입한 것은 아니다. plan `spec-sync-config-gaps.md` 의 "후속 — Regenerate·Delete 버튼 Admin(RBAC) UI 가드" 항목에 미완료로 명시·추적됨.
- 상세: 백엔드 `@Roles('admin')` 가 fail-closed 로 강제하므로 실제 권한상승은 없으나, 비-admin 에게 403 혼란을 주는 UX 결함 + `spec/5-system/1-auth.md §3.2` RBAC UI 정합성 위반.
- 제안: 이번 PR 의 순수 리팩토링 범위 밖으로 plan 에서 이미 추적됨. 후속 PR 에서 처리.

### [INFO] [SPEC-DRIFT] spec frontmatter `code:` 목록에 신규 분리 파일 미포함

- 위치: `spec/2-navigation/6-config.md` frontmatter `code:` 목록
- 상세: spec frontmatter 의 `code:` 목록이 `authentication/page.tsx` 만 나열하고 신규 분리 파일(`use-auth-config-form.ts`, `auth-config-create-form.tsx`, `auth-config-edit-dialog.tsx`, `auth-config-form-fields.tsx`, `auth-config-types.ts`)을 포함하지 않는다. 코드는 올바르게 분리됐고 spec 이 낡은 상태.
- 제안: 코드 유지 + `spec/2-navigation/6-config.md` frontmatter `code:` 섹션에 신규 5개 파일 경로 추가. (spec 갱신은 `project-planner` 경로)

### [INFO] AuthConfigCreateForm Copy 버튼 aria-label 누락

- 위치: `auth-config-create-form.tsx` generatedKey Copy 버튼
- 상세: 생성된 키 옆 Copy 버튼에 `aria-label` 이 없다. 접근성 issue 이나 기능 완전성·요구사항 충족에는 영향 없음. 분리 전 `page.tsx` 에도 동일하게 누락돼 있어 리팩토링 도입 결함 아님.

---

## 요약

본 변경은 `authentication/page.tsx` 의 God Component 에서 폼 상태·검증·다이얼로그 제어를 `useAuthConfigForm` 훅으로 추출하고, 생성/편집 다이얼로그를 단일-목적 컴포넌트로 분리하는 순수 구조 리팩토링이다. 동작·UI·API 호출·i18n 키 불변이 목적이며, 변경된 코드는 이를 달성하고 있다. spec `6-config.md §A.2` (IP Whitelist, Header 이름, type별 추가 입력, 편집 폼 제약), `§A.3` (usage 드로어), `§A.4` (마스킹/Reveal/평문 1회 표시), `spec/5-system/1-auth.md §3.2` RBAC(Admin+ 게이트)의 기존 구현이 리팩토링 후에도 유지된다. Regenerate·Delete 버튼의 RBAC UI 가드 누락은 이번 PR 이전부터 존재하던 결함으로 plan 에서 후속 추적 중이며(WARNING), spec frontmatter `code:` 목록이 신규 파일을 포함하지 않아 spec 갱신이 필요한 SPEC-DRIFT 가 1건 있다(INFO). 기능 완전성 관점에서 요구사항을 충족하며 이번 변경이 도입한 Critical 발견사항 없음.

---

## 위험도

LOW
