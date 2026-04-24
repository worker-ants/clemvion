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

  // ED-AI-40 B: PORT_NOT_FOUND / NODE_NOT_FOUND 실패 배지가 같은 source/target
  // 의 성공 배지로 이어지면 "재시도 후 성공" 한 그룹으로 축약.
  describe("recovery merge (ED-AI-40)", () => {
    function addEdge(
      id: string,
      sourceId: string,
      targetId: string,
      opts: { ok: boolean; port?: string; error?: string },
    ): AssistantToolCallRecord {
      return {
        id,
        name: "add_edge",
        arguments: {
          source_id: sourceId,
          target_id: targetId,
          ...(opts.port ? { source_port: opts.port } : {}),
        },
        kind: "edit",
        result: opts.ok
          ? { ok: true, id: `edge-${id}` }
          : { ok: false, error: opts.error ?? "PORT_NOT_FOUND" },
      };
    }

    it("collapses PORT_NOT_FOUND → same source/target success into a single retried group", () => {
      const calls = [
        addEdge("e1", "nA", "nB", {
          ok: false,
          port: "out",
          error: "PORT_NOT_FOUND",
        }),
        addEdge("e2", "nA", "nB", {
          ok: true,
          port: "btn_korean",
        }),
      ];
      const groups = groupToolCalls(calls);
      expect(groups).toHaveLength(1);
      expect(groups[0].retried).toBe(true);
      expect(groups[0].retriedFromError).toBe("PORT_NOT_FOUND");
      // 대표 배지는 성공한 call 이어야 한다.
      expect(
        (groups[0].representative.result as { ok: boolean }).ok,
      ).toBe(true);
    });

    it("collapses NODE_NOT_FOUND cascading fix on update_node with the same id", () => {
      const calls: AssistantToolCallRecord[] = [
        {
          id: "u1",
          name: "update_node",
          arguments: { id: "node-X", patch: { config: {} } },
          kind: "edit",
          result: { ok: false, error: "NODE_NOT_FOUND" },
        },
        {
          id: "u2",
          name: "update_node",
          arguments: { id: "node-X", patch: { config: {} } },
          kind: "edit",
          result: { ok: true },
        },
      ];
      const groups = groupToolCalls(calls);
      expect(groups).toHaveLength(1);
      expect(groups[0].retried).toBe(true);
      expect(groups[0].retriedFromError).toBe("NODE_NOT_FOUND");
    });

    it("does NOT collapse other error codes like LABEL_CONFLICT", () => {
      const calls: AssistantToolCallRecord[] = [
        {
          id: "a1",
          name: "add_node",
          arguments: { type: "http_request", label: "X" },
          kind: "edit",
          result: { ok: false, error: "LABEL_CONFLICT" },
        },
        {
          id: "a2",
          name: "add_node",
          arguments: { type: "http_request", label: "X" },
          kind: "edit",
          result: { ok: true, id: "aaa" },
        },
      ];
      const groups = groupToolCalls(calls);
      expect(groups).toHaveLength(2);
      expect(groups[0].retried).toBeFalsy();
      expect(groups[1].retried).toBeFalsy();
    });

    it("does NOT collapse when source/target do not match (different edge)", () => {
      const calls = [
        addEdge("e1", "nA", "nB", {
          ok: false,
          port: "out",
          error: "PORT_NOT_FOUND",
        }),
        addEdge("e2", "nC", "nD", { ok: true, port: "btn_x" }),
      ];
      const groups = groupToolCalls(calls);
      expect(groups).toHaveLength(2);
      expect(groups[0].retried).toBeFalsy();
      expect(groups[1].retried).toBeFalsy();
    });

    it("accepts camelCase (sourceId/targetId) endpoint args for recovery matching", () => {
      const calls: AssistantToolCallRecord[] = [
        {
          id: "e1",
          name: "add_edge",
          arguments: { source_id: "nA", target_id: "nB" },
          kind: "edit",
          result: { ok: false, error: "NODE_NOT_FOUND" },
        },
        {
          id: "e2",
          name: "add_edge",
          arguments: { sourceId: "nA", targetId: "nB" },
          kind: "edit",
          result: { ok: true, id: "edge-x" },
        },
      ];
      const groups = groupToolCalls(calls);
      expect(groups).toHaveLength(1);
      expect(groups[0].retried).toBe(true);
    });

    it("does NOT collapse when the failed group has count > 1 (real repeated failure)", () => {
      const calls = [
        addEdge("e1", "nA", "nB", {
          ok: false,
          port: "out",
          error: "PORT_NOT_FOUND",
        }),
        addEdge("e2", "nA", "nB", {
          ok: false,
          port: "out",
          error: "PORT_NOT_FOUND",
        }),
        addEdge("e3", "nA", "nB", { ok: true, port: "btn_x" }),
      ];
      const groups = groupToolCalls(calls);
      // 실패 2건이 한 그룹(count=2) 으로 묶이고, 그 뒤 성공은 별개 그룹.
      // 진짜 반복 실패라 "재시도 후 성공" 축약 대상 아님.
      expect(groups).toHaveLength(2);
      expect(groups[0].retried).toBeFalsy();
      expect(groups[1].retried).toBeFalsy();
    });
  });
});
