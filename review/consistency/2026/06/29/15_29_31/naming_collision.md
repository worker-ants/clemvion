# 신규 식별자 충돌 Check — spec/conventions/user-guide-evidence.md

## 발견사항

충돌 없음. 이하는 각 관점별 검토 결과다.

---

### [INFO] `id: user-guide-evidence` 와 `id: user-guide` 의 인접성
- target 신규 식별자: `user-guide-evidence` (`spec/conventions/user-guide-evidence.md` frontmatter)
- 기존 사용처: `spec/2-navigation/13-user-guide.md` frontmatter `id: user-guide`
- 상세: 두 ID 는 서로 다른 도메인(navigation spec vs conventions)을 가리키며 kebab-case 가 완전히 다르다. `user-guide` 는 내비게이션 화면 spec, `user-guide-evidence` 는 `<ImplAnchor>` 컨벤션 SoT 로 의미가 명확히 분리돼 있다. `spec-impl-evidence.md §2.1` 에서 동일 basename 충돌 시 prefix 로 회피하도록 명시하고 있으나, 두 basename 자체가 다르므로 해당 조건도 해당 없다.
- 제안: 변경 불필요.

---

### [INFO] `code:` 필드의 동명 키 (spec frontmatter vs user-guide MDX frontmatter)
- target 신규 식별자: `code:` 키 (spec-impl-evidence §2.1 스키마의 동일 필드)
- 기존 사용처: user-guide MDX frontmatter 의 `code:` (registry.test.ts 가드 대상)
- 상세: `spec-impl-evidence.md R-6` 이 이미 이 이중 사용을 명시적으로 인식하고, 대상 문서 종류(`.md` vs `.mdx`)와 검증 가드(`spec-code-paths.test.ts` vs `registry.test.ts`)가 서로 다름을 Rationale 로 기록하고 있다. target 문서 자체도 §2.1 "다른 가드와의 관계" 에서 이를 명확히 구분한다. 의미 충돌 없음.
- 제안: 변경 불필요.

---

### [INFO] `integrations-coverage.test.ts` / `triggers-coverage.test.ts` 파일 이름
- target 신규 식별자: `codebase/frontend/src/lib/docs/__tests__/integrations-coverage.test.ts`, `triggers-coverage.test.ts`
- 기존 사용처: `spec/conventions/data-hydration-surfaces.md` 의 `hydration-coverage.test.ts`, `spec/conventions/i18n-userguide.md` 의 `nodes-coverage.test.ts` 패밀리
- 상세: `*-coverage.test.ts` 패턴을 공유하지만 각각 다른 검증 도메인(hydration, nodes, integrations, triggers)을 가리키며, 실제 파일도 이미 `codebase/frontend/src/lib/docs/__tests__/` 에 존재함이 확인됐다. 명명 충돌 없음.
- 제안: 변경 불필요.

---

### [INFO] `user-guide-evidence` ID 가 plan 에서 이미 참조됨
- target 신규 식별자: `spec/conventions/user-guide-evidence.md` (파일 경로 + id)
- 기존 사용처: `plan/complete/spec-sync-user-guide-evidence-gaps.md`, `plan/complete/spec-fix-impl-marker-flips.md` 가 이미 이 경로를 참조
- 상세: 파일이 이미 존재하며 plan 이 이를 참조하고 있다. 신규 도입이 아닌 기존 파일의 갱신·동기화 작업으로, 경로 충돌이 아니라 일관된 참조다.
- 제안: 변경 불필요.

---

## 요약

target 문서 `spec/conventions/user-guide-evidence.md` 가 도입하는 식별자 — spec ID `user-guide-evidence`, 컴포넌트 `<ImplAnchor>`, 파일 `impl-anchor.tsx`, 테스트 파일 3건(`impl-anchor-existence.test.ts`, `integrations-coverage.test.ts`, `triggers-coverage.test.ts`), 헬퍼 `impl-anchor-parse.ts`, `kind` enum 4값 — 은 기존 spec / codebase 에서 다른 의미로 사용 중인 동일 이름이 없다. 인접한 `id: user-guide`, `*-coverage.test.ts` 패턴, `code:` 키의 동명 사용은 각각 이미 spec-impl-evidence Rationale 에 명시적으로 인지·분리돼 있으며 실제 충돌을 유발하지 않는다. 파일 경로 `spec/conventions/user-guide-evidence.md` 도 기존 컨벤션 문서 목록에 고유하게 위치한다.

## 위험도

NONE
