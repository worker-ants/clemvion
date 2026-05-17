import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import type { GraphVisualizationData } from "@/lib/api/knowledge-bases";

// ---- Mocks ----------------------------------------------------------------
//
// react-force-graph-3d 와 three-spritetext 는 WebGL 의존이라 jsdom 에서 mount
// 불가능 → 캡처용 가짜 구현으로 치환해 콜백 props 를 직접 호출/검증한다.

interface CapturedProps {
  graphData: { nodes: unknown[]; links: unknown[] };
  nodeColor: (n: { type: string }) => string;
  nodeVal: (n: { mentionCount: number }) => number;
  nodeThreeObject: (n: { label: string; mentionCount: number }) => unknown;
  linkColor: () => string;
  linkWidth: (l: { weight: number }) => number;
  linkLabel: (l: { predicate: string }) => string;
  onNodeClick: (n: { x?: number; y?: number; z?: number }) => void;
  onEngineStop: () => void;
  width: number;
  height: number;
  backgroundColor: string;
  nodeOpacity: number;
}

const hoistedSpies = vi.hoisted(() => ({
  captured: { current: null as CapturedProps | null },
  cameraPositionSpy: vi.fn(),
  zoomToFitSpy: vi.fn(),
  sanitizeSpy: vi.fn((s: string) => `[s]${s}`),
}));
const captured = hoistedSpies.captured;
const cameraPositionSpy = hoistedSpies.cameraPositionSpy;
const zoomToFitSpy = hoistedSpies.zoomToFitSpy;
const sanitizeSpy = hoistedSpies.sanitizeSpy;

vi.mock("react-force-graph-3d", () => {
  const ForceGraph3D = vi.fn(
    (props: CapturedProps & { ref?: unknown }) => {
      hoistedSpies.captured.current = props;
      const refContainer = (
        props as unknown as { ref?: { current?: unknown } }
      ).ref;
      if (
        refContainer &&
        typeof refContainer === "object" &&
        "current" in refContainer
      ) {
        (
          refContainer as {
            current: {
              cameraPosition: typeof hoistedSpies.cameraPositionSpy;
              zoomToFit: typeof hoistedSpies.zoomToFitSpy;
            };
          }
        ).current = {
          cameraPosition: hoistedSpies.cameraPositionSpy,
          zoomToFit: hoistedSpies.zoomToFitSpy,
        };
      }
      return null;
    },
  );
  return { __esModule: true, default: ForceGraph3D };
});

// `vi.mock` 의 factory 는 import 보다 먼저 hoist 실행 → 일반 class 선언은
// 못 잡힘. `vi.hoisted` 로 spriteInstances + FakeSpriteText 를 함께 끌어올린다.
const spriteHoisted = vi.hoisted(() => {
  const instances: unknown[] = [];
  class FakeSpriteText {
    text: string;
    color = "";
    backgroundColor = "";
    padding = 0;
    borderRadius = 0;
    textHeight = 0;
    position = { set: vi.fn() };
    material = {
      depthWrite: true,
      map: { dispose: vi.fn() },
      dispose: vi.fn(),
    };
    constructor(text: string) {
      this.text = text;
      instances.push(this);
    }
  }
  return { instances, FakeSpriteText };
});
const spriteInstances = spriteHoisted.instances;
type FakeSpriteText = InstanceType<typeof spriteHoisted.FakeSpriteText>;
vi.mock("three-spritetext", () => ({
  __esModule: true,
  default: spriteHoisted.FakeSpriteText,
}));

vi.mock("dompurify", () => ({
  __esModule: true,
  default: { sanitize: hoistedSpies.sanitizeSpy },
}));

// ---- Helpers --------------------------------------------------------------

import Graph3DRenderer from "../graph-3d-renderer";

function makeData(): GraphVisualizationData {
  return {
    nodes: [
      { id: "n1", label: "Alice", type: "person", mentionCount: 9 },
      { id: "n2", label: "Acme", type: "organization", mentionCount: 1 },
      // unknown type → other fallback.
      { id: "n3", label: "Quirk", type: "weird-type", mentionCount: 4 },
    ],
    edges: [
      {
        id: "e1",
        source: "n1",
        target: "n2",
        predicate: "works_at",
        weight: 5,
      },
    ],
    truncated: false,
  };
}

beforeEach(() => {
  captured.current = null;
  spriteInstances.length = 0;
  cameraPositionSpy.mockClear();
  zoomToFitSpy.mockClear();
  sanitizeSpy.mockClear();
});

describe("Graph3DRenderer", () => {
  it("sanitizes label / predicate via DOMPurify before passing to ForceGraph", () => {
    render(<Graph3DRenderer data={makeData()} width={800} height={600} />);
    expect(sanitizeSpy).toHaveBeenCalledWith("Alice");
    expect(sanitizeSpy).toHaveBeenCalledWith("works_at");
    const g = captured.current!.graphData;
    const aliceNode = (g.nodes as Array<{ label: string }>)[0];
    expect(aliceNode.label).toBe("[s]Alice");
    const link = (g.links as Array<{ predicate: string }>)[0];
    expect(link.predicate).toBe("[s]works_at");
  });

  it("maps node type → color (with 'other' fallback for unknown types)", () => {
    render(<Graph3DRenderer data={makeData()} width={800} height={600} />);
    const { nodeColor } = captured.current!;
    expect(nodeColor({ type: "person" })).toBe("#3b82f6");
    expect(nodeColor({ type: "organization" })).toBe("#a855f7");
    // 정의되지 않은 type 은 other 색으로 fallback.
    expect(nodeColor({ type: "weird-type" })).toBe("#6b7280");
  });

  it("uses √(mentionCount) * 2 for nodeVal so big nodes don't dwarf small ones", () => {
    render(<Graph3DRenderer data={makeData()} width={800} height={600} />);
    const { nodeVal } = captured.current!;
    expect(nodeVal({ mentionCount: 9 })).toBeCloseTo(6); // √9 * 2
    expect(nodeVal({ mentionCount: 1 })).toBeCloseTo(2);
    expect(nodeVal({ mentionCount: 0 })).toBeCloseTo(2); // clamp to 1
  });

  it("places sprite label above the node sphere using the matching radius formula", () => {
    render(<Graph3DRenderer data={makeData()} width={800} height={600} />);
    const { nodeThreeObject } = captured.current!;
    nodeThreeObject({ label: "Alice", mentionCount: 9 });
    // sprite Y = √9 * 2 + 6 (LABEL_BASE_OFFSET) = 12.
    const lastSprite = spriteInstances[
      spriteInstances.length - 1
    ] as FakeSpriteText;
    expect(lastSprite.position.set).toHaveBeenCalledWith(0, 12, 0);
    // sprite text 는 라벨 + mention 카운트.
    expect(lastSprite.text).toBe("Alice · 9");
  });

  it("calls zoomToFit when force-graph engine settles (no hardcoded timer)", () => {
    render(<Graph3DRenderer data={makeData()} width={800} height={600} />);
    const { onEngineStop } = captured.current!;
    onEngineStop();
    expect(zoomToFitSpy).toHaveBeenCalledTimes(1);
  });

  it("moves camera to a node's offset position on click", () => {
    render(<Graph3DRenderer data={makeData()} width={800} height={600} />);
    const { onNodeClick } = captured.current!;
    onNodeClick({ x: 10, y: 0, z: 0 });
    expect(cameraPositionSpy).toHaveBeenCalledTimes(1);
    const args = cameraPositionSpy.mock.calls[0];
    // distance 60, radius 10 → distRatio = 1 + 6 = 7 → x = 70
    expect(args[0]).toEqual({ x: 70, y: 0, z: 0 });
    expect(args[1]).toEqual({ x: 10, y: 0, z: 0 });
    expect(args[2]).toBe(1000);
  });

  it("disposes sprite textures on unmount to avoid WebGL leaks", () => {
    const { unmount } = render(
      <Graph3DRenderer data={makeData()} width={800} height={600} />,
    );
    const { nodeThreeObject } = captured.current!;
    nodeThreeObject({ label: "Alice", mentionCount: 9 });
    nodeThreeObject({ label: "Acme", mentionCount: 1 });
    const sprites = [...spriteInstances] as FakeSpriteText[];
    unmount();
    for (const s of sprites) {
      expect(s.material.dispose).toHaveBeenCalled();
      expect(s.material.map.dispose).toHaveBeenCalled();
    }
  });

  it("forwards width / height / background color to ForceGraph3D", () => {
    render(<Graph3DRenderer data={makeData()} width={1024} height={500} />);
    const c = captured.current!;
    expect(c.width).toBe(1024);
    expect(c.height).toBe(500);
    expect(c.backgroundColor).toBe("#0b0d12");
  });

  it("renders nothing user-visible (canvas owned by ForceGraph mock)", () => {
    // 단순 smoke — captured props 외에 DOM 노드 누설이 없는지.
    const { container } = render(
      <Graph3DRenderer data={makeData()} width={800} height={600} />,
    );
    expect(container.children.length).toBe(0);
    cleanup();
  });
});
