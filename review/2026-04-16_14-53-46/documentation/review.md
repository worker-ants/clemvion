## 문서화 코드 리뷰

### 발견사항

**[INFO]** `next.config.ts` — 삭제된 주석 누락
- 위치: `transpilePackages` 바로 위 (삭제된 라인)
- 상세: `// Local symlinked package — transpile required for bundler resolution. // Build uses --webpack flag because Turbopack cannot follow symlinked local packages.` 주석이 제거됐어요. `--webpack` 빌드 제약은 여전히 유효한 설명이며, 삭제된 이유가 불명확해요.
- 제안: 해당 빌드 제약이 해소된 게 아니라면 주석을 유지하거나, `README.md`의 빌드 명령 섹션에 이를 기록해요.

---

**[INFO]** `canvas-empty-state.tsx` — JSDoc 없음
- 위치: `CanvasEmptyState` 컴포넌트
- 상세: 컴포넌트가 조건부로만 렌더되는 점(`nodes.length === 0`), `pointer-events-none` 부모 안에서 `pointer-events-auto`를 복구하는 트릭, 그리고 표시 조건 등 비자명한 결정이 있어요. 이 컴포넌트를 처음 보는 개발자는 `panel`에 `pointer-events-none`이 있는 이유를 알기 어려워요.
- 제안:
  ```tsx
  /**
   * 빈 캔버스(nodes.length === 0) 상태에서 중앙 상단에 표시되는 온보딩 카드.
   * ReactFlow Panel이 pointer-events-none이므로 내부에서 pointer-events-auto를 복구해요.
   */
  ```

---

**[INFO]** `field-help.tsx` — `FieldHelpProps` 인터페이스 JSDoc 부재
- 위치: `FieldHelpProps` 인터페이스
- 상세: `side` 기본값(`right`), `docsHref` 형식(`/docs/<section>/<slug>#<anchor>`) 같은 계약이 타입만으로 표현되지 않아요. 스펙(`1-node-common.md`)에는 명시됐지만 코드에는 없어요.
- 제안: `docsHref` 필드에 `/** /docs/<section>/<slug> 형태의 매뉴얼 딥링크. 새 탭으로 열려요. */` 주석 추가.

---

**[WARNING]** `shared.tsx` — 모듈 수준 가변 상태 주석 부재
- 위치: `checkboxIdCounter` / `nextCheckboxId()`
- 상세: 모듈 수준의 가변 카운터(`let checkboxIdCounter = 0`)는 SSR 환경에서 서버 재시작 없이 누적될 수 있고, 테스트 간 상태가 공유될 수 있어요. React 18 `useId()` 대신 이 방식을 선택한 이유가 코드 어디에도 없어요.
- 제안:
  ```ts
  // label이 ReactNode인 경우 string 기반 id 생성이 불가능하므로 단조 증가 카운터를 사용해요.
  // useId()는 React 트리 밖(서버 핸들러)에서 호출 불가, useRef는 훅 환경 필요 — 순수 유틸 함수로 유지해요.
  ```

---

**[INFO]** `_glossary.md` — 등록 제외 방식 문서화 필요
- 위치: `frontend/src/content/docs/_glossary.md` 상단
- 상세: 파일이 언더스코어 접두로 registry에서 제외된다고 설명되어 있지만, registry 코드(`getDocsIndex`)에서 이 규칙이 어떻게 구현되는지 확인이 필요해요. 규칙이 글로서리에만 기술되고 코드에 주석이 없다면 나중에 실수로 제외 규칙을 제거할 수 있어요.
- 제안: registry 파일의 필터 로직 옆에 `// "_"로 시작하는 파일은 내비게이션에서 제외 (예: _glossary.md)` 주석 추가.

---

**[INFO]** MDX 컴포넌트 (`callout.tsx`, `steps.tsx`, `field-table.tsx`, `example.tsx`) — JSDoc 없음
- 위치: 각 컴포넌트
- 상세: `Callout`, `Steps/Step`, `FieldTable`, `Example` 컴포넌트는 MDX 콘텐츠 작성자가 직접 사용하는 공개 API예요. 허용 `type` 값(`"note" | "tip" | "warn"`), `FieldRow` 필드의 의미, `Steps` 안에서만 `Step`을 써야 한다는 제약 등이 JSDoc으로 명시되면 문서 작성자가 타입 정의를 따로 찾지 않아도 돼요.
- 제안: 각 컴포넌트에 사용 예시를 포함한 간단한 JSDoc 추가.

---

**[INFO]** `mdx-components.tsx` (미포함) — 전역 MDX 컴포넌트 등록 파일 확인 필요
- 위치: `frontend/src/mdx-components.tsx` (diff에 내용 없음)
- 상세: Next.js MDX는 `mdx-components.tsx`에서 전역 컴포넌트를 등록해야 해요. 해당 파일이 새로 추가됐지만 diff에 내용이 없어 `Callout`, `Steps`, `FieldTable`, `Example` 컴포넌트가 MDX에서 import 없이 사용 가능한지 확인이 어려워요.
- 제안: `mdx-components.tsx` 파일에 등록된 컴포넌트 목록을 주석으로 명시해 주세요.

---

**[INFO]** README 업데이트 필요성
- 위치: 프로젝트 루트 `README.md`
- 상세: `@next/mdx`, `rehype-*`, `remark-gfm`, `gray-matter` 패키지가 추가됐고, `/docs` 라우트와 `src/content/docs/` 디렉토리가 새로 생겼어요. 빌드 시 `dynamicParams = false`로 정적 생성을 사용하므로 콘텐츠를 추가할 때 빌드가 필요하다는 점도 문서화가 필요해요.
- 제안: README의 "프로젝트 구조" 섹션에 `src/content/docs/` 경로와 MDX 문서 추가 방법을 기술해요.

---

**[INFO]** `page.tsx` (docs/[...slug]) — dynamic import 패턴 주석 부재
- 위치: `await import(\`@/content/docs/${slugPath}.mdx\`)`
- 상세: 동적 import로 MDX를 불러오는 패턴이 `dynamicParams = false`와 함께 동작하는 이유(빌드 타임 정적 생성), 그리고 슬러그와 파일 경로가 어떻게 매핑되는지 자명하지 않아요.
- 제안:
  ```ts
  // generateStaticParams()에서 반환한 slug 배열로 빌드 타임에 모든 경로가 생성돼요.
  // 런타임 동적 라우팅은 없으므로 존재하지 않는 slug는 notFound()로 처리해요.
  ```

---

### 요약

이번 변경은 인앱 사용자 매뉴얼(`/docs`) 전체 인프라를 도입하는 대규모 작업으로, MDX 파이프라인 설정, 레이아웃/사이드바, 10개 이상의 콘텐츠 파일, FieldHelp 컴포넌트, 빈 캔버스 안내 카드, PRD/스펙 문서 갱신까지 일관성 있게 구성되어 있어요. 콘텐츠 자체의 품질(구조, 용어 통일성, 예시 코드)은 높고, `_glossary.md`로 표기 기준을 명시한 점도 긍정적이에요. 다만 `shared.tsx`의 모듈 수준 가변 카운터 선택 이유, `next.config.ts`에서 삭제된 빌드 제약 주석, 공개 MDX 컴포넌트의 JSDoc 부재, README에 새 디렉토리·빌드 방식 미반영이 아쉬운 점이에요. 전반적으로 문서화 관점의 위험도는 낮고, 대부분 주석·JSDoc 보완 수준이에요.

### 위험도

**LOW**