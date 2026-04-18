import { describe, it, expect } from "vitest";
import {
  getAncestorsInScope,
  getContainerChain,
  type ScopedNode,
  type EdgeLite,
} from "../reachable-nodes";

function n(
  id: string,
  type: string,
  overrides: Partial<ScopedNode> = {},
): ScopedNode {
  return {
    id,
    type,
    containerId: overrides.containerId ?? null,
    toolOwnerId: overrides.toolOwnerId ?? null,
  };
}

function e(source: string, target: string): EdgeLite {
  return { source, target };
}

describe("getAncestorsInScope", () => {
  it("returns empty set for a node with no predecessors", () => {
    const nodes = [n("A", "http_request")];
    const result = getAncestorsInScope("A", nodes, []);
    expect(Array.from(result)).toEqual([]);
  });

  it("returns empty set when target node does not exist", () => {
    const result = getAncestorsInScope("missing", [], []);
    expect(result.size).toBe(0);
  });

  it("returns ancestors along a linear chain", () => {
    const nodes = [
      n("A", "http_request"),
      n("B", "code"),
      n("C", "code"),
    ];
    const edges = [e("A", "B"), e("B", "C")];
    expect(Array.from(getAncestorsInScope("C", nodes, edges)).sort()).toEqual([
      "A",
      "B",
    ]);
    expect(Array.from(getAncestorsInScope("A", nodes, edges))).toEqual([]);
  });

  it("does not include sibling branches", () => {
    // A → B, A → C: B and C are independent siblings
    const nodes = [n("A", "http_request"), n("B", "code"), n("C", "code")];
    const edges = [e("A", "B"), e("A", "C")];
    expect(Array.from(getAncestorsInScope("B", nodes, edges))).toEqual(["A"]);
    expect(Array.from(getAncestorsInScope("C", nodes, edges))).toEqual(["A"]);
  });

  it("handles diamond merge", () => {
    // A → B → D; A → C → D: D sees A, B, C
    const nodes = [
      n("A", "http_request"),
      n("B", "code"),
      n("C", "code"),
      n("D", "code"),
    ];
    const edges = [e("A", "B"), e("A", "C"), e("B", "D"), e("C", "D")];
    expect(Array.from(getAncestorsInScope("D", nodes, edges)).sort()).toEqual([
      "A",
      "B",
      "C",
    ]);
  });

  it("is cycle-safe: returns reachable set without infinite recursion", () => {
    // A → B → A (cycle). BFS should terminate and return {B} for A.
    const nodes = [n("A", "code"), n("B", "code")];
    const edges = [e("A", "B"), e("B", "A")];
    const fromA = getAncestorsInScope("A", nodes, edges);
    expect(fromA.has("B")).toBe(true);
    // A node must not appear as its own ancestor.
    expect(fromA.has("A")).toBe(false);
  });

  it("excludes nodes owned by a tool (toolOwnerId != null)", () => {
    // T is a tool child of "Agent" and feeds into Y. T should be hidden.
    const nodes = [
      n("T", "http_request", { toolOwnerId: "Agent" }),
      n("Y", "code"),
    ];
    const edges = [e("T", "Y")];
    expect(Array.from(getAncestorsInScope("Y", nodes, edges))).toEqual([]);
  });

  it("promotes to outer container level when target is inside a container", () => {
    // Top-level:  A → Loop
    // Loop body:  X → Y (both containerId=Loop)
    // Y should see X (sibling in body) and A (outer ancestor of Loop).
    // Y should NOT see Loop itself (container output isn't ready during iteration).
    const nodes = [
      n("A", "http_request"),
      n("Loop", "loop"),
      n("X", "code", { containerId: "Loop" }),
      n("Y", "code", { containerId: "Loop" }),
    ];
    const edges = [e("A", "Loop"), e("Loop", "X"), e("X", "Y"), e("Y", "Loop")];
    const result = getAncestorsInScope("Y", nodes, edges);
    expect(Array.from(result).sort()).toEqual(["A", "X"]);
    expect(result.has("Loop")).toBe(false);
  });

  it("does not allow outer nodes to see inside-container nodes", () => {
    // Top-level: A → Loop → Z
    // Loop body: X → Y
    // Z (outer) should see A and Loop (after Loop's done port), but NOT X or Y.
    const nodes = [
      n("A", "http_request"),
      n("Loop", "loop"),
      n("X", "code", { containerId: "Loop" }),
      n("Y", "code", { containerId: "Loop" }),
      n("Z", "code"),
    ];
    const edges = [
      e("A", "Loop"),
      e("Loop", "X"),
      e("X", "Y"),
      e("Y", "Loop"),
      e("Loop", "Z"),
    ];
    const result = getAncestorsInScope("Z", nodes, edges);
    expect(result.has("X")).toBe(false);
    expect(result.has("Y")).toBe(false);
    expect(result.has("A")).toBe(true);
    expect(result.has("Loop")).toBe(true);
  });

  it("does not cross-leak between parallel branches", () => {
    // Parallel contains two branches: [b1a → b1b] and [b2a → b2b].
    // b1b should see b1a and the outer chain; NOT b2a/b2b.
    const nodes = [
      n("Start", "manual_trigger"),
      n("P", "parallel"),
      n("b1a", "code", { containerId: "P" }),
      n("b1b", "code", { containerId: "P" }),
      n("b2a", "code", { containerId: "P" }),
      n("b2b", "code", { containerId: "P" }),
    ];
    const edges = [
      e("Start", "P"),
      e("P", "b1a"),
      e("b1a", "b1b"),
      e("P", "b2a"),
      e("b2a", "b2b"),
      e("b1b", "P"),
      e("b2b", "P"),
    ];
    const result = getAncestorsInScope("b1b", nodes, edges);
    expect(result.has("b1a")).toBe(true);
    expect(result.has("Start")).toBe(true);
    expect(result.has("b2a")).toBe(false);
    expect(result.has("b2b")).toBe(false);
    expect(result.has("P")).toBe(false);
  });

  it("walks the full container chain for nested containers", () => {
    // Top:   Trigger → Outer (foreach)
    // Outer: Inner (foreach)
    // Inner: X → Y
    // Y should see Trigger (outer ancestor) and X (body sibling).
    const nodes = [
      n("Trigger", "manual_trigger"),
      n("Outer", "foreach"),
      n("Inner", "foreach", { containerId: "Outer" }),
      n("X", "code", { containerId: "Inner" }),
      n("Y", "code", { containerId: "Inner" }),
    ];
    const edges = [
      e("Trigger", "Outer"),
      e("Outer", "Inner"),
      e("Inner", "X"),
      e("X", "Y"),
    ];
    const result = getAncestorsInScope("Y", nodes, edges);
    expect(Array.from(result).sort()).toEqual(["Trigger", "X"]);
  });
});

describe("getContainerChain", () => {
  it("returns empty chain for a top-level node", () => {
    const nodes = [n("A", "http_request")];
    expect(getContainerChain("A", nodes)).toEqual([]);
  });

  it("returns innermost-first chain for a deeply nested node", () => {
    const nodes = [
      n("Outer", "foreach"),
      n("Inner", "loop", { containerId: "Outer" }),
      n("Leaf", "code", { containerId: "Inner" }),
    ];
    const chain = getContainerChain("Leaf", nodes);
    expect(chain.map((c) => c.id)).toEqual(["Inner", "Outer"]);
  });

  it("stops gracefully when a broken containerId reference is found", () => {
    const nodes = [n("Leaf", "code", { containerId: "missing" })];
    expect(getContainerChain("Leaf", nodes)).toEqual([]);
  });

  it("tolerates self-referential containerId without looping forever", () => {
    const nodes = [n("X", "loop", { containerId: "X" })];
    const chain = getContainerChain("X", nodes);
    // X should appear at most once — we don't care about exact semantics for
    // this malformed case, only that we terminate.
    expect(chain.length).toBeLessThanOrEqual(1);
  });
});
