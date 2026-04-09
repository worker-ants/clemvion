import { describe, it, expect, beforeEach } from "vitest";
import { useExecutionStore } from "../execution-store";
import type { NodeResult, NodeStatusInfo } from "../execution-store";

function makeResult(overrides: Partial<NodeResult> = {}): NodeResult {
  return {
    nodeId: "n1",
    nodeLabel: "Node 1",
    nodeType: "action",
    nodeCategory: "logic",
    status: "completed",
    outputData: null,
    ...overrides,
  };
}

const initialState = {
  executionId: null,
  status: "idle" as const,
  nodeStatuses: new Map(),
  nodeResults: [],
  startedAt: null,
  waitingNodeId: null,
  waitingFormConfig: null,
  selectedResultNodeId: null,
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
    expect(state.waitingNodeId).toBeNull();
    expect(state.waitingFormConfig).toBeNull();
    expect(state.selectedResultNodeId).toBeNull();
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
      expect(state.waitingNodeId).toBeNull();
      expect(state.waitingFormConfig).toBeNull();
      expect(state.selectedResultNodeId).toBeNull();
    });

    it("resets previous results when starting new execution", () => {
      useExecutionStore.getState().addNodeResult(makeResult({ outputData: { foo: "bar" } }));
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
      const result = makeResult({ outputData: { data: "test" } });
      useExecutionStore.getState().addNodeResult(result);

      expect(useExecutionStore.getState().nodeResults).toHaveLength(1);
      expect(useExecutionStore.getState().nodeResults[0]).toEqual(result);
    });

    it("appends multiple results", () => {
      useExecutionStore.getState().addNodeResult(makeResult({ nodeId: "n1", nodeLabel: "A" }));
      useExecutionStore.getState().addNodeResult(makeResult({ nodeId: "n2", nodeLabel: "B" }));

      expect(useExecutionStore.getState().nodeResults).toHaveLength(2);
    });

    it("updates existing result for same nodeId instead of duplicating", () => {
      useExecutionStore.getState().addNodeResult(makeResult({ nodeId: "n1", nodeType: "table", outputData: { v: 1 } }));
      useExecutionStore.getState().addNodeResult(makeResult({ nodeId: "n1", nodeType: "table", outputData: { v: 2 } }));

      const results = useExecutionStore.getState().nodeResults;
      expect(results).toHaveLength(1);
      expect(results[0].outputData).toEqual({ v: 2 });
    });

    it("preserves inputData when merging with a result that lacks it", () => {
      // First result from polling includes inputData
      useExecutionStore.getState().addNodeResult(makeResult({
        nodeId: "n1",
        outputData: { v: 1 },
        inputData: { key: "value" },
      }));

      // Second result from WS event lacks inputData
      useExecutionStore.getState().addNodeResult(makeResult({
        nodeId: "n1",
        outputData: { v: 2 },
      }));

      const results = useExecutionStore.getState().nodeResults;
      expect(results).toHaveLength(1);
      expect(results[0].outputData).toEqual({ v: 2 });
      expect(results[0].inputData).toEqual({ key: "value" });
    });

    it("updates inputData when new result provides it", () => {
      useExecutionStore.getState().addNodeResult(makeResult({
        nodeId: "n1",
        inputData: { old: true },
      }));

      useExecutionStore.getState().addNodeResult(makeResult({
        nodeId: "n1",
        inputData: { new: true },
      }));

      const results = useExecutionStore.getState().nodeResults;
      expect(results[0].inputData).toEqual({ new: true });
    });
  });

  describe("completeExecution", () => {
    it("sets status to completed and clears waiting state", () => {
      useExecutionStore.getState().startExecution("exec-1");
      useExecutionStore.getState().pauseForForm("node-form", { fields: [] });
      useExecutionStore.getState().completeExecution();

      const state = useExecutionStore.getState();
      expect(state.status).toBe("completed");
      expect(state.waitingNodeId).toBeNull();
      expect(state.waitingFormConfig).toBeNull();
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

    it("clears waiting state on failure", () => {
      useExecutionStore.getState().startExecution("exec-1");
      useExecutionStore.getState().pauseForForm("node-form", { fields: [] });
      useExecutionStore.getState().failExecution("Error");

      const state = useExecutionStore.getState();
      expect(state.waitingNodeId).toBeNull();
      expect(state.waitingFormConfig).toBeNull();
    });
  });

  describe("pauseForForm / resumeFromForm", () => {
    it("transitions to waiting_for_input with form config", () => {
      useExecutionStore.getState().startExecution("exec-1");
      const formConfig = {
        fields: [{ name: "approved", type: "checkbox", label: "Approved" }],
        title: "Approval",
      };
      useExecutionStore.getState().pauseForForm("node-form", formConfig);

      const state = useExecutionStore.getState();
      expect(state.status).toBe("waiting_for_input");
      expect(state.waitingNodeId).toBe("node-form");
      expect(state.waitingFormConfig).toEqual(formConfig);
    });

    it("resumes to running state and clears waiting info", () => {
      useExecutionStore.getState().startExecution("exec-1");
      useExecutionStore.getState().pauseForForm("node-form", { fields: [] });
      useExecutionStore.getState().resumeFromForm();

      const state = useExecutionStore.getState();
      expect(state.status).toBe("running");
      expect(state.waitingNodeId).toBeNull();
      expect(state.waitingFormConfig).toBeNull();
    });
  });

  describe("selectResultNode", () => {
    it("selects and deselects a result node", () => {
      useExecutionStore.getState().selectResultNode("n1");
      expect(useExecutionStore.getState().selectedResultNodeId).toBe("n1");

      useExecutionStore.getState().selectResultNode(null);
      expect(useExecutionStore.getState().selectedResultNodeId).toBeNull();
    });
  });

  describe("reset", () => {
    it("resets all state to initial values including waiting state", () => {
      useExecutionStore.getState().startExecution("exec-1");
      useExecutionStore.getState().updateNodeStatus("n1", { status: "running" });
      useExecutionStore.getState().addNodeResult(makeResult());
      useExecutionStore.getState().pauseForForm("node-form", { fields: [] });
      useExecutionStore.getState().selectResultNode("n1");

      useExecutionStore.getState().reset();

      const state = useExecutionStore.getState();
      expect(state.executionId).toBeNull();
      expect(state.status).toBe("idle");
      expect(state.nodeStatuses.size).toBe(0);
      expect(state.nodeResults).toEqual([]);
      expect(state.startedAt).toBeNull();
      expect(state.waitingNodeId).toBeNull();
      expect(state.waitingFormConfig).toBeNull();
      expect(state.selectedResultNodeId).toBeNull();
    });
  });
});
