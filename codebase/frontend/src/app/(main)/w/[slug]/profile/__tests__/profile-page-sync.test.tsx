import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/i18n", () => ({
  useT: () => (key: string) => key,
  useLocale: () => "ko" as const,
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: { get: vi.fn() },
}));

vi.mock("@/lib/workspace/use-workspace-slug", () => ({
  useWorkspaceSlug: () => "acme",
}));

vi.mock("../components/profile-info-card", () => ({
  ProfileInfoCard: () => null,
}));
vi.mock("../components/profile-preferences-card", () => ({
  ProfilePreferencesCard: () => null,
}));

import { apiClient } from "@/lib/api/client";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useLocaleStore } from "@/lib/stores/locale-store";
import ProfilePage from "../page";

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <ProfilePage />
    </QueryClientProvider>,
  );
}

const profile = {
  id: "u1",
  name: "홍길동",
  email: "a@b.c",
  avatarUrl: "https://img.test/a.png",
  locale: "ko",
  theme: "dark",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ProfilePage 의 프로필 동기화", () => {
  it("/users/me 응답을 syncProfile 로 한 번 넘기고 locale 을 반영한다", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: profile } });
    const syncProfile = vi.fn();
    const setLocale = vi.fn();
    useAuthStore.setState({ syncProfile } as never);
    useLocaleStore.setState({ setLocale } as never);

    renderPage();

    await waitFor(() => expect(syncProfile).toHaveBeenCalledTimes(1));
    expect(syncProfile).toHaveBeenCalledWith({
      id: "u1",
      name: "홍길동",
      avatarUrl: "https://img.test/a.png",
      locale: "ko",
      theme: "dark",
    });
    expect(setLocale).toHaveBeenCalledWith("ko");
  });

  it("알 수 없는 locale 이면 locale 저장소는 건드리지 않는다", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { data: { ...profile, locale: "xx", avatarUrl: undefined } },
    });
    const syncProfile = vi.fn();
    const setLocale = vi.fn();
    useAuthStore.setState({ syncProfile } as never);
    useLocaleStore.setState({ setLocale } as never);

    renderPage();

    await waitFor(() => expect(syncProfile).toHaveBeenCalledTimes(1));
    expect(setLocale).not.toHaveBeenCalled();
    expect(syncProfile.mock.calls[0][0].avatarUrl).toBeUndefined();
  });
});
