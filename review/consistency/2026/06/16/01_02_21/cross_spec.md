# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-done`  
Target scope: `spec/2-navigation/6-config.md` (구현 변경 대상)  
diff-base: `1899c05e`

---

## 발견사항

### 1. [WARNING] "Add Auth Method" 버튼이 isAdmin 가드 없이 노출됨

- **target 위치**: `codebase/frontend/src/app/(main)/authentication/page.tsx` line 236 (`<Button onClick={form.openCreate}>`)
- **충돌 대상**: `spec/5-system/1-auth.md §3.2 RBAC 매트릭스` — "Auth Config | CRUD | CRUD | R | R" (Owner/Admin만 CRUD, Editor/Viewer는 R만)
- **상세**: `isAdmin` 체크는 Reveal 버튼(line 491)·Edit 버튼(line 502)에만 적용된다. "Add Auth Method"(`form.openCreate`) 버튼은 `isAdmin` 가드 없이 모든 역할에 노출된다. Editor/Viewer 가 버튼을 클릭해 create 폼을 열고 제출하면 백엔드 `@Roles('admin')` 에서 403을 반환해 혼란을 준다. 이 상태는 분리 전 page.tsx 에도 존재했는지 별도 확인이 필요하나, 이번 diff 이후 `openCreate` 가 독립 버튼 핸들러가 됐으므로 가드 추가 기회다.
- **제안**: `<Button onClick={form.openCreate}>` 를 `{isAdmin && <Button ...>}` 로 감싸 spec §3.2 RBAC와 일치시킨다. Edit 버튼(line 502)과 동일한 패턴.

---

### 2. [WARNING] Regenerate 버튼이 isAdmin 가드 없이 노출됨 (pre-existing, diff 이전부터)

- **target 위치**: `codebase/frontend/src/app/(main)/authentication/page.tsx` line ~518 (`onClick={() => setRegenerateTarget(config.id)}`)
- **충돌 대상**: `spec/5-system/1-auth.md §4.1 감사 액션` — `auth_config.regenerate` 는 Admin+ 액션. `§3.2 RBAC` — Auth Config CRUD 는 Admin+.
- **상세**: Regenerate 버튼은 이번 diff 에서 변경되지 않았지만 `isAdmin` 가드가 없다. 백엔드가 막더라도 UI 에서 차단하지 않으면 Editor/Viewer 가 버튼을 볼 수 있어 403 혼란이 발생한다. Reveal·Edit 에는 `isAdmin` 가드가 있으나 Regenerate 에는 없다.
- **제안**: Regenerate 버튼도 `{isAdmin && (...)}` 로 감싸는 별도 fix 를 추가한다. 이번 diff 가 도입한 이슈는 아니나 이 검토 컨텍스트에서 발견된 기존 불일치다.

---

### 3. [INFO] `spec/2-navigation/6-config.md` frontmatter `code:` 목록 미갱신

- **target 위치**: `spec/2-navigation/6-config.md` frontmatter `code:` 섹션
- **충돌 대상**: 없음 (동기화 권장)
- **상세**: 이번 diff 에서 신규 파일 5개가 생성됐다:
  - `codebase/frontend/src/app/(main)/authentication/auth-config-create-form.tsx`
  - `codebase/frontend/src/app/(main)/authentication/auth-config-edit-dialog.tsx`
  - `codebase/frontend/src/app/(main)/authentication/auth-config-form-fields.tsx`
  - `codebase/frontend/src/app/(main)/authentication/auth-config-types.ts`
  - `codebase/frontend/src/app/(main)/authentication/use-auth-config-form.ts`

  현재 frontmatter `code:` 에는 `codebase/frontend/src/app/(main)/authentication/page.tsx` 만 있다.
- **제안**: spec frontmatter `code:` 에 위 5개 파일을 추가해 구현 증거를 동기화한다.

---

### 4. [INFO] `AuthConfig` 인터페이스 이동 — 데이터 모델 spec 정합 확인

- **target 위치**: `codebase/frontend/src/app/(main)/authentication/auth-config-types.ts` — `AuthConfig` 인터페이스 정의
- **충돌 대상**: `spec/1-data-model.md §2.17` — AuthConfig 엔티티 정의
- **상세**: `AuthConfig` 인터페이스(`id`, `name`, `type`, `isActive`, `lastUsedAt`, `config`, `ipWhitelist`)가 page.tsx 인라인 정의에서 `auth-config-types.ts` 로 이동됐다. 스키마 자체는 spec §2.17 과 일치한다. `pickPlaintextSecret` 의 우선순위 체인(`key ?? token ?? secret ?? password`)도 spec §2.17.1 의 secret 필드 목록(key/token/secret/password)과 정확히 일치한다. 이동 자체는 충돌이 아닌 내부 리팩터링이다.
- **제안**: 별도 액션 불필요.

---

## 요약

이번 diff 는 `page.tsx` 의 God Component 를 `useAuthConfigForm` 훅·`AuthConfigCreateForm`·`AuthConfigEditDialog`·`AuthConfigFormFields`·`auth-config-types.ts` 로 분리한 순수 리팩터링이다. 데이터 모델(`spec/1-data-model.md §2.17`)과의 충돌, API 계약(`spec/2-navigation/6-config.md §3`)과의 충돌, 상태 전이 충돌은 발견되지 않았다. 주요 리스크는 RBAC 관련 두 가지다: "Add Auth Method" 버튼에 `isAdmin` 가드가 없어 spec `1-auth.md §3.2` 의 "Auth Config CRUD = Admin+" 요건과 불일치하고, Regenerate 버튼에도 같은 문제가 (diff 이전부터) 존재한다. spec frontmatter `code:` 목록 미갱신은 추적 문제로 기능 영향은 없다.

---

## 위험도

MEDIUM
