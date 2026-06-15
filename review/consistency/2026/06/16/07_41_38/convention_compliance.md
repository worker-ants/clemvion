# Convention Compliance Report

**검토 모드**: 구현 완료 후 (--impl-done)
**Target**: `spec/2-navigation/6-config.md` diff (base: `86b50b29`)
**검토 범위**: 신규 파일 6개 + page.tsx 대규모 리팩토링

---

## 발견사항

### **[INFO]** `spec/2-navigation/6-config.md` frontmatter `code:` 목록에 신규 파일 미등재

- **target 위치**: `spec/2-navigation/6-config.md` frontmatter `code:` 섹션 (라인 6–13)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2` — `code:` 필드는 "본 spec 이 약속한 surface 의 구현 경로" 를 열거해야 함
- **상세**: 이번 diff 에서 신규 생성된 파일들(`auth-config-types.ts`, `auth-config-form-fields.tsx`, `auth-config-create-form.tsx`, `auth-config-edit-dialog.tsx`, `use-auth-config-form.ts`)이 `spec/2-navigation/6-config.md` frontmatter `code:` 목록에 반영되지 않았다. 현재 `code:` 는 `page.tsx` 만 참조하고 있어 God-component 분리 후의 실제 구현 경로와 불일치한다. glob 패턴(`codebase/frontend/src/app/(main)/authentication/**`)으로 일괄 커버하는 것도 허용된다.
- **제안**: `spec/2-navigation/6-config.md` frontmatter `code:` 에 `codebase/frontend/src/app/(main)/authentication/**` glob 또는 신규 파일 각각을 추가. `page.tsx` 한 항목만 남겨둔 현 상태는 새 SoT 파일들을 누락하므로 갱신 필요.

---

### **[INFO]** 테스트 파일 확장자 — JSX 없는 hook 테스트에 `.tsx` 사용

- **target 위치**: `codebase/frontend/src/app/(main)/authentication/__tests__/use-auth-config-form.test.tsx`
- **위반 규약**: `spec/conventions/` 에 프론트엔드 테스트 파일 명명 규약은 별도 명시되지 않음 — 관행 일관성 관점의 INFO
- **상세**: `use-auth-config-form.test.tsx` 는 `.tsx` 확장자를 쓰지만 내부에 JSX 요소 없이 `renderHook` / `act` 만 사용한다. 규약 직접 위반은 아니나 `.ts` 가 더 정확하다.
- **제안**: 파일명을 `use-auth-config-form.test.ts` 로 변경 (규약 갱신 불필요 — 관행 정렬).

---

## 요약

이번 diff(God-component 분리 리팩토링)는 `spec/conventions/` 의 정식 규약들(audit-actions, swagger, error-codes, spec-impl-evidence 등)을 직접 위반하는 항목이 없다. 코드 변경은 순수 프론트엔드 컴포넌트 분리이며 백엔드 DTO·API endpoint·에러 코드·Swagger 데코레이터 변경이 포함되지 않아 해당 규약들의 적용 대상이 아니다. 유일한 지적 사항은 `spec/2-navigation/6-config.md` frontmatter `code:` 목록이 God-component 분리로 생긴 신규 파일들을 포함하도록 갱신되지 않아 `spec-impl-evidence` 컨벤션의 "구현 경로 최신 유지" 취지와 어긋난다는 점(INFO)이다.

## 위험도

LOW
