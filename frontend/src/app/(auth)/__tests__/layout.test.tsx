import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import AuthLayout from "../layout";

describe("AuthLayout", () => {
  it("renders the full logo above the card slot (spec §8.4.6 + 10-auth-flow.md §1)", () => {
    render(
      <AuthLayout>
        <div data-testid="auth-card">card</div>
      </AuthLayout>,
    );
    // Logo + card both present, logo announces full alt (sub-copy is always-on)
    const imgs = screen.getAllByRole("img", { hidden: true });
    expect(imgs.length).toBeGreaterThan(0);
    expect(
      imgs.some((img) => img.getAttribute("alt")?.includes("Agentic Workflow")),
    ).toBe(true);
    expect(screen.getByTestId("auth-card")).toBeInTheDocument();
  });

  it("uses solid --background (no gradient — spec §8.4.4 prohibits)", () => {
    const { container } = render(
      <AuthLayout>
        <div>card</div>
      </AuthLayout>,
    );
    const wrapper = container.firstChild as HTMLElement;
    // bg-[hsl(var(--background))] resolves to soil-50 (light) / vine-dark-bg-base (dark)
    expect(wrapper.className).toContain("bg-[hsl(var(--background))]");
    // No gradient class names should remain from the old layout
    expect(wrapper.className).not.toContain("gradient");
    expect(wrapper.className).not.toContain("bg-gradient");
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
