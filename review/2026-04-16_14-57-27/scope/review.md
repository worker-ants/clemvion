## Scope Code Review 결과

---

### 발견사항

- **[WARNING]** `fixtures-broken` 픽스처 디렉터리 미확인
  - 위치: `registry.test.ts:54` — `path.resolve(__dirname, "fixtures-broken")`
  - 상세: 테스트가 `fixtures-broken` 디렉터리 존재를 전제하지만, 해당 디렉터리가 리뷰 대상에 포함되지 않았습니다. `registry.ts`의 `listSectionDirs`는 루트가 존재하지 않으면 `[]`를 반환하므로, 디렉터리가 없으면 예외 없이 빈 인덱스를 반환합니다. 이 경우 `.toThrow()` 단언이 **항상 실패**합니다.
  - 제안: `fixtures-broken/<section>/broken.mdx` (필수 프론트매터 필드 누락)를 추가하거나, 리뷰 범위에 해당 픽스처가 포함되었는지 확인하세요.

- **[WARNING]** Spec §11 빌드 시 검증 요건 미구현
  - 위치: `spec/2-navigation/13-user-guide.md` §11 / `registry.test.ts` 전체
  - 상세: 스펙은 "빌드 시 검증 — `registry.ts` 단위 테스트에서 모든 `spec:`/`code:` 경로 존재 확인"을 요구하지만, 테스트 파일에 해당 검증 케이스가 없습니다. `DocFrontmatter`에 `spec?`, `code?` 필드가 정의되어 있음에도 경로 실존 검사 테스트가 누락되었습니다.
  - 제안: `spec:` / `code:` glob 경로가 실제로 존재하는지 검증하는 테스트 케이스를 추가하세요.

- **[INFO]** `cachedIndex` 모듈 레벨 싱글턴 — 테스트 격리 잠재 위험
  - 위치: `registry.ts:161-163`
  - 상세: `let cachedIndex: DocsIndex | null = null`은 프로세스 수명 동안 유지됩니다. 현재 테스트는 `getDocsIndex()` 대신 `loadDocsIndex()`를 직접 호출하므로 문제가 없지만, 향후 `getDocsIndex()`를 테스트하거나 테스트 환경에서 캐시가 오염될 경우 격리가 깨질 수 있습니다.
  - 제안: 테스트 전용 `resetDocsIndexCache()` 익스포트를 추가하거나, 테스트에서 `getDocsIndex()` 호출을 명시적으로 제한하는 주석을 남기세요.

- **[INFO]** `SECTION_LABELS` 하드코딩 — 스펙 IA와 강결합
  - 위치: `registry.ts:37-44`
  - 상세: 6개 섹션 레이블이 하드코딩되어 있습니다. 스펙 §2의 IA가 변경될 때 레지스트리 코드도 함께 수정해야 합니다. `humanize()` 폴백이 있어 동작은 보장되지만, 레이블이 한글이어야 한다는 요구를 폴백이 충족하지 못합니다(`humanize`는 영문 기반).
  - 제안: 현재 구조는 스펙 IA를 따르므로 범위 이탈은 아니나, 섹션별 `index.mdx`의 프론트매터에서 레이블을 읽는 방식으로 전환을 검토하세요 (스펙 §9 언급).

- **[INFO]** `mdx-components.tsx`에서 import하는 컴포넌트 구현체 미확인
  - 위치: `mdx-components.tsx:3-6`
  - 상세: `Callout`, `Example`, `FieldTable`, `Step`, `Steps`를 `@/components/docs/mdx/*`에서 import하지만, 해당 구현 파일들이 리뷰 범위에 없습니다. git status의 `?? frontend/src/components/docs/`로 보아 새 디렉터리이므로, 이들 컴포넌트가 실제로 구현되어 있는지 확인이 필요합니다.
  - 제안: 컴포넌트 구현체를 리뷰 대상에 포함시키거나, 빌드 성공 여부를 TEST WORKFLOW로 확인하세요.

---

### 요약

리뷰된 파일들은 스펙 §2~§11에서 정의한 `/docs` 사용자 가이드 기능(docs 레지스트리, MDX 컴포넌트 맵, 테스트 픽스처, 스펙 문서)에 집중되어 있으며, **의도된 범위를 벗어난 변경은 발견되지 않았습니다.** 다만, `fixtures-broken` 픽스처 누락으로 인해 프론트매터 검증 예외 테스트가 실제로 동작하지 않을 가능성이 있고, 스펙이 명시한 `spec:`/`code:` 경로 실존 검증 테스트 케이스가 구현되지 않아 두 건의 Warning이 발생합니다.

### 위험도

**MEDIUM** — 핵심 기능 로직의 범위 이탈은 없으나, 테스트 픽스처 누락으로 인한 거짓 양성(false-positive) 테스트와 스펙 명시 검증 항목 누락이 품질 기준 미달에 해당합니다.