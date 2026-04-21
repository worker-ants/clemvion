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

  it("assigns a deterministic fallback id to cases that omit id (no longer dropped)", () => {
    // Assistant / 사용자가 id 를 빠뜨려도 출력 포트는 반드시 생성되어야
    // 한다 — 그래야 UI 핸들이 나타나고 배선이 가능하다. 인덱스 기반
    // `case_${i}` 를 부여해 안정성 확보.
    const ports = resolveDynamicPorts(
      "switch",
      { cases: [{ id: "", label: "Skip" }, { id: "real", label: "Real" }] },
      def("switch", [], SWITCH_SPEC),
    );
    expect(ports.map((p) => p.id)).toEqual(["case_0", "real", "default"]);
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

  it("assigns a deterministic fallback id to conditions that omit id", () => {
    const ports = resolveDynamicPorts(
      "ai_agent",
      {
        mode: "single_turn",
        conditions: [{ id: "", label: "Bad" }, { id: "good", label: "Good" }],
      },
      agentDef,
    );
    expect(ports.map((p) => p.id)).toEqual(["cond_0", "good", "out", "error"]);
  });

  it("keeps condition ports even when every condition omits id (does not fall back to no-condition branch)", () => {
    // 기존 동작은 id 누락 condition 을 전부 떨어뜨려 조건 없음 분기로
    // 퇴행했다. 이제는 cond_0, cond_1 fallback 으로 포트를 발행해 사용자가
    // 의도한 분기 구조를 유지.
    const ports = resolveDynamicPorts(
      "ai_agent",
      {
        mode: "single_turn",
        conditions: [{ id: "", label: "A" }, { id: "", label: "B" }],
      },
      agentDef,
    );
    expect(ports.map((p) => p.id)).toEqual(["cond_0", "cond_1", "out", "error"]);
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

  describe("button id fallback for presentation nodes", () => {
    /**
     * Carousel schema 의 button.id 가 optional 이라 LLM 이 id 없이 버튼을
     * 생성하는 케이스가 실제로 발생한다. 이때 dedupeById 가 id 없는 포트를
     * 전부 필터링하면 캔버스에서 outport 가 사라지므로, resolver 가
     * 경로 기반의 deterministic fallback id 를 부여해 최소한의 포트를
     * 제공한다.
     */
    it("assigns deterministic fallback ids to item buttons that omit id", () => {
      const d = def("carousel", [], CAROUSEL_SPEC);
      const ports = resolveDynamicPorts(
        "carousel",
        {
          mode: "static",
          items: [
            {
              title: "AI",
              buttons: [{ label: "Agent", type: "port" }, { label: "Router", type: "port" }],
            },
            {
              title: "Logic",
              buttons: [{ label: "Switch", type: "port" }],
            },
          ],
        },
        d,
      );
      expect(ports.length).toBe(3);
      expect(ports.map((p) => p.id)).toEqual([
        "items_0_btn_0",
        "items_0_btn_1",
        "items_1_btn_0",
      ]);
      expect(ports.every((p) => p.id.length > 0)).toBe(true);
    });

    it("preserves explicit button ids when present, fills in only missing ones", () => {
      const d = def("carousel", [], CAROUSEL_SPEC);
      const ports = resolveDynamicPorts(
        "carousel",
        {
          mode: "static",
          items: [
            {
              title: "Cat",
              buttons: [
                { id: "btn_a", label: "A", type: "port" },
                { label: "B", type: "port" },
              ],
            },
          ],
        },
        d,
      );
      expect(ports.map((p) => p.id)).toEqual(["btn_a", "items_0_btn_1"]);
    });

    it("applies fallback ids to itemButtons and global buttons as well", () => {
      const d = def("carousel", [], CAROUSEL_SPEC);
      const ports = resolveDynamicPorts(
        "carousel",
        {
          itemButtons: [{ label: "IB", type: "port" }],
          buttons: [{ label: "G", type: "port" }],
        },
        d,
      );
      expect(ports.map((p) => p.id)).toEqual(["itemBtn_0", "btn_0"]);
    });
  });

  describe("port id deduplication (SSOT invariant)", () => {
    /**
     * 동적 포트 배열은 SSOT — 같은 id 가 두 번 나타나면 edge 연결·React key
     * 양쪽에서 모호해진다. resolver 에서 첫 등장만 유지해 중복을 제거한다.
     */
    it("deduplicates switch cases that share an id (keeps first occurrence)", () => {
      const d = def("switch", [], SWITCH_SPEC);
      const ports = resolveDynamicPorts(
        "switch",
        {
          cases: [
            { id: "c1", label: "first" },
            { id: "c1", label: "duplicate" },
            { id: "c2", label: "second" },
          ],
        },
        d,
      );
      const ids = ports.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
      // 'default' 가 마지막에 붙어도 unique 유지
      expect(ids.filter((id) => id === "c1").length).toBe(1);
    });

    it("deduplicates carousel buttons across items / itemButtons / globals", () => {
      const d = def("carousel", [], CAROUSEL_SPEC);
      const ports = resolveDynamicPorts(
        "carousel",
        {
          mode: "static",
          items: [
            {
              title: "Card A",
              buttons: [{ id: "continue", label: "Go", type: "port" }],
            },
            {
              title: "Card B",
              buttons: [{ id: "continue", label: "Go too", type: "port" }],
            },
          ],
          itemButtons: [{ id: "continue", label: "Shared Go", type: "port" }],
          buttons: [{ id: "continue", label: "Global Go", type: "port" }],
        },
        d,
      );
      const ids = ports.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("deduplicates classifier categories whose index-derived id collides with fallback/error", () => {
      // class_0 와 spec.fallbackId 가 같은 문자열이면 중복 발생 가능.
      const spec: DynamicPortsSpec = {
        kind: "classifier-categories",
        fallbackId: "class_0",
        errorId: "error",
      };
      const d = def("classifier", [], spec);
      const ports = resolveDynamicPorts(
        "classifier",
        { categories: [{ name: "A" }, { name: "B" }] },
        d,
      );
      const ids = ports.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });
});
