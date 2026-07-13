import { describe, it, expect, beforeAll } from "vitest";
import {
  resolvePortType,
  getEdgeColor,
  buildEdgeData,
  getConnectedEdgeIds,
  dropStaleEdges,
  enrichEdgesWithPortData,
  isSelfConnection,
  isDuplicateConnection,
  isConnectionDroppedOnPane,
  firstInputHandleId,
  firstOutputHandleId,
  connectionDragSource,
  pointerClientPosition,
  buildAutoConnectConnection,
  isContainerBoundaryEdge,
  buildEdgeSplitPlan,
  findEdgeIdAtPoint,
  resolveEdgeExecutionState,
  buildEdgeStyle,
  PORT_TYPE_COLORS,
} from "../edge-utils";
import type { Node, Edge } from "@xyflow/react";
import { useNodeDefinitionsStore } from "@/lib/stores/node-definitions-store";
import type { NodeDefinition } from "@/lib/node-definitions";

beforeAll(() => {
  const make = (
    type: string,
    extras: Partial<NodeDefinition>,
  ): NodeDefinition => ({
    type,
    category: "logic",
    label: type,
    description: "",
    icon: "Box",
    color: "#000",
    inputs: [],
    outputs: [],
    defaultConfig: {},
    configSchema: {},
    ...extras,
  });
  useNodeDefinitionsStore.setState({
    status: "ready",
    error: null,
    order: ["loop", "map", "foreach", "http_request"],
    definitions: {
      loop: make("loop", { isContainer: true }),
      map: make("map", { isContainer: true }),
      foreach: make("foreach", { isContainer: true }),
      http_request: make("http_request", {
        category: "integration",
        outputs: [
          { id: "success", label: "Success", type: "data" },
          { id: "error", label: "Error", type: "error" },
        ],
      }),
    },
  });
});

describe("resolvePortType", () => {
  it("returns 'error' for error sourceHandle", () => {
    expect(resolvePortType("error", "http_request")).toBe("error");
  });

  it("returns 'container' for body sourceHandle", () => {
    expect(resolvePortType("body", "loop")).toBe("container");
  });

  it("returns 'system' for AI agent system ports", () => {
    expect(resolvePortType("out", "ai_agent")).toBe("system");
    expect(resolvePortType("user_ended", "ai_agent")).toBe("system");
    expect(resolvePortType("max_turns", "ai_agent")).toBe("system");
  });

  it("returns 'data' for AI agent custom condition ports", () => {
    expect(resolvePortType("some_condition_id", "ai_agent")).toBe("data");
  });

  it("returns 'system' for container done port", () => {
    expect(resolvePortType("done", "loop")).toBe("system");
    expect(resolvePortType("done", "map")).toBe("system");
    expect(resolvePortType("done", "foreach")).toBe("system");
  });

  it("returns 'data' for regular data ports", () => {
    expect(resolvePortType("out", "manual_trigger")).toBe("data");
    expect(resolvePortType("out", "variable_declaration")).toBe("data");
    expect(resolvePortType("true", "if_else")).toBe("data");
    expect(resolvePortType("false", "if_else")).toBe("data");
  });

  it("returns 'data' for null/undefined sourceHandle", () => {
    expect(resolvePortType(null, "manual_trigger")).toBe("data");
    expect(resolvePortType(undefined, "manual_trigger")).toBe("data");
  });

  it("returns 'data' for unknown node type", () => {
    expect(resolvePortType("out", "nonexistent_type")).toBe("data");
  });

  it("returns 'data' for emit handle", () => {
    expect(resolvePortType("emit", "loop")).toBe("data");
  });
});

describe("getEdgeColor", () => {
  it("returns correct color for each port type", () => {
    expect(getEdgeColor("data")).toBe("#22c55e");
    expect(getEdgeColor("system")).toBe("#3b82f6");
    expect(getEdgeColor("error")).toBe("#ef4444");
    expect(getEdgeColor("container")).toBe("#a855f7");
  });
});

