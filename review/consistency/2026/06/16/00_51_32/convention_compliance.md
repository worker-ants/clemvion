# 정식 규약 준수 검토 결과

검토 모드: 구현 완료 후 (--impl-done)
Target 문서: `spec/2-navigation/6-config.md`
Diff base: `1899c05e`

---

## 발견사항

- **[WARNING]** spec frontmatter `code:` 목록이 신규 분리 파일을 누락
  - target 위치: `spec/2-navigation/6-config.md` frontmatter `code:` 블록 (라인 7)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1` — `code:` 는 "본 spec 이 약속한 surface 의 구현 경로"를 의무 열거해야 한다.
  - 상세: 현재 frontmatter 는 `codebase/frontend/src/app/(main)/authentication/page.tsx` 만 나열한다. 이번 diff 에서 God Component 분리로 신규 생성된 5개 파일 — `auth-config-types.ts`, `use-auth-config-form.ts`, `auth-config-create-form.tsx`, `auth-config-edit-dialog.tsx`, `auth-config-form-fields.tsx` — 이 `code:` 에 없다. `spec-impl-evidence` 규약의 `code:` 필드는 구현 coverage 증거로 glob 패턴을 허용하므로, 인증 화면 전체를 `codebase/frontend/src/app/(main)/authentication/**` glob 하나로 표현하거나 각 파일을 열거해야 한다. 현재 상태에서 `spec-code-paths.test.ts` 가드가 `page.tsx` 경로만 확인하므로 신규 파일 누락이 가드 우회된 채 통과된다.
  - 제안: frontmatter `code:` 를 다음 중 하나로 갱신한다.
    - (A) glob 로 확장: `codebase/frontend/src/app/(main)/authentication/**` (신규 파일 전부 포함, 향후 추가에도 유연)
    - (B) 개별 열거: `auth-config-types.ts`, `use-auth-config-form.ts`, `auth-config-create-form.tsx`, `auth-config-edit-dialog.tsx`, `auth-config-form-fields.tsx` 를 각각 추가

- **[INFO]** `spec/2-navigation/6-config.md` 의 §A.2 구현 현황 주석이 page.tsx 파일명을 직접 명시
  - target 위치: `spec/2-navigation/6-config.md` §A.2 "구현 현황" 주석 (라인 55)
  - 위반 규약: 규약 직접 위반은 아님. INFO 수준 일관성 제안.
  - 상세: "생성 폼 (`authentication/page.tsx`) 도 …" 라고 파일명을 직접 명시했는데, 이번 분리로 폼 로직은 `use-auth-config-form.ts`·`auth-config-create-form.tsx` 등으로 이동됐다. spec 본문이 특정 파일명을 고정하면 향후 리팩토링마다 spec 을 수동 갱신해야 하는 coupling 이 생긴다.
  - 제안: 파일명 직접 명시 대신 기능 단위(`인증 설정 생성 폼`)로 서술하거나, `code:` frontmatter 로만 경로 증거를 위임하고 본문 주석에서 파일명 참조를 제거한다.

---

## 요약

정식 규약 준수 관점의 주요 문제는 `spec-impl-evidence` 규약의 `code:` 의무 갱신 누락이다. 이번 God Component 분리(auth form → 5개 신규 파일)가 spec frontmatter 에 반영되지 않아, spec 이 약속한 surface 의 구현 경로 증거가 불완전한 상태다. 명명 규약(파일명·식별자·API endpoint), 문서 3섹션 구조(Overview/본문/Rationale), API 문서 규약(Swagger/DTO 패턴), 금지 항목(에러 코드·감사 액션 등) 관점에서는 위반이 발견되지 않는다. 신규 파일 명명도 kebab-case(`auth-config-types.ts`), camelCase 훅명(`useAuthConfigForm`), PascalCase 컴포넌트명(`AuthConfigCreateForm` 등) 모두 프로젝트 관행과 일치한다.

---

## 위험도

LOW

STATUS: SUCCESS
