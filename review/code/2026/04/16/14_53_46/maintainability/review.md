## 유지보수성 코드 리뷰

### 발견사항

---

#### **[WARNING]** `checkboxIdCounter` 모듈 수준 전역 변수 사용
- **위치**: `shared.tsx` — `let checkboxIdCounter = 0`
- **상세**: 모듈 수준 가변 전역 카운터는 테스트 간 상태 누수, HMR 시 예기치 않은 재설정, SSR 환경에서의 불일치 등 부작용을 일으킬 수 있어요. React의 `useId` 훅은 이 문제를 런타임·SSR 양쪽에서 안전하게 해결해요.
- **제안**: 
```tsx
// CheckboxField 내부에서
const id = typeof label === "string"
  ? `cb-${label.replace(/\s+/g, "-").toLowerCase()}`
  : `cb-${useId()}`;
```

---

#### **[WARNING]** `docsHref` 인라인 문자열 하드코딩 — 동일 경로 반복
- **위치**: `ai-configs.tsx` — 3개 `LabelWithHelp`의 `docsHref` 모두 `"/docs/02-nodes/ai"` 중복
- **상세**: 문서 경로가 변경될 때 여러 곳을 동시에 수정해야 해요. 같은 파일 내에서도 동일 문자열이 3회 반복되고 있어요.
- **제안**: 파일 상단에 상수로 추출:
```tsx
const AI_DOCS_HREF = "/docs/02-nodes/ai";
```

---

#### **[WARNING]** `canvas-empty-state.tsx` — `GETTING_STARTED_HREF` 상수와 `STEPS[*].href` 간 관계 불명확
- **위치**: `canvas-empty-state.tsx` — L5, L9
- **상세**: CTA 버튼 href(`/docs/01-getting-started/first-workflow`)와 STEPS 배열의 href들이 같은 레벨의 상수임에도 하나만 `const`로 추출되고 나머지는 인라인으로 남아 있어요. 일관성이 떨어지고 문서 경로가 변경될 때 누락이 생길 수 있어요.
- **제안**: STEPS 배열의 href들도 같은 수준으로 상수화하거나, `DOCS_LINKS` 객체로 중앙 관리:
```tsx
const DOCS_LINKS = {
  gettingStarted: "/docs/01-getting-started/first-workflow",
  nodeOverview: "/docs/02-nodes/overview",
  uiTour: "/docs/01-getting-started/ui-tour",
  runWorkflow: "/docs/04-run-and-debug/running-a-workflow",
} as const;
```

---

#### **[INFO]** `DocPage`에서 동적 `import()` 사용 — 빌드 타임 안전성 부족
- **위치**: `page.tsx:L44-46`
- **상세**: 
```tsx
const { default: MDXContent } = await import(`@/content/docs/${slugPath}.mdx`);
```
동적 경로 import는 번들러가 정적 분석을 할 수 없어 빌드 시 잘못된 경로를 감지하지 못해요. `dynamicParams = false`와 `generateStaticParams`로 경로를 제한하고 있어 런타임 오류는 `notFound()`로 방어되지만, 빌드 에러로 즉시 확인하는 방식보다 피드백이 늦어요.
- **제안**: 현재 구조상 불가피하다면 `try/catch`로 감싸 명시적인 `notFound()` 처리를 추가하거나 주석으로 의도를 문서화.

---

#### **[INFO]** `DocsIndexPage`에서 fallback href `/dashboard`가 하드코딩
- **위치**: `page.tsx:L7` — `redirect(first?.href ?? "/dashboard")`
- **상세**: 문서 섹션이 없을 때 `/dashboard`로 리다이렉트하는 로직이 인라인 문자열이에요. 변경 시 추적하기 어렵고 의도가 불명확해요.
- **제안**: `FALLBACK_REDIRECT = "/dashboard"` 상수 또는 `notFound()` 처리로 변경.

---

#### **[INFO]** `FieldHelp`의 `side` prop 기본값이 `LabelWithHelp`에서 재정의 불가
- **위치**: `field-help.tsx` — `LabelWithHelpProps`의 `help: Omit<FieldHelpProps, "side" | "className">`
- **상세**: `LabelWithHelp`를 통해 `FieldHelp`를 쓸 때 `side`를 지정할 수 없어요. 노드 설정 패널의 레이아웃에 따라 팝오버 방향을 변경해야 하는 케이스(예: 좌측에 배치된 필드)에서 유연성이 제한돼요.
- **제안**: `side`를 `Omit` 목록에서 제거하거나 `LabelWithHelpProps`에 `side` 옵션을 노출.

---

#### **[INFO]** `globals.css` — `docs-prose` 스타일 블록이 별도 파일로 분리되지 않음
- **위치**: `globals.css` L108-215 (+108줄 추가)
- **상세**: 범용 globals.css에 docs 전용 스타일이 110줄 추가되어 파일 책임이 증가했어요. 현재는 문제없지만 매뉴얼 스타일이 더 늘어나면 관리가 어려워져요.
- **제안**: `docs.css`를 별도로 분리하고 `globals.css`에서 import하거나, Tailwind의 `@layer` 방식으로 이동을 고려.

---

### 요약

이번 변경은 MDX 기반 인앱 사용자 가이드 시스템을 추가하는 잘 구조화된 작업이에요. `FieldHelp`/`LabelWithHelp` 컴포넌트 분리, `CanvasEmptyState` 명확한 역할 정의, docs 레지스트리 분리 등 전반적으로 유지보수성이 좋은 설계를 따르고 있어요. 다만 `checkboxIdCounter` 전역 가변 카운터가 React 관용적이지 않고 테스트 환경에서 상태 오염 가능성이 있으며, 문서 경로 문자열이 여러 파일에 중복 하드코딩되어 있어 경로 변경 시 누락 위험이 존재해요. 이 두 가지를 개선하면 전체 유지보수성이 크게 향상될 거예요.

### 위험도

**LOW**