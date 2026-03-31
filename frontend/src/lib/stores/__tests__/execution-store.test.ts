import { describe, it, expect, beforeEach } from "vitest";
import { useExecutionStore } from "../execution-store";
import type { NodeResult, NodeStatusInfo } from "../execution-store";

const initialState = {
  executionId: null,
  status: "idle" as const,
  nodeStatuses: new Map(),
  nodeResults: [],
  startedAt: null,
};

describe("useExecutionStore", () => {
  beforeEach(() => {
    useExecutionStore.setState(initialState);
  });

  it("has correct initial state", () => {
    const state = useExecutionStore.getState();
    expect(state.executionId).toBeNull();
    expect(state.status).toBe("idle");
    expect(state.nodeStatuses.size).toBe(0);
    expect(state.nodeResults).toEqual([]);
    expect(state.startedAt).toBeNull();
  });

  describe("startExecution", () => {
    it("sets executionId, status, and startedAt", () => {
      useExecutionStore.getState().startExecution("exec-1");

      const state = useExecutionStore.getState();
      expect(state.executionId).toBe("exec-1");
      expect(state.status).toBe("running");
      expect(state.startedAt).toBeTruthy();
      expect(state.nodeStatuses.size).toBe(0);
      expect(state.nodeResults).toEqual([]);
    });

    it("resets previous results when starting new execution", () => {
      const result: NodeResult = {
        nodeId: "n1",
        nodeLabel: "Node 1",
        nodeType: "action",
        outputData: { foo: "bar" },
      };
      useExecutionStore.getState().addNodeResult(result);
      expect(useExecutionStore.getState().nodeResults).toHaveLength(1);

      useExecutionStore.getState().startExecution("exec-2");
      expect(useExecutionStore.getState().nodeResults).toEqual([]);
    });
  });

  describe("updateNodeStatus", () => {
    it("sets status for a node", () => {
      const info: NodeStatusInfo = { status: "running" };
      useExecutionStore.getState().updateNodeStatus("node-1", info);

      const statuses = useExecutionStore.getState().nodeStatuses;
      expect(statuses.get("node-1")).toEqual(info);
    });

    it("updates existing node status", () => {
      useExecutionStore.getState().updateNodeStatus("node-1", { status: "running" });
      useExecutionStore.getState().updateNodeStatus("node-1", { status: "completed", duration: 150 });

      const statuses = useExecutionStore.getState().nodeStatuses;
      expect(statuses.get("node-1")?.status).toBe("completed");
      expect(statuses.get("node-1")?.duration).toBe(150);
    });

    it("tracks multiple nodes independently", () => {
      useExecutionStore.getState().updateNodeStatus("node-1", { status: "completed" });
      useExecutionStore.getState().updateNodeStatus("node-2", { status: "running" });

      const statuses = useExecutionStore.getState().nodeStatuses;
      expect(statuses.get("node-1")?.status).toBe("completed");
      expect(statuses.get("node-2")?.status).toBe("running");
    });
  });

  describe("addNodeResult", () => {
    it("adds a result to the list", () => {
      const result: NodeResult = {
        nodeId: "n1",
        nodeLabel: "Node 1",
        nodeType: "action",
        outputData: { data: "test" },
      };
      useExecutionStore.getState().addNodeResult(result);

      expect(useExecutionStore.getState().nodeResults).toHaveLength(1);
      expect(useExecutionStore.getState().nodeResults[0]).toEqual(result);
    });

    it("appends multiple results", () => {
      const r1: NodeResult = { nodeId: "n1", nodeLabel: "A", nodeType: "action", outputData: null };
      const r2: NodeResult = { nodeId: "n2", nodeLabel: "B", nodeType: "action", outputData: null };
      useExecutionStore.getState().addNodeResult(r1);
      useExecutionStore.getState().addNodeResult(r2);

      expect(useExecutionStore.getState().nodeResults).toHaveLength(2);
    });
  });

  describe("completeExecution", () => {
    it("sets status to completed", () => {
      useExecutionStore.getState().startExecution("exec-1");
      useExecutionStore.getState().completeExecution();
      expect(useExecutionStore.getState().status).toBe("completed");
    });
  });

  describe("failExecution", () => {
    it("sets status to failed", () => {
      useExecutionStore.getState().startExecution("exec-1");
      useExecutionStore.getState().failExecution();
      expect(useExecutionStore.getState().status).toBe("failed");
    });

    it("stores error on __execution__ key when error provided with executionId", () => {
      useExecutionStore.getState().startExecution("exec-1");
      useExecutionStore.getState().failExecution("Something went wrong");

      const state = useExecutionStore.getState();
      expect(state.status).toBe("failed");
      expect(state.nodeStatuses.get("__execution__")).toEqual({
        status: "failed",
        error: "Something went wrong",
      });
    });
  });

  describe("reset", () => {
    it("resets all state to initial values", () => {
      useExecutionStore.getState().startExecution("exec-1");
      useExecutionStore.getState().updateNodeStatus("n1", { status: "running" });
      useExecutionStore.getState().addNodeResult({ nodeId: "n1", nodeLabel: "A", nodeType: "x", outputData: null });

      useExecutionStore.getState().reset();

      const state = useExecutionStore.getState();
      expect(state.executionId).toBeNull();
      expect(state.status).toBe("idle");
      expect(state.nodeStatuses.size).toBe(0);
      expect(state.nodeResults).toEqual([]);
      expect(state.startedAt).toBeNull();
    });
  });
});
