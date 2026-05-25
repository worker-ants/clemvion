import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Logo, LogoMark } from "../logo";

describe("Logo", () => {
  it("renders full logo by default with sub-copy alt", () => {
    render(<Logo />);
    const imgs = screen.getAllByRole("img");
    expect(imgs.length).toBeGreaterThan(0);
    // alt contains the Agentic Workflow tagline since sub-copy is always-on (spec §8.4.3)
    expect(imgs.some((img) => img.getAttribute("alt")?.includes("Agentic Workflow"))).toBe(true);
  });

  it("renders mark variant (no sub-copy in alt)", () => {
    render(<Logo variant="mark" theme="light" />);
    const img = screen.getByRole("img");
    expect(img.getAttribute("src")).toBe("/logo-mark.svg");
    expect(img.getAttribute("alt")).toBe("Clemvion");
  });

  it("renders wordmark variant", () => {
    render(<Logo variant="wordmark" theme="light" />);
    const img = screen.getByRole("img");
    expect(img.getAttribute("src")).toBe("/logo-wordmark.svg");
  });

  it("renders light theme explicitly with the light asset path", () => {
    render(<Logo variant="full" theme="light" />);
    const img = screen.getByRole("img");
    expect(img.getAttribute("src")).toBe("/logo.svg");
  });

  it("renders dark theme explicitly with the dark asset path", () => {
    render(<Logo variant="full" theme="dark" />);
    const img = screen.getByRole("img");
    expect(img.getAttribute("src")).toBe("/logo-dark.svg");
  });

  it("renders both light and dark assets when theme=auto", () => {
    render(<Logo variant="full" theme="auto" />);
    const imgs = screen.getAllByRole("img", { hidden: true });
    const srcs = imgs.map((i) => i.getAttribute("src"));
    expect(srcs).toContain("/logo.svg");
    expect(srcs).toContain("/logo-dark.svg");
    // Light is hidden in dark mode, dark is hidden in light mode — Tailwind `dark:` variant
    const lightImg = imgs.find((i) => i.getAttribute("src") === "/logo.svg")!;
    const darkImg = imgs.find((i) => i.getAttribute("src") === "/logo-dark.svg")!;
    expect(lightImg.className).toContain("dark:hidden");
    expect(darkImg.className).toContain("hidden");
    expect(darkImg.className).toContain("dark:block");
  });

  it("applies size prop as inline width style", () => {
    render(<Logo variant="full" theme="light" size={200} />);
    const img = screen.getByRole("img");
    expect((img as HTMLElement).style.width).toBe("200px");
  });

  it("respects an explicit alt override", () => {
    render(<Logo variant="full" theme="light" alt="Custom alt" />);
    const img = screen.getByRole("img");
    expect(img.getAttribute("alt")).toBe("Custom alt");
  });

  it("forwards className to the wrapper", () => {
    const { container } = render(
      <Logo variant="mark" theme="light" className="custom-class" />,
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("custom-class");
  });

  it("omits inline width style when size is not provided", () => {
    render(<Logo variant="full" theme="light" />);
    const img = screen.getByRole("img");
    expect((img as HTMLElement).style.width).toBe("");
  });

  it("sets height: auto alongside width to preserve aspect ratio", () => {
    render(<Logo variant="mark" theme="light" size={48} />);
    const img = screen.getByRole("img");
    expect((img as HTMLElement).style.width).toBe("48px");
    expect((img as HTMLElement).style.height).toBe("auto");
  });

  it("renders wordmark variant with auto theme (separate light/dark assets)", () => {
    // Wordmark now splits into light (black text) and dark (white text)
    // variants — spec §8.4.4 R-16. The auto renderer emits both and lets
    // Tailwind `dark:` swap them.
    render(<Logo variant="wordmark" theme="auto" />);
    const imgs = screen.getAllByRole("img", { hidden: true });
    expect(imgs).toHaveLength(2);
    const srcs = imgs.map((i) => i.getAttribute("src"));
    expect(srcs).toContain("/logo-wordmark.svg");
    expect(srcs).toContain("/logo-wordmark-dark.svg");
    const lightImg = imgs.find((i) => i.getAttribute("src") === "/logo-wordmark.svg")!;
    const darkImg = imgs.find((i) => i.getAttribute("src") === "/logo-wordmark-dark.svg")!;
    expect(lightImg.className).toContain("dark:hidden");
    expect(darkImg.className).toContain("hidden");
    expect(darkImg.className).toContain("dark:block");
  });

  it("keeps alt on both auto-rendered images so the visible one is announced", () => {
    // display:none removes the hidden <img> from the a11y tree; we deliberately
    // do NOT add aria-hidden so that dark-mode users still hear the alt.
    render(<Logo variant="full" theme="auto" alt="Test alt" />);
    const imgs = screen.getAllByRole("img", { hidden: true });
    expect(imgs.every((i) => i.getAttribute("alt") === "Test alt")).toBe(true);
    expect(imgs.every((i) => i.getAttribute("aria-hidden") == null)).toBe(true);
  });
});

describe("LogoMark", () => {
  it("is a convenience for Logo with variant=mark", () => {
    render(<LogoMark theme="light" />);
    const img = screen.getByRole("img");
    expect(img.getAttribute("src")).toBe("/logo-mark.svg");
    expect(img.getAttribute("alt")).toBe("Clemvion");
  });

  it("renders the mark with auto theme as two imgs pointing at the same asset (R-16 transparent unified)", () => {
    // After R-16 the mark has no light/dark distinction — transparent
    // background, single gradient. Both auto-rendered <img>s point at
    // the same file but keep the Tailwind `dark:` toggle so a future
    // tinted-variant split is one line in logo.tsx ASSET_PATHS.
    render(<LogoMark theme="auto" />);
    const imgs = screen.getAllByRole("img", { hidden: true });
    expect(imgs).toHaveLength(2);
    expect(imgs.every((i) => i.getAttribute("src") === "/logo-mark.svg")).toBe(true);
    expect(imgs[0].className).toContain("dark:hidden");
    expect(imgs[1].className).toContain("hidden");
    expect(imgs[1].className).toContain("dark:block");
  });
});
