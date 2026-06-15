# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-done`  
scope: `spec/2-navigation/6-config.md`  
diff-base: `86b50b29`

---

## 발견사항

### [INFO] spec/2-navigation/6-config.md frontmatter code: 목록에 신규 파일 미등재

- target 위치: `spec/2-navigation/6-config.md` frontmatter `code:` 배열 (lines 6-13)
- 충돌 대상: 없음 (모순 아님, 추적 누락)
- 상세: God Component 분리로 생성된 신규 파일 5개(`auth-config-types.ts`, `use-auth-config-form.ts`, `auth-config-create-form.tsx`, `auth-config-edit-dialog.tsx`, `auth-config-form-fields.tsx`)가 `code:` 목록에 없다. 현재 목록은 `page.tsx` 만 명시.
- 제안: frontmatter `code:` 에 신규 파일 추가 또는 glob `codebase/frontend/src/app/(main)/authentication/**` 으로 교체. spec 수정은 `project-planner` 역할 담당.

---

## 요약

이번 변경은 God Component `authentication/page.tsx` 를 단일-목적 컴포넌트(`AuthConfigCreateForm`, `AuthConfigEditDialog`, `AuthConfigFormFields`)와 커스텀 훅(`useAuthConfigForm`)으로 분리하는 순수 리팩토링이다. 엔티티 필드(`AuthConfig`, `UsageRecentCall`, `UsagePeriodCounts`, `AuthConfigUsage`)·API 계약(`POST/PATCH /auth-configs`, `POST /auth-configs/:id/reveal`)·상태 머신(`mode: null→create|edit`)·RBAC 모델(Admin+ Reveal, `useHasRole("admin")`)·계층 책임(프런트 프레젠테이션 레이어 내 분리) 모두 `spec/1-data-model.md §2.17`, `spec/2-navigation/6-config.md §A.2-A.4`, `spec/5-system/1-auth.md §3.2` 와 일치하며, 다른 spec 영역과의 직접 충돌은 발견되지 않았다.

---

## 위험도

NONE
