import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GraphVisualization } from "../graph-visualization";

// 3D 렌더러는 three.js / WebGL 의존성 때문에 jsdom 에서 mount 불가 — chrome
// (control bar / loader / empty / error / 3D 영역 진입) 만 검증하고 실제
// 그래프는 mock 으로 치환한다.
vi.mock("../graph-3d-renderer", () => ({
  __esModule: true,
  default: ({
    width,
    height,
    data,
  }: {
    width: number;
    height: number;
    data: { nodes: unknown[]; edges: unknown[] };
  }) => (
    <div
      data-testid="graph-3d"
      data-width={width}
      data-height={height}
      data-node-count={data.nodes.length}
      data-edge-count={data.edges.length}
    />
  ),
}));

// next/dynamic 은 vitest 에서 즉시 resolve — 별도 mock 불필요.

const apiMock = vi.hoisted(() => ({
  getGraphVisualization: vi.fn(),
}));
vi.mock("@/lib/api/knowledge-bases", () => ({
  knowledgeBasesApi: apiMock,
}));

vi.mock("@/lib/i18n", () => ({
  useT:
    () =>
    (key: string, params?: Record<string, unknown>): string =>
      params ? `${key} ${JSON.stringify(params)}` : key,
}));

// jsdom 은 ResizeObserver 가 없음 — contentRect.width=800 을 즉시 보고하는 mock.
// afterEach 에서 원본으로 복원해 후속 테스트 파일에 누출되지 않게 한다.
let originalResizeObserver: typeof ResizeObserver | undefined;
beforeEach(() => {
  originalResizeObserver = (
    globalThis as { ResizeObserver?: typeof ResizeObserver }
  ).ResizeObserver;

  class MockResizeObserver {
    callback: ResizeObserverCallback;
    constructor(cb: ResizeObserverCallback) {
      this.callback = cb;
    }
    observe(target: Element) {
      queueMicrotask(() => {
        this.callback(
          [
            {
              target,
              contentRect: { width: 800 } as DOMRectReadOnly,
            } as ResizeObserverEntry,
          ],
          this as unknown as ResizeObserver,
        );
      });
    }
    unobserve() {}
    disconnect() {}
  }
  (
    globalThis as { ResizeObserver: typeof ResizeObserver }
  ).ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
});

afterEach(() => {
  if (originalResizeObserver) {
    (
      globalThis as { ResizeObserver: typeof ResizeObserver }
    ).ResizeObserver = originalResizeObserver;
  } else {
    delete (
      globalThis as { ResizeObserver?: typeof ResizeObserver }
    ).ResizeObserver;
  }
  apiMock.getGraphVisualization.mockReset();
});

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>{ui}</QueryClientProvider>,
  );
}

describe("GraphVisualization (3D)", () => {
  it("shows loader before data resolves", async () => {
    apiMock.getGraphVisualization.mockReturnValue(new Promise(() => {}));
    renderWithQuery(<GraphVisualization kbId="kb-1" />);
    expect(screen.getByText("knowledgeBases.graphVizLimit")).toBeDefined();
    expect(screen.queryByTestId("graph-3d")).toBeNull();
  });

  it("renders empty placeholder when graph has no nodes", async () => {
    apiMock.getGraphVisualization.mockResolvedValue({
      nodes: [],
      edges: [],
      truncated: false,
    });
    renderWithQuery(<GraphVisualization kbId="kb-2" />);
    await waitFor(() => {
      expect(screen.getByText("knowledgeBases.graphVizEmpty")).toBeDefined();
    });
    expect(screen.queryByTestId("graph-3d")).toBeNull();
  });

  it("renders error placeholder when API fails", async () => {
    apiMock.getGraphVisualization.mockRejectedValue(new Error("boom"));
    renderWithQuery(<GraphVisualization kbId="kb-err" />);
    await waitFor(() => {
      expect(
        screen.getByText("knowledgeBases.graphVizLoadFailed"),
      ).toBeDefined();
    });
    expect(screen.queryByTestId("graph-3d")).toBeNull();
  });

  it("mounts 3D renderer with measured width and graph data", async () => {
    apiMock.getGraphVisualization.mockResolvedValue({
      nodes: [
        { id: "n1", label: "Alice", type: "person", mentionCount: 5 },
        { id: "n2", label: "Acme", type: "organization", mentionCount: 3 },
      ],
      edges: [
        {
          id: "e1",
          source: "n1",
          target: "n2",
          predicate: "works_at",
          weight: 2,
        },
      ],
      truncated: false,
    });
    renderWithQuery(<GraphVisualization kbId="kb-3" />);
    const renderer = await screen.findByTestId("graph-3d");
    expect(renderer.getAttribute("data-node-count")).toBe("2");
    expect(renderer.getAttribute("data-edge-count")).toBe("1");
    expect(renderer.getAttribute("data-height")).toBe("600");
    expect(renderer.getAttribute("data-width")).toBe("800");
  });

  it("renders truncation warning when limit is exceeded", async () => {
    apiMock.getGraphVisualization.mockResolvedValue({
      nodes: [{ id: "n1", label: "x", type: "concept", mentionCount: 1 }],
      edges: [],
      truncated: true,
    });
    renderWithQuery(<GraphVisualization kbId="kb-4" />);
    await waitFor(() => {
      expect(
        screen.getByText(/knowledgeBases\.graphVizTruncated/),
      ).toBeDefined();
    });
  });

  it("re-fetches when limit changes via the selector", async () => {
    apiMock.getGraphVisualization.mockResolvedValue({
      nodes: [{ id: "n1", label: "x", type: "concept", mentionCount: 1 }],
      edges: [],
      truncated: false,
    });
    renderWithQuery(<GraphVisualization kbId="kb-5" />);
    await screen.findByTestId("graph-3d");
    // 첫 호출: default limit=50.
    expect(apiMock.getGraphVisualization).toHaveBeenCalledWith("kb-5", 50);

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "200" },
    });

    await waitFor(() => {
      expect(apiMock.getGraphVisualization).toHaveBeenCalledWith("kb-5", 200);
    });
  });

  it("withholds 3D mount until ResizeObserver reports a width", async () => {
    // ResizeObserver 가 호출되지 않는 환경: observe 가 no-op 인 mock 으로 대체.
    class StubResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    (
      globalThis as { ResizeObserver: typeof ResizeObserver }
    ).ResizeObserver = StubResizeObserver as unknown as typeof ResizeObserver;

    apiMock.getGraphVisualization.mockResolvedValue({
      nodes: [{ id: "n1", label: "x", type: "concept", mentionCount: 1 }],
      edges: [],
      truncated: false,
    });
    renderWithQuery(<GraphVisualization kbId="kb-6" />);
    // 데이터는 도착했지만 width=0 이라 3D 컨테이너는 렌더되지 않아야 한다.
    await waitFor(() => {
      expect(apiMock.getGraphVisualization).toHaveBeenCalled();
    });
    expect(screen.queryByTestId("graph-3d")).toBeNull();
  });
});
