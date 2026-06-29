# Cross-Spec 일관성 검토 결과

**Target**: `spec/conventions/spec-impl-evidence.md`
**검토 모드**: spec draft (--spec)
**검토 일시**: 2026-06-29

---

## 변경 요약 (diff 기준)

1. `§1` inclusive list 아래에 "의도적 제외" 설명 블록 추가 — `spec/data-flow/**` 가 frontmatter 의무 대상이 아닌 이유를 문서화.
2. `§2.1` `user_guide` 필드 설명 확장 — KO/EN 로케일 쌍 등재 지침 + build-time 가드 미적용 명시.
3. `§5.3` 예시 블록 — `user_guide` 주석 추가 + `telegram.en.mdx` 경로 등재.

---

## 발견사항

### [INFO] `spec/data-flow/**` 제외 설명 — 기존 `spec-area-index.test.ts` 스코프와 잠재 불일치

- target 위치: `spec/conventions/spec-impl-evidence.md §1` 추가 블록
- 충돌 대상: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` `collectSpecMarkdown()` + `spec-area-index.test.ts`
- 상세: `collectSpecMarkdown()` 는 `spec/data-flow/` 를 포함한 **모든** `spec/**/*.md` 를 수집한다 (카탈로그만 제외). `spec-area-index.test.ts` 는 이 함수를 그대로 사용하므로 `spec/data-flow/`(16개 파일)의 area-index 검사도 이미 수행된다. target 의 "의도적 제외" 설명은 **frontmatter-evidence 가드(`INCLUDE_PREFIXES`)** 에 한정되는데, 독자가 "data-flow 는 어떤 가드도 적용되지 않는다"로 오독할 여지가 있다. 실제로는 `spec-link-integrity.test.ts` 와 `spec-area-index.test.ts` 의 **링크·index 가드는 data-flow 에도 적용**된다.
- 제안: target §1 의 설명 문장을 "frontmatter-evidence 가드 (`INCLUDE_PREFIXES`) 에서 제외될 뿐이며, 링크 무결성·area-index 가드(§4.2)는 data-flow 에도 적용된다"는 뉘앙스로 보강하면 오독 방지. 현재 문구가 틀린 것은 아니나 scope 명시 보강 권장.

### [INFO] `user_guide` KO/EN 쌍 등재 지침 — `user-guide-evidence.md` 와 정렬 확인 권장

- target 위치: `spec/conventions/spec-impl-evidence.md §2.1` `user_guide` 행
- 충돌 대상: `spec/conventions/user-guide-evidence.md`
- 상세: target 이 `user_guide` 필드에 KO/EN 쌍(`<name>.mdx` + `<name>.en.mdx`) 모두 등재하도록 권장하는 규칙을 신설했다. `user-guide-evidence.md` 는 `.en.mdx` 파일 존재를 인지하고 있으나(`triggers-coverage.test.ts` 참조), `user_guide:` 필드 등재 규칙을 별도로 언급하지 않는다. 빌드 가드가 `user_guide:` 에 미적용(`§2.1` 명시)이라 충돌은 없지만 두 컨벤션 문서 간 단순 동기화 권장 사항이다.
- 제안: `user-guide-evidence.md` 에 "spec frontmatter `user_guide:` 에 로케일 쌍 등재 기준은 `spec-impl-evidence.md §2.1` 참조" 한 줄 추가 고려.

---

## 긍정적 확인 사항

- `spec/data-flow/**` 파일 16개 전체에 `id:`/`status:` frontmatter가 **실제로 없음** — target 의 "해당 파일들은 `id`/`status` frontmatter 자체가 없다" 주장이 코드베이스와 일치.
- `INCLUDE_PREFIXES` 구현(`spec-frontmatter-parse.ts`)에 `spec/data-flow/` 가 포함되지 않음 — target 의 "가드 `INCLUDE_PREFIXES` 미등재" 주장이 구현과 일치.
- `telegram.en.mdx` 파일이 `codebase/frontend/src/content/docs/06-integrations-and-config/` 에 실제 존재함 — §5.3 예시 경로 정확.
- `user_guide:` 의 build-time 가드 미적용 기술이 테스트 코드(`spec-frontmatter-parse.ts` 타입 정의만, 검증 로직 없음)와 일치.
- 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 관점에서 기존 spec 영역과 직접 모순되는 변경 없음.

---

## 요약

`spec/conventions/spec-impl-evidence.md` 의 이번 변경은 (1) `spec/data-flow/**` 의 frontmatter 의무 제외를 공식 문서화하고, (2) `user_guide:` 필드의 KO/EN 쌍 등재 지침을 명확화하는 두 가지 설명 보강이다. 기존 가드 구현(`INCLUDE_PREFIXES`, `collectSpecMarkdown`)과 실제 data-flow 파일 상태가 모두 target 서술과 일치하므로 구현-spec 모순은 없다. CRITICAL/WARNING 급 충돌은 발견되지 않았으며, 두 건의 INFO는 독자 오독 방지를 위한 설명 보강 및 인접 컨벤션 문서와의 동기화 권장 수준이다.

---

## 위험도

NONE
