import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import AuthLayout from "../layout";

describe("AuthLayout", () => {
  it("renders the full logo above the card slot with auto theme (spec §8.4.6 R-17)", () => {
    render(
      <AuthLayout>
        <div data-testid="auth-card">card</div>
      </AuthLayout>,
    );
    // R-17 (2026-05-25): the dedicated dark backdrop was dropped — the
    // logo now uses theme="auto" and adapts to the active mode via the
    // dual-img Tailwind `dark:` swap. Both /logo.svg and /logo-dark.svg
    // must be present in the DOM.
    const imgs = screen.getAllByRole("img", { hidden: true });
    const srcs = imgs.map((i) => i.getAttribute("src"));
    expect(srcs).toContain("/logo.svg");
    expect(srcs).toContain("/logo-dark.svg");
    expect(imgs.every((i) => i.getAttribute("alt")?.includes("Agentic Workflow"))).toBe(true);
    expect(screen.getByTestId("auth-card")).toBeInTheDocument();
  });

  it("keeps the original gradient background (theme rolled back post brand-refresh)", () => {
    // The brand-refresh kept Shadcn neutral theme tokens, so the
    // pre-existing gradient surface is restored. The brand SVG sits on top.
    const { container } = render(
      <AuthLayout>
        <div>card</div>
      </AuthLayout>,
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("bg-gradient-to-br");
  });

  it("logo wrapper has no dedicated backdrop (R-17 dropped #111e14)", () => {
    // R-14 originally placed the logo on a #111e14 dark surface. R-17
    // (2026-05-25) dropped that backdrop — the transparent brand SVG
    // (R-16) now sits directly on the auth gradient surface.
    render(
      <AuthLayout>
        <div>card</div>
      </AuthLayout>,
    );
    const imgs = screen.getAllByRole("img", { hidden: true });
    const wrapper = imgs[0].parentElement?.parentElement;
    expect(wrapper?.className ?? "").not.toContain("bg-[#111e14]");
    expect(wrapper?.className ?? "").not.toMatch(/rounded/);
  });

  it("renders the logo as a non-link element so first Tab lands on the form input", () => {
    // Enforces the a11y contract from e2e/a11y/smoke.spec.ts — auth screens
    // intentionally skip a home link in the layout so keyboard users reach
    // the form input directly. See layout.tsx comment.
    render(
      <AuthLayout>
        <div>card</div>
      </AuthLayout>,
    );
    const link = screen.queryByRole("link", { name: /Clemvion/i });
    expect(link).toBeNull();
  });
});
