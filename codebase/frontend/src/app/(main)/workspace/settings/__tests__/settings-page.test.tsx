import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  render,
  screen,
  act,
  cleanup,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLocaleStore } from "@/lib/stores/locale-store";
import {
  useWorkspaceStore,
  type WorkspaceRole,
} from "@/lib/stores/workspace-store";

const getSettingsMock = vi.fn();
const updateSettingsMock = vi.fn();
vi.mock("@/lib/api/workspaces", () => ({
  workspacesApi: {
    getSettings: (...args: unknown[]) => getSettingsMock(...args),
    updateSettings: (...args: unknown[]) => updateSettingsMock(...args),
    list: vi.fn(() => Promise.resolve([])),
  },
}));

import WorkspaceSettingsPage from "../page";

afterEach(() => {
  cleanup();
});

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

async function renderPage() {
  await act(async () => {
    render(<WorkspaceSettingsPage />, { wrapper: createWrapper() });
  });
}

function setRole(role: WorkspaceRole) {
  useWorkspaceStore.setState({
    workspaces: [
      { id: "ws-1", name: "Test", type: "personal", slug: "me", role },
    ],
    currentWorkspaceId: "ws-1",
    loaded: true,
  });
}

// [Spec 2-navigation/3-schedule §2.2] 워크스페이스 기본 시간대 설정 UI
describe("WorkspaceSettingsPage — default timezone", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    useLocaleStore.setState({ locale: "en" });
    setRole("admin");
    getSettingsMock.mockResolvedValue({
      interactionAllowedOrigins: [],
      timezone: "Asia/Seoul",
    });
    updateSettingsMock.mockResolvedValue(undefined);
  });

  // getSettings 성공 후 editor 가 key-remount 로 초기값을 시드하므로,
  // findByDisplayValue 로 시드 완료된(=편집 가능) 입력을 기다린다.
  it("admin: timezone 입력이 getSettings 값으로 시드되고 편집 가능하다", async () => {
    await renderPage();
    const tzInput = await screen.findByDisplayValue("Asia/Seoul");
    expect(tzInput).toHaveAttribute("id", "ws-timezone");
    expect(tzInput).toBeEnabled();
  });

  it("admin: 값 수정 후 저장하면 updateSettings 가 { timezone } 으로만 호출된다", async () => {
    await renderPage();
    const tzInput = (await screen.findByDisplayValue(
      "Asia/Seoul",
    )) as HTMLInputElement;
    const user = userEvent.setup();
    await user.clear(tzInput);
    await user.type(tzInput, "UTC");
    // 타임존 카드에 국한해 Save 버튼을 찾는다(임베드 카드에도 동명 버튼 존재).
    const card = tzInput.closest("div.space-y-4") as HTMLElement;
    await user.click(within(card).getByRole("button", { name: /^save$/i }));
    expect(updateSettingsMock).toHaveBeenCalledWith("ws-1", { timezone: "UTC" });
  });

  it("admin: 값을 비우고 저장하면 updateSettings 가 { timezone: '' } 로 호출된다(설정 해제)", async () => {
    await renderPage();
    const tzInput = (await screen.findByDisplayValue(
      "Asia/Seoul",
    )) as HTMLInputElement;
    const user = userEvent.setup();
    await user.clear(tzInput);
    const card = tzInput.closest("div.space-y-4") as HTMLElement;
    await user.click(within(card).getByRole("button", { name: /^save$/i }));
    expect(updateSettingsMock).toHaveBeenCalledWith("ws-1", { timezone: "" });
  });

  it("viewer: timezone 입력은 비활성이고 저장 버튼이 없다", async () => {
    setRole("viewer");
    await renderPage();
    const tzInput = await screen.findByDisplayValue("Asia/Seoul");
    expect(tzInput).toBeDisabled();
    const card = tzInput.closest("div.space-y-4") as HTMLElement;
    expect(
      within(card).queryByRole("button", { name: /^save$/i }),
    ).toBeNull();
  });
});
