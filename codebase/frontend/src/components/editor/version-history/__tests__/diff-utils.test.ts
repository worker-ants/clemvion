import { describe, it, expect } from "vitest";
import { diffSnapshots } from "../diff-utils";
import type { VersionSnapshot } from "@/lib/api/workflows";

function node(
  id: string,
  overrides: Partial<VersionSnapshot["nodes"][number]> = {},
): VersionSnapshot["nodes"][number] {
  return {
    id,
    type: "manual_trigger",
    category: "trigger",
    label: id,
    positionX: 0,
    positionY: 0,
    config: {},
    isDisabled: false,
    description: null,
    containerId: null,
    toolOwnerId: null,
    ...overrides,
  };
}

function edge(
  id: string,
  source: string,
  target: string,
): VersionSnapshot["edges"][number] {
  return {
    id,
    sourceNodeId: source,
    sourcePort: "out",
    targetNodeId: target,
    targetPort: "in",
    type: "data",
    condition: null,
  };
}

function snap(
  name: string,
  nodes: VersionSnapshot["nodes"],
  edges: VersionSnapshot["edges"],
): VersionSnapshot {
  return { name, description: null, nodes, edges };
}

describe("diffSnapshots", () => {
  it("detects added nodes", () => {
    const before = snap("wf", [node("a")], []);
    const after = snap("wf", [node("a"), node("b")], []);
    const d = diffSnapshots(before, after);
    expect(d.nodes.added.map((n) => n.id)).toEqual(["b"]);
    expect(d.nodes.removed).toHaveLength(0);
    expect(d.nodes.modified).toHaveLength(0);
  });

  it("detects removed nodes", () => {
    const before = snap("wf", [node("a"), node("b")], []);
    const after = snap("wf", [node("a")], []);
    const d = diffSnapshots(before, after);
    expect(d.nodes.removed.map((n) => n.id)).toEqual(["b"]);
  });

  it("detects modified node fields", () => {
    const before = snap("wf", [node("a", { label: "Old", positionX: 0 })], []);
    const after = snap("wf", [node("a", { label: "New", positionX: 100 })], []);
    const d = diffSnapshots(before, after);
    expect(d.nodes.modified).toHaveLength(1);
    expect(d.nodes.modified[0].fields).toEqual(
      expect.arrayContaining(["label", "positionX"]),
    );
  });

  it("detects edge add/remove by source/target/port key", () => {
    const before = snap("wf", [node("a"), node("b")], [edge("e1", "a", "b")]);
    const after = snap("wf", [node("a"), node("b")], [edge("e2", "b", "a")]);
    const d = diffSnapshots(before, after);
    expect(d.edges.removed).toHaveLength(1);
    expect(d.edges.added).toHaveLength(1);
  });

  it("detects name changes", () => {
    const before = snap("Old", [], []);
    const after = snap("New", [], []);
    const d = diffSnapshots(before, after);
    expect(d.nameChanged).toEqual({ before: "Old", after: "New" });
  });

  it("returns no changes for identical snapshots", () => {
    const s = snap("wf", [node("a")], []);
    const d = diffSnapshots(s, s);
    expect(d.nodes.added).toHaveLength(0);
    expect(d.nodes.removed).toHaveLength(0);
    expect(d.nodes.modified).toHaveLength(0);
    expect(d.edges.added).toHaveLength(0);
    expect(d.edges.removed).toHaveLength(0);
    expect(d.nameChanged).toBeNull();
  });
});
