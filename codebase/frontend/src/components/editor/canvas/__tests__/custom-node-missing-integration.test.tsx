import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEditorStore } from "@/lib/stores/editor-store";
import { useLocaleStore } from "@/lib/stores/locale-store";

// ReactFlow 의 Handle/useStore/useUpdateNodeInternals stub — 본 테스트 관심사는
// §5 Missing integration 배지뿐이므로 실제 <ReactFlow> 인스턴스를 요구하는
// 훅/컴포넌트를 가볍게 stub 한다 (custom-node-graph-warning.test.tsx 와 동일 패턴).
vi.mock("@xyflow/react", () => ({
  Handle: () => null,
  Position: { Left: "left", Right: "right" },
  useStore: (selector: (s: { transform: number[]; nodes: unknown[] }) => unknown) =>
    selector({ transform: [0, 0, 1], nodes: [] }),
  useUpdateNodeInternals: () => () => {},
}));

// useQuery 를 per-test 로 제어 — 실제 QueryClientProvider·네트워크 없이
// integration 목록 상태(로딩/결과)를 주입한다. 배지는 category=integration +
// integrationId 가 있을 때만 mount 되어 useQuery 를 호출한다.
let mockQuery: { data: unknown; isLoading: boolean };
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => mockQuery,
}));

import { CustomNode } from "../custom-node";

const NODE_ID = "int-1";

function makeProps(config: Record<string, unknown>, category = "integration") {
  return {
    id: NODE_ID,
    type: "custom" as const,
    data: { type: "http_request", label: "HTTP", config, category },
    selected: false,
    dragging: false,
    isConnectable: true,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    zIndex: 0,
    deletable: true,
    selectable: true,
    draggable: true,
    width: 180,
    height: 80,
  } as never;
}

function renderNode(config: Record<string, unknown>, category = "integration") {
  return render(
    <TooltipProvider>
      {/* @ts-expect-error — test passes the minimal NodeProps shape */}
      <CustomNode {...makeProps(config, category)} />
    </TooltipProvider>,
  );
}

function withList(ids: string[]) {
  mockQuery = {
    data: { data: ids.map((id) => ({ id })), pagination: {} },
    isLoading: false,
  };
}

describe("CustomNode ⚠ Missing integration 배지", () => {
  beforeEach(() => {
    cleanup();
    useLocaleStore.setState({ locale: "ko" });
    useEditorStore.setState({
      graphWarnings: { results: [], hasError: false, hasWarning: false },
    } as never);
    mockQuery = { data: undefined, isLoading: false };
  });
  afterEach(() => cleanup());

  it("참조 integrationId 가 목록에 없으면(삭제됨) 배지를 렌더한다", () => {
    withList(["other-int"]);
    renderNode({ integrationId: "deleted-int" });
    expect(screen.getByTestId("missing-integration-badge")).toBeInTheDocument();
  });

  it("참조 integrationId 가 목록에 실재하면 배지를 렌더하지 않는다", () => {
    withList(["live-int", "other-int"]);
    renderNode({ integrationId: "live-int" });
    expect(
      screen.queryByTestId("missing-integration-badge"),
    ).not.toBeInTheDocument();
  });

  it("목록 로딩 중에는 배지를 억제한다 (위양성 방지)", () => {
    mockQuery = { data: undefined, isLoading: true };
    renderNode({ integrationId: "any-int" });
    expect(
      screen.queryByTestId("missing-integration-badge"),
    ).not.toBeInTheDocument();
  });

  it("integrationId 미선택(빈 값)이면 배지가 아닌 schema warningRules 가 담당 — 배지 미렌더", () => {
    withList([]);
    renderNode({ integrationId: "" });
    expect(
      screen.queryByTestId("missing-integration-badge"),
    ).not.toBeInTheDocument();
  });

  it("integration 카테고리가 아니면 config.integrationId 가 있어도 배지를 렌더하지 않는다", () => {
    withList([]);
    renderNode({ integrationId: "deleted-int" }, "logic");
    expect(
      screen.queryByTestId("missing-integration-badge"),
    ).not.toBeInTheDocument();
  });
});
