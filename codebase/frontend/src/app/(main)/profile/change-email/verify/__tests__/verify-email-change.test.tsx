import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

let mockToken: string | null = "tok-123";
const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => ({
    get: (k: string) => (k === "token" ? mockToken : null),
  }),
}));

const setAccessToken = vi.fn();
vi.mock("@/lib/api/client", () => ({
  setAccessToken: (...args: unknown[]) => setAccessToken(...args),
}));

const verifyEmailChange = vi.fn();
vi.mock("@/lib/api/users", () => ({
  usersApi: { verifyEmailChange: (t: string) => verifyEmailChange(t) },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/i18n", async () => {
  const { ko } = await import("@/lib/i18n/dict/ko");
  const tFromKo = (key: string): string => {
    const parts = key.split(".");
    let cur: unknown = ko;
    for (const p of parts) {
      if (!cur || typeof cur !== "object") return key;
      cur = (cur as Record<string, unknown>)[p];
    }
    return typeof cur === "string" ? cur : key;
  };
  return { useT: () => tFromKo };
});

import VerifyEmailChangePage from "../page";

beforeEach(() => {
  vi.clearAllMocks();
  mockToken = "tok-123";
});

describe("VerifyEmailChangePage", () => {
  it("토큰 검증 성공 → access token 교체 + /profile 리다이렉트", async () => {
    verifyEmailChange.mockResolvedValue({
      data: { data: { accessToken: "new-AT" } },
    });

    render(<VerifyEmailChangePage />);

    await waitFor(() => {
      expect(verifyEmailChange).toHaveBeenCalledWith("tok-123");
      expect(setAccessToken).toHaveBeenCalledWith("new-AT");
      expect(replace).toHaveBeenCalledWith("/profile");
    });
  });

  it("토큰 검증 실패 → 에러 메시지 표시, 리다이렉트 없음", async () => {
    verifyEmailChange.mockRejectedValue(new Error("expired"));

    render(<VerifyEmailChangePage />);

    await waitFor(() => {
      expect(
        screen.getByTestId("email-change-verify-error"),
      ).toBeInTheDocument();
    });
    expect(replace).not.toHaveBeenCalled();
    expect(setAccessToken).not.toHaveBeenCalled();
  });

  it("토큰 없는 링크 → 에러 표시, verify 미호출", async () => {
    mockToken = null;

    render(<VerifyEmailChangePage />);

    expect(await screen.findByTestId("email-change-verify-error")).toHaveTextContent(
      "유효하지 않은 링크",
    );
    expect(verifyEmailChange).not.toHaveBeenCalled();
  });
});
