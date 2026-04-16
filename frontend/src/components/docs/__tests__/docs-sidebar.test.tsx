import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { DocsSection } from "@/lib/docs/registry";

vi.mock("next/navigation", () => ({
  usePathname: () => "/docs/02-nodes/ai",
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
      },
    ],
  },
];

describe("DocsSidebar", () => {
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

  it("모든 페이지 링크가 href를 갖고 있어요", () => {
    render(<DocsSidebar sections={sections} />);
    const links = screen.getAllByRole("link");
    expect(links.length).toBe(3);
    for (const link of links) {
      expect(link.getAttribute("href")).toMatch(/^\/docs\//);
    }
  });
});
