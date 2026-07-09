import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const listMock = vi.fn();
vi.mock("@/lib/api/workspaces", () => ({
  workspacesApi: { list: (...a: unknown[]) => listMock(...a) },
}));

let mockUser: unknown = { id: "u1" };
vi.mock("@/lib/stores/auth-store", () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ user: mockUser }),
}));

const setWorkspacesMock = vi.fn();
vi.mock("@/lib/stores/workspace-store", () => ({
  useWorkspaceStore: (sel: (s: unknown) => unknown) =>
    sel({ setWorkspaces: setWorkspacesMock }),
}));

import { useWorkspaces } from "../use-workspaces";

function wrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function W({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

const LIST = [
  { id: "a", name: "A", type: "personal", slug: "team-a", role: "owner" },
];

describe("useWorkspaces", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: "u1" };
  });

  it("fetches the list and syncs it into the store when a user is present", async () => {
    listMock.mockResolvedValue(LIST);
    renderHook(() => useWorkspaces(), { wrapper: wrapper() });
    await waitFor(() => expect(setWorkspacesMock).toHaveBeenCalledWith(LIST));
    expect(listMock).toHaveBeenCalledTimes(1);
  });

  it("does not fetch when there is no authenticated user (enabled gate)", () => {
    mockUser = null;
    renderHook(() => useWorkspaces(), { wrapper: wrapper() });
    expect(listMock).not.toHaveBeenCalled();
    expect(setWorkspacesMock).not.toHaveBeenCalled();
  });
});
