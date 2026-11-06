import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/i18n", async () => {
  const { ko } = await import("@/lib/i18n/dict/ko");
  const { interpolate } = await import("@/lib/i18n/core");
  const tFromKo = (
    key: string,
    params?: Record<string, string | number>,
  ): string => {
    const parts = key.split(".");
    let cur: unknown = ko;
    for (const p of parts) {
      if (!cur || typeof cur !== "object") return key;
      cur = (cur as Record<string, unknown>)[p];
    }
    return typeof cur === "string" ? interpolate(cur, params) : key;
  };
  return { useT: () => tFromKo, useLocale: () => "ko" as const };
});

vi.mock("@/lib/api/client", () => ({
  apiClient: {
    patch: vi.fn().mockResolvedValue({ data: {} }),
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

import { AxiosError, AxiosHeaders } from "axios";
import { apiClient } from "@/lib/api/client";
import { AVATAR_MAX_BYTES } from "@/lib/api/users";
import { toast } from "sonner";
import { ProfileInfoCard } from "../profile-info-card";

function renderCard(user: {
  name: string;
  email: string;
  pendingEmail?: string | null;
  avatarUrl?: string | null;
}) {
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
    expect(screen.getByTestId("profile-name-input")).toHaveValue("Gehrig");
  });

  it("[취소] restores the original value and returns to view mode", () => {
    renderCard({ name: "Gehrig", email: "g@example.com" });
    fireEvent.click(screen.getByTestId("profile-info-edit"));
    fireEvent.change(screen.getByTestId("profile-name-input"), {
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
    fireEvent.change(screen.getByTestId("profile-name-input"), {
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
    fireEvent.change(screen.getByTestId("profile-name-input"), {
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
    fireEvent.change(screen.getByTestId("profile-name-input"), {
      target: { value: "Gehrig Kim" },
    });
    fireEvent.click(screen.getByTestId("profile-info-save"));
    fireEvent.click(screen.getByTestId("diff-confirm"));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
    // mode 가 edit 으로 유지되어 input 이 그대로 보인다 (사용자가 재시도 가능)
    expect(screen.getByTestId("profile-name-input")).toBeInTheDocument();
  });

  it("이메일 변경 CTA 링크를 /profile/change-email 로 노출한다", () => {
    renderCard({ name: "Gehrig", email: "g@example.com" });
    const link = screen.getByTestId("profile-change-email-link");
    expect(link).toHaveAttribute("href", "/profile/change-email");
  });

  it("pendingEmail 이 없으면 readonly 힌트를 보이고 pending 표시는 없다", () => {
    renderCard({ name: "Gehrig", email: "g@example.com" });
    expect(screen.queryByTestId("profile-email-pending")).toBeNull();
  });

  it("pendingEmail 이 있으면 확인 대기 주소를 표시한다", () => {
    renderCard({
      name: "Gehrig",
      email: "g@example.com",
      pendingEmail: "new@example.com",
    });
    expect(screen.getByTestId("profile-email-pending")).toHaveTextContent(
      "new@example.com",
    );
  });
});

function makeFile(name: string, size: number, type = "image/png"): File {
  const file = new File(["x"], name, { type });
  // 큰 버퍼를 실제로 만들지 않고 크기만 정한다.
  Object.defineProperty(file, "size", { value: size });
  return file;
}

function axiosError(status: number, code?: string, message?: string) {
  return new AxiosError(
    message ?? "Request failed",
    "ERR_BAD_REQUEST",
    undefined,
    undefined,
    {
      status,
      statusText: "",
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: { error: { code, message } },
    },
  );
}

function chooseFile(file: File) {
  fireEvent.change(screen.getByTestId("profile-avatar-file"), {
    target: { files: [file] },
  });
}

function saveAndConfirm() {
  fireEvent.click(screen.getByTestId("profile-info-save"));
  fireEvent.click(screen.getByTestId("diff-confirm"));
}

describe("ProfileInfoCard 아바타 (CLE-T-KMZQ6N)", () => {
  it("avatarUrl 이 있으면 이미지를, 없으면 이니셜을 보인다", () => {
    const { unmount } = renderCard({
      name: "Gehrig",
      email: "g@example.com",
      avatarUrl: "https://cdn.example.com/a.png",
    });
    expect(screen.getByTestId("profile-avatar-image")).toHaveAttribute(
      "src",
      "https://cdn.example.com/a.png",
    );
    unmount();
    renderCard({ name: "Gehrig", email: "g@example.com", avatarUrl: null });
    expect(screen.queryByTestId("profile-avatar-image")).toBeNull();
    expect(screen.getByTestId("profile-avatar-initials")).toHaveTextContent(
      "G",
    );
  });

  it("이미지를 불러오지 못하면 이니셜로 대신한다", () => {
    renderCard({
      name: "Gehrig",
      email: "g@example.com",
      avatarUrl: "https://broken.example.com/a.png",
    });
    fireEvent.error(screen.getByTestId("profile-avatar-image"));
    expect(screen.queryByTestId("profile-avatar-image")).toBeNull();
    expect(screen.getByTestId("profile-avatar-initials")).toBeInTheDocument();
  });

  it("보기 모드에는 아바타 편집 컨트롤이 없다", () => {
    renderCard({ name: "Gehrig", email: "g@example.com" });
    expect(screen.queryByTestId("profile-avatar-editor")).toBeNull();
  });

  it("고른 이미지를 diff 로 보여 주고 확인하면 POST /users/me/avatar 로 올린다", async () => {
    renderCard({ name: "Gehrig", email: "g@example.com" });
    fireEvent.click(screen.getByTestId("profile-info-edit"));
    const file = makeFile("me.png", 1024);
    chooseFile(file);
    expect(
      screen.getByTestId("profile-avatar-selected-file"),
    ).toHaveTextContent("me.png");
    fireEvent.click(screen.getByTestId("profile-info-save"));
    expect(screen.getByTestId("diff-before-아바타")).toHaveTextContent("없음");
    expect(screen.getByTestId("diff-after-아바타")).toHaveTextContent(
      "새 이미지: me.png",
    );
    fireEvent.click(screen.getByTestId("diff-confirm"));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());

    const post = apiClient.post as ReturnType<typeof vi.fn>;
    expect(post).toHaveBeenCalledTimes(1);
    const [url, body, config] = post.mock.calls[0];
    expect(url).toBe("/users/me/avatar");
    expect((body as FormData).get("file")).toBe(file);
    expect(config).toEqual({
      headers: { "Content-Type": "multipart/form-data" },
    });
    // 이름을 바꾸지 않았으면 PATCH 는 보내지 않는다.
    expect(apiClient.patch).not.toHaveBeenCalled();
  });

  it("이미지와 이름을 함께 바꾸면 업로드 뒤 이름만 PATCH 한다", async () => {
    renderCard({ name: "Gehrig", email: "g@example.com" });
    fireEvent.click(screen.getByTestId("profile-info-edit"));
    chooseFile(makeFile("me.webp", 2048, "image/webp"));
    fireEvent.change(screen.getByTestId("profile-name-input"), {
      target: { value: "Gehrig Kim" },
    });
    saveAndConfirm();
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    const postOrder = (apiClient.post as ReturnType<typeof vi.fn>).mock
      .invocationCallOrder[0];
    const patchOrder = (apiClient.patch as ReturnType<typeof vi.fn>).mock
      .invocationCallOrder[0];
    expect(postOrder).toBeLessThan(patchOrder);
    expect(apiClient.patch).toHaveBeenCalledWith("/users/me", {
      name: "Gehrig Kim",
    });
  });

  it.each([
    [
      "허용하지 않은 확장자",
      makeFile("logo.svg", 100, "image/svg+xml"),
      "png, jpg, jpeg, webp, gif 이미지만 올릴 수 있어요",
    ],
    [
      "확장자 없음",
      makeFile("avatar", 100),
      "png, jpg, jpeg, webp, gif 이미지만 올릴 수 있어요",
    ],
    [
      "2MB 초과",
      makeFile("big.png", AVATAR_MAX_BYTES + 1),
      "2MB 이하 이미지만 올릴 수 있어요",
    ],
    ["빈 파일", makeFile("empty.png", 0), "비어 있는 파일은 올릴 수 없어요"],
  ])("%s 이면 고르지 않고 인라인 오류를 보인다", (_case, file, message) => {
    renderCard({ name: "Gehrig", email: "g@example.com" });
    fireEvent.click(screen.getByTestId("profile-info-edit"));
    chooseFile(file);
    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(screen.queryByTestId("profile-avatar-selected-file")).toBeNull();
    // 고른 것이 없으니 저장해도 바뀐 내용이 없다.
    fireEvent.click(screen.getByTestId("profile-info-save"));
    expect(toast.info).toHaveBeenCalledTimes(1);
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it("정확히 2MB 인 이미지는 받는다", () => {
    renderCard({ name: "Gehrig", email: "g@example.com" });
    fireEvent.click(screen.getByTestId("profile-info-edit"));
    chooseFile(makeFile("edge.JPG", AVATAR_MAX_BYTES, "image/jpeg"));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(
      screen.getByTestId("profile-avatar-selected-file"),
    ).toHaveTextContent("edge.JPG");
  });

  it("외부 URL 을 넣으면 PATCH /users/me { avatarUrl } 로 바꾼다", async () => {
    renderCard({ name: "Gehrig", email: "g@example.com" });
    fireEvent.click(screen.getByTestId("profile-info-edit"));
    fireEvent.change(screen.getByTestId("profile-avatar-url"), {
      target: { value: " https://cdn.example.com/new.png " },
    });
    fireEvent.click(screen.getByTestId("profile-info-save"));
    expect(screen.getByTestId("diff-after-아바타")).toHaveTextContent(
      "https://cdn.example.com/new.png",
    );
    fireEvent.click(screen.getByTestId("diff-confirm"));
    await waitFor(() =>
      expect(apiClient.patch).toHaveBeenCalledWith("/users/me", {
        avatarUrl: "https://cdn.example.com/new.png",
      }),
    );
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it.each([
    "not a url",
    "javascript:alert(1)",
    `https://e.com/${"a".repeat(500)}`,
  ])("올바르지 않은 URL(%s)은 저장하지 않고 인라인 오류를 보인다", (value) => {
    renderCard({ name: "Gehrig", email: "g@example.com" });
    fireEvent.click(screen.getByTestId("profile-info-edit"));
    fireEvent.change(screen.getByTestId("profile-avatar-url"), {
      target: { value },
    });
    fireEvent.click(screen.getByTestId("profile-info-save"));
    expect(screen.getByRole("alert")).toHaveTextContent("이미지 URL");
    expect(screen.queryByTestId("diff-confirm")).toBeNull();
  });

  it("[제거] 하면 PATCH /users/me { avatarUrl: null } 로 지운다", async () => {
    renderCard({
      name: "Gehrig",
      email: "g@example.com",
      avatarUrl: "https://cdn.example.com/a.png",
    });
    fireEvent.click(screen.getByTestId("profile-info-edit"));
    expect(screen.getByTestId("profile-avatar-url")).toHaveValue(
      "https://cdn.example.com/a.png",
    );
    fireEvent.click(screen.getByTestId("profile-avatar-remove"));
    fireEvent.click(screen.getByTestId("profile-info-save"));
    expect(screen.getByTestId("diff-before-아바타")).toHaveTextContent(
      "https://cdn.example.com/a.png",
    );
    expect(screen.getByTestId("diff-after-아바타")).toHaveTextContent("없음");
    fireEvent.click(screen.getByTestId("diff-confirm"));
    await waitFor(() =>
      expect(apiClient.patch).toHaveBeenCalledWith("/users/me", {
        avatarUrl: null,
      }),
    );
  });

  it("아바타가 없으면 [제거] 를 보이지 않는다", () => {
    renderCard({ name: "Gehrig", email: "g@example.com" });
    fireEvent.click(screen.getByTestId("profile-info-edit"));
    expect(screen.queryByTestId("profile-avatar-remove")).toBeNull();
  });

  it("[취소] 하면 고른 이미지를 버리고 보기 모드로 돌아간다", () => {
    renderCard({ name: "Gehrig", email: "g@example.com" });
    fireEvent.click(screen.getByTestId("profile-info-edit"));
    chooseFile(makeFile("me.png", 1024));
    fireEvent.click(screen.getByRole("button", { name: /취소|cancel/i }));
    fireEvent.click(screen.getByTestId("profile-info-edit"));
    expect(screen.queryByTestId("profile-avatar-selected-file")).toBeNull();
  });

  it("고른 이미지를 미리 보여 주고 바꾸면 이전 미리보기 URL 을 해제한다", () => {
    const create = vi
      .fn()
      .mockReturnValueOnce("blob:first")
      .mockReturnValueOnce("blob:second");
    const revoke = vi.fn();
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = create;
    URL.revokeObjectURL = revoke;
    try {
      renderCard({ name: "Gehrig", email: "g@example.com" });
      fireEvent.click(screen.getByTestId("profile-info-edit"));
      chooseFile(makeFile("one.png", 10));
      expect(screen.getByTestId("profile-avatar-image")).toHaveAttribute(
        "src",
        "blob:first",
      );
      chooseFile(makeFile("two.png", 10));
      expect(revoke).toHaveBeenCalledWith("blob:first");
      expect(screen.getByTestId("profile-avatar-image")).toHaveAttribute(
        "src",
        "blob:second",
      );
    } finally {
      URL.createObjectURL = origCreate;
      URL.revokeObjectURL = origRevoke;
    }
  });

  it.each([
    [
      "INVALID_FILE_TYPE",
      axiosError(
        400,
        "INVALID_FILE_TYPE",
        "Only png, jpg, jpeg, webp, gif images are allowed",
      ),
      "png, jpg, jpeg, webp, gif 이미지만 올릴 수 있어요",
    ],
    [
      "FILE_REQUIRED",
      axiosError(400, "FILE_REQUIRED", "Avatar image file is required"),
      "비어 있는 파일은 올릴 수 없어요",
    ],
    [
      "PAYLOAD_TOO_LARGE",
      axiosError(413, "PAYLOAD_TOO_LARGE", "Request payload too large."),
      "2MB 이하 이미지만 올릴 수 있어요",
    ],
    ["413 (코드 없음)", axiosError(413), "2MB 이하 이미지만 올릴 수 있어요"],
    [
      "알 수 없는 코드",
      axiosError(500, "INTERNAL_ERROR", "Server exploded"),
      "Server exploded",
    ],
  ])(
    "업로드가 %s 로 실패하면 그 문구를 띄우고 PATCH 하지 않는다",
    async (_c, err, message) => {
      (apiClient.post as ReturnType<typeof vi.fn>).mockRejectedValueOnce(err);
      renderCard({ name: "Gehrig", email: "g@example.com" });
      fireEvent.click(screen.getByTestId("profile-info-edit"));
      chooseFile(makeFile("me.png", 1024));
      fireEvent.change(screen.getByTestId("profile-name-input"), {
        target: { value: "Gehrig Kim" },
      });
      saveAndConfirm();
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith(message));
      expect(apiClient.patch).not.toHaveBeenCalled();
      // 편집 모드와 고른 파일이 남아 있어 바로 다시 시도할 수 있다.
      expect(
        screen.getByTestId("profile-avatar-selected-file"),
      ).toBeInTheDocument();
    },
  );

  it("응답이 없는 업로드 실패는 기본 문구를 띄운다", async () => {
    (apiClient.post as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new AxiosError(""),
    );
    renderCard({ name: "Gehrig", email: "g@example.com" });
    fireEvent.click(screen.getByTestId("profile-info-edit"));
    chooseFile(makeFile("me.png", 1024));
    saveAndConfirm();
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "아바타 이미지를 올리지 못했어요",
      ),
    );
  });
});
