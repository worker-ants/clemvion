import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

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

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const getMe = vi.fn();
const requestEmailChange = vi.fn();
const resendEmailChange = vi.fn();
const cancelEmailChange = vi.fn();

vi.mock("@/lib/api/users", () => ({
  USER_PROFILE_QUERY_KEY: ["user-profile"],
  usersApi: {
    getMe: () => getMe(),
    requestEmailChange: (b: unknown) => requestEmailChange(b),
    resendEmailChange: () => resendEmailChange(),
    cancelEmailChange: () => cancelEmailChange(),
  },
}));

import ChangeEmailPage from "../page";

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <ChangeEmailPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ChangeEmailPage", () => {
  it("submits a request with the new email and reauth payload", async () => {
    getMe.mockResolvedValue({
      data: { data: { id: "u", email: "old@x.com", name: "U", pendingEmail: null } },
    });
    requestEmailChange.mockResolvedValue({ data: { data: { message: "ok" } } });

    renderPage();

    const input = await screen.findByLabelText(/새 이메일/);
    fireEvent.change(input, { target: { value: "new@x.com" } });
    fireEvent.change(screen.getByLabelText(/현재 비밀번호/), {
      target: { value: "P@ssw0rd1" },
    });
    fireEvent.click(screen.getByTestId("email-change-submit"));

    await waitFor(() => {
      expect(requestEmailChange).toHaveBeenCalledWith({
        newEmail: "new@x.com",
        password: "P@ssw0rd1",
        totpCode: undefined,
      });
    });
  });

  it("shows pending state with resend/cancel when a change is in progress", async () => {
    getMe.mockResolvedValue({
      data: {
        data: {
          id: "u",
          email: "old@x.com",
          name: "U",
          pendingEmail: "pending@x.com",
        },
      },
    });
    resendEmailChange.mockResolvedValue({ data: { data: { message: "ok" } } });

    renderPage();

    expect(await screen.findByTestId("email-change-pending")).toHaveTextContent(
      "pending@x.com",
    );
    fireEvent.click(screen.getByTestId("email-change-resend"));
    await waitFor(() => expect(resendEmailChange).toHaveBeenCalledTimes(1));
  });
});
