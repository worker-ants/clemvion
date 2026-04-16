import { describe, it, expect } from "vitest";
import { resolveDynamicPorts } from "../resolve-dynamic-ports";
import type { DynamicPortsSpec, NodeDefinition } from "../types";

function def(
  type: string,
  outputs: NodeDefinition["outputs"],
  dynamicPorts?: DynamicPortsSpec,
): NodeDefinition {
  return {
    type,
    category: "logic",
    label: type,
    description: "",
    icon: "Box",
    color: "#000",
    inputs: [],
    outputs,
    defaultConfig: {},
    configSchema: {},
    dynamicPorts,
  };
}

const SWITCH_SPEC: DynamicPortsSpec = { kind: "switch-cases" };
const CLASSIFIER_SPEC: DynamicPortsSpec = {
  kind: "classifier-categories",
  fallbackId: "fallback",
  errorId: "error",
};
const AI_AGENT_SPEC: DynamicPortsSpec = {
  kind: "ai-agent-conditional",
  modeField: "mode",
  conditionsField: "conditions",
  multiTurnValue: "multi_turn",
};
const CAROUSEL_SPEC: DynamicPortsSpec = {
  kind: "presentation-buttons",
  supportsItems: true,
  supportsItemButtons: true,
  continueId: "continue",
};
const TABLE_SPEC: DynamicPortsSpec = {
  kind: "presentation-buttons",
  continueId: "continue",
};

describe("resolveDynamicPorts — switch", () => {
  it("emits a port per case plus a default port", () => {
    const ports = resolveDynamicPorts(
      "switch",
      { cases: [{ id: "c1", label: "Yes" }, { id: "c2", label: "No" }] },
      def("switch", [], SWITCH_SPEC),
    );
    expect(ports.map((p) => p.id)).toEqual(["c1", "c2", "default"]);
    expect(ports.every((p) => p.type === "data")).toBe(true);
  });

  it("filters out cases with empty id", () => {
    const ports = resolveDynamicPorts(
      "switch",
      { cases: [{ id: "", label: "Skip" }, { id: "real", label: "Real" }] },
      def("switch", [], SWITCH_SPEC),
    );
    expect(ports.map((p) => p.id)).toEqual(["real", "default"]);
  });

  it("uses 'Case' as default label when empty", () => {
    const ports = resolveDynamicPorts(
      "switch",
      { cases: [{ id: "c1", label: "" }] },
      def("switch", [], SWITCH_SPEC),
    );
    expect(ports[0].label).toBe("Case");
  });

  it("returns only the default port when cases is missing", () => {
    const ports = resolveDynamicPorts("switch", {}, def("switch", [], SWITCH_SPEC));
    expect(ports).toEqual([{ id: "default", label: "Default", type: "data" }]);
  });
});

describe("resolveDynamicPorts — text_classifier", () => {
  it("emits class_i port per category plus fallback and error", () => {
    const ports = resolveDynamicPorts(
      "text_classifier",
      { categories: [{ name: "Spam" }, { name: "Ham" }] },
      def("text_classifier", [], CLASSIFIER_SPEC),
    );
    expect(ports.map((p) => p.id)).toEqual([
      "class_0",
      "class_1",
      "fallback",
      "error",
    ]);
    expect(ports[3].type).toBe("error");
  });

  it("auto-labels unnamed categories", () => {
    const ports = resolveDynamicPorts(
      "text_classifier",
      { categories: [{ name: "" }, {}] },
      def("text_classifier", [], CLASSIFIER_SPEC),
    );
    expect(ports[0].label).toBe("Category 1");
    expect(ports[1].label).toBe("Category 2");
  });

  it("emits only fallback+error when no categories", () => {
    const ports = resolveDynamicPorts(
      "text_classifier",
      {},
      def("text_classifier", [], CLASSIFIER_SPEC),
    );
    expect(ports.map((p) => p.id)).toEqual(["fallback", "error"]);
  });
});

