import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

let mockParams: Record<string, unknown> = {};
vi.mock("next/navigation", () => ({
  useParams: () => mockParams,
}));

import { useWorkspaceSlug } from "../use-workspace-slug";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";

const WS = {
  id: "w1",
  name: "One",
  type: "team" as const,
  slug: "team-one",
  role: "owner" as const,
};

describe("useWorkspaceSlug", () => {
  beforeEach(() => {
    mockParams = {};
    useWorkspaceStore.setState({
      workspaces: [WS],
      currentWorkspaceId: "w1",
      loaded: true,
    });
  });

  it("prefers the URL slug param (URL is the routing SoT)", () => {
    mockParams = { slug: "team-url" };
    const { result } = renderHook(() => useWorkspaceSlug());
    expect(result.current).toBe("team-url");
  });

  it("falls back to the active workspace's slug when the route has no slug param", () => {
    mockParams = {};
    const { result } = renderHook(() => useWorkspaceSlug());
    expect(result.current).toBe("team-one");
  });

  it("returns null when there is no URL param and no active workspace", () => {
    mockParams = {};
    useWorkspaceStore.setState({ currentWorkspaceId: null });
    const { result } = renderHook(() => useWorkspaceSlug());
    expect(result.current).toBeNull();
  });
});
