### 발견사항

- **[WARNING]** 모듈 레벨 가변 카운터 — SSR 하이드레이션 불일치 위험
  - 위치: `shared.tsx` — `let checkboxIdCounter = 0`
  - 상세: 모듈 레벨 카운터는 서버 렌더링과 클라이언트 렌더링 사이에서 각각 독립적으로 증가해요. Next.js SSR 환경에서 서버에서 `cb-5`가 생성됐을 때 클라이언트에서는 `cb-1`이 될 수 있고, 이는 하이드레이션 에러를 유발해요. React Strict Mode에서도 이중 실행으로 인해 카운터가 예상보다 빠르게 증가할 수 있어요.
  - 제안: `useId()` hook (React 18+)을 사용하면 SSR-안전한 고유 ID를 생성할 수 있어요. `CheckboxField`를 Client Component로 변환하거나, `crypto.randomUUID()` 대신 `useId()`를 사용하는 방식을 권장해요.

- **[WARNING]** 템플릿 리터럴 동적 import — 번들 분석 불가
  - 위치: `app/(main)/docs/[...slug]/page.tsx`
  ```ts
  await import(`@/content/docs/${slugPath}.mdx`)
  ```
  - 상세: Webpack/Turbopack은 템플릿 리터럴 동적 import를 정적으로 분석할 수 없어요. 결과적으로 빌더가 `@/content/docs/` 하위 모든 `.mdx` 파일을 하나의 청크에 포함시킬 가능성이 있어요. `dynamicParams = false` + `generateStaticParams`가 있어도 빌드 타임 분석 한계는 별개예요.
  - 제안: `generateStaticParams`에서 반환한 slugs를 기반으로 **정적 import map**을 생성하는 방식을 고려해요. 예를 들어 `src/lib/docs/mdx-map.ts`에서 각 slug별 import를 명시적으로 선언하거나, `next/dynamic`과 함께 사용해 청크 분리를 명확히 하는 방법이 있어요.

- **[INFO]** `getDocsIndex()` 반복 호출 — 캐싱 여부 불명확
  - 위치: `layout.tsx`, `page.tsx`, `[...slug]/page.tsx`
  - 상세: `getDocsIndex()`가 한 요청 사이클 내에서 최대 3회 호출돼요. 내부 구현이 보이지 않아 확인이 필요하지만, 파일시스템 읽기나 frontmatter 파싱을 포함한다면 요청마다 반복 실행될 수 있어요. Next.js의 `unstable_cache`나 단순 모듈 레벨 캐시가 없는 경우 개발 서버에서 HMR 중 느릴 수 있어요.
  - 제안: `getDocsIndex()` 내부에서 결과를 모듈 레벨 변수에 캐싱하는지 확인하고, 없다면 `const _cache = new Map()` 패턴이나 Next.js `cache()` 함수로 요청 범위 캐싱을 추가해요.

- **[INFO]** `DocsIndexPage`에서 redirect만을 위한 `getDocsIndex()` 호출
  - 위치: `app/(main)/docs/page.tsx`
  - 상세: 첫 페이지 href를 얻기 위해 전체 인덱스를 로드해요. 첫 페이지 경로가 고정값에 가깝다면 하드코딩하거나 환경 상수로 분리하는 편이 더 효율적이에요.
  - 제안: `redirect("/docs/01-getting-started/what-is-this")`로 고정하거나, `DOCS_DEFAULT_HREF` 상수를 registry에서 export해 직접 사용해요.

---

### 요약

이번 변경은 MDX 기반 사용자 가이드 시스템 추가가 핵심이에요. 대부분의 작업이 빌드 타임 정적 생성 경로(`generateStaticParams`, `dynamicParams = false`)를 사용하고 있어 런타임 성능 부담은 낮아요. 그러나 **모듈 레벨 `checkboxIdCounter`의 SSR 하이드레이션 불일치**는 실제 버그로 이어질 수 있고, **템플릿 리터럴 동적 import**는 번들 크기에 영향을 줄 수 있어요. `getDocsIndex()` 캐싱 여부는 구현 확인이 필요해요.

### 위험도

**LOW** — 런타임 성능 영향은 제한적이나, SSR 하이드레이션 이슈(체크박스 ID)는 기능 정확성에 영향을 줄 수 있어요.