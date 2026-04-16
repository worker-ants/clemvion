### 발견사항

---

**[CRITICAL] `CheckboxField`의 모듈 레벨 가변 카운터 (`shared.tsx`)**
- 위치: `shared.tsx` — `let checkboxIdCounter = 0`
- 상세: 모듈 스코프의 가변 변수 `checkboxIdCounter`는 두 가지 심각한 부작용을 동반해요.
  1. **SSR 하이드레이션 불일치**: Next.js 서버 렌더링 시 카운터 값이 서버와 클라이언트 간에 다를 수 있어요. 서버는 `cb-3`을 렌더하고, 클라이언트는 `cb-7`을 렌더하면 React가 하이드레이션 경고를 내고 `<label htmlFor>`와 `<input id>` 연결이 깨져요.
  2. **리렌더마다 ID 변경**: `nextCheckboxId()`가 render 함수 안에서 직접 호출돼요. 부모가 리렌더되면 `label`이 ReactNode인 모든 `CheckboxField`가 새 ID를 받아 접근성 연결이 끊겨요.
- 제안: `useId()` (React 18+)로 교체해요. 서버/클라이언트 일관성과 렌더 안정성을 모두 보장해요.

```ts
// 수정 예시
const id = typeof label === "string"
  ? `cb-${label.replace(/\s+/g, "-").toLowerCase()}`
  : `cb-${useId()}`;
```

---

**[WARNING] DocPage의 템플릿 리터럴 동적 import (`[...slug]/page.tsx`)**
- 위치: `DocPage` — `` await import(`@/content/docs/${slugPath}.mdx`) ``
- 상세: 동적 import의 경로가 완전한 변수이면 번들러(webpack/turbopack)가 정적 분석으로 포함할 모듈을 결정하지 못해요. Next.js의 `dynamicParams = false` + `generateStaticParams` 조합이 런타임에는 문제가 없어 보여도, 빌드 시 모든 `.mdx` 파일을 하나의 청크에 묶거나 import를 아예 누락시키는 빌드 에러가 발생할 수 있어요.
- 제안: webpack magic comment 또는 `next/dynamic`과 `import(/* webpackChunkName */ ...)` 패턴을 사용하거나, `registry`에서 직접 MDX 모듈을 resolve하도록 리팩터링해요.

---

**[WARNING] `label` prop 타입 시그니처 변경 (`shared.tsx`)**
- 위치: `FieldGroup`, `SelectField`, `NumberField`, `CheckboxField` — `label: string` → `label: React.ReactNode`
- 상세: TypeScript 타입 레벨에서는 하위 호환이지만, 이 컴포넌트들을 사용하는 외부 코드 중 `label`을 문자열 변수로 다루어 문자열 연산(`.length`, `.trim()` 등)을 수행하던 코드가 있다면 런타임에서 깨질 수 있어요. 테스트 코드가 `getByText(label)`처럼 label 문자열을 직접 쿼리하는 경우에도 영향을 받아요.
- 제안: 컴포넌트 prop 변경 사항을 기존 사용처 전체에서 확인하고, 필요하다면 `labelText?: string` 같은 별도 prop을 추가해 구분하는 것도 고려해요.

---

**[INFO] `rehype-autolink-headings`의 `behavior: "wrap"` (`next.config.ts`)**
- 위치: `withMDX` options
- 상세: `behavior: "wrap"`은 `<h2>텍스트</h2>` 구조를 `<h2><a href="#...">텍스트</a></h2>`로 변환해요. MDX 문서를 테스트하거나 heading 텍스트를 직접 쿼리하는 테스트가 있다면 `getByRole("heading", { name: "..." })`이 여전히 동작하지만, `getByText`나 DOM 구조를 가정한 셀렉터는 깨질 수 있어요.
- 제안: 문서가 아직 초기 단계이므로 현재는 수용 가능해요. 추후 E2E 테스트 추가 시 이 구조를 염두에 두세요.

---

**[INFO] `CanvasEmptyState`의 `<a>` vs `<Link>` (`canvas-empty-state.tsx`)**
- 위치: `canvas-empty-state.tsx` — CTA 링크들
- 상세: `target="_blank"` 링크는 의도적으로 `<a>`를 쓰는 것이 맞지만, 동일 앱 내 경로(`/docs/...`)를 native `<a>`로 여는 경우 클라이언트 사이드 라우팅의 이점(prefetch, 빠른 전환)이 없어요. 그러나 `target="_blank"`이므로 새 탭 열기에서는 이 차이가 없어 실제 동작 문제는 없어요.

---

### 요약

가장 주의해야 할 부작용은 `shared.tsx`에 도입된 모듈 레벨 가변 카운터예요. 이 패턴은 Next.js의 SSR 환경에서 서버/클라이언트 ID 불일치로 이어지고, 리렌더 시 접근성 연결을 매번 끊어요. `useId()`로 교체하면 두 문제가 동시에 해결돼요. 나머지 변경사항(MDX 파이프라인, CSS 추가, 사이드바 항목, 빈 캔버스 UI, 도움말 팝오버)은 기존 기능에 영향을 주지 않는 독립적인 추가 기능으로, 자체적인 부작용은 없거나 낮은 수준이에요. DocPage의 동적 import 패턴은 빌드 환경에 따라 예상치 못한 번들링 문제를 일으킬 수 있으므로 빌드 출력을 한 번 확인하는 것이 좋아요.

### 위험도

**MEDIUM** — `checkboxIdCounter`의 SSR 하이드레이션 이슈가 실제 렌더링 버그로 이어질 수 있으나, 현재 `LabelWithHelp`가 적용된 필드가 소수여서 노출 범위는 제한적이에요.