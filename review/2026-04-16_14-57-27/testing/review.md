### 발견사항

- **[WARNING]** `getDocsIndex()` 캐싱 로직에 대한 테스트 누락
  - 위치: `registry.ts` — `getDocsIndex()` 함수 (모듈 레벨 `cachedIndex`)
  - 상세: `cachedIndex`가 모듈 싱글턴이므로 테스트 간 상태가 누출됩니다. 한 테스트에서 `getDocsIndex()`를 호출하면 이후 테스트의 환경(NODE_ENV, 파일 구조)이 달라도 캐시된 인덱스가 반환됩니다. 현재 테스트는 `loadDocsIndex`를 직접 호출하므로 당장은 안전하지만, 캐시 히트·무효화 동작 자체는 전혀 검증되지 않습니다.
  - 제안: `getDocsIndex()` 전용 테스트를 추가하고, 모듈 캐시를 초기화할 수 있도록 `resetDocsIndexCache()` 내부 함수를 export하거나 `vi.resetModules()`를 활용하세요.

- **[WARNING]** `fixtures-broken` 디렉터리가 실제로 존재하지 않으면 테스트가 의도와 다르게 통과함
  - 위치: `registry.test.ts` — `"frontmatter 필수 필드 검증에 실패하면 예외를 던져요"` (line 43)
  - 상세: `loadDocsIndex`는 존재하지 않는 root에 대해 빈 결과를 반환(`listSectionDirs`에서 `[]` 반환)합니다. `fixtures-broken` 디렉터리가 없으면 예외를 던지지 않고 `{ sections: [], byHref: Map {} }`를 반환하여 `expect(...).toThrow()` 단언이 **실패**해야 하나, 리포에 해당 디렉터리가 없는 경우 항상 실패하는 테스트가 됩니다. 반대로 누락된 frontmatter 파일이 있는 디렉터리가 실제로 없으면 이 테스트는 red 상태입니다.
  - 제안: `fixtures-broken/01-test/broken.mdx`(필수 필드 누락 파일)를 실제로 커밋하거나, 테스트 내에서 `tmp` 디렉터리를 동적으로 생성·삭제(`beforeEach`/`afterEach`)하여 fixture 존재를 보장하세요.

- **[WARNING]** `sectionLabel` / `humanize` / `stripNumberPrefix` 헬퍼 함수에 대한 단위 테스트 없음
  - 위치: `registry.ts` — `stripNumberPrefix`, `humanize`, `sectionLabel` 함수
  - 상세: `SECTION_LABELS` 매핑에 없는 키가 들어올 때 `humanize()`가 올바른 라벨을 생성하는지 검증되지 않습니다. 예: `"07-new-section"` → `"New Section"` 변환 로직의 엣지 케이스(숫자만 있는 경우, 빈 문자열 등)가 미검증 상태입니다.
  - 제안: `humanize`, `stripNumberPrefix`를 export하고 별도 단위 테스트를 추가하거나, 통합 테스트에 `SECTION_LABELS`에 없는 키를 가진 fixture 섹션을 추가하여 `label` 필드를 검증하세요.

- **[WARNING]** `getAllSlugs`가 draft 포함 여부를 index 생성 옵션에 의존하는데, 이 관계가 테스트에서 명시적으로 검증되지 않음
  - 위치: `registry.test.ts` — `getAllSlugs` describe 블록
  - 상세: `getAllSlugs(index)` 자체는 draft를 필터링하지 않고 index에 이미 포함된 페이지를 그대로 반환합니다. 테스트에서 `loadDocsIndex(fixturesRoot)` (draft 제외)로 생성한 index를 사용하고 있어 동작은 맞지만, `includeDrafts: true`로 생성한 index에 `getAllSlugs`를 호출했을 때 draft slug가 포함됨을 검증하는 대칭 케이스가 없습니다.
  - 제안: `includeDrafts: true` index에서 `getAllSlugs`를 호출하면 `"02-second/c"`(draft)가 포함됨을 검증하는 테스트를 추가하세요.

- **[INFO]** `useMDXComponents`의 `a` 컴포넌트 렌더링 로직에 대한 테스트 없음
  - 위치: `mdx-components.tsx`
  - 상세: 내부 링크(`/docs/...`)는 `<Link>`로, 외부 링크는 `target="_blank" rel="noopener noreferrer"` `<a>`로 렌더링되는 분기 로직이 있으나 테스트가 없습니다. `href`가 `undefined`인 경우도 미검증입니다.
  - 제안: `@testing-library/react`로 `<a href="/internal">`와 `<a href="https://external.com">`에 대한 렌더링 테스트를 추가하세요.

- **[INFO]** `loadDocsIndex`에서 섹션에 페이지가 0개일 때 섹션을 건너뛰는 로직 미검증
  - 위치: `registry.ts:115` — `if (pages.length === 0) continue;`
  - 상세: 섹션 디렉터리는 존재하지만 모든 파일이 draft이고 `includeDrafts: false`인 경우, 섹션 자체가 생략됩니다. 이 경로를 검증하는 테스트가 없습니다.
  - 제안: `02-second` 섹션에서 `includeDrafts: false`로 `d.mdx`도 draft로 만든 fixture를 추가하거나, 별도 fixture set으로 "모든 페이지가 draft인 섹션은 sections 배열에서 제외"됨을 검증하세요.

---

### 요약

`registry.ts`의 핵심 기능(섹션 정렬, draft 필터링, underscore 제외, slug 매핑)은 fixture 기반 통합 테스트로 잘 커버되어 있고 테스트 가독성도 우수합니다. 그러나 `fixtures-broken` fixture의 실제 존재 여부에 의존하는 취약한 예외 테스트, 모듈 레벨 캐시(`cachedIndex`)에 대한 미검증, 내부 헬퍼 함수의 엣지 케이스 누락이 있습니다. `mdx-components.tsx`의 링크 분기 로직은 전혀 테스트되지 않습니다. 전반적으로 happy-path 커버리지는 충분하나 경계 케이스와 캐시 격리에 보완이 필요합니다.

### 위험도

**MEDIUM**