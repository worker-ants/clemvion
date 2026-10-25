import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const listMock = vi.fn();

vi.mock("@/lib/api/integrations", () => ({
  integrationsApi: {
    list: (...args: unknown[]) => listMock(...args),
  },
}));

import {
  INTEGRATIONS_LIST_QUERY_KEY,
  useIntegrationRefFilterContext,
} from "../integration-list-context";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useEditorStore } from "@/lib/stores/editor-store";

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { client, wrapper: Wrapper };
}

const page = (rows: unknown[], totalItems = rows.length) => ({
  data: rows,
  pagination: { page: 1, limit: 100, totalItems, totalPages: 1 },
});

describe("useIntegrationRefFilterContext (REQ-EDITOR-059)", () => {
  beforeEach(() => {
    listMock.mockReset();
    useAuthStore.setState({ user: { id: "alice" } as never });
    useEditorStore.setState({ workflowCreatedBy: "bob" });
  });

  it("지금 사용자 · 워크플로우 작성자 · 통합 목록을 한 문맥으로 묶는다", async () => {
    listMock.mockResolvedValue(
      page([
        { id: "org-1", scope: "organization", createdBy: "bob", name: "x" },
        { id: "alice-personal", scope: "personal", createdBy: "alice" },
      ]),
    );
    const { wrapper } = setup();
    const { result } = renderHook(() => useIntegrationRefFilterContext(), {
      wrapper,
    });
    // 목록을 받기 전에는 비울 근거가 없다.
    expect(result.current.integrations).toBeNull();
    expect(result.current.currentUserId).toBe("alice");
    expect(result.current.workflowAuthorId).toBe("bob");

    await waitFor(() => expect(result.current.integrations).not.toBeNull());
    expect(result.current.integrations).toEqual(
      new Map([
        ["org-1", { scope: "organization", createdBy: "bob" }],
        ["alice-personal", { scope: "personal", createdBy: "alice" }],
      ]),
    );
    expect(listMock).toHaveBeenCalledWith({ limit: 100 });
  });

  it("목록이 잘렸으면 통합 목록을 null 로 둔다", async () => {
    listMock.mockResolvedValue(
      page([{ id: "org-1", scope: "organization", createdBy: "bob" }], 150),
    );
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useIntegrationRefFilterContext(), {
      wrapper,
    });
    // 조회가 끝난 뒤에도 null 이어야 한다(로딩 중의 null 과 구별한다).
    await waitFor(() =>
      expect(client.getQueryData(INTEGRATIONS_LIST_QUERY_KEY)).toBeDefined(),
    );
    expect(result.current.integrations).toBeNull();
    expect(result.current.workflowAuthorId).toBe("bob");
  });

  it("로그인 사용자나 워크플로우 작성자를 모르면 null 로 싣는다", async () => {
    listMock.mockResolvedValue(page([]));
    useAuthStore.setState({ user: null });
    useEditorStore.setState({ workflowCreatedBy: null });
    const { wrapper } = setup();
    const { result } = renderHook(() => useIntegrationRefFilterContext(), {
      wrapper,
    });
    await waitFor(() => expect(result.current.integrations).not.toBeNull());
    expect(result.current.currentUserId).toBeNull();
    expect(result.current.workflowAuthorId).toBeNull();
  });
});
