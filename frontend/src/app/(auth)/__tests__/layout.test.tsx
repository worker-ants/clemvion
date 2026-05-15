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
