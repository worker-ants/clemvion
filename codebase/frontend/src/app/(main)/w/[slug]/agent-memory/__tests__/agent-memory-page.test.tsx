import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// i18n: ko dict 를 그대로 walk 하는 t (실제 라벨 매칭).
vi.mock("@/lib/i18n", async () => {
  const { ko } = await import("@/lib/i18n/dict/ko");
  const tFromKo = (key: string, params?: Record<string, unknown>): string => {
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
  return { useT: () => tFromKo, useLocale: () => "ko" as const };
});

// RoleGate: 권한 검증(workspace-store) 우회 — children 그대로 렌더해 editor 액션 노출.
vi.mock("@/components/auth/role-gate", () => ({
  RoleGate: ({ children }: { children: React.ReactNode }) => children,
}));

const getMock = vi.fn();
const deleteMock = vi.fn();
vi.mock("@/lib/api/client", () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
    delete: (...args: unknown[]) => deleteMock(...args),
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { toast } from "sonner";
import AgentMemoryPage from "../page";

function scopesBody() {
  return {
    data: {
      data: [
        {
          scopeKey: "cust-1",
          count: 2,
          latestUpdatedAt: "2026-06-01T00:00:00.000Z",
        },
      ],
      pagination: { page: 1, limit: 20, totalItems: 1, totalPages: 1 },
    },
  };
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AgentMemoryPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe("AgentMemoryPage — clearScope 토스트 (X-Deleted-Count 분기)", () => {
  it("scope 목록을 렌더한다", async () => {
    getMock.mockResolvedValue(scopesBody());
    renderPage();
    expect(await screen.findByText("cust-1")).toBeInTheDocument();
  });

  it("삭제 건수 > 0 이면 success 토스트", async () => {
    getMock.mockResolvedValue(scopesBody());
    deleteMock.mockResolvedValue({
      data: undefined,
      headers: { "x-deleted-count": "2" },
    });
    renderPage();
    await screen.findByText("cust-1");

    // scope 행 삭제 버튼 → ConfirmModal → 확인.
    fireEvent.click(screen.getByRole("button", { name: "scope 전체 삭제" }));
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        "scope 의 메모리를 모두 삭제했어요",
      ),
    );
    expect(toast.info).not.toHaveBeenCalled();
  });

  it("삭제 건수 0 이면 중립 토스트(info) — '삭제했다' 오해 방지", async () => {
    getMock.mockResolvedValue(scopesBody());
    deleteMock.mockResolvedValue({
      data: undefined,
      headers: { "x-deleted-count": "0" },
    });
    renderPage();
    await screen.findByText("cust-1");

    fireEvent.click(screen.getByRole("button", { name: "scope 전체 삭제" }));
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    await waitFor(() =>
      expect(toast.info).toHaveBeenCalledWith("삭제할 메모리가 없었어요"),
    );
    expect(toast.success).not.toHaveBeenCalled();
  });
});
