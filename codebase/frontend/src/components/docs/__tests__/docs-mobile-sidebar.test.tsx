import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import type { DocsSection } from "@/lib/docs/registry";
import type { DocsSearchEntry } from "@/lib/docs/registry";
import { useLocaleStore } from "@/lib/stores/locale-store";

// pathname 을 테스트 안에서 동적으로 바꿀 수 있도록 mutable 변수에 위임.
// `localizedDocsHref` 가 locale prefix 를 붙이므로 활성 페이지 매칭은 prefix 포함.
let currentPathname = "/docs/ko/02-nodes/ai";
vi.mock("next/navigation", () => ({
  usePathname: () => currentPathname,
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
}));

import { DocsMobileSidebar } from "../docs-mobile-sidebar";

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

const entriesByLocale: Record<"ko" | "en", DocsSearchEntry[]> = {
  ko: [],
  en: [],
};

describe("DocsMobileSidebar", () => {
  beforeEach(() => {
    currentPathname = "/docs/ko/02-nodes/ai";
    window.localStorage.clear();
    useLocaleStore.setState({ locale: "ko" });
  });

  afterEach(() => {
    cleanup();
    document.body.style.overflow = "";
    useLocaleStore.setState({ locale: "ko" });
  });

  it("토글 버튼이 현재 섹션·페이지 라벨을 노출해요", () => {
    render(
      <DocsMobileSidebar
        sections={sections}
        entriesByLocale={entriesByLocale}
      />,
    );
    const toggle = screen.getByRole("button", { name: /가이드 목차/ });
    expect(toggle).toBeInTheDocument();
    // 현재 페이지의 섹션 라벨과 페이지 제목이 토글 버튼에 함께 노출
    expect(toggle.textContent).toContain("노드 가이드");
    expect(toggle.textContent).toContain("AI 노드");
  });

  it("토글 버튼 클릭 전에는 drawer 가 닫혀 있어요", () => {
    render(
      <DocsMobileSidebar
        sections={sections}
        entriesByLocale={entriesByLocale}
      />,
    );
    const panel = screen.getByRole("dialog", { hidden: true });
    expect(panel).toHaveAttribute("aria-hidden", "true");
  });

  it("토글 클릭 시 drawer 가 열리고 DocsSidebar 항목과 검색 입력이 보여요", () => {
    render(
      <DocsMobileSidebar
        sections={sections}
        entriesByLocale={entriesByLocale}
      />,
    );
    const toggle = screen.getByRole("button", { name: /가이드 목차/ });
    fireEvent.click(toggle);

    const panel = screen.getByRole("dialog");
    expect(panel).toHaveAttribute("aria-hidden", "false");
    // DocsSearch 의 입력
    expect(within(panel).getByRole("searchbox")).toBeInTheDocument();
    // DocsSidebar 의 페이지 링크
    expect(within(panel).getByRole("link", { name: "AI 노드" })).toBeInTheDocument();
  });

  it("drawer 안의 페이지 링크를 클릭하면 자동 close 돼요 (사용자가 페이지 이동 시 drawer 가 잔존하지 않음)", () => {
    render(
      <DocsMobileSidebar
        sections={sections}
        entriesByLocale={entriesByLocale}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /가이드 목차/ }));
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-hidden", "false");

    // drawer 안의 다른 페이지 링크 클릭 → drawer close
    const link = within(screen.getByRole("dialog")).getByRole("link", {
      name: "개요",
    });
    fireEvent.click(link);

    expect(screen.getByRole("dialog", { hidden: true })).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("drawer 가 열릴 때 활성 페이지 항목에 대해 scrollIntoView 가 호출돼요", async () => {
    const scrollSpy = vi.fn();
    // 모든 Element 의 scrollIntoView 를 spy. drawer 안 활성 link 가 호출 대상.
    Element.prototype.scrollIntoView = scrollSpy;
    render(
      <DocsMobileSidebar
        sections={sections}
        entriesByLocale={entriesByLocale}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /가이드 목차/ }));
    // setTimeout(0) 으로 next tick 에 scroll — waitFor 로 flush 대기.
    await waitFor(() => expect(scrollSpy).toHaveBeenCalled());
  });
});