describe("resolveDynamicPorts — ai_agent (4 mode×condition combinations)", () => {
  const agentDef = def("ai_agent", [], AI_AGENT_SPEC);

  it("single_turn + no conditions → out + error", () => {
    const ports = resolveDynamicPorts("ai_agent", { mode: "single_turn" }, agentDef);
    expect(ports.map((p) => p.id)).toEqual(["out", "error"]);
    expect(ports[0].type).toBe("system");
    expect(ports[1].type).toBe("error");
  });

  it("multi_turn + no conditions → user_ended + max_turns + error", () => {
    const ports = resolveDynamicPorts("ai_agent", { mode: "multi_turn" }, agentDef);
    expect(ports.map((p) => p.id)).toEqual(["user_ended", "max_turns", "error"]);
  });

  it("single_turn + conditions → condition ports + out + error", () => {
    const ports = resolveDynamicPorts(
      "ai_agent",
      {
        mode: "single_turn",
        conditions: [
          { id: "refund", label: "Refund" },
          { id: "support", label: "Support" },
        ],
      },
      agentDef,
    );
    expect(ports.map((p) => p.id)).toEqual(["refund", "support", "out", "error"]);
  });

  it("multi_turn + conditions → condition ports + user_ended + max_turns + error (no out)", () => {
    const ports = resolveDynamicPorts(
      "ai_agent",
      {
        mode: "multi_turn",
        conditions: [{ id: "stop", label: "Stop" }],
      },
      agentDef,
    );
    expect(ports.map((p) => p.id)).toEqual([
      "stop",
      "user_ended",
      "max_turns",
      "error",
    ]);
    expect(ports.some((p) => p.id === "out")).toBe(false);
  });

  it("defaults to single_turn when mode is missing", () => {
    const ports = resolveDynamicPorts("ai_agent", {}, agentDef);
    expect(ports.map((p) => p.id)).toEqual(["out", "error"]);
  });

  it("drops conditions with empty id", () => {
    const ports = resolveDynamicPorts(
      "ai_agent",
      {
        mode: "single_turn",
        conditions: [{ id: "", label: "Bad" }, { id: "good", label: "Good" }],
      },
      agentDef,
    );
    expect(ports.map((p) => p.id)).toEqual(["good", "out", "error"]);
  });
});

