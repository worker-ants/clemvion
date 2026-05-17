import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { useLocaleStore } from "@/lib/stores/locale-store";

const replace = vi.fn();
let mockPathname = "/docs/ko/01-getting-started/what-is-this";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => mockPathname,
}));

import { DocsLocaleUrlSync } from "../docs-locale-url-sync";

describe("DocsLocaleUrlSync", () => {
  beforeEach(() => {
    replace.mockClear();
    useLocaleStore.setState({ locale: "ko" });
  });

  afterEach(() => {
    cleanup();
    useLocaleStore.setState({ locale: "ko" });
  });

  it("locale과 URL이 일치하면 redirect 하지 않아요", () => {
    mockPathname = "/docs/ko/01-getting-started/what-is-this";
    render(<DocsLocaleUrlSync />);
    expect(replace).not.toHaveBeenCalled();
  });

  it("locale이 바뀌면 같은 docSlug에 대해 새 locale 경로로 replace 해요", () => {
    mockPathname = "/docs/ko/01-getting-started/what-is-this";
    useLocaleStore.setState({ locale: "en" });
    render(<DocsLocaleUrlSync />);
    expect(replace).toHaveBeenCalledWith(
      "/docs/en/01-getting-started/what-is-this",
    );
  });

  it("/docs 이외의 경로에서는 동작하지 않아요", () => {
    mockPathname = "/workflows/abc";
    useLocaleStore.setState({ locale: "en" });
    render(<DocsLocaleUrlSync />);
    expect(replace).not.toHaveBeenCalled();
  });

  it("locale 프리픽스가 없는 레거시 URL은 건드리지 않아요 (서버 redirect에 위임)", () => {
    mockPathname = "/docs/01-getting-started/what-is-this";
    useLocaleStore.setState({ locale: "en" });
    render(<DocsLocaleUrlSync />);
    expect(replace).not.toHaveBeenCalled();
  });
});
