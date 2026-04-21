import { describe, it, expect } from "vitest";
import { groupToolCalls } from "./tool-call-badge";
import type { AssistantToolCallRecord } from "@/lib/api/assistant";

function updateNode(
  id: string,
  patchKeys: string[],
  ok = true,
): AssistantToolCallRecord {
  const patch: Record<string, unknown> = {};
  for (const k of patchKeys) patch[k] = 1;
  return {
    id,
    name: "update_node",
    arguments: { id: "n", patch },
    kind: "edit",
    result: { ok },
  };
}

function addNode(
  id: string,
  type: string,
  ok = true,
): AssistantToolCallRecord {
  return {
    id,
    name: "add_node",
    arguments: { type, label: id, position: { x: 0, y: 0 }, config: {} },
    kind: "edit",
    result: { ok, id },
  };
}

describe("groupToolCalls", () => {
  it("returns singletons (count=1) when calls are heterogeneous", () => {
    const calls = [
      updateNode("u1", ["position"]),
      addNode("a1", "http_request"),
      updateNode("u2", ["config"]),
    ];
    const groups = groupToolCalls(calls);
    expect(groups).toHaveLength(3);
    expect(groups.every((g) => g.count === 1)).toBe(true);
  });

  it("collapses a run of update_node:position into a single group", () => {
    const calls = Array.from({ length: 15 }, (_, i) =>
      updateNode(`u${i}`, ["position"]),
    );
    const groups = groupToolCalls(calls);
    expect(groups).toHaveLength(1);
    expect(groups[0].count).toBe(15);
    expect(groups[0].representative.id).toBe("u0");
  });

  it("splits on different patch-field sets (position vs config)", () => {
    const calls = [
      updateNode("u1", ["position"]),
      updateNode("u2", ["position"]),
      updateNode("u3", ["config"]),
      updateNode("u4", ["config"]),
      updateNode("u5", ["position"]),
    ];
    const groups = groupToolCalls(calls);
    expect(groups.map((g) => g.count)).toEqual([2, 2, 1]);
  });

  it("splits add_node groups by node type", () => {
    const calls = [
      addNode("a1", "http_request"),
      addNode("a2", "http_request"),
      addNode("a3", "carousel"),
      addNode("a4", "carousel"),
    ];
    const groups = groupToolCalls(calls);
    expect(groups.map((g) => g.count)).toEqual([2, 2]);
  });

  it("keeps failed calls in a separate group so errors aren't hidden", () => {
    const calls = [
      updateNode("u1", ["position"], true),
      updateNode("u2", ["position"], true),
      updateNode("u3", ["position"], false), // fail
      updateNode("u4", ["position"], true),
    ];
    const groups = groupToolCalls(calls);
    expect(groups.map((g) => g.count)).toEqual([2, 1, 1]);
    // 실패 그룹의 대표는 실패 호출이어야 함
    expect(
      (groups[1].representative.result as { ok: boolean }).ok,
    ).toBe(false);
  });

  it("does not collapse runs separated by a different call", () => {
    const calls = [
      updateNode("u1", ["position"]),
      addNode("a1", "http_request"),
      updateNode("u2", ["position"]),
    ];
    const groups = groupToolCalls(calls);
    expect(groups.map((g) => g.count)).toEqual([1, 1, 1]);
  });
});
