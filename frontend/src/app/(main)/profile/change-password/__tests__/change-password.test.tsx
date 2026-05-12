import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: {
    post: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

import { apiClient } from "@/lib/api/client";
import { toast } from "sonner";
import ChangePasswordPage from "../page";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ChangePasswordPage", () => {
  it("renders the three password fields and a submit button", () => {
    render(<ChangePasswordPage />);
    expect(
      screen.getByLabelText(/현재 비밀번호|current password/i),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/새 비밀번호|new password/i),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/비밀번호 확인|confirm password/i),
    ).toBeInTheDocument();
  });

  it("shows validation error when newPassword is shorter than 8 chars", async () => {
    render(<ChangePasswordPage />);
    fireEvent.change(screen.getByLabelText(/현재 비밀번호|current password/i), {
      target: { value: "old-pass" },
    });
    fireEvent.change(screen.getByLabelText(/새 비밀번호|new password/i), {
      target: { value: "short" },
    });
    fireEvent.change(screen.getByLabelText(/비밀번호 확인|confirm password/i), {
      target: { value: "short" },
    });
    fireEvent.click(screen.getByRole("button", { name: /변경|change/i }));
    await waitFor(() => {
      expect(
        screen.getByText(/8자 이상|at least 8/i),
      ).toBeInTheDocument();
    });
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it("shows mismatch error when confirm differs from new", async () => {
    render(<ChangePasswordPage />);
    fireEvent.change(screen.getByLabelText(/현재 비밀번호|current password/i), {
      target: { value: "old-pass" },
    });
    fireEvent.change(screen.getByLabelText(/새 비밀번호|new password/i), {
      target: { value: "new-password-123" },
    });
    fireEvent.change(screen.getByLabelText(/비밀번호 확인|confirm password/i), {
      target: { value: "different-456" },
    });
    fireEvent.click(screen.getByRole("button", { name: /변경|change/i }));
    await waitFor(() => {
      expect(
        screen.getByText(/일치하지 않|do not match/i),
      ).toBeInTheDocument();
    });
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it("submits POST /users/me/change-password and redirects to /profile on success", async () => {
    render(<ChangePasswordPage />);
    fireEvent.change(screen.getByLabelText(/현재 비밀번호|current password/i), {
      target: { value: "old-pass" },
    });
    fireEvent.change(screen.getByLabelText(/새 비밀번호|new password/i), {
      target: { value: "new-password-123" },
    });
    fireEvent.change(screen.getByLabelText(/비밀번호 확인|confirm password/i), {
      target: { value: "new-password-123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /변경|change/i }));
    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        "/users/me/change-password",
        { currentPassword: "old-pass", newPassword: "new-password-123" },
      );
    });
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/profile");
    });
    expect(toast.success).toHaveBeenCalled();
  });

  it("cancel button navigates back to /profile without submitting", () => {
    render(<ChangePasswordPage />);
    fireEvent.click(screen.getByRole("button", { name: /취소|cancel/i }));
    expect(pushMock).toHaveBeenCalledWith("/profile");
    expect(apiClient.post).not.toHaveBeenCalled();
  });
});
