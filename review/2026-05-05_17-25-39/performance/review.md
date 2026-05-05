### 발견사항

- **[INFO]** 동일 URL 중복 네비게이션 — E2E 테스트 실행 시간 낭비
  - 위치: `smoke.spec.ts` — `describe("a11y smoke — forgot-password / reset-password")` 내 두 테스트
  - 상세: 같은 describe 블록 안의 두 테스트가 각각 독립적으로 `page.goto("/forgot-password")`를 호출한다. CI 환경에서 콜드 페이지 로드는 보통 500–1500ms이므로 동일 URL 탐색이 두 번 발생한다. 기존 login/register describe도 동일 패턴이므로 테스트 수가 늘어날수록 누적 비용이 커진다.
  - 제안: `test.beforeEach`로 공통 네비게이션을 공유하거나, axe 스캔과 키보드 진입 단언을 하나의 테스트로 합쳐 네비게이션을 1회로 줄일 수 있다. 단, 테스트 격리가 우선순위라면 현 구조도 허용 가능하다.

  ```ts
  test.describe("a11y smoke — forgot-password / reset-password", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/forgot-password");
    });

    test("axe scan: critical 위반 0", async ({ page }) => {
      const results = await new AxeBuilder({ page }).withTags([...WCAG_TAGS]).analyze();
      expect(results.violations.filter((v) => v.impact === "critical")).toEqual([]);
    });

    test("Tab 시 첫 focusable 확인", async ({ page }) => {
      await page.keyboard.press("Tab");
      const focused = await page.evaluate(() => document.activeElement?.tagName ?? null);
      expect(["A", "INPUT", "BUTTON"]).toContain(focused);
    });
  });
  ```

- **[INFO]** CSS 변수 변경(`--muted-foreground`) — 성능 영향 없음
  - 위치: `globals.css` `:root` / `.dark`
  - 상세: CSS 커스텀 프로퍼티는 런타임 재계산 비용이 O(1)이다. 값 변경은 스타일 캐스케이드에 영향을 주지 않는다.

- **[INFO]** `hover:underline` → `underline` 일괄 변경
  - 위치: 4개 인증 폼 컴포넌트 링크 클래스
  - 상세: Tailwind hover 변형 제거로 `:hover` 이벤트 기반 스타일 재계산 경로가 하나 줄어든다. 체감 불가 수준이지만 방향은 옳다.

---

### 요약

변경 집합 전체가 접근성(WCAG AA) 보강에 집중되어 있어 성능 관점에서 실질적인 위험이 없다. CSS 변수값 조정과 `aria-hidden` / `underline` 추가는 런타임 비용 변화가 무시 수준이며, `result-detail.tsx`의 diff 범위(`StatusBadge` 색상 및 aria-hidden)도 기존의 복잡한 메모이제이션 구조를 건드리지 않는다. 유일하게 의미 있는 지적은 E2E 테스트의 중복 `page.goto` 호출로, CI 빌드 시간이 누적되면 체감할 수 있지만 현 규모에서는 낮은 수준이다.

### 위험도

**LOW**