describe("buildEdgeData", () => {
  it("builds correct edge data for data port", () => {
    const data = buildEdgeData("out", "manual_trigger");
    expect(data).toEqual({
      sourcePort: "out",
      portType: "data",
      portColor: PORT_TYPE_COLORS.data,
    });
  });

  it("builds correct edge data for error port", () => {
    const data = buildEdgeData("error", "http_request");
    expect(data).toEqual({
      sourcePort: "error",
      portType: "error",
      portColor: PORT_TYPE_COLORS.error,
    });
  });

  it("builds correct edge data for container body port", () => {
    const data = buildEdgeData("body", "loop");
    expect(data).toEqual({
      sourcePort: "body",
      portType: "container",
      portColor: PORT_TYPE_COLORS.container,
    });
  });

  it("builds correct edge data for AI agent system port", () => {
    const data = buildEdgeData("user_ended", "ai_agent");
    expect(data).toEqual({
      sourcePort: "user_ended",
      portType: "system",
      portColor: PORT_TYPE_COLORS.system,
    });
  });

  it("defaults sourcePort to 'out' for null handle", () => {
    const data = buildEdgeData(null, "manual_trigger");
    expect(data.sourcePort).toBe("out");
  });
});

describe("getConnectedEdgeIds", () => {
  const edges: Edge[] = [
    { id: "e1", source: "a", target: "b" },
    { id: "e2", source: "b", target: "c" },
    { id: "e3", source: "d", target: "e" },
  ];

  it("returns edges connected to a node as source or target", () => {
    const ids = getConnectedEdgeIds("b", edges);
    expect(ids).toEqual(new Set(["e1", "e2"]));
  });

  it("returns empty set for unconnected node", () => {
    const ids = getConnectedEdgeIds("z", edges);
    expect(ids).toEqual(new Set());
  });

  it("returns single edge for leaf node", () => {
    const ids = getConnectedEdgeIds("a", edges);
    expect(ids).toEqual(new Set(["e1"]));
  });

  it("returns edge when node is both source and target (self-loop)", () => {
    const selfLoopEdges: Edge[] = [{ id: "e1", source: "a", target: "a" }];
    const ids = getConnectedEdgeIds("a", selfLoopEdges);
    expect(ids).toEqual(new Set(["e1"]));
  });
});

describe("isSelfConnection (§2.2)", () => {
  it("source === target 이면 true", () => {
    expect(isSelfConnection({ source: "a", target: "a" })).toBe(true);
  });

  it("서로 다른 노드면 false", () => {
    expect(isSelfConnection({ source: "a", target: "b" })).toBe(false);
  });

  it("source 나 target 이 null 이면 false (미완성 드래그)", () => {
    expect(isSelfConnection({ source: null, target: null })).toBe(false);
    expect(isSelfConnection({ source: "a", target: null })).toBe(false);
  });
});

describe("isDuplicateConnection (§2.2)", () => {
  const edges: Edge[] = [
    { id: "e1", source: "a", target: "b", sourceHandle: "out", targetHandle: "in" },
  ];

  it("같은 (source, sourceHandle, target, targetHandle) 조합이면 true", () => {
    expect(
      isDuplicateConnection(edges, {
        source: "a",
        target: "b",
        sourceHandle: "out",
        targetHandle: "in",
      }),
    ).toBe(true);
  });

  it("sourceHandle 이 다르면 false (다른 포트에서 나가는 별개 연결)", () => {
    expect(
      isDuplicateConnection(edges, {
        source: "a",
        target: "b",
        sourceHandle: "error",
        targetHandle: "in",
      }),
    ).toBe(false);
  });

  it("target 이 다르면 false", () => {
    expect(
      isDuplicateConnection(edges, {
        source: "a",
        target: "c",
        sourceHandle: "out",
        targetHandle: "in",
      }),
    ).toBe(false);
  });

  it("handle 없음(null/undefined) 은 동등 취급", () => {
    const noHandleEdges: Edge[] = [{ id: "e1", source: "a", target: "b" }];
    expect(
      isDuplicateConnection(noHandleEdges, { source: "a", target: "b" }),
    ).toBe(true);
    expect(
      isDuplicateConnection(noHandleEdges, {
        source: "a",
        target: "b",
        sourceHandle: null,
        targetHandle: undefined,
      }),
    ).toBe(true);
  });
});

describe("isConnectionDroppedOnPane (§1.2)", () => {
  it("유효 핸들 연결(isValid===true)이면 false — onConnect 가 처리하므로 팝업 없음", () => {
    expect(isConnectionDroppedOnPane({ isValid: true })).toBe(false);
  });

  it("빈 영역 드롭(isValid===false)이면 true — 노드 추가 팝업 대상", () => {
    expect(isConnectionDroppedOnPane({ isValid: false })).toBe(true);
  });

  it("isValid 가 null(무효 target)이면 true", () => {
    expect(isConnectionDroppedOnPane({ isValid: null })).toBe(true);
  });

  it("isValid 가 undefined 여도 true (연결 미성립)", () => {
    expect(isConnectionDroppedOnPane({})).toBe(true);
  });

  it("connectionState 자체가 없으면 false (판정 불가 → 팝업 안 띄움)", () => {
    expect(isConnectionDroppedOnPane(null)).toBe(false);
    expect(isConnectionDroppedOnPane(undefined)).toBe(false);
  });
});

describe("firstInputHandleId (§1.2)", () => {
  it("첫 입력 포트의 id 를 반환한다", () => {
    expect(
      firstInputHandleId({ inputs: [{ id: "in" }, { id: "in2" }] }),
    ).toBe("in");
  });

  it("입력 포트가 없으면 null (예: 트리거 노드 → 자동 연결 생략)", () => {
    expect(firstInputHandleId({ inputs: [] })).toBeNull();
  });

  it("definition 이 null/undefined 여도 null", () => {
    expect(firstInputHandleId(null)).toBeNull();
    expect(firstInputHandleId(undefined)).toBeNull();
  });

  it("inputs 필드가 없어도 null", () => {
    expect(firstInputHandleId({})).toBeNull();
  });

  it("예약 입력 포트 'emit' 은 건너뛰고 첫 일반 입력 포트를 반환한다 (§1.3 (e))", () => {
    // 컨테이너 노드처럼 첫 입력이 'emit'(loopback 수집)이면 그 포트로 자동 연결 시
    // detectContainerConflict 가 거부해 orphan 이 남으므로 일반 입력('in')을 택한다.
    expect(
      firstInputHandleId({ inputs: [{ id: "emit" }, { id: "in" }] }),
    ).toBe("in");
  });

  it("예약 포트('emit')만 있으면 null (자동 연결 생략)", () => {
    expect(firstInputHandleId({ inputs: [{ id: "emit" }] })).toBeNull();
  });
});

describe("connectionDragSource (§1.2)", () => {
  const src = { id: "n1" };
  const outHandle = { id: "out", type: "source" };

  it("빈 영역 드롭 + 출력 포트 시작이면 연결원을 반환한다", () => {
    expect(
      connectionDragSource({ isValid: false, fromNode: src, fromHandle: outHandle }),
    ).toEqual({ nodeId: "n1", handleId: "out" });
  });

  it("handle id 가 null 이면 handleId=null (단일 출력 포트)", () => {
    expect(
      connectionDragSource({
        isValid: null,
        fromNode: src,
        fromHandle: { id: null, type: "source" },
      }),
    ).toEqual({ nodeId: "n1", handleId: null });
  });

  it("유효 연결(isValid===true)이면 null — onConnect 가 처리", () => {
    expect(
      connectionDragSource({ isValid: true, fromNode: src, fromHandle: outHandle }),
    ).toBeNull();
  });

  it("입력 포트(target 타입) 시작 역방향 드래그는 null — §1.3 소관", () => {
    expect(
      connectionDragSource({
        isValid: false,
        fromNode: src,
        fromHandle: { id: "in", type: "target" },
      }),
    ).toBeNull();
  });

  it("fromNode 가 없으면 null", () => {
    expect(
      connectionDragSource({ isValid: false, fromNode: null, fromHandle: outHandle }),
    ).toBeNull();
  });

  it("connectionState 가 null/undefined 여도 null", () => {
    expect(connectionDragSource(null)).toBeNull();
    expect(connectionDragSource(undefined)).toBeNull();
  });
});

