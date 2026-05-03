import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GraphVisualization } from "../graph-visualization";

// 3D 렌더러는 three.js / WebGL 의존성 때문에 jsdom 에서 mount 불가 — chrome
// (control bar / loader / empty / 3D 영역 진입) 만 검증하고 실제 그래프는 mock.
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

// next/dynamic 은 컴포넌트를 lazy 로드 — vi.mock 대상이 dynamic 안의 import 라
// vitest 기본 동작상 즉시 resolve 된다. 별도 mock 불필요.

// ResizeObserver 는 jsdom 에 없음 — 가짜로 채워 contentRect.width=800 을 즉시
// 보고하도록 한다 (3D 컨테이너 진입 조건).
beforeEach(() => {
  class MockResizeObserver {
    callback: ResizeObserverCallback;
    constructor(cb: ResizeObserverCallback) {
      this.callback = cb;
    }
    observe(target: Element) {
      // 마운트 다음 마이크로태스크에 한 번 호출.
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

// API 모듈을 통째로 mock — 호출자별로 결과를 갈아끼우기 위해 module-scope state.
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
    // Limit selector 와 legend 는 항상 보이고, 본문엔 spinner 만.
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
    // ResizeObserver mock 이 800 을 보고함.
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
});
