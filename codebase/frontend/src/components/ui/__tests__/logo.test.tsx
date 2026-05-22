import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Logo, LogoMark } from "../logo";

describe("Logo", () => {
  it("renders full logo by default with brand alt", () => {
    render(<Logo />);
    const imgs = screen.getAllByRole("img");
    expect(imgs.length).toBeGreaterThan(0);
    expect(imgs.some((img) => img.getAttribute("alt") === "Clemvion")).toBe(true);
  });

  it("renders mark variant with the light mark asset", () => {
    render(<Logo variant="mark" theme="light" />);
    const img = screen.getByRole("img");
    expect(img.getAttribute("src")).toBe("/logo-mark.png");
    expect(img.getAttribute("alt")).toBe("Clemvion");
  });

  it("renders wordmark variant with the light wordmark asset", () => {
    render(<Logo variant="wordmark" theme="light" />);
    const img = screen.getByRole("img");
    expect(img.getAttribute("src")).toBe("/logo-wordmark.jpg");
  });

  it("renders light theme explicitly with the light asset path", () => {
    render(<Logo variant="full" theme="light" />);
    const img = screen.getByRole("img");
    expect(img.getAttribute("src")).toBe("/logo.jpg");
  });

  it("renders dark theme explicitly with the dark asset path", () => {
    render(<Logo variant="full" theme="dark" />);
    const img = screen.getByRole("img");
    expect(img.getAttribute("src")).toBe("/logo-dark.jpg");
  });

  it("renders both light and dark assets when theme=auto", () => {
    render(<Logo variant="full" theme="auto" />);
    const imgs = screen.getAllByRole("img", { hidden: true });
    const srcs = imgs.map((i) => i.getAttribute("src"));
    expect(srcs).toContain("/logo.jpg");
    expect(srcs).toContain("/logo-dark.jpg");
    const lightImg = imgs.find((i) => i.getAttribute("src") === "/logo.jpg")!;
    const darkImg = imgs.find((i) => i.getAttribute("src") === "/logo-dark.jpg")!;
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

  it("renders both light and dark wordmark assets when theme=auto", () => {
    render(<Logo variant="wordmark" theme="auto" />);
    const imgs = screen.getAllByRole("img", { hidden: true });
    const srcs = imgs.map((i) => i.getAttribute("src"));
    expect(srcs).toContain("/logo-wordmark.jpg");
    expect(srcs).toContain("/logo-wordmark-dark.jpg");
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
    expect(img.getAttribute("src")).toBe("/logo-mark.png");
    expect(img.getAttribute("alt")).toBe("Clemvion");
  });

  it("renders both light and dark mark assets when theme=auto", () => {
    render(<LogoMark theme="auto" />);
    const imgs = screen.getAllByRole("img", { hidden: true });
    const srcs = imgs.map((i) => i.getAttribute("src"));
    expect(srcs).toContain("/logo-mark.png");
    expect(srcs).toContain("/logo-mark-dark.png");
    const lightImg = imgs.find((i) => i.getAttribute("src") === "/logo-mark.png")!;
    const darkImg = imgs.find((i) => i.getAttribute("src") === "/logo-mark-dark.png")!;
    expect(lightImg.className).toContain("dark:hidden");
    expect(darkImg.className).toContain("hidden");
    expect(darkImg.className).toContain("dark:block");
  });
});