describe("pointerClientPosition (§1.2)", () => {
  it("마우스 이벤트에서 clientX/clientY 를 추출한다", () => {
    expect(
      pointerClientPosition({ clientX: 10, clientY: 20 } as unknown as MouseEvent),
    ).toEqual({ clientX: 10, clientY: 20 });
  });

  it("터치 이벤트는 changedTouches[0] 에서 추출한다", () => {
    expect(
      pointerClientPosition({
        changedTouches: [{ clientX: 5, clientY: 6 }],
      } as unknown as TouchEvent),
    ).toEqual({ clientX: 5, clientY: 6 });
  });

  it("빈 changedTouches 면 null", () => {
    expect(
      pointerClientPosition({ changedTouches: [] } as unknown as TouchEvent),
    ).toBeNull();
  });
});

describe("buildAutoConnectConnection (§1.2)", () => {
  const source = { nodeId: "src", handleId: "out" };

  it("대상에 입력 포트가 있으면 Connection 을 조립한다", () => {
    expect(
      buildAutoConnectConnection(source, "new1", { inputs: [{ id: "in" }] }),
    ).toEqual({
      source: "src",
      sourceHandle: "out",
      target: "new1",
      targetHandle: "in",
    });
  });

  it("source handleId 가 null 이면 sourceHandle=null 로 보존", () => {
    expect(
      buildAutoConnectConnection(
        { nodeId: "src", handleId: null },
        "new1",
        { inputs: [{ id: "in" }] },
      ),
    ).toEqual({
      source: "src",
      sourceHandle: null,
      target: "new1",
      targetHandle: "in",
    });
  });

  it("대상에 입력 포트가 없으면 null — 연결 생략(트리거 등)", () => {
    expect(buildAutoConnectConnection(source, "new1", { inputs: [] })).toBeNull();
    expect(buildAutoConnectConnection(source, "new1", null)).toBeNull();
  });
});

describe("firstOutputHandleId (§4.1)", () => {
  it("첫 출력 포트의 id 를 반환한다", () => {
    expect(
      firstOutputHandleId({ outputs: [{ id: "out" }, { id: "out2" }] }),
    ).toBe("out");
  });

  it("출력 포트가 없으면 null (순수 sink 노드 → 분할 생략)", () => {
    expect(firstOutputHandleId({ outputs: [] })).toBeNull();
    expect(firstOutputHandleId({})).toBeNull();
    expect(firstOutputHandleId(null)).toBeNull();
    expect(firstOutputHandleId(undefined)).toBeNull();
  });
});

describe("isContainerBoundaryEdge (§4.1)", () => {
  it("sourceHandle 이 body(본문 진입)면 경계 엣지", () => {
    expect(isContainerBoundaryEdge({ sourceHandle: "body" })).toBe(true);
  });
  it("targetHandle 이 emit 이면 경계 엣지(loopback)", () => {
    expect(isContainerBoundaryEdge({ targetHandle: "emit" })).toBe(true);
  });
  it("done 은 경계가 아니다 — Parallel Branch 의 일반 데이터 출력과 동명이라 오배제 방지", () => {
    expect(isContainerBoundaryEdge({ sourceHandle: "done" })).toBe(false);
  });
  it("일반 데이터 엣지는 false", () => {
    expect(
      isContainerBoundaryEdge({ sourceHandle: "out", targetHandle: "in" }),
    ).toBe(false);
    expect(isContainerBoundaryEdge({})).toBe(false);
  });
});

