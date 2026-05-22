import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import AuthLayout from "../layout";

describe("AuthLayout", () => {
  it("renders the dark-theme full logo above the card slot (spec §8.4.6)", () => {
    render(
      <AuthLayout>
        <div data-testid="auth-card">card</div>
      </AuthLayout>,
    );
    // The auth slot uses the dark logo variant on a dark surface for contrast.
    const img = screen.getByRole("img");
    expect(img.getAttribute("src")).toBe("/logo-dark.jpg");
    expect(img.getAttribute("alt")).toBe("Clemvion");
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

  it("wraps the logo in a vine-dark-bg-elevated surface for contrast", () => {
    // Vine-green accents wash out on the light gradient surface. The logo
    // sits on a #111e14 (vine-dark-bg-elevated) container — same look as
    // the apple-icon. Verified at the wrapper of the <img>.
    render(
      <AuthLayout>
        <div>card</div>
      </AuthLayout>,
    );
    const img = screen.getByRole("img");
    const wrapper = img.parentElement?.parentElement;
    expect(wrapper?.className).toContain("bg-[#111e14]");
    expect(wrapper?.className).toMatch(/rounded/);
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