describe("resolveDynamicPorts — presentation with buttons", () => {
  const tableDef = def(
    "table",
    [{ id: "out", label: "Output", type: "data" }],
    TABLE_SPEC,
  );
  const carouselDef = def(
    "carousel",
    [{ id: "out", label: "Output", type: "data" }],
    CAROUSEL_SPEC,
  );

  it("emits port per global button of type 'port'", () => {
    const ports = resolveDynamicPorts(
      "table",
      {
        buttons: [
          { id: "confirm", label: "Confirm", type: "port" },
          { id: "cancel", label: "Cancel", type: "port" },
        ],
      },
      tableDef,
    );
    expect(ports.map((p) => p.id)).toEqual(["confirm", "cancel"]);
  });

  it("ignores non-port buttons and falls back to node default outputs", () => {
    const ports = resolveDynamicPorts(
      "table",
      { buttons: [{ id: "nav", label: "Nav", type: "link" }] },
      tableDef,
    );
    expect(ports).toEqual([{ id: "continue", label: "Continue", type: "data" }]);
  });

  it("returns default outputs when there are no buttons at all", () => {
    const ports = resolveDynamicPorts("table", {}, tableDef);
    expect(ports).toEqual([{ id: "out", label: "Output", type: "data" }]);
  });

  it("carousel static: groups per-item port buttons by item title", () => {
    const ports = resolveDynamicPorts(
      "carousel",
      {
        mode: "static",
        items: [
          {
            title: "Card A",
            buttons: [{ id: "a-buy", label: "Buy", type: "port" }],
          },
          {
            title: "Card B",
            buttons: [{ id: "b-buy", label: "Buy", type: "port" }],
          },
        ],
      },
      carouselDef,
    );
    expect(ports.map((p) => p.id)).toEqual(["a-buy", "b-buy"]);
    expect(ports[0].group).toBe("Card A");
    expect(ports[1].group).toBe("Card B");
  });

  it("carousel dynamic: itemButtons use 'Item' as group", () => {
    const ports = resolveDynamicPorts(
      "carousel",
      {
        mode: "dynamic",
        itemButtons: [{ id: "view", label: "View", type: "port" }],
      },
      carouselDef,
    );
    expect(ports[0].group).toBe("Item");
  });

  it("carousel: global 'port' buttons appear alongside item buttons without group", () => {
    const ports = resolveDynamicPorts(
      "carousel",
      {
        mode: "static",
        items: [
          {
            title: "Card",
            buttons: [{ id: "a", label: "A", type: "port" }],
          },
        ],
        buttons: [{ id: "global", label: "Global", type: "port" }],
      },
      carouselDef,
    );
    expect(ports.map((p) => p.id)).toEqual(["a", "global"]);
    expect(ports[0].group).toBe("Card");
    expect(ports[1].group).toBeUndefined();
  });

  it("carousel static: any link button (no port) emits continue port", () => {
    const ports = resolveDynamicPorts(
      "carousel",
      {
        mode: "static",
        items: [
          {
            title: "Card",
            buttons: [{ id: "href", label: "Go", type: "link" }],
          },
        ],
      },
      carouselDef,
    );
    expect(ports).toEqual([{ id: "continue", label: "Continue", type: "data" }]);
  });
});

describe("resolveDynamicPorts — unknown / default fallback", () => {
  it("returns definition.outputs for nodes without custom dynamic rules", () => {
    const ports = resolveDynamicPorts(
      "if_else",
      {},
      def("if_else", [
        { id: "true", label: "True", type: "data" },
        { id: "false", label: "False", type: "data" },
      ]),
    );
    expect(ports.map((p) => p.id)).toEqual(["true", "false"]);
  });

  it("returns empty array when definition is undefined", () => {
    const ports = resolveDynamicPorts("unknown", {}, undefined);
    expect(ports).toEqual([]);
  });

  describe("parallel-branches", () => {
    const PARALLEL_SPEC: DynamicPortsSpec = { kind: "parallel-branches" };

    it("returns branchCount ports + done (default 2 branches)", () => {
      const d = def("parallel", [], PARALLEL_SPEC);
      const ports = resolveDynamicPorts("parallel", {}, d);
      expect(ports).toEqual([
        { id: "branch_0", label: "Branch 0", type: "data" },
        { id: "branch_1", label: "Branch 1", type: "data" },
        { id: "done", label: "Done", type: "data" },
      ]);
    });

    it("respects branchCount config", () => {
      const d = def("parallel", [], PARALLEL_SPEC);
      const ports = resolveDynamicPorts("parallel", { branchCount: 4 }, d);
      // 4 branches + 1 done = 5
      expect(ports.length).toBe(5);
      expect(ports[3]).toEqual({ id: "branch_3", label: "Branch 3", type: "data" });
      expect(ports[4]).toEqual({ id: "done", label: "Done", type: "data" });
    });

    it("clamps to min 2", () => {
      const d = def("parallel", [], PARALLEL_SPEC);
      const ports = resolveDynamicPorts("parallel", { branchCount: 0 }, d);
      // 2 branches + 1 done = 3
      expect(ports.length).toBe(3);
    });

    it("clamps to max 16", () => {
      const d = def("parallel", [], PARALLEL_SPEC);
      const ports = resolveDynamicPorts("parallel", { branchCount: 100 }, d);
      // 16 branches + 1 done = 17
      expect(ports.length).toBe(17);
    });
  });
});
