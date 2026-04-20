import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import type { DocsSection } from "@/lib/docs/registry";
import { useLocaleStore } from "@/lib/stores/locale-store";

vi.mock("next/navigation", () => ({
  usePathname: () => "/docs/ko/02-nodes/ai",
}));

import { DocsSidebar } from "../docs-sidebar";

const sections: DocsSection[] = [
  {
    key: "01-getting-started",
    label: "시작하기",
    pages: [
      {
        slug: ["01-getting-started", "what-is-this"],
        href: "/docs/01-getting-started/what-is-this",
        filePath: "",
        frontmatter: {
          title: "제품 소개",
          section: "01-getting-started",
          order: 1,
          summary: "",
        },
        availableLocales: ["ko"],
      },
    ],
  },
  {
    key: "02-nodes",
    label: "노드 가이드",
    pages: [
      {
        slug: ["02-nodes", "overview"],
        href: "/docs/02-nodes/overview",
        filePath: "",
        frontmatter: {
          title: "개요",
          section: "02-nodes",
          order: 1,
          summary: "",
        },
        availableLocales: ["ko"],
      },
      {
        slug: ["02-nodes", "ai"],
        href: "/docs/02-nodes/ai",
        filePath: "",
        frontmatter: {
          title: "AI 노드",
          section: "02-nodes",
          order: 2,
          summary: "",
        },
        availableLocales: ["ko"],
      },
    ],
  },
];

describe("DocsSidebar", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useLocaleStore.setState({ locale: "ko" });
  });

  afterEach(() => {
    cleanup();
    useLocaleStore.setState({ locale: "ko" });
  });

  it("섹션 레이블과 페이지 타이틀을 렌더해요", () => {
    render(<DocsSidebar sections={sections} />);
    expect(screen.getByText("시작하기")).toBeInTheDocument();
    expect(screen.getByText("노드 가이드")).toBeInTheDocument();
    expect(screen.getByText("제품 소개")).toBeInTheDocument();
    expect(screen.getByText("AI 노드")).toBeInTheDocument();
  });

  it("현재 경로와 일치하는 페이지 링크에 aria-current='page'를 부여해요", () => {
    render(<DocsSidebar sections={sections} />);
    const active = screen.getByRole("link", { name: "AI 노드" });
    expect(active).toHaveAttribute("aria-current", "page");

    const inactive = screen.getByRole("link", { name: "제품 소개" });
    expect(inactive).not.toHaveAttribute("aria-current");
  });

  it("모든 페이지 링크가 locale 프리픽스가 붙은 href를 갖고 있어요", () => {
    render(<DocsSidebar sections={sections} />);
    const links = screen.getAllByRole("link");
    expect(links.length).toBe(3);
    for (const link of links) {
      expect(link.getAttribute("href")).toMatch(/^\/docs\/(ko|en)\//);
    }
  });

  it("locale이 'en'으로 바뀌면 hrefs도 /docs/en/... 로 갱신돼요", () => {
    useLocaleStore.setState({ locale: "en" });
    render(<DocsSidebar sections={sections} />);
    for (const link of screen.getAllByRole("link")) {
      expect(link.getAttribute("href")).toMatch(/^\/docs\/en\//);
    }
  });

  it("섹션 헤더 토글 버튼으로 섹션을 접을 수 있어요", () => {
    render(<DocsSidebar sections={sections} />);
    // Toggle a non-active section ('시작하기') — active section's pages
    // remain forced open regardless of state.
    const toggle = screen.getByRole("button", { name: /시작하기/ });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.queryByRole("link", { name: "제품 소개" })).not.toBeNull();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: "제품 소개" })).toBeNull();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.queryByRole("link", { name: "제품 소개" })).not.toBeNull();
  });

  it("활성 페이지가 속한 섹션은 저장된 접힘 상태와 무관하게 펼쳐져요", () => {
    window.localStorage.setItem(
      "docs-sidebar-collapsed",
      JSON.stringify(["02-nodes"]),
    );
    render(<DocsSidebar sections={sections} />);
    // Even though '02-nodes' is in the stored collapsed set, the active
    // page lives there so links must remain visible.
    expect(screen.queryByRole("link", { name: "AI 노드" })).not.toBeNull();
    expect(screen.queryByRole("link", { name: "개요" })).not.toBeNull();
  });

  it("접힘 상태를 localStorage에 저장해요", () => {
    render(<DocsSidebar sections={sections} />);
    const toggle = screen.getByRole("button", { name: /시작하기/ });
    fireEvent.click(toggle);
    const raw = window.localStorage.getItem("docs-sidebar-collapsed");
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!)).toContain("01-getting-started");
  });

  it("활성 섹션 헤더는 접을 수 없도록 disabled 처리돼요", () => {
    render(<DocsSidebar sections={sections} />);
    const active = screen.getByRole("button", { name: /노드 가이드/ });
    expect(active).toBeDisabled();
    expect(active).toHaveAttribute("aria-expanded", "true");

    // Clicking the disabled button should not flip state or write storage.
    fireEvent.click(active);
    expect(screen.queryByRole("link", { name: "AI 노드" })).not.toBeNull();
    expect(
      window.localStorage.getItem("docs-sidebar-collapsed"),
    ).toBeNull();
  });

  it("활성 페이지 링크에 좌측 강조 테두리가 적용돼요", () => {
    render(<DocsSidebar sections={sections} />);
    const active = screen.getByRole("link", { name: "AI 노드" });
    // The accent border uses the theme's `--primary` token via `border-[hsl(var(--primary))]`.
    expect(active.className).toMatch(/border-\[hsl\(var\(--primary\)\)\]/);
    const inactive = screen.getByRole("link", { name: "개요" });
    expect(inactive.className).toMatch(/border-transparent/);
  });
});
