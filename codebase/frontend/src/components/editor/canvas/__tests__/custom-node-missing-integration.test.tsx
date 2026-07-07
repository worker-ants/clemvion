import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEditorStore } from "@/lib/stores/editor-store";
import { useLocaleStore } from "@/lib/stores/locale-store";
import { IntegrationListProvider } from "../integration-list-context";

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

import { CustomNode } from "../custom-node";

const NODE_ID = "int-1";

function makeProps(
  config: Record<string, unknown>,
  { category = "integration", type = "http_request" } = {},
) {
  return {
    id: NODE_ID,
    type: "custom" as const,
    data: { type, label: "Node", config, category },
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

// integrationIds: 워크스페이스 실재 id 집합 (null = 로딩/미완전 → 억제).
function renderNode(
  config: Record<string, unknown>,
  integrationIds: ReadonlySet<string> | null,
  opts?: { category?: string; type?: string },
) {
  return render(
    <TooltipProvider>
      <IntegrationListProvider value={{ integrationIds }}>
        {/* @ts-expect-error — test passes the minimal NodeProps shape */}
        <CustomNode {...makeProps(config, opts)} />
      </IntegrationListProvider>
    </TooltipProvider>,
  );
}

describe("CustomNode ⚠ Missing integration 배지", () => {
  beforeEach(() => {
    cleanup();
    useLocaleStore.setState({ locale: "ko" });
    useEditorStore.setState({
      graphWarnings: { results: [], hasError: false, hasWarning: false },
    } as never);
  });
  afterEach(() => cleanup());

  it("참조 integrationId 가 목록에 없으면(삭제됨) 배지를 렌더한다", () => {
    renderNode(
      { authentication: "integration", integrationId: "deleted-int" },
      new Set(["other-int"]),
    );
    expect(screen.getByTestId("missing-integration-badge")).toBeInTheDocument();
  });

  it("참조 integrationId 가 목록에 실재하면 배지를 렌더하지 않는다", () => {
    renderNode(
      { authentication: "integration", integrationId: "live-int" },
      new Set(["live-int", "other-int"]),
    );
    expect(
      screen.queryByTestId("missing-integration-badge"),
    ).not.toBeInTheDocument();
  });

  it("목록 미확정(null: 로딩 중이거나 페이지네이션 미완전)이면 배지를 억제한다 (위양성 방지)", () => {
    renderNode(
      { authentication: "integration", integrationId: "any-int" },
      null,
    );
    expect(
      screen.queryByTestId("missing-integration-badge"),
    ).not.toBeInTheDocument();
  });

  it("integrationId 미선택(빈 값)이면 배지가 아닌 schema warningRules 가 담당 — 배지 미렌더", () => {
    renderNode({ authentication: "integration", integrationId: "" }, new Set());
    expect(
      screen.queryByTestId("missing-integration-badge"),
    ).not.toBeInTheDocument();
  });

  it("integration 카테고리가 아니면 config.integrationId 가 있어도 배지를 렌더하지 않는다", () => {
    renderNode({ integrationId: "deleted-int" }, new Set(), {
      category: "logic",
    });
    expect(
      screen.queryByTestId("missing-integration-badge"),
    ).not.toBeInTheDocument();
  });

  // http_request 만 integrationId 가 authentication 조건부 — 다른 인증 모드에서
  // 잔존 integrationId 로 오탐하지 않는다 (requirement review WARNING).
  it("http_request 가 authentication!=='integration' 이면 잔존 integrationId 로 배지를 렌더하지 않는다", () => {
    renderNode(
      { authentication: "none", integrationId: "deleted-int" },
      new Set(["other-int"]),
      { type: "http_request" },
    );
    expect(
      screen.queryByTestId("missing-integration-badge"),
    ).not.toBeInTheDocument();
  });

  it("integrationId 가 무조건 필수인 노드(send_email)는 삭제 시 배지를 렌더한다", () => {
    renderNode(
      { integrationId: "deleted-int" },
      new Set(["other-int"]),
      { type: "send_email" },
    );
    expect(screen.getByTestId("missing-integration-badge")).toBeInTheDocument();
  });
});