describe("buildEdgeSplitPlan (§4.1)", () => {
  const def = { inputs: [{ id: "in" }], outputs: [{ id: "out" }] };
  const edge = {
    source: "A",
    sourceHandle: "true", // 다중 출력(If/Else) 원본 핸들
    target: "B",
    targetHandle: "in",
  };

  it("source→새노드·새노드→target 두 Connection 을 조립하고 원본 양끝 핸들을 보존한다", () => {
    expect(buildEdgeSplitPlan(edge, "N", def)).toEqual({
      sourceToNew: {
        source: "A",
        sourceHandle: "true",
        target: "N",
        targetHandle: "in",
      },
      newToTarget: {
        source: "N",
        sourceHandle: "out",
        target: "B",
        targetHandle: "in",
      },
    });
  });

  it("원본 핸들이 없으면(null) 그대로 null 로 보존", () => {
    const plan = buildEdgeSplitPlan(
      { source: "A", target: "B" },
      "N",
      def,
    );
    expect(plan?.sourceToNew.sourceHandle).toBeNull();
    expect(plan?.newToTarget.targetHandle).toBeNull();
  });

  it("첫 입력 포트는 예약 emit 을 건너뛴다", () => {
    const plan = buildEdgeSplitPlan(edge, "N", {
      inputs: [{ id: "emit" }, { id: "in" }],
      outputs: [{ id: "out" }],
    });
    expect(plan?.sourceToNew.targetHandle).toBe("in");
  });

  it("새 노드에 입력이 없으면 null (트리거)", () => {
    expect(
      buildEdgeSplitPlan(edge, "N", { inputs: [], outputs: [{ id: "out" }] }),
    ).toBeNull();
  });

  it("새 노드에 출력이 없으면 null (순수 sink)", () => {
    expect(
      buildEdgeSplitPlan(edge, "N", { inputs: [{ id: "in" }], outputs: [] }),
    ).toBeNull();
  });

  it("definition 이 null/undefined 여도 null (방어)", () => {
    expect(buildEdgeSplitPlan(edge, "N", null)).toBeNull();
    expect(buildEdgeSplitPlan(edge, "N", undefined)).toBeNull();
  });

  it("컨테이너 경계 엣지는 분할 대상 제외 → null (R-3)", () => {
    expect(
      buildEdgeSplitPlan(
        { source: "L", sourceHandle: "body", target: "C", targetHandle: "in" },
        "N",
        def,
      ),
    ).toBeNull();
    expect(
      buildEdgeSplitPlan(
        { source: "C", sourceHandle: "out", target: "L", targetHandle: "emit" },
        "N",
        def,
      ),
    ).toBeNull();
  });

  it("새 노드 자체가 컨테이너면 null — body 재편입 위험 제외 (R-3, ai-review CRITICAL)", () => {
    // 컨테이너 노드의 첫 출력은 body → firstOutputHandleId 가 body 를 고르면 target 이
    // 새 컨테이너 본문 자식으로 재편입되므로, 분할 자체를 막고 노드만 추가한다.
    expect(
      buildEdgeSplitPlan(edge, "N", {
        inputs: [{ id: "in" }],
        outputs: [{ id: "body" }, { id: "done" }],
        isContainer: true,
      }),
    ).toBeNull();
  });

  it("다중 출력 비-컨테이너 노드(If/Else 등)는 첫 출력만 연결한다", () => {
    const plan = buildEdgeSplitPlan(edge, "N", {
      inputs: [{ id: "in" }],
      outputs: [{ id: "true" }, { id: "false" }],
    });
    expect(plan?.newToTarget.sourceHandle).toBe("true"); // 첫 출력, 나머지 분기는 수동
  });
});

describe("findEdgeIdAtPoint (§4.1)", () => {
  const fakeDoc = (edgeId: string | null) => ({
    elementFromPoint: () =>
      edgeId === null
        ? null
        : ({
            closest: (sel: string) =>
              sel === ".react-flow__edge"
                ? { getAttribute: () => edgeId }
                : null,
          } as unknown as Element),
  });

  it("드롭 지점 아래 엣지의 data-id 를 반환한다", () => {
    expect(findEdgeIdAtPoint(10, 20, fakeDoc("e1"))).toBe("e1");
  });

  it("엣지 위가 아니면(elementFromPoint null) null", () => {
    expect(findEdgeIdAtPoint(10, 20, fakeDoc(null))).toBeNull();
  });

  it("엘리먼트가 엣지 조상을 갖지 않으면 null", () => {
    const doc = {
      elementFromPoint: () =>
        ({ closest: () => null }) as unknown as Element,
    };
    expect(findEdgeIdAtPoint(10, 20, doc)).toBeNull();
  });

  it("엣지 조상이 data-id 속성을 갖지 않으면 null (coalesce)", () => {
    const doc = {
      elementFromPoint: () =>
        ({
          closest: () => ({ getAttribute: () => null }),
        }) as unknown as Element,
    };
    expect(findEdgeIdAtPoint(10, 20, doc)).toBeNull();
  });
});

describe("resolveEdgeExecutionState (§3.2)", () => {
  const edge = { source: "a", target: "b" };
  const ctx = (over?: {
    disabled?: string[];
    statuses?: Record<string, string>;
    executing?: boolean;
  }) => ({
    disabledNodeIds: new Set(over?.disabled ?? []),
    nodeStatusById: new Map(Object.entries(over?.statuses ?? {})),
    executing: over?.executing ?? false,
  });

  it("source 가 비활성이면 inactive (flowing/completed 배제)", () => {
    expect(
      resolveEdgeExecutionState(edge, ctx({ disabled: ["a"] })),
    ).toEqual({ inactive: true, flowing: false, completed: false });
  });

  it("target 이 비활성이어도 inactive", () => {
    expect(
      resolveEdgeExecutionState(edge, ctx({ disabled: ["b"] })).inactive,
    ).toBe(true);
  });

  it("비활성이 실행 상태보다 우선 — 둘 다 completed 여도 inactive", () => {
    expect(
      resolveEdgeExecutionState(
        edge,
        ctx({ disabled: ["a"], statuses: { a: "completed", b: "completed" } }),
      ),
    ).toEqual({ inactive: true, flowing: false, completed: false });
  });

  it("실행 중 + source completed + target running 이면 flowing", () => {
    expect(
      resolveEdgeExecutionState(
        edge,
        ctx({ executing: true, statuses: { a: "completed", b: "running" } }),
      ),
    ).toEqual({ inactive: false, flowing: true, completed: false });
  });

  it("미실행이면 flowing 아님(같은 상태여도)", () => {
    expect(
      resolveEdgeExecutionState(
        edge,
        ctx({ executing: false, statuses: { a: "completed", b: "running" } }),
      ).flowing,
    ).toBe(false);
  });

  it("source·target 둘 다 completed 면 completed", () => {
    expect(
      resolveEdgeExecutionState(
        edge,
        ctx({ statuses: { a: "completed", b: "completed" } }),
      ),
    ).toEqual({ inactive: false, flowing: false, completed: true });
  });

  it("아무 상태도 없으면 전부 false (기본 스타일)", () => {
    expect(resolveEdgeExecutionState(edge, ctx())).toEqual({
      inactive: false,
      flowing: false,
      completed: false,
    });
  });

  it("target 이 failed 면 flowing·completed 모두 false", () => {
    expect(
      resolveEdgeExecutionState(
        edge,
        ctx({ executing: true, statuses: { a: "completed", b: "failed" } }),
      ),
    ).toEqual({ inactive: false, flowing: false, completed: false });
  });

  it("방향 역전(source running + target completed)은 flowing 아님", () => {
    expect(
      resolveEdgeExecutionState(
        edge,
        ctx({ executing: true, statuses: { a: "running", b: "completed" } }),
      ).flowing,
    ).toBe(false);
  });
});

describe("buildEdgeStyle (§3.1/§3.2)", () => {
  const base = { portColor: "#22c55e", selected: false, isHighlighted: false, inactive: false };

  it("기본: 포트색 stroke, 1.5px, opacity/dash 없음", () => {
    const s = buildEdgeStyle(base);
    expect(s.stroke).toBe("#22c55e");
    expect(s.strokeWidth).toBe(1.5);
    expect(s.opacity).toBeUndefined();
    expect(s.strokeDasharray).toBeUndefined();
  });

  it("selected: primary stroke + 2.5px", () => {
    const s = buildEdgeStyle({ ...base, selected: true });
    expect(s.stroke).toBe("hsl(var(--primary))");
    expect(s.strokeWidth).toBe(2.5);
  });

  it("isHighlighted: 2.5px (색은 포트색 유지)", () => {
    const s = buildEdgeStyle({ ...base, isHighlighted: true });
    expect(s.strokeWidth).toBe(2.5);
    expect(s.stroke).toBe("#22c55e");
  });

  it("inactive: opacity 0.4 + 점선", () => {
    const s = buildEdgeStyle({ ...base, inactive: true });
    expect(s.opacity).toBe(0.4);
    expect(s.strokeDasharray).toBe("6 4");
  });

  it("baseStyle 이 마지막에 스프레드돼 우선한다", () => {
    const s = buildEdgeStyle({ ...base, baseStyle: { stroke: "red", strokeWidth: 9 } });
    expect(s.stroke).toBe("red");
    expect(s.strokeWidth).toBe(9);
  });
});

describe("enrichEdgesWithPortData", () => {
  it("enriches edges with port type data from nodes", () => {
    const nodes: Node[] = [
      { id: "n1", position: { x: 0, y: 0 }, data: { type: "manual_trigger" } },
      { id: "n2", position: { x: 200, y: 0 }, data: { type: "http_request" } },
      { id: "n3", position: { x: 400, y: 0 }, data: { type: "template" } },
    ];
    const edges: Edge[] = [
      { id: "e1", source: "n1", target: "n2", sourceHandle: "out", targetHandle: "in", type: "custom" },
      { id: "e2", source: "n2", target: "n3", sourceHandle: "error", targetHandle: "in", type: "custom" },
    ];

    const enriched = enrichEdgesWithPortData(edges, nodes);

    expect((enriched[0].data as Record<string, unknown>).portType).toBe("data");
    expect((enriched[1].data as Record<string, unknown>).portType).toBe("error");
  });

  it("preserves existing edge data fields", () => {
    const nodes: Node[] = [
      { id: "n1", position: { x: 0, y: 0 }, data: { type: "manual_trigger" } },
      { id: "n2", position: { x: 200, y: 0 }, data: { type: "template" } },
    ];
    const edges: Edge[] = [
      { id: "e1", source: "n1", target: "n2", sourceHandle: "out", type: "custom", data: { existingField: "keep" } },
    ];

    const enriched = enrichEdgesWithPortData(edges, nodes);

    expect((enriched[0].data as Record<string, unknown>).existingField).toBe("keep");
    expect((enriched[0].data as Record<string, unknown>).portType).toBe("data");
  });

  it("handles AI agent system ports", () => {
    const nodes: Node[] = [
      { id: "n1", position: { x: 0, y: 0 }, data: { type: "ai_agent" } },
      { id: "n2", position: { x: 200, y: 0 }, data: { type: "template" } },
    ];
    const edges: Edge[] = [
      { id: "e1", source: "n1", target: "n2", sourceHandle: "user_ended", type: "custom" },
    ];

    const enriched = enrichEdgesWithPortData(edges, nodes);
    expect((enriched[0].data as Record<string, unknown>).portType).toBe("system");
  });

  it("handles container body ports", () => {
    const nodes: Node[] = [
      { id: "n1", position: { x: 0, y: 0 }, data: { type: "loop" } },
      { id: "n2", position: { x: 200, y: 0 }, data: { type: "template" } },
    ];
    const edges: Edge[] = [
      { id: "e1", source: "n1", target: "n2", sourceHandle: "body", type: "custom" },
    ];

    const enriched = enrichEdgesWithPortData(edges, nodes);
    expect((enriched[0].data as Record<string, unknown>).portType).toBe("container");
  });
});

