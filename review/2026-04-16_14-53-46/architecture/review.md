## 발견사항

### **[WARNING]** 모듈 레벨 가변 상태 — SSR/하이드레이션 불일치 위험
- **위치**: `frontend/src/components/editor/settings-panel/node-configs/shared.tsx`
  ```ts
  let checkboxIdCounter = 0;
  function nextCheckboxId() {
    checkboxIdCounter += 1;
    return `cb-${checkboxIdCounter}`;
  }
  ```
- **상세**: 모듈 레벨의 가변 카운터는 서버 렌더링과 클라이언트 하이드레이션 간 ID 순서가 달라질 수 있어요. React concurrent rendering에서도 비결정적이에요. 서버에서 `cb-3`이 생성되었을 때 클라이언트에서 `cb-1`이 생성되면 `<label htmlFor>`와 `<input id>` 연결이 깨져요.
- **제안**: React 18의 `useId()` 훅으로 교체하세요. `label`이 `ReactNode`로 바뀐 시점이 이미 `useId()`를 도입할 수 있는 구조 변경이었어요.

---

### **[WARNING]** 동적 import 경로에 URL 파라미터 직접 사용
- **위치**: `frontend/src/app/(main)/docs/[...slug]/page.tsx`
  ```tsx
  const { default: MDXContent } = await import(
    `@/content/docs/${slugPath}.mdx`
  );
  ```
- **상세**: `dynamicParams = false` + `generateStaticParams`로 알려진 슬러그만 허용되어 런타임 파일시스템 탐색은 차단되지만, 이 패턴은 레지스트리 검증(`getDocBySlug`)과 import 경로 사이에 보이지 않는 결합이 생겨요. 레지스트리에 등록된 슬러그와 실제 파일 경로가 불일치하면 빌드 시점이 아닌 런타임에 에러가 발생해요.
- **제안**: `getDocBySlug`가 MDX Content 모듈을 함께 반환하는 방식으로 결합을 명시적으로 만들거나, 빌드 단계에서 레지스트리-파일 일관성을 검증하는 테스트를 추가하세요.

---

### **[WARNING]** docs URL 경로가 컴포넌트 설정에 하드코딩 분산
- **위치**: `frontend/src/components/editor/settings-panel/node-configs/ai-configs.tsx`, `canvas-empty-state.tsx`
  ```tsx
  docsHref: "/docs/02-nodes/ai",
  href: "/docs/04-run-and-debug/running-a-workflow",
  ```
- **상세**: 문서 URL 구조가 변경되면 컴포넌트 로직 파일을 찾아다니며 수정해야 해요. 이 패턴이 확장되면(다른 노드 설정 파일에도 적용 시) 변경 비용이 커져요.
- **제안**: `src/lib/docs/links.ts` 같은 상수 파일로 중앙화하세요. `export const DOCS = { nodes: { ai: '/docs/02-nodes/ai' } }` 형태면 문서 구조 변경 시 한 곳만 수정하면 돼요.

---

### **[INFO]** `getDocsIndex()` 반복 호출 — 메모이제이션 부재
- **위치**: `docs/layout.tsx`, `docs/page.tsx`, `docs/[...slug]/page.tsx` 모두에서 개별 호출
- **상세**: Next.js App Router의 각 서버 컴포넌트 렌더링마다 `getDocsIndex()`가 별도로 호출돼요. 구현이 `gray-matter` 파일 파싱을 포함한다면(git status에서 추측) 불필요한 I/O가 발생할 수 있어요. Next.js `cache()` 래퍼나 모듈 레벨 캐싱으로 요청당 1회 실행으로 제한할 수 있어요.

---

### **[INFO]** `shared.tsx`와 `shared/` 디렉터리의 동명 공존
- **위치**: `frontend/src/components/editor/settings-panel/node-configs/`
- **상세**: `shared.tsx` 파일과 `shared/` 디렉터리가 같은 레벨에 존재해요. `ai-configs.tsx`가 `./shared`와 `./shared/field-help`를 각각 import하는 구조는 파일 시스템 상 동작하지만, 의미적으로 `shared.tsx`가 `shared/` 디렉터리의 인덱스 역할인지 별개의 파일인지 불명확해요.
- **제안**: `shared.tsx`를 `shared/index.tsx`로 이동해 디렉터리 구조를 명확히 하세요.

---

### **[INFO]** MDX 콘텐츠에 에러 바운더리 부재
- **위치**: `docs/[...slug]/page.tsx`의 `<MDXContent />`
- **상세**: MDX 컴포넌트 렌더링 중 발생하는 React 에러가 페이지 전체를 크래시시켜요. 콘텐츠 오류가 앱 전체 내비게이션에 영향을 줄 수 있어요. `error.tsx` 경계 파일이 docs 하위에 존재하는지 확인이 필요해요.

---

## 요약

이번 변경은 MDX 기반 인앱 문서 시스템을 도입하는 것으로, 전반적인 아키텍처 접근은 합리적이에요. Next.js App Router의 정적 생성(`dynamicParams = false`)과 레지스트리 패턴 조합, `FieldHelp` 컴포넌트의 Popover 기반 점진적 채택 전략, `CanvasEmptyState`의 컴포넌트 분리 등은 바람직한 구조예요. 그러나 모듈 레벨 가변 카운터(`checkboxIdCounter`)는 SSR 환경에서 즉각적인 hydration 불일치 위험이 있고, 분산된 docs URL 하드코딩은 규모 확장 시 유지보수 부담이 되므로 조기 해소가 권장돼요. 레지스트리-파일 경로 결합의 암묵성도 빌드 단계 검증으로 보완하면 견고해질 거예요.

## 위험도
**MEDIUM**