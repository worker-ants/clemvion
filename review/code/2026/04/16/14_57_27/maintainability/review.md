## 유지보수성 코드 리뷰

### 발견사항

---

**[INFO]** `assertFrontmatter`의 중복 null 검사 패턴
- 위치: `registry.ts` — `assertFrontmatter` 함수 (57~82행)
- 상세: 필수 필드 존재 여부를 루프로 먼저 체크한 뒤, 각 필드의 타입을 개별 `if` 블록으로 다시 검사합니다. 존재 여부 루프에서 `null`/`undefined` 배제 후 동일 필드에 `typeof` 검사를 반복하여 논리가 두 곳에 산재합니다.
- 제안: Zod 등의 스키마 검증 라이브러리를 도입하거나, 필드별로 존재 + 타입을 함께 검증하는 헬퍼(`assertString`, `assertNumber`)로 정리하면 검증 로직이 한 곳에 집중됩니다.

---

**[INFO]** 프로세스 레벨 모듈 캐시(`cachedIndex`)의 테스트 격리 위험
- 위치: `registry.ts` — 174~180행
- 상세: `cachedIndex`가 모듈 스코프 변수로 선언되어 있어, 테스트 간 상태가 공유될 수 있습니다. `getDocsIndex()`를 호출하는 테스트가 추가될 경우 순서 의존성이 발생할 수 있습니다. (현재 테스트는 `loadDocsIndex`를 직접 호출하므로 즉각적 문제는 없음)
- 제안: `cachedIndex = null`로 초기화하는 `resetDocsIndexCache()` 함수를 export하거나, 테스트에서 `getDocsIndex`를 직접 테스트하는 케이스 추가 시 캐시 해제 수단이 필요합니다.

---

**[INFO]** `fixtures-broken` 디렉터리가 테스트 코드에서 참조되나 제공되지 않음
- 위치: `registry.test.ts` — 42~44행
- 상세: `"frontmatter 필수 필드 검증에 실패하면 예외를 던져요"` 테스트가 `fixtures-broken` 경로를 참조합니다. 해당 fixture가 존재하지 않으면 `loadDocsIndex`가 빈 index를 반환하고 예외가 발생하지 않아 테스트가 오탐(false positive)이 될 수 있습니다.
- 제안: `fixtures-broken` 디렉터리와 의도적으로 잘못된 frontmatter를 가진 `.mdx` 파일을 함께 커밋하거나, `fs.existsSync` 실패 경로를 별도 케이스로 분리해야 합니다.

---

**[INFO]** `SECTION_LABELS` 상수가 실제 콘텐츠 디렉터리와 결합(coupling)
- 위치: `registry.ts` — 36~43행
- 상세: 섹션 키와 한글 레이블이 코드 내에 하드코딩되어 있습니다. 새 섹션 추가 시 코드와 디렉터리 양쪽을 수정해야 하며, 두 곳의 동기화가 깨질 위험이 있습니다.
- 제안: 각 섹션 디렉터리에 `_section.json` 또는 `_section.yaml` 메타파일을 두어 레이블을 선언하거나, `humanize` 폴백을 현재처럼 유지하되 `SECTION_LABELS`는 콘텐츠 레이어로 이동하는 방향을 검토할 수 있습니다.

---

**[INFO]** `useMDXComponents` 기본 파라미터가 의도와 다를 수 있음
- 위치: `mdx-components.tsx` — 25행
- 상세: `components: MDXComponents = {}` 기본값이 설정되어 있어 항상 `docsComponents`가 호출자 제공 컴포넌트로 덮어써집니다. Next.js의 MDX 컴포넌트 병합 규약에서는 호출자가 명시적으로 오버라이드할 수 있어야 하는데, 현재 스프레드 순서(`{ ...docsComponents, ...components }`)는 올바릅니다. 다만 함수 시그니처의 기본값이 `{}` 이어서 외부 호출 없이 테스트하기 어렵습니다.
- 제안: 현재 동작에 문제는 없으나, 필요 시 `docsComponents`를 named export하면 개별 컴포넌트를 단위 테스트하기 용이합니다.

---

**[INFO]** 테스트에 `expect.arrayContaining` 사용 시 순서 비검증
- 위치: `registry.test.ts` — `getAllSlugs` describe, 68~77행
- 상세: `getAllSlugs`는 섹션→페이지 순서가 보장된 결과를 반환하지만 `expect.arrayContaining`으로 검증하여 실제 순서가 깨져도 테스트가 통과합니다. 순서가 명세의 일부라면 `toEqual`로 전체 배열을 비교해야 합니다.
- 제안: 순서 보장이 요구사항이면 `expect(slugs).toEqual([["01-first","a"], ...])` 형태로 수정하세요.

---

### 요약

전체적으로 코드 구조는 명확하고 단일 책임 원칙을 잘 따르고 있습니다. `registry.ts`는 파일시스템 스캔, 프론트매터 검증, 인덱스 구축의 세 역할이 비교적 깔끔하게 분리되어 있으며, 테스트도 동작 명세를 한국어로 명시하여 가독성이 높습니다. 다만 `assertFrontmatter`의 이중 검증 구조, 모듈 캐시의 테스트 격리 문제, `fixtures-broken` fixture 누락으로 인한 오탐 위험, `SECTION_LABELS`의 콘텐츠-코드 결합이 향후 유지보수 부담을 높일 수 있는 요소입니다. 특히 `fixtures-broken` fixture 미존재는 예외 테스트의 신뢰성을 저해하므로 우선 확인이 필요합니다.

### 위험도

**LOW**