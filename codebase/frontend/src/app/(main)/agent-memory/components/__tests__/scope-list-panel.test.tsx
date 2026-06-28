import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/lib/i18n", async () => {
  const { ko } = await import("@/lib/i18n/dict/ko");
  const t = (key: string, params?: Record<string, unknown>): string => {
    const parts = key.split(".");
    let cur: unknown = ko;
    for (const p of parts) {
      if (!cur || typeof cur !== "object") return key;
      cur = (cur as Record<string, unknown>)[p];
    }
    if (typeof cur !== "string") return key;
    return params
      ? cur.replace(/\{\{(\w+)\}\}/g, (_m, k) => String(params[k] ?? ""))
      : cur;
  };
  return { useT: () => t, useLocale: () => "ko" as const };
});

vi.mock("@/components/auth/role-gate", () => ({
  RoleGate: ({ children }: { children: React.ReactNode }) => children,
}));

import { ScopeListPanel } from "../scope-list-panel";
import type { AgentMemoryScopeData } from "@/lib/api/agent-memories";

const SCOPE: AgentMemoryScopeData = {
  scopeKey: "cust-1",
  count: 2,
  latestUpdatedAt: "2026-06-01T00:00:00.000Z",
};

function baseProps(over: Partial<React.ComponentProps<typeof ScopeListPanel>> = {}) {
  return {
    scopes: [SCOPE],
    selectedScope: null,
    isLoading: false,
    isError: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    searchInput: "",
    onSearchInputChange: vi.fn(),
    onSubmitSearch: vi.fn((e: React.FormEvent) => e.preventDefault()),
    onSelectScope: vi.fn(),
    onRequestClearScope: vi.fn(),
    onLoadMore: vi.fn(),
    ...over,
  };
}

describe("ScopeListPanel", () => {
  it("isLoading 이면 스피너 표시 (scope 행 없음)", () => {
    const { container } = render(
      <ScopeListPanel {...baseProps({ isLoading: true, scopes: [] })} />,
    );
    expect(container.querySelector(".animate-spin")).toBeTruthy();
  });

  it("scopes 가 비고 로딩/에러 아니면 빈 상태", () => {
    render(<ScopeListPanel {...baseProps({ scopes: [] })} />);
    expect(screen.getByText("아직 메모리가 없습니다")).toBeInTheDocument();
  });

  it("scope 클릭 시 onSelectScope 호출", () => {
    const onSelectScope = vi.fn();
    render(<ScopeListPanel {...baseProps({ onSelectScope })} />);
    fireEvent.click(screen.getByText("cust-1"));
    expect(onSelectScope).toHaveBeenCalledWith("cust-1");
  });

  it("삭제 버튼 클릭 시 onRequestClearScope 호출", () => {
    const onRequestClearScope = vi.fn();
    render(<ScopeListPanel {...baseProps({ onRequestClearScope })} />);
    fireEvent.click(screen.getByRole("button", { name: "scope 전체 삭제" }));
    expect(onRequestClearScope).toHaveBeenCalledWith(SCOPE);
  });

  it("hasNextPage 면 load more 버튼 → onLoadMore", () => {
    const onLoadMore = vi.fn();
    render(<ScopeListPanel {...baseProps({ hasNextPage: true, onLoadMore })} />);
    fireEvent.click(screen.getByRole("button", { name: "더 보기" }));
    expect(onLoadMore).toHaveBeenCalled();
  });
});
