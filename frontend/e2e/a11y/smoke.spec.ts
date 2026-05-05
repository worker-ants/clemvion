import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Stage 10 baseline smoke — 로그인 페이지 단일 axe scan.
 * 이 단계에서는 위반을 "잡아낼 수 있는지" 확인이 목적. critical 위반 0 이
 * Stage 10 종료 기준.
 *
 * dev 서버가 떠 있어야 한다 (`PLAYWRIGHT_BASE_URL` 또는 default
 * http://localhost:3000). dev 서버 미기동 시 Playwright 가 connection refused
 * 로 실패하므로 별도 startup 도구 (webServer) 는 도입하지 않는다 — 마이그레이션
 * 단계에서는 운영자가 dev 서버를 띄운 상태로 호출하는 흐름이 단순.
 */
test.describe("a11y smoke — login page", () => {
  test("axe scan: critical 위반 0", async ({ page }) => {
    await page.goto("/login");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
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

  /**
   * baseline 단계 — 모든 위반 (critical 포함 minor/moderate/serious) 을 콘솔로
   * 보고하지만 전체를 expect 로 강제하지는 않는다. Step F (색 대비) 등에서
   * 점진적으로 0 으로 끌어내릴 예정.
   */
  test("axe scan: 전체 위반 보고 (assertion 없음)", async ({ page }) => {
    await page.goto("/login");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    if (results.violations.length === 0) {
      console.log("\n[a11y smoke] login page — 위반 없음");
      return;
    }
    console.log(
      `\n[a11y smoke] login page — 총 ${results.violations.length} 위반 (impact 별 분류):`,
    );
    const byImpact = new Map<string, number>();
    for (const v of results.violations) {
      const key = v.impact ?? "unknown";
      byImpact.set(key, (byImpact.get(key) ?? 0) + 1);
    }
    for (const [impact, count] of byImpact) {
      console.log(`  ${impact}: ${count}`);
    }
  });
});
