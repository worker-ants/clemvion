import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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
  return { useT: () => tFromKo, useLocale: () => "ko" as const };
});

vi.mock("@/lib/api/client", () => ({
  apiClient: {
    patch: vi.fn().mockResolvedValue({ data: {} }),
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
import { ProfileInfoCard } from "../profile-info-card";

function renderCard(user: { name: string; email: string }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <ProfileInfoCard user={user} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ProfileInfoCard", () => {
  it("renders readonly view by default with the [편집] button visible", () => {
    renderCard({ name: "Gehrig", email: "g@example.com" });
    expect(screen.getByTestId("profile-name-readonly")).toHaveTextContent(
      "Gehrig",
    );
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByTestId("profile-info-edit")).toBeInTheDocument();
  });

  it("toggles to edit mode and pre-fills the name input", () => {
    renderCard({ name: "Gehrig", email: "g@example.com" });
    fireEvent.click(screen.getByTestId("profile-info-edit"));
    expect(screen.getByRole("textbox")).toHaveValue("Gehrig");
  });

  it("[취소] restores the original value and returns to view mode", () => {
    renderCard({ name: "Gehrig", email: "g@example.com" });
    fireEvent.click(screen.getByTestId("profile-info-edit"));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Changed" },
    });
    fireEvent.click(screen.getByRole("button", { name: /취소|cancel/i }));
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByTestId("profile-name-readonly")).toHaveTextContent(
      "Gehrig",
    );
  });

  it("shows noChanges toast when [저장] is clicked without changes", () => {
    renderCard({ name: "Gehrig", email: "g@example.com" });
    fireEvent.click(screen.getByTestId("profile-info-edit"));
    fireEvent.click(screen.getByTestId("profile-info-save"));
    expect(toast.info).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("opens diff dialog with before/after when name changes", () => {
    renderCard({ name: "Gehrig", email: "g@example.com" });
    fireEvent.click(screen.getByTestId("profile-info-edit"));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Gehrig Kim" },
    });
    fireEvent.click(screen.getByTestId("profile-info-save"));
    expect(screen.getByTestId("diff-before-이름")).toHaveTextContent("Gehrig");
    expect(screen.getByTestId("diff-after-이름")).toHaveTextContent(
      "Gehrig Kim",
    );
  });

  it("calls PATCH /users/me { name } trimmed when the diff is confirmed", async () => {
    renderCard({ name: "Gehrig", email: "g@example.com" });
    fireEvent.click(screen.getByTestId("profile-info-edit"));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "  Gehrig Kim  " },
    });
    fireEvent.click(screen.getByTestId("profile-info-save"));
    fireEvent.click(screen.getByTestId("diff-confirm"));
    await waitFor(() => {
      expect(apiClient.patch).toHaveBeenCalledWith("/users/me", {
        name: "Gehrig Kim",
      });
      expect(toast.success).toHaveBeenCalled();
    });
  });

  it("shows an error toast and keeps edit mode when PATCH rejects", async () => {
    (apiClient.patch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("server down"),
    );
    renderCard({ name: "Gehrig", email: "g@example.com" });
    fireEvent.click(screen.getByTestId("profile-info-edit"));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Gehrig Kim" },
    });
    fireEvent.click(screen.getByTestId("profile-info-save"));
    fireEvent.click(screen.getByTestId("diff-confirm"));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
    // mode 가 edit 으로 유지되어 input 이 그대로 보인다 (사용자가 재시도 가능)
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });
});
