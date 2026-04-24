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

    it("does NOT collapse other error codes like LABEL_CONFLICT (add_edge path)", () => {
      // LABEL_CONFLICT 는 RECOVERABLE 에 없고, add_edge 의 실패→성공 재시도에서
      // 발생할 일도 없지만, 혹시 모를 다른 에러 코드 축약 방지 회귀 가드로 쓴다.
      // add_edge 에 LABEL_CONFLICT 는 발생 안 하므로 여기선 UNKNOWN 을 대신 사용.
      const calls = [
        addEdge("e1", "nA", "nB", {
          ok: false,
          port: "out",
          error: "UNKNOWN_ERROR",
        }),
        addEdge("e2", "nA", "nB", { ok: true, port: "btn_x" }),
      ];
      const groups = groupToolCalls(calls);
      expect(groups).toHaveLength(2);
      expect(groups[0].retried).toBeFalsy();
      expect(groups[1].retried).toBeFalsy();
    });

    // review I-4: add_node 는 recovery 축약 대상에서 제외. LABEL_CONFLICT
    // 성공 경로 (suggested 반영) 를 "재시도 후 성공" 으로 오인하면 사용자
    // 가 의도적으로 label 을 바꿔 생성한 워크플로우가 실패처럼 보인다.
    it("does NOT collapse add_node failure → success pairs (I-4)", () => {
      const calls: AssistantToolCallRecord[] = [
        {
          id: "a1",
          name: "add_node",
          arguments: { type: "http_request", label: "Start" },
          kind: "edit",
          result: { ok: false, error: "LABEL_CONFLICT" },
        },
        {
          id: "a2",
          name: "add_node",
          arguments: { type: "http_request", label: "Start (2)" },
          kind: "edit",
          result: { ok: true, id: "aaa" },
        },
      ];
      const groups = groupToolCalls(calls);
      expect(groups).toHaveLength(2);
      expect(groups[0].retried).toBeFalsy();
      expect(groups[1].retried).toBeFalsy();
    });

    // review I-5: remove_node 도 NODE_NOT_FOUND 에 label-lookalike hint 가
    // 붙는 경로라 recovery 축약 대상. 같은 id 로 재시도 성공하면 1그룹.
    it("collapses remove_node NODE_NOT_FOUND → same id success", () => {
      const calls: AssistantToolCallRecord[] = [
        {
          id: "r1",
          name: "remove_node",
          arguments: { id: "node-X" },
          kind: "edit",
          result: { ok: false, error: "NODE_NOT_FOUND" },
        },
        {
          id: "r2",
          name: "remove_node",
          arguments: { id: "node-X" },
          kind: "edit",
          result: { ok: true },
        },
      ];
      const groups = groupToolCalls(calls);
      expect(groups).toHaveLength(1);
      expect(groups[0].retried).toBe(true);
      expect(groups[0].retriedFromError).toBe("NODE_NOT_FOUND");
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

    // review W-4: [fail_A → success_A → fail_B → success_B] 시퀀스가 각
     // 쌍을 독립된 retried 그룹으로 축약해야 한다 (count=2 가 아니라 2 그룹).
    it("collapses two consecutive fail → success pairs into two independent retried groups", () => {
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
        addEdge("e3", "nC", "nD", {
          ok: false,
          port: "out",
          error: "PORT_NOT_FOUND",
        }),
        addEdge("e4", "nC", "nD", {
          ok: true,
          port: "btn_western",
        }),
      ];
      const groups = groupToolCalls(calls);
      expect(groups).toHaveLength(2);
      expect(groups[0].retried).toBe(true);
      expect(groups[0].retriedFromError).toBe("PORT_NOT_FOUND");
      expect(groups[1].retried).toBe(true);
      expect(groups[1].retriedFromError).toBe("PORT_NOT_FOUND");
      // 두 그룹이 각기 다른 edge target 이어야 함.
      expect(
        (groups[0].representative.arguments as { target_id: string }).target_id,
      ).toBe("nB");
      expect(
        (groups[1].representative.arguments as { target_id: string }).target_id,
      ).toBe("nD");
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
