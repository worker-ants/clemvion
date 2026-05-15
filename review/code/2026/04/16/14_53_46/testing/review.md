### 발견사항

---

**[WARNING]** `checkboxIdCounter`가 모듈 수준 변경 가능 상태(mutable state)
- 위치: `shared.tsx` — `let checkboxIdCounter = 0;`
- 상세: 모듈 레벨 카운터는 테스트 간에 초기화되지 않아요. `CheckboxField`에 ReactNode label을 전달하는 테스트가 여러 개 실행되면 `cb-1`, `cb-2`... 처럼 ID가 비결정적으로 변해요. `label`을 기반으로 `for`/`aria-labelledby`를 검증하는 테스트가 생기면 즉시 깨질 수 있어요.
- 제안: `useId()` (React 18) 훅으로 교체하면 SSR 안전성과 테스트 결정성을 동시에 확보할 수 있어요. 서버 컴포넌트라면 `crypto.randomUUID()` 대신 `useId()`를 Client Component에서 사용해요.

---

**[WARNING]** `DocsSidebar` 테스트 없음
- 위치: `docs-sidebar.tsx`
- 상세: `usePathname()`을 직접 호출하는 `"use client"` 컴포넌트인데 테스트가 없어요. `active` 상태(현재 경로와 일치할 때 `aria-current="page"` 설정, 배경색 변경)는 사이드바의 핵심 동작이에요.
- 제안:
  ```tsx
  // next/navigation 모킹 후:
  it("현재 경로와 일치하는 항목에 aria-current=page가 붙어요", () => {
    vi.mocked(usePathname).mockReturnValue("/docs/01-getting-started/what-is-this");
    render(<DocsSidebar sections={mockSections} />);
    expect(screen.getByRole("link", { name: "이 제품은 무엇인가요" }))
      .toHaveAttribute("aria-current", "page");
  });
  ```

---

**[WARNING]** `DocsIndexPage` 리다이렉트 동작 테스트 없음
- 위치: `frontend/src/app/(main)/docs/page.tsx`
- 상세: `index.sections[0]?.pages[0]`이 없을 때 `/dashboard`로 리다이렉트하는 경로가 테스트되지 않아요. 콘텐츠 없는 상태에서의 fallback 동작은 회귀 취약점이에요.
- 제안: `getDocsIndex`를 mock하여 빈 섹션 케이스와 정상 케이스 두 가지를 커버하는 테스트 추가.

---

**[WARNING]** `docs` 레지스트리(`registry.ts`) 테스트 파일 확인 필요
- 위치: `frontend/src/lib/docs/__tests__/` — fixture 파일들만 diff에 포함됨
- 상세: `fixtures/` 디렉토리와 `fixtures-broken/` 디렉토리가 있는 걸로 보아 테스트가 설계되었을 것이나, 실제 테스트 파일(`registry.test.ts` 등)이 diff에 없어요. `frontmatter 없는 파일` 처리(broken fixture), `getAllSlugs`, `getDocBySlug` 함수가 테스트되지 않으면 라우팅 전체가 위험해요.
- 제안: `__tests__/registry.test.ts`가 존재하는지 확인하고, 없다면 최소한 아래 케이스를 추가:
  - 정상 MDX 파일 파싱
  - frontmatter 없는 파일 → 예외 처리
  - `_` 접두사 파일 제외
  - `getDocBySlug` slug 불일치 → `undefined` 반환

---

**[INFO]** `FieldHelp` Radix UI Popover 포털 렌더링 주의
- 위치: `field-help.test.tsx`
- 상세: Radix `PopoverContent`는 `document.body` 포털로 렌더돼요. `screen.findByText()`는 전체 document를 검색하므로 현재 구조에서는 동작하지만, `@testing-library/react`의 `within()` 스코프로 검색하면 찾지 못할 수 있어요. 또한 `PopoverTrigger`가 `asChild` 없이 `button`을 감싸는 구조에서 포커스 이벤트가 예상대로 동작하는지 검증하는 **키보드 접근성 테스트**(Tab → Enter → Escape)가 없어요.
- 제안:
  ```tsx
  it("Escape 키로 Popover가 닫혀요", async () => {
    const user = userEvent.setup();
    render(<FieldHelp summary="설명" />);
    await user.click(screen.getByLabelText("도움말"));
    await screen.findByText("설명");
    await user.keyboard("{Escape}");
    expect(screen.queryByText("설명")).not.toBeInTheDocument();
  });
  ```

---

**[INFO]** MDX 컴포넌트들(`Callout`, `Example`, `FieldTable`, `Steps`) 테스트 없음
- 위치: `frontend/src/components/docs/mdx/`
- 상세: 단순 presentational 컴포넌트이지만, `Callout`의 `type`별 CSS 클래스 적용(`note`/`tip`/`warn`), `FieldTable`의 `required` 렌더링, `Steps`의 `marker` 순서 등은 문서 품질에 직결돼요. 테스트가 없으면 향후 스타일 리팩토링 시 회귀를 잡기 어려워요.
- 제안: 각 컴포넌트당 1~2개의 스냅샷 테스트 또는 role/text 기반 단위 테스트 추가.

---

**[INFO]** `CheckboxField`에서 ReactNode label을 사용할 때 `id` 기반 연결 검증 없음
- 위치: `shared.tsx` + 관련 테스트
- 상세: `typeof label === "string"`이 아닐 때 생성된 `cb-N` ID와 `<input>` 의 `id`, `<label>` 의 `htmlFor`가 올바르게 연결되는지 검증하는 테스트가 없어요. 접근성 요구사항이기도 해요.

---

### 요약

핵심 신규 기능인 `CanvasEmptyState`와 `FieldHelp`/`LabelWithHelp`는 테스트가 존재하고 주요 스펙(aria, 새 탭 링크, popover 열기/닫기, docsHref 조건부 렌더)을 커버해요. 그러나 `DocsSidebar`의 활성 상태, 문서 레지스트리(`registry.ts`)의 파싱·라우팅 로직, `DocsIndexPage`의 리다이렉트 폴백은 테스트가 없거나 미확인 상태예요. 특히 `shared.tsx`의 `checkboxIdCounter`가 모듈 수준 전역 상태로 남아 있어 테스트 간 격리를 깨뜨릴 수 있고, `DocsSidebar`는 `usePathname` mock 없이는 동작 검증이 불가능한 구조예요. 레지스트리 fixture 파일이 있는 것으로 보아 테스트가 설계되었을 가능성은 있지만, diff에 실제 테스트 파일이 포함되지 않아 커버리지 확인이 필요해요.

### 위험도

**MEDIUM**