import { describe, it, expect } from "vitest";
import type { NodeResult } from "@/lib/stores/execution-store";
import {
  buildTimelineTree,
  countDescendants,
  sumDescendantDurations,
} from "../timeline-tree";

function makeResult(overrides: Partial<NodeResult>): NodeResult {
  return {
    nodeId: "n-" + Math.random(),
    nodeLabel: "Node",
    nodeType: "action",
    nodeCategory: "logic",
    status: "completed",
    outputData: null,
    ...overrides,
  };
}

describe("buildTimelineTree", () => {
  it("returns every row as a root when no parentNodeExecutionId is set", () => {
    const results = [
      makeResult({ nodeExecutionId: "a", nodeId: "n-a" }),
      makeResult({ nodeExecutionId: "b", nodeId: "n-b" }),
      makeResult({ nodeExecutionId: "c", nodeId: "n-c" }),
    ];
    const tree = buildTimelineTree(results);
    expect(tree).toHaveLength(3);
    expect(tree.every((t) => t.children.length === 0)).toBe(true);
  });

  it("nests children under their Sub-Workflow parent", () => {
    const results: NodeResult[] = [
      makeResult({ nodeExecutionId: "wf", nodeId: "n-wf", nodeType: "workflow" }),
      makeResult({
        nodeExecutionId: "child-1",
        nodeId: "n-c1",
        parentNodeExecutionId: "wf",
      }),
      makeResult({
        nodeExecutionId: "child-2",
        nodeId: "n-c2",
        parentNodeExecutionId: "wf",
      }),
    ];
    const tree = buildTimelineTree(results);
    expect(tree).toHaveLength(1);
    expect(tree[0].result.nodeExecutionId).toBe("wf");
    expect(tree[0].children).toHaveLength(2);
    expect(tree[0].children.map((c) => c.result.nodeExecutionId)).toEqual([
      "child-1",
      "child-2",
    ]);
  });

  it("supports nested Sub-Workflow cards (depth ≥ 2)", () => {
    const results: NodeResult[] = [
      makeResult({ nodeExecutionId: "outer", nodeType: "workflow" }),
      makeResult({
        nodeExecutionId: "inner",
        nodeType: "workflow",
        parentNodeExecutionId: "outer",
      }),
      makeResult({
        nodeExecutionId: "leaf",
        parentNodeExecutionId: "inner",
      }),
    ];
    const tree = buildTimelineTree(results);
    expect(tree).toHaveLength(1);
    expect(tree[0].children[0].result.nodeExecutionId).toBe("inner");
    expect(tree[0].children[0].children[0].result.nodeExecutionId).toBe("leaf");
  });

  it("treats orphaned parent references as roots (no data loss)", () => {
    const results: NodeResult[] = [
      makeResult({
        nodeExecutionId: "orphan",
        parentNodeExecutionId: "missing-parent",
      }),
    ];
    const tree = buildTimelineTree(results);
    expect(tree).toHaveLength(1);
    expect(tree[0].result.nodeExecutionId).toBe("orphan");
  });

  it("assigns iteration indices per nodeId across siblings", () => {
    const results: NodeResult[] = [
      makeResult({ nodeExecutionId: "a1", nodeId: "body" }),
      makeResult({ nodeExecutionId: "a2", nodeId: "body" }),
      makeResult({ nodeExecutionId: "a3", nodeId: "body" }),
    ];
    const tree = buildTimelineTree(results);
    expect(tree.map((t) => t.iterIndex)).toEqual([1, 2, 3]);
    expect(tree.every((t) => t.totalIterations === 3)).toBe(true);
  });

  it("groups separate Sub-Workflow invocations as separate cards", () => {
    // Loop body that invokes a Sub-Workflow twice.
    const results: NodeResult[] = [
      makeResult({ nodeExecutionId: "wf-iter-1", nodeId: "sw", nodeType: "workflow" }),
      makeResult({
        nodeExecutionId: "child-1-1",
        nodeId: "x",
        parentNodeExecutionId: "wf-iter-1",
      }),
      makeResult({ nodeExecutionId: "wf-iter-2", nodeId: "sw", nodeType: "workflow" }),
      makeResult({
        nodeExecutionId: "child-2-1",
        nodeId: "x",
        parentNodeExecutionId: "wf-iter-2",
      }),
    ];
    const tree = buildTimelineTree(results);
    expect(tree).toHaveLength(2);
    expect(tree[0].iterIndex).toBe(1);
    expect(tree[1].iterIndex).toBe(2);
    expect(tree[0].children).toHaveLength(1);
    expect(tree[1].children).toHaveLength(1);
  });
});

describe("countDescendants / sumDescendantDurations", () => {
  it("counts transitive descendants and sums durations", () => {
    const results: NodeResult[] = [
      makeResult({ nodeExecutionId: "root", nodeType: "workflow" }),
      makeResult({
        nodeExecutionId: "a",
        parentNodeExecutionId: "root",
        duration: 100,
      }),
      makeResult({
        nodeExecutionId: "b",
        nodeType: "workflow",
        parentNodeExecutionId: "root",
        duration: 50,
      }),
      makeResult({
        nodeExecutionId: "b-leaf",
        parentNodeExecutionId: "b",
        duration: 30,
      }),
    ];
    const [root] = buildTimelineTree(results);
    expect(countDescendants(root)).toBe(3);
    expect(sumDescendantDurations(root)).toBe(100 + 50 + 30);
  });
});
