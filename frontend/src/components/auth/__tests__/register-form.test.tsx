import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockRegister = vi.fn();
vi.mock("@/lib/api/auth", () => ({
  authApi: {
    register: (...args: unknown[]) => mockRegister(...args),
  },
}));

const mockGetByToken = vi.fn();
vi.mock("@/lib/api/invitations", () => ({
  invitationsApi: {
    getByToken: (...args: unknown[]) => mockGetByToken(...args),
  },
  INVITATION_ERROR: {
    EMAIL_MISMATCH: "invitation_email_mismatch",
    EXPIRED: "invitation_expired",
    ALREADY_USED: "invitation_already_used",
    NOT_FOUND: "invitation_not_found",
  },
}));

const mockSetAccessToken = vi.fn();
vi.mock("@/lib/api/client", () => ({
  setAccessToken: (...args: unknown[]) => mockSetAccessToken(...args),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { RegisterForm } from "../register-form";
import { useLocaleStore } from "@/lib/stores/locale-store";

const VALID_TOKEN = "a".repeat(64);

function axiosError(status: number, body: object = {}) {
  return Object.assign(new Error("axios error"), {
    isAxiosError: true,
    response: { status, data: body },
  });
}

describe("RegisterForm — invitation token flow", () => {
  beforeEach(() => {
    useLocaleStore.setState({ locale: "ko" });
    mockPush.mockReset();
    mockRegister.mockReset();
    mockGetByToken.mockReset();
    mockSetAccessToken.mockReset();
  });

  it("renders no banner when invitationToken is absent", () => {
    render(<RegisterForm />);
    expect(mockGetByToken).not.toHaveBeenCalled();
    expect(screen.queryByText(/초대받으셨어요/)).toBeNull();
  });

  it("shows a 410 'invitation gone' banner and disables submit when token is expired", async () => {
    mockGetByToken.mockRejectedValue(axiosError(410, { code: "invitation_expired" }));

    render(<RegisterForm invitationToken={VALID_TOKEN} />);

    await waitFor(() => expect(mockGetByToken).toHaveBeenCalledWith(VALID_TOKEN));
    expect(
      await screen.findByText(/이 초대는 만료되었거나 이미 사용됐어요/),
    ).toBeDefined();
    // 에러 상태에서는 submit 버튼이 비활성화되어야 한다.
    const submit = screen.getByRole("button", { name: /계정 만들기/ });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows a 404 'not found' banner when token is unknown", async () => {
    mockGetByToken.mockRejectedValue(axiosError(404, { code: "invitation_not_found" }));
    render(<RegisterForm invitationToken={VALID_TOKEN} />);
    expect(
      await screen.findByText(/초대 링크를 확인할 수 없어요/),
    ).toBeDefined();
  });

  it("prefills email read-only and shows workspace banner when meta is ready", async () => {
    mockGetByToken.mockResolvedValue({
      workspaceName: "Team Alpha",
      invitedByName: "Alice",
      email: "invited@example.com",
      role: "editor",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });

    render(<RegisterForm invitationToken={VALID_TOKEN} />);

    expect(
      await screen.findByText(/Team Alpha 워크스페이스에 초대받으셨어요/),
    ).toBeDefined();
    expect(screen.getByText(/Alice님이 보낸 초대예요/)).toBeDefined();

    const email = screen.getByLabelText("이메일") as HTMLInputElement;
    await waitFor(() => expect(email.value).toBe("invited@example.com"));
    expect(email.readOnly).toBe(true);
  });

  it("on successful invitation register, stores accessToken and pushes /dashboard (no /verify-email)", async () => {
    mockGetByToken.mockResolvedValue({
      workspaceName: "Team Alpha",
      invitedByName: null,
      email: "invited@example.com",
      role: "editor",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    mockRegister.mockResolvedValue({
      data: { data: { message: "ok", accessToken: "fresh-access" } },
    });

    const user = userEvent.setup();
    render(<RegisterForm invitationToken={VALID_TOKEN} />);

    // 메타 prefetch 완료 대기
    const email = (await screen.findByLabelText("이메일")) as HTMLInputElement;
    await waitFor(() => expect(email.value).toBe("invited@example.com"));

    await user.type(screen.getByLabelText("이름"), "Invitee");
    await user.type(screen.getByLabelText("비밀번호"), "Aa1!aaaa");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /계정 만들기/ }));

    await waitFor(() => expect(mockRegister).toHaveBeenCalledTimes(1));
    expect(mockRegister.mock.calls[0][0]).toMatchObject({
      name: "Invitee",
      email: "invited@example.com",
      invitationToken: VALID_TOKEN,
    });
    await waitFor(() => expect(mockSetAccessToken).toHaveBeenCalledWith("fresh-access"));
    expect(mockPush).toHaveBeenCalledWith("/dashboard");
    expect(mockPush).not.toHaveBeenCalledWith("/verify-email");
  });

  it("on register without accessToken (no invitation), goes to /verify-email", async () => {
    mockRegister.mockResolvedValue({
      data: { data: { message: "ok" } },
    });

    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText("이름"), "Newbie");
    await user.type(screen.getByLabelText("이메일"), "newbie@example.com");
    await user.type(screen.getByLabelText("비밀번호"), "Aa1!aaaa");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /계정 만들기/ }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/verify-email"));
    expect(mockSetAccessToken).not.toHaveBeenCalled();
  });
});
