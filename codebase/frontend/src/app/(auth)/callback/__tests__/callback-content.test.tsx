import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const refreshAccessToken = vi.fn();
vi.mock("@/lib/api/client", () => ({
  refreshAccessToken: () => refreshAccessToken(),
}));

import { CallbackContent } from "../callback-content";

describe("CallbackContent (decision A — refresh-cookie reuse)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it("calls refreshAccessToken on success and routes to /dashboard", async () => {
    refreshAccessToken.mockResolvedValue("new-access-token");
    render(<CallbackContent success="true" />);

    await waitFor(() => expect(refreshAccessToken).toHaveBeenCalled());
    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
  });

  it("shows error when refresh returns null (no token) — no dashboard route", async () => {
    refreshAccessToken.mockResolvedValue(null);
    render(<CallbackContent success="true" />);

    await waitFor(() => expect(refreshAccessToken).toHaveBeenCalled());
    // refresh 가 token 을 못 주면 대시보드로 이동하지 않는다 (error 상태).
    expect(push).not.toHaveBeenCalled();
  });

  it("shows error and does not refresh when error param is present", async () => {
    render(<CallbackContent error="access_denied" />);
    // initialError 분기 — refresh 호출 없음
    expect(refreshAccessToken).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("treats missing success as error (no refresh)", () => {
    render(<CallbackContent />);
    expect(refreshAccessToken).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
});
