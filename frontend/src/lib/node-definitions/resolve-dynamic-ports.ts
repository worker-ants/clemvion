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

/**
 * Slug 형식의 stable port id 만 통과시키고, 그 외는 fallback 으로 떨어뜨린다.
 * Backend `nodes/core/port-id.util.ts` 와 lockstep — schema 를 우회한 데이터
 * (legacy import, 직접 DB 주입 등) 에서도 라우팅 키가 오염되지 않도록 한다.
 */
const PORT_ID_SLUG_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;
function resolveStableSlugId(id: unknown, fallback: string): string {
  if (typeof id !== "string") return fallback;
  const trimmed = id.trim();
  if (trimmed.length === 0) return fallback;
  if (!PORT_ID_SLUG_REGEX.test(trimmed)) return fallback;
  return trimmed;
}

type CaseEntry = { id: string; label: string };
type CategoryEntry = { id?: string; name: string };
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
  // id 누락 case 는 드롭하지 않고 `case_${i}` fallback id 를 부여한다 —
  // 드롭하면 UI 에 out-port 핸들이 사라져 사용자가 배선 자체를 못 한다.
  // fallback id 가 이후 유저 편집으로 커스텀 id 로 교체될 때까지 안정적인
  // 포트 식별자를 제공한다.
  const casePorts = cases.map<DynamicPortDefinition>((c, i) => ({
    id: resolveStableSlugId(c.id, `case_${i}`),
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
    // backend `resolve-dynamic-ports.ts` 와 lockstep — trim 기반 stable id +
    // slug regex 검증으로 schema 우회 입력에서도 안전한 fallback.
    id: resolveStableSlugId(c.id, `class_${i}`),
    label: c.name || `Category ${i + 1}`,
    type: "data",
  }));
  return [
    ...catPorts,
    { id: spec.fallbackId, label: "Fallback", type: "data" },
    { id: spec.errorId, label: "Error", type: "error" },
  ];
}

function infoExtractorModePorts(
  config: Record<string, unknown>,
  spec: Extract<DynamicPortsSpec, { kind: "info-extractor-mode" }>,
): DynamicPortDefinition[] {
  const mode = config[spec.modeField] as string | undefined;
  const isMultiTurn = mode === spec.multiTurnValue;

  if (isMultiTurn) {
    return [
      { id: "completed", label: "Completed", type: "system" },
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

function aiAgentConditionalPorts(
  config: Record<string, unknown>,
  spec: Extract<DynamicPortsSpec, { kind: "ai-agent-conditional" }>,
): DynamicPortDefinition[] {
  const conditions =
    (config[spec.conditionsField] as ConditionEntry[] | undefined) ?? [];
  // switchPorts 와 동일한 정책: id 누락 condition 은 드롭하지 않고
  // `cond_${i}` fallback 부여. "조건이 전혀 없음" 분기는 conditions 배열
  // 길이 기준 — id 누락으로 fallback 처리된 경우도 실제 의도된 분기로
  // 간주해 포트를 발행한다.
  const condPorts = conditions.map<DynamicPortDefinition>((c, i) => ({
    id: resolveStableSlugId(c.id, `cond_${i}`),
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

  // button.id 가 schema 상 optional 이라 LLM 이 생략해 들어오는 경우가 있다.
  // 빈 id 인 채로 두면 dedupeById 가 모두 필터해 캔버스에서 outport 가
  // 사라진다. 경로 기반의 deterministic fallback id 를 부여한다. 사용자가
  // 이후 설정 UI 에서 id 를 수정하면 explicit 값이 우선된다.
  const resolveButtonId = (b: ButtonEntry, fallback: string): string =>
    typeof b.id === "string" && b.id.length > 0 ? b.id : fallback;

  if (spec.supportsItems) {
    if (config.mode === "static" && Array.isArray(config.items)) {
      const items = config.items as CarouselItem[];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.buttons) continue;
        for (let j = 0; j < item.buttons.length; j++) {
          const b = item.buttons[j];
          if (b.type !== "port") continue;
          portDefs.push({
            id: resolveButtonId(b, `items_${i}_btn_${j}`),
            label: b.label || "Button",
            type: "data",
            group: item.title || "Item",
          });
        }
      }
    }
  }
  if (spec.supportsItemButtons && Array.isArray(config.itemButtons)) {
    const itemButtons = config.itemButtons as ButtonEntry[];
    for (let i = 0; i < itemButtons.length; i++) {
      const b = itemButtons[i];
      if (b.type !== "port") continue;
      portDefs.push({
        id: resolveButtonId(b, `itemBtn_${i}`),
        label: b.label || "Button",
        type: "data",
        group: "Item",
      });
    }
  }

  for (let i = 0; i < globalButtons.length; i++) {
    const b = globalButtons[i];
    if (b.type !== "port") continue;
    portDefs.push({
      id: resolveButtonId(b, `btn_${i}`),
      label: b.label || "Button",
      type: "data",
    });
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

  const resolved: DynamicPortDefinition[] = (() => {
    if (spec) {
      switch (spec.kind) {
        case "switch-cases":
          return switchPorts(config);
        case "classifier-categories":
          return classifierCategoriesPorts(config, spec);
        case "ai-agent-conditional":
          return aiAgentConditionalPorts(config, spec);
        case "info-extractor-mode":
          return infoExtractorModePorts(config, spec);
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
  })();

  // SSOT invariant: port id 는 노드 내 고유해야 한다. 중복이 들어가면
  //  - edge 연결이 어느 포트에 붙었는지 모호해지고
  //  - 캔버스 렌더의 React key 가 중복되어 경고·DOM 재사용 오류로 이어진다.
  // 여러 출처(items × buttons, global buttons, fallback id 등) 에서 port 가
  // 합쳐질 때 실수로 충돌하는 케이스를 막기 위해 **첫 등장만 유지** 하는
  // dedupe 를 resolver 단에서 수행한다.
  return dedupeById(resolved);
}

function dedupeById(
  ports: DynamicPortDefinition[],
): DynamicPortDefinition[] {
  const seen = new Set<string>();
  const out: DynamicPortDefinition[] = [];
  for (const p of ports) {
    if (!p.id || seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
  }
  return out;
}
