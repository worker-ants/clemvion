import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { useLocaleStore } from "@/lib/stores/locale-store";

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a data-testid="next-link" href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { DocsLink } from "../mdx/docs-link";

describe("DocsLink", () => {
  beforeEach(() => {
    useLocaleStore.setState({ locale: "ko" });
  });
  afterEach(() => {
    cleanup();
    useLocaleStore.setState({ locale: "ko" });
  });

  it("strips `javascript:` hrefs — XSS defense", () => {
    const { container } = render(
      <DocsLink href={"javascript:alert(1)" as string}>click</DocsLink>,
    );
    expect(container.querySelector("a")).toBeNull();
    expect(screen.getByText("click")).toBeDefined();
  });

  it("strips `data:` hrefs — XSS defense", () => {
    const { container } = render(
      <DocsLink href={"data:text/html,<script>alert(1)</script>" as string}>
        click
      </DocsLink>,
    );
    expect(container.querySelector("a")).toBeNull();
  });

  it("injects the current locale into locale-less /docs/ paths", () => {
    render(
      <DocsLink href="/docs/01-getting-started/what-is-this">Go</DocsLink>,
    );
    const link = screen.getByTestId("next-link") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe(
      "/docs/ko/01-getting-started/what-is-this",
    );
  });

  it("uses the active locale (en) when the store is set accordingly", () => {
    useLocaleStore.setState({ locale: "en" });
    render(<DocsLink href="/docs/02-nodes/ai">AI</DocsLink>);
    expect(
      (screen.getByTestId("next-link") as HTMLAnchorElement).getAttribute(
        "href",
      ),
    ).toBe("/docs/en/02-nodes/ai");
  });

  it("leaves already-localized /docs/<locale>/ paths untouched", () => {
    render(
      <DocsLink href="/docs/en/01-getting-started/ui-tour">Tour</DocsLink>,
    );
    expect(
      (screen.getByTestId("next-link") as HTMLAnchorElement).getAttribute(
        "href",
      ),
    ).toBe("/docs/en/01-getting-started/ui-tour");
  });

  it("does not touch non-docs internal paths", () => {
    render(<DocsLink href="/workflows/abc">Flow</DocsLink>);
    expect(
      (screen.getByTestId("next-link") as HTMLAnchorElement).getAttribute(
        "href",
      ),
    ).toBe("/workflows/abc");
  });

  it("opens external http(s) links with rel=noopener noreferrer target=_blank", () => {
    render(
      <DocsLink href="https://example.com/x">external</DocsLink>,
    );
    const anchor = screen.getByText("external").closest("a");
    expect(anchor?.getAttribute("target")).toBe("_blank");
    expect(anchor?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(anchor?.getAttribute("href")).toBe("https://example.com/x");
  });

  it("allows mailto and #anchor hrefs", () => {
    const { rerender } = render(
      <DocsLink href="mailto:x@y.z">mail</DocsLink>,
    );
    expect(screen.getByText("mail").closest("a")).not.toBeNull();
    rerender(<DocsLink href="#section">anchor</DocsLink>);
    expect(screen.getByText("anchor").closest("a")).not.toBeNull();
  });
});
