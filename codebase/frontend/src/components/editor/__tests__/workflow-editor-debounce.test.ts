/**
 * SUMMARY#19 — WorkflowEditor debounced graph-warning 평가 동작 검증.
 *
 * WorkflowEditor 전체 렌더링은 WebSocket · ReactFlow · QueryClient 등
 * 인프라 의존성이 많아 단위 테스트에 적합하지 않다. 본 파일은
 * debounce 로직의 핵심 조건 (topology + config 감지) 을 독립적으로
 * 검증한다.
 */
import { describe, it, expect } from "vitest";

// topology key 계산 로직은 프로덕션(`workflow-editor.tsx`)이 사용하는 것과 동일한
// 공유 함수를 import 해 검증한다 — 별도 로컬 재구현 시 프로덕션과 diverge 하면
// 테스트가 실제 동작과 다른 것을 검증하게 되므로 SSOT 를 유지한다. cross-node
// 규칙은 node config (예: parallel maxConcurrency/branchCount) 도 평가 입력이므로
// key 에 해당 필드를 포함해 config 변경 시 재평가가 트리거되도록 한다.
import {
  computeNodeTopologyKey,
  computeEdgeTopologyKey,
} from "@/lib/utils/topology-key";

describe("WorkflowEditor — topology key (debounce dependency logic, SUMMARY#19)", () => {
  describe("nodeTopologyKey", () => {
    it("produces identical key when only node positions change (drag scenario)", () => {
      const nodesV1 = [
        { id: "n1", data: { type: "action" }, position: { x: 0, y: 0 } },
        { id: "n2", data: { type: "trigger" }, position: { x: 100, y: 0 } },
      ];
      const nodesV2 = [
        { id: "n1", data: { type: "action" }, position: { x: 50, y: 200 } }, // drag
        { id: "n2", data: { type: "trigger" }, position: { x: 150, y: 50 } }, // drag
      ];
      expect(computeNodeTopologyKey(nodesV1)).toBe(
        computeNodeTopologyKey(nodesV2),
      );
    });

    it("produces different key when a node type changes", () => {
      const before = [{ id: "n1", data: { type: "action" } }];
      const after = [{ id: "n1", data: { type: "condition" } }];
      expect(computeNodeTopologyKey(before)).not.toBe(
        computeNodeTopologyKey(after),
      );
    });

    it("produces different key when a node is added", () => {
      const before = [{ id: "n1", data: { type: "action" } }];
      const after = [
        { id: "n1", data: { type: "action" } },
        { id: "n2", data: { type: "trigger" } },
      ];
      expect(computeNodeTopologyKey(before)).not.toBe(
        computeNodeTopologyKey(after),
      );
    });

    it("produces different key when a node's config changes (e.g. parallel maxConcurrency)", () => {
      const before = [
        { id: "n1", data: { type: "parallel", config: { maxConcurrency: 4 } } },
      ];
      const after = [
        { id: "n1", data: { type: "parallel", config: { maxConcurrency: 8 } } },
      ];
      expect(computeNodeTopologyKey(before)).not.toBe(
        computeNodeTopologyKey(after),
      );
    });

    it("produces empty string for empty node list", () => {
      expect(computeNodeTopologyKey([])).toBe("");
    });
  });

  describe("edgeTopologyKey", () => {
    it("produces identical key for same connections", () => {
      const edgesV1 = [
        { source: "n1", sourceHandle: "out", target: "n2", targetHandle: "in" },
      ];
      const edgesV2 = [
        { source: "n1", sourceHandle: "out", target: "n2", targetHandle: "in" },
      ];
      expect(computeEdgeTopologyKey(edgesV1)).toBe(
        computeEdgeTopologyKey(edgesV2),
      );
    });

    it("produces different key when an edge is removed", () => {
      const before = [
        { source: "n1", sourceHandle: "out", target: "n2", targetHandle: "in" },
      ];
      const after: typeof before = [];
      expect(computeEdgeTopologyKey(before)).not.toBe(
        computeEdgeTopologyKey(after),
      );
    });

    it("handles null sourceHandle/targetHandle without throwing", () => {
      expect(() =>
        computeEdgeTopologyKey([
          { source: "n1", sourceHandle: null, target: "n2", targetHandle: null },
        ]),
      ).not.toThrow();
    });
  });
});
