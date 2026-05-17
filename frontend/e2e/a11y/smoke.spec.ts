import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * WCAG 2.1 A/AA 태그. axe 가 검사할 범위를 명시 — 4.1.2/1.3.1/4.1.3 등 핵심
 * 룰이 모두 포함된다. 한 곳에서 정의해 모든 시나리오가 동일 기준으로 검사
 * (review W-11).
 */
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] as const;

/**
 * 접근성 baseline smoke — 로그인/회원가입 페이지의 axe scan.
 * critical 위반 0 이 Stage 10 종료 기준.
 *
 * dev 서버가 떠 있어야 한다 (`PLAYWRIGHT_BASE_URL` 또는 default
 * http://localhost:3012). dev 서버 미기동 시 Playwright 가 connection refused
 * 로 실패하므로 별도 startup 도구 (webServer) 는 본 단계에서는 도입하지 않는다.
 */
test.describe("a11y smoke — login page", () => {
  test("axe scan: critical 위반 0", async ({ page }) => {
    await page.goto("/login");
    const results = await new AxeBuilder({ page })
      .withTags([...WCAG_TAGS])
      .analyze();
    const criticals = results.violations.filter((v) => v.impact === "critical");
    if (criticals.length > 0) {
      console.log(
        `\n[a11y smoke] login page — ${criticals.length} critical 위반:`,
      );
      for (const v of criticals) {
        console.log(`  - ${v.id}: ${v.description}`);
        for (const node of v.nodes.slice(0, 3)) {
          console.log(`      ${node.target.join(" ")}`);
        }
      }
    }
    expect(criticals).toEqual([]);
  });

  test("h1 1개 존재 (페이지 heading 위계)", async ({ page }) => {
    await page.goto("/login");
    const h1Count = await page.locator("h1").count();
    expect(h1Count).toBe(1);
  });

  /**
   * 전체 위반(critical + serious + moderate + minor) 을 0 으로 강제. 도입 시점
   * (review W-2) 에 dead test 로 분류돼 baseline 으로 전환 — 이미 login 은 0
   * 위반이므로 회귀 감지용으로 0 강제. 향후 위반 발생 시 즉시 fail 로 검출.
   */
  test("axe scan: 전체 위반 0 (회귀 감지)", async ({ page }) => {
    await page.goto("/login");
    const results = await new AxeBuilder({ page })
      .withTags([...WCAG_TAGS])
      .analyze();
    if (results.violations.length > 0) {
      console.log(
        `\n[a11y smoke] login page — 총 ${results.violations.length} 위반:`,
      );
      for (const v of results.violations) {
        console.log(`  - [${v.impact}] ${v.id}: ${v.description}`);
      }
    }
    expect(results.violations).toEqual([]);
  });
});

test.describe("a11y smoke — register page", () => {
  test("axe scan: critical 위반 0", async ({ page }) => {
    await page.goto("/register");
    const results = await new AxeBuilder({ page })
      .withTags([...WCAG_TAGS])
      .analyze();
    const criticals = results.violations.filter((v) => v.impact === "critical");
    expect(criticals).toEqual([]);
  });

  test("h1 1개 존재", async ({ page }) => {
    await page.goto("/register");
    const h1Count = await page.locator("h1").count();
    expect(h1Count).toBe(1);
  });
});

test.describe("a11y smoke — forgot-password page", () => {
  test("axe scan: critical 위반 0", async ({ page }) => {
    await page.goto("/forgot-password");
    const results = await new AxeBuilder({ page })
      .withTags([...WCAG_TAGS])
      .analyze();
    const criticals = results.violations.filter((v) => v.impact === "critical");
    if (criticals.length > 0) {
      console.log(
        `\n[a11y smoke] forgot-password page — ${criticals.length} critical 위반:`,
      );
      for (const v of criticals) {
        console.log(`  - ${v.id}: ${v.description}`);
      }
    }
    expect(criticals).toEqual([]);
  });

  test("h1 1개 존재", async ({ page }) => {
    await page.goto("/forgot-password");
    const h1Count = await page.locator("h1").count();
    expect(h1Count).toBe(1);
  });

  test("키보드 진입 — 첫 Tab 시 email 입력으로 직접 도달", async ({ page }) => {
    await page.goto("/forgot-password");
    // (auth) layout 은 skip-to-main 없음 — 첫 Tab 이 폼 첫 input 으로.
    await page.keyboard.press("Tab");
    const focusedTag = await page.evaluate(
      () => document.activeElement?.tagName ?? null,
    );
    expect(focusedTag).toBe("INPUT");
  });
});
