import type { ReactNode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ko } from "@/lib/i18n/dict/ko";

vi.mock("@/lib/i18n", async () => {
  const { ko } = await import("@/lib/i18n/dict/ko");
  const tFromKo = (key: string, vars?: Record<string, string>): string => {
    const parts = key.split(".");
    let cur: unknown = ko;
    for (const p of parts) {
      if (!cur || typeof cur !== "object") return key;
      cur = (cur as Record<string, unknown>)[p];
    }
    if (typeof cur !== "string") return key;
    return cur.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars?.[k] ?? "");
  };
  return { useT: () => tFromKo, useLocale: () => "ko" as const };
});

vi.mock("@/lib/api/notifications", async (orig) => {
  const actual = await orig<typeof import("@/lib/api/notifications")>();
  return {
    ...actual,
    notificationsApi: { getSettings: vi.fn(), updateSettings: vi.fn() },
  };
});

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { toast } from "sonner";
import { notificationsApi } from "@/lib/api/notifications";
import { NotificationSettingsPanel } from "../notification-settings-panel";

const n = ko.profile.notifications;
const getSettings = vi.mocked(notificationsApi.getSettings);
const updateSettings = vi.mocked(notificationsApi.updateSettings);

const DEFAULTS = {
  executionFailedInApp: true,
  executionFailedEmail: true,
  scheduleFailedInApp: true,
  scheduleFailedEmail: true,
  integrationExpiryInApp: true,
  integrationExpiryEmail: false,
  dailyDigestEmail: false,
};

function renderPanel() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(<NotificationSettingsPanel />, { wrapper });
}

function box(type: string, channel: "inApp" | "email"): HTMLInputElement {
  const tpl = channel === "inApp" ? n.inAppAria : n.emailAria;
  return screen.getByLabelText(tpl.replace("{{type}}", type));
}

// 근거: CLE-OBS-NOTIFY-SETTINGS 「알림 설정 화면과 수신 거부 링크」 (CLE-T-EJFQ1Y)
describe("NotificationSettingsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("세 유형의 인앱 · 이메일 토글을 서버 값대로 보인다", async () => {
    getSettings.mockResolvedValue(DEFAULTS);
    renderPanel();

    await waitFor(() =>
      expect(box(n.typeExecutionFailed, "inApp")).toBeTruthy(),
    );
    expect(box(n.typeExecutionFailed, "inApp").checked).toBe(true);
    expect(box(n.typeExecutionFailed, "email").checked).toBe(true);
    expect(box(n.typeScheduleFailed, "inApp").checked).toBe(true);
    expect(box(n.typeIntegrationExpired, "inApp").checked).toBe(true);
    // 통합 만료 이메일은 opt-in 이라 기본 꺼짐.
    expect(box(n.typeIntegrationExpired, "email").checked).toBe(false);
    // 유형별 6개 + 일일 요약 1개.
    expect(screen.getAllByRole("checkbox")).toHaveLength(7);
    expect(screen.getByText(n.alwaysOnNote)).toBeTruthy();
    expect(screen.queryByText(n.bothOff)).toBeNull();
  });

  it("토글을 바꾸면 그 키 하나만 PATCH 하고 응답으로 화면을 갱신한다", async () => {
    getSettings.mockResolvedValue(DEFAULTS);
    updateSettings.mockResolvedValue({
      ...DEFAULTS,
      executionFailedInApp: false,
    });
    renderPanel();

    await waitFor(() =>
      expect(box(n.typeExecutionFailed, "inApp")).toBeTruthy(),
    );
    fireEvent.click(box(n.typeExecutionFailed, "inApp"));

    await waitFor(() =>
      expect(updateSettings).toHaveBeenCalledWith({
        executionFailedInApp: false,
      }),
    );
    await waitFor(() =>
      expect(box(n.typeExecutionFailed, "inApp").checked).toBe(false),
    );
    expect(toast.success).toHaveBeenCalledWith(n.saved);
  });

  it("벨과 이메일을 모두 끈 유형에는 받지 않는다는 안내를 보인다", async () => {
    getSettings.mockResolvedValue({
      ...DEFAULTS,
      scheduleFailedInApp: false,
      scheduleFailedEmail: false,
    });
    renderPanel();

    await waitFor(() => expect(screen.getByText(n.bothOff)).toBeTruthy());
    expect(screen.getAllByText(n.bothOff)).toHaveLength(1);
  });

  it("저장에 실패하면 오류 토스트를 띄운다", async () => {
    getSettings.mockResolvedValue(DEFAULTS);
    updateSettings.mockRejectedValue(new Error("boom"));
    renderPanel();

    await waitFor(() =>
      expect(box(n.typeScheduleFailed, "email")).toBeTruthy(),
    );
    fireEvent.click(box(n.typeScheduleFailed, "email"));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(n.saveFailed));
  });

  it("설정을 불러오지 못하면 오류 문구를 보인다", async () => {
    getSettings.mockRejectedValue(new Error("down"));
    renderPanel();

    await waitFor(() => expect(screen.getByText(n.loadFailed)).toBeTruthy());
  });

  // 근거: CLE-OBS-NOTIFY-SETTINGS 「일일 요약」 (CLE-T-BAXAN4)
  it("일일 요약 토글은 기본 꺼짐이고 켜면 dailyDigestEmail 만 PATCH 한다", async () => {
    getSettings.mockResolvedValue(DEFAULTS);
    updateSettings.mockResolvedValue({ ...DEFAULTS, dailyDigestEmail: true });
    renderPanel();

    const digest = await screen.findByLabelText<HTMLInputElement>(
      n.digestLabel,
    );
    expect(digest.checked).toBe(false);
    expect(screen.getByText(n.digestDescription)).toBeTruthy();
    expect(screen.getByText(n.digestExcludedNote)).toBeTruthy();

    fireEvent.click(digest);
    await waitFor(() =>
      expect(updateSettings).toHaveBeenCalledWith({ dailyDigestEmail: true }),
    );
    await waitFor(() => expect(digest.checked).toBe(true));
  });
});