describe("dropStaleEdges", () => {
  // Isolated definitions fixture so changes here don't leak into other
  // `describe` blocks in this file.
  const definitionsFixture = {
    ai_agent: {
      type: "ai_agent",
      category: "ai" as const,
      label: "AI Agent",
      description: "",
      icon: "Brain",
      color: "#000",
      inputs: [{ id: "in", label: "Input", type: "data" as const }],
      outputs: [{ id: "out", label: "Output", type: "data" as const }],
      defaultConfig: {},
      configSchema: {},
      isDynamicPorts: true,
      dynamicPorts: {
        kind: "ai-agent-conditional" as const,
        modeField: "mode",
        conditionsField: "conditions",
        multiTurnValue: "multi_turn",
      },
    },
    template: {
      type: "template",
      category: "presentation" as const,
      label: "Template",
      description: "",
      icon: "FileText",
      color: "#000",
      inputs: [{ id: "in", label: "Input", type: "data" as const }],
      outputs: [{ id: "out", label: "Output", type: "data" as const }],
      defaultConfig: {},
      configSchema: {},
    },
  };

  let snapshot: ReturnType<typeof useNodeDefinitionsStore.getState>;
  beforeAll(() => {
    snapshot = useNodeDefinitionsStore.getState();
    useNodeDefinitionsStore.setState({
      status: "ready",
      error: null,
      order: [...snapshot.order, "ai_agent", "template"],
      definitions: {
        ...snapshot.definitions,
        ...definitionsFixture,
      },
    });
  });

  it("keeps edges whose handles exist on the current node config", () => {
    const nodes: Node[] = [
      { id: "a", position: { x: 0, y: 0 }, data: { type: "ai_agent", config: { mode: "single_turn" } } },
      { id: "b", position: { x: 0, y: 0 }, data: { type: "template" } },
    ];
    const edges: Edge[] = [
      { id: "e1", source: "a", target: "b", sourceHandle: "out", targetHandle: "in", type: "custom" },
    ];
    const result = dropStaleEdges(edges, nodes);
    expect(result.edges).toEqual(edges);
    expect(result.dropped).toEqual([]);
  });

  it("drops edges whose sourceHandle no longer exists after mode switch", () => {
    const nodes: Node[] = [
      // AI Agent switched to multi_turn → ports become user_ended/max_turns/error, "out" removed
      { id: "a", position: { x: 0, y: 0 }, data: { type: "ai_agent", config: { mode: "multi_turn" } } },
      { id: "b", position: { x: 0, y: 0 }, data: { type: "template" } },
    ];
    const edges: Edge[] = [
      { id: "stale", source: "a", target: "b", sourceHandle: "out", targetHandle: "in", type: "custom" },
      { id: "live", source: "a", target: "b", sourceHandle: "user_ended", targetHandle: "in", type: "custom" },
    ];
    const result = dropStaleEdges(edges, nodes);
    expect(result.edges.map((e) => e.id)).toEqual(["live"]);
    expect(result.dropped.map((e) => e.id)).toEqual(["stale"]);
  });

  it("drops edges whose targetHandle does not exist on the target node", () => {
    const nodes: Node[] = [
      { id: "a", position: { x: 0, y: 0 }, data: { type: "template" } },
      { id: "b", position: { x: 0, y: 0 }, data: { type: "template" } },
    ];
    const edges: Edge[] = [
      { id: "stale", source: "a", target: "b", sourceHandle: "out", targetHandle: "nonexistent", type: "custom" },
    ];
    const result = dropStaleEdges(edges, nodes);
    expect(result.edges).toEqual([]);
    expect(result.dropped).toEqual(edges);
  });

  it("drops edges referencing missing nodes", () => {
    const nodes: Node[] = [
      { id: "a", position: { x: 0, y: 0 }, data: { type: "template" } },
    ];
    const edges: Edge[] = [
      { id: "orphan", source: "a", target: "ghost", sourceHandle: "out", targetHandle: "in", type: "custom" },
    ];
    const result = dropStaleEdges(edges, nodes);
    expect(result.edges).toEqual([]);
    expect(result.dropped).toEqual(edges);
  });

  it("keeps edges for unknown node types (permissive fallback)", () => {
    // Guards against over-eager dropping when the node definitions cache hasn't finished loading.
    const nodes: Node[] = [
      { id: "a", position: { x: 0, y: 0 }, data: { type: "unknown_future_type" } },
      { id: "b", position: { x: 0, y: 0 }, data: { type: "template" } },
    ];
    const edges: Edge[] = [
      { id: "e1", source: "a", target: "b", sourceHandle: "out", targetHandle: "in", type: "custom" },
    ];
    const result = dropStaleEdges(edges, nodes);
    expect(result.edges).toEqual(edges);
    expect(result.dropped).toEqual([]);
  });

  it("keeps edges with null sourceHandle (no handle constraint)", () => {
    // null/undefined handles happen for nodes with a single default handle
    // — React Flow accepts them without a source handle id.
    const nodes: Node[] = [
      { id: "a", position: { x: 0, y: 0 }, data: { type: "template" } },
      { id: "b", position: { x: 0, y: 0 }, data: { type: "template" } },
    ];
    const edges: Edge[] = [
      { id: "e1", source: "a", target: "b", sourceHandle: null, targetHandle: null, type: "custom" },
    ];
    const result = dropStaleEdges(edges, nodes);
    expect(result.edges).toEqual(edges);
    expect(result.dropped).toEqual([]);
  });
});
