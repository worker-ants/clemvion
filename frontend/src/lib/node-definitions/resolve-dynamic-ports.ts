import type {
  DynamicPortsSpec,
  NodeDefinition,
  PortDefinition,
} from "./types";

export type DynamicPortType = "data" | "system" | "error" | "control";

export type DynamicPortDefinition = {
  id: string;
  label: string;
  type: DynamicPortType;
  /** Group tag used by the renderer to visually cluster related ports (e.g. per-item buttons in Carousel static mode). */
  group?: string;
};

type CaseEntry = { id: string; label: string };
type CategoryEntry = { name: string };
type ConditionEntry = { id: string; label: string };
type ButtonEntry = { id: string; label: string; type: string };
type CarouselItem = { title?: string; buttons?: ButtonEntry[] };

function parallelBranchPorts(config: Record<string, unknown>): DynamicPortDefinition[] {
  const branchCount = Math.max(2, Math.min(16, Math.floor(
    typeof config.branchCount === "number" ? config.branchCount : 2,
  )));
  const branches: DynamicPortDefinition[] = Array.from({ length: branchCount }, (_, i) => ({
    id: `branch_${i}`,
    label: `Branch ${i}`,
    type: "data" as DynamicPortType,
  }));
  return [...branches, { id: "done", label: "Done", type: "data" }];
}

function switchPorts(config: Record<string, unknown>): DynamicPortDefinition[] {
  const cases = (config.cases as CaseEntry[] | undefined) ?? [];
  const casePorts = cases
    .filter((c) => c.id)
    .map<DynamicPortDefinition>((c) => ({
      id: c.id,
      label: c.label || "Case",
      type: "data",
    }));
  return [...casePorts, { id: "default", label: "Default", type: "data" }];
}

function classifierCategoriesPorts(
  config: Record<string, unknown>,
  spec: Extract<DynamicPortsSpec, { kind: "classifier-categories" }>,
): DynamicPortDefinition[] {
  const categories = (config.categories as CategoryEntry[] | undefined) ?? [];
  const catPorts = categories.map<DynamicPortDefinition>((c, i) => ({
    id: `class_${i}`,
    label: c.name || `Category ${i + 1}`,
    type: "data",
  }));
  return [
    ...catPorts,
    { id: spec.fallbackId, label: "Fallback", type: "data" },
    { id: spec.errorId, label: "Error", type: "error" },
  ];
}

function aiAgentConditionalPorts(
  config: Record<string, unknown>,
  spec: Extract<DynamicPortsSpec, { kind: "ai-agent-conditional" }>,
): DynamicPortDefinition[] {
  const conditions =
    (config[spec.conditionsField] as ConditionEntry[] | undefined) ?? [];
  const condPorts = conditions
    .filter((c) => c.id)
    .map<DynamicPortDefinition>((c) => ({
      id: c.id,
      label: c.label || "Condition",
      type: "data",
    }));
  const mode = config[spec.modeField] as string | undefined;
  const isMultiTurn = mode === spec.multiTurnValue;

  if (condPorts.length === 0) {
    if (isMultiTurn) {
      return [
        { id: "user_ended", label: "User Ended", type: "system" },
        { id: "max_turns", label: "Max Turns", type: "system" },
        { id: "error", label: "Error", type: "error" },
      ];
    }
    return [
      { id: "out", label: "Output", type: "system" },
      { id: "error", label: "Error", type: "error" },
    ];
  }

  if (isMultiTurn) {
    return [
      ...condPorts,
      { id: "user_ended", label: "User Ended", type: "system" },
      { id: "max_turns", label: "Max Turns", type: "system" },
      { id: "error", label: "Error", type: "error" },
    ];
  }
  return [
    ...condPorts,
    { id: "out", label: "Output", type: "system" },
    { id: "error", label: "Error", type: "error" },
  ];
}

function presentationButtonPorts(
  config: Record<string, unknown>,
  spec: Extract<DynamicPortsSpec, { kind: "presentation-buttons" }>,
  fallbackOutputs: PortDefinition[],
): DynamicPortDefinition[] {
  const globalButtons = (config.buttons as ButtonEntry[] | undefined) ?? [];
  const portDefs: DynamicPortDefinition[] = [];

  if (spec.supportsItems) {
    if (config.mode === "static" && Array.isArray(config.items)) {
      for (const item of config.items as CarouselItem[]) {
        if (!item.buttons) continue;
        for (const b of item.buttons) {
          if (b.type !== "port") continue;
          portDefs.push({
            id: b.id,
            label: b.label || "Button",
            type: "data",
            group: item.title || "Item",
          });
        }
      }
    }
  }
  if (spec.supportsItemButtons && Array.isArray(config.itemButtons)) {
    for (const b of config.itemButtons as ButtonEntry[]) {
      if (b.type !== "port") continue;
      portDefs.push({
        id: b.id,
        label: b.label || "Button",
        type: "data",
        group: "Item",
      });
    }
  }

  for (const b of globalButtons) {
    if (b.type !== "port") continue;
    portDefs.push({ id: b.id, label: b.label || "Button", type: "data" });
  }

  if (portDefs.length > 0) return portDefs;

  const itemsHaveLink =
    !!spec.supportsItems &&
    config.mode === "static" &&
    Array.isArray(config.items) &&
    (config.items as CarouselItem[]).some((item) =>
      item.buttons?.some((b) => b.type === "link"),
    );
  const itemButtonsHaveLink =
    !!spec.supportsItemButtons &&
    Array.isArray(config.itemButtons) &&
    (config.itemButtons as ButtonEntry[]).some((b) => b.type === "link");
  const globalHasLink = globalButtons.some((b) => b.type === "link");

  if (globalHasLink || itemButtonsHaveLink || itemsHaveLink) {
    return [{ id: spec.continueId, label: "Continue", type: "data" }];
  }

  return fallbackOutputs.map((p) => ({
    id: p.id,
    label: p.label,
    type: p.type as DynamicPortType,
  }));
}

/**
 * Resolves the output ports for a node instance on the canvas.
 *
 * Priority:
 *  1. If `definition.dynamicPorts` is set, switch on its `kind` and apply the
 *     parameterized generator. This is the schema-driven path and the SSOT
 *     with the backend metadata.
 *  2. Otherwise, fall back to the node's static `definition.outputs`.
 */
export function resolveDynamicPorts(
  _nodeType: string,
  config: Record<string, unknown>,
  definition: NodeDefinition | undefined,
): DynamicPortDefinition[] {
  const spec = definition?.dynamicPorts;
  const staticOutputs = definition?.outputs ?? [];

  if (spec) {
    switch (spec.kind) {
      case "switch-cases":
        return switchPorts(config);
      case "classifier-categories":
        return classifierCategoriesPorts(config, spec);
      case "ai-agent-conditional":
        return aiAgentConditionalPorts(config, spec);
      case "presentation-buttons":
        return presentationButtonPorts(config, spec, staticOutputs);
      case "parallel-branches":
        return parallelBranchPorts(config);
    }
  }

  return staticOutputs.map((p) => ({
    id: p.id,
    label: p.label,
    type: p.type as DynamicPortType,
  }));
}
