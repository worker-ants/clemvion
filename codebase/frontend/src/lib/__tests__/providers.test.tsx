import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, act, cleanup, waitFor } from "@testing-library/react";
import { useQuery, QueryClient } from "@tanstack/react-query";

import { Providers } from "../providers";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";

const WORKSPACE_A = {
  id: "ws-a",
  name: "A",
  type: "personal" as const,
  slug: "a",
  role: "owner" as const,
};

const WORKSPACE_B = {
  id: "ws-b",
  name: "B",
  type: "team" as const,
  slug: "b",
  role: "editor" as const,
};

function Probe({
  onRender,
  responder,
}: {
  onRender: (data: string | undefined) => void;
  responder: () => Promise<string>;
}) {
  const query = useQuery<string>({
    queryKey: ["probe"],
    queryFn: responder,
    staleTime: Infinity,
  });
  onRender(query.data);
  return null;
}

describe("Providers workspace switch invalidation", () => {
  let resetSpy: ReturnType<typeof vi.spyOn>;
  let cancelSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    useWorkspaceStore.setState({
      workspaces: [WORKSPACE_A, WORKSPACE_B],
      currentWorkspaceId: WORKSPACE_A.id,
      loaded: true,
    });
    resetSpy = vi.spyOn(QueryClient.prototype, "resetQueries");
    cancelSpy = vi.spyOn(QueryClient.prototype, "cancelQueries");
  });

  afterEach(() => {
    cleanup();
    useWorkspaceStore.getState().reset();
    vi.restoreAllMocks();
  });

  it("resets active queries so the currently-open page loses stale data immediately", async () => {
    const onRender = vi.fn();
    let resolveFetch: ((value: string) => void) | null = null;
    const responder = vi.fn(async () => {
      if (resolveFetch) {
        return new Promise<string>((resolve) => {
          resolveFetch = resolve;
        });
      }
      return "A-data";
    });

    render(
      <Providers>
        <Probe onRender={onRender} responder={responder} />
      </Providers>,
    );

    await waitFor(() => {
      expect(onRender).toHaveBeenCalledWith("A-data");
    });

    // 다음 fetch는 응답을 보류시켜, reset 직후의 중간 상태를 관찰
    resolveFetch = () => {};

    await act(async () => {
      useWorkspaceStore.getState().switchWorkspace(WORKSPACE_B.id);
    });

    expect(cancelSpy).toHaveBeenCalledTimes(1);
    expect(resetSpy).toHaveBeenCalledTimes(1);

    // reset 직후, refetch가 아직 끝나지 않은 상태에서 Probe의 data는 undefined여야 한다.
    // (= 열린 페이지에서 이전 workspace의 목록이 즉시 사라진다)
    await waitFor(() => {
      expect(onRender.mock.calls.at(-1)?.[0]).toBeUndefined();
    });
  });

  it("does not reset cache when workspace id is set to the same value", async () => {
    const onRender = vi.fn();
    render(
      <Providers>
        <Probe onRender={onRender} responder={async () => "A-data"} />
      </Providers>,
    );

    await waitFor(() => expect(onRender).toHaveBeenCalledWith("A-data"));
    resetSpy.mockClear();
    cancelSpy.mockClear();

    await act(async () => {
      useWorkspaceStore.getState().switchWorkspace(WORKSPACE_A.id);
    });

    expect(resetSpy).not.toHaveBeenCalled();
    expect(cancelSpy).not.toHaveBeenCalled();
  });

  it("does not reset cache on initial workspace load (null → id)", async () => {
    useWorkspaceStore.setState({
      workspaces: [WORKSPACE_A, WORKSPACE_B],
      currentWorkspaceId: null,
      loaded: false,
    });

    const onRender = vi.fn();
    render(
      <Providers>
        <Probe onRender={onRender} responder={async () => "A-data"} />
      </Providers>,
    );
    await waitFor(() => expect(onRender).toHaveBeenCalledWith("A-data"));
    resetSpy.mockClear();
    cancelSpy.mockClear();

    await act(async () => {
      useWorkspaceStore.setState({
        currentWorkspaceId: WORKSPACE_A.id,
        loaded: true,
      });
    });

    expect(resetSpy).not.toHaveBeenCalled();
    expect(cancelSpy).not.toHaveBeenCalled();
  });
});
