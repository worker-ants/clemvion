import { describe, it, expect, beforeEach, vi } from "vitest";

// switchWorkspace 는 동적으로 ../api/auth 를 import 하므로 그 모듈을 스텁한다.
const switchWorkspaceApiMock = vi.fn();
vi.mock("../../api/auth", () => ({
  switchWorkspaceApi: (...args: unknown[]) => switchWorkspaceApiMock(...args),
}));

// 실패 시 toast.error 를 띄우므로 sonner 를 스텁한다.
const toastErrorMock = vi.fn();
vi.mock("sonner", () => ({ toast: { error: (...a: unknown[]) => toastErrorMock(...a) } }));

import { useWorkspaceStore } from "../workspace-store";

const WS_A = {
  id: "ws-a",
  name: "A",
  type: "personal" as const,
  slug: "a",
  role: "owner" as const,
};
const WS_B = {
  id: "ws-b",
  name: "B",
  type: "team" as const,
  slug: "b",
  role: "editor" as const,
};

describe("workspace-store switchWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWorkspaceStore.setState({
      workspaces: [WS_A, WS_B],
      currentWorkspaceId: WS_A.id,
      loaded: true,
    });
  });

  it("switches via the API then updates currentWorkspaceId (토큰 재발급 후 상태 반영)", async () => {
    switchWorkspaceApiMock.mockResolvedValue(undefined);
    await useWorkspaceStore.getState().switchWorkspace(WS_B.id);
    expect(switchWorkspaceApiMock).toHaveBeenCalledWith(WS_B.id);
    expect(useWorkspaceStore.getState().currentWorkspaceId).toBe(WS_B.id);
  });

  it("no-op when target is not in the workspace list (API 미호출)", async () => {
    await useWorkspaceStore.getState().switchWorkspace("ws-unknown");
    expect(switchWorkspaceApiMock).not.toHaveBeenCalled();
    expect(useWorkspaceStore.getState().currentWorkspaceId).toBe(WS_A.id);
  });

  it("no-op when already on the target workspace (API 미호출)", async () => {
    await useWorkspaceStore.getState().switchWorkspace(WS_A.id);
    expect(switchWorkspaceApiMock).not.toHaveBeenCalled();
  });

  it("keeps currentWorkspaceId and surfaces a toast on switch failure (부분 전환 방지)", async () => {
    switchWorkspaceApiMock.mockRejectedValue(new Error("NOT_A_MEMBER"));
    await useWorkspaceStore.getState().switchWorkspace(WS_B.id);
    // 전환 실패 → 현재 선택 유지 + 사용자 알림.
    expect(useWorkspaceStore.getState().currentWorkspaceId).toBe(WS_A.id);
    expect(toastErrorMock).toHaveBeenCalledTimes(1);
  });
});
