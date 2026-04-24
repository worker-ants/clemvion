import type {
  DynamicPortsSpec,
  NodePort,
} from '../../../nodes/core/node-component.interface';
import type { NodeDefinitionView } from '../../../nodes/core/node-component.registry';

/**
 * Backend mirror of `frontend/src/lib/node-definitions/resolve-dynamic-ports.ts`.
 *
 * Purpose: the assistant's self-review needs to know which output ports are
 * *actually* exposed on the canvas by each node's current config — this is what
 * the user sees and what `add_edge` can legitimately attach to. The frontend
 * resolver owns the canonical rules; we replicate them here so review can flag
 * dangling ports without the backend importing UI code. The two copies must
 * stay in lockstep — regression is covered by `resolve-dynamic-ports.spec.ts`
 * mirroring the frontend fixtures.
 *
 * Difference vs frontend: every returned port carries `isUserConfigured`. Ports
 * derived from user-written arrays (switch.cases, carousel.buttons,
 * ai_agent.conditions, etc.) are **strong** — leaving them unconnected is a
 * dead click. Default / error / fallback / continue ports are **weak** — the
 * framework synthesizes them regardless of config, and they're legitimately
 * left disconnected for terminal flows. Only strong ports participate in the
 * `DANGLING_OUTPUT_PORTS` review check.
 */
export type ResolvedPortType = 'data' | 'system' | 'error' | 'control';

export interface ResolvedPort {
  id: string;
  label: string;
  type: ResolvedPortType;
  /**
   * True when the port was generated from a user-configured array entry
   * (e.g. a specific button the user added). These ports represent choices
   * the end user will see — leaving them unconnected produces dead ends.
   * False for framework-synthesized ports (error / default / fallback /
   * continue / static defaults) which may be intentionally unconnected.
   */
  isUserConfigured: boolean;
}

type CaseEntry = { id?: string; label?: string };
type CategoryEntry = { name?: string };
type ConditionEntry = { id?: string; label?: string };
type ButtonEntry = { id?: string; label?: string; type?: string };
type CarouselItem = { title?: string; buttons?: ButtonEntry[] };

function parallelBranchPorts(config: Record<string, unknown>): ResolvedPort[] {
  const raw = typeof config.branchCount === 'number' ? config.branchCount : 2;
  const branchCount = Math.max(2, Math.min(16, Math.floor(raw)));
  const branches: ResolvedPort[] = Array.from(
    { length: branchCount },
    (_, i) => ({
      id: `branch_${i}`,
      label: `Branch ${i}`,
      type: 'data',
      isUserConfigured: true,
    }),
  );
  return [
    ...branches,
    { id: 'done', label: 'Done', type: 'data', isUserConfigured: false },
  ];
}

function switchPorts(config: Record<string, unknown>): ResolvedPort[] {
  const cases = (config.cases as CaseEntry[] | undefined) ?? [];
  const casePorts = cases.map<ResolvedPort>((c, i) => ({
    // trim() 로 공백만 담긴 id (e.g. ' ') 는 truthy 여도 fallback 발동.
    id: typeof c.id === 'string' && c.id.trim().length > 0 ? c.id : `case_${i}`,
    label: c.label || 'Case',
    type: 'data',
    isUserConfigured: true,
  }));
  return [
    ...casePorts,
    { id: 'default', label: 'Default', type: 'data', isUserConfigured: false },
  ];
}

function classifierCategoriesPorts(
  config: Record<string, unknown>,
  spec: Extract<DynamicPortsSpec, { kind: 'classifier-categories' }>,
): ResolvedPort[] {
  const categories = (config.categories as CategoryEntry[] | undefined) ?? [];
  const catPorts = categories.map<ResolvedPort>((c, i) => ({
    id: `class_${i}`,
    label: c.name || `Category ${i + 1}`,
    type: 'data',
    isUserConfigured: true,
  }));
  return [
    ...catPorts,
    {
      id: spec.fallbackId,
      label: 'Fallback',
      type: 'data',
      isUserConfigured: false,
    },
    {
      id: spec.errorId,
      label: 'Error',
      type: 'error',
      isUserConfigured: false,
    },
  ];
}

function infoExtractorModePorts(
  config: Record<string, unknown>,
  spec: Extract<DynamicPortsSpec, { kind: 'info-extractor-mode' }>,
): ResolvedPort[] {
  const mode = config[spec.modeField] as string | undefined;
  const isMultiTurn = mode === spec.multiTurnValue;

  if (isMultiTurn) {
    return [
      {
        id: 'completed',
        label: 'Completed',
        type: 'system',
        isUserConfigured: false,
      },
      {
        id: 'user_ended',
        label: 'User Ended',
        type: 'system',
        isUserConfigured: false,
      },
      {
        id: 'max_turns',
        label: 'Max Turns',
        type: 'system',
        isUserConfigured: false,
      },
      { id: 'error', label: 'Error', type: 'error', isUserConfigured: false },
    ];
  }
  return [
    { id: 'out', label: 'Output', type: 'system', isUserConfigured: false },
    { id: 'error', label: 'Error', type: 'error', isUserConfigured: false },
  ];
}

function aiAgentConditionalPorts(
  config: Record<string, unknown>,
  spec: Extract<DynamicPortsSpec, { kind: 'ai-agent-conditional' }>,
): ResolvedPort[] {
  const conditions =
    (config[spec.conditionsField] as ConditionEntry[] | undefined) ?? [];
  const condPorts = conditions.map<ResolvedPort>((c, i) => ({
    id: typeof c.id === 'string' && c.id.length > 0 ? c.id : `cond_${i}`,
    label: c.label || 'Condition',
    type: 'data',
    isUserConfigured: true,
  }));
  const mode = config[spec.modeField] as string | undefined;
  const isMultiTurn = mode === spec.multiTurnValue;

  if (condPorts.length === 0) {
    if (isMultiTurn) {
      return [
        {
          id: 'user_ended',
          label: 'User Ended',
          type: 'system',
          isUserConfigured: false,
        },
        {
          id: 'max_turns',
          label: 'Max Turns',
          type: 'system',
          isUserConfigured: false,
        },
        { id: 'error', label: 'Error', type: 'error', isUserConfigured: false },
      ];
    }
    return [
      { id: 'out', label: 'Output', type: 'system', isUserConfigured: false },
      { id: 'error', label: 'Error', type: 'error', isUserConfigured: false },
    ];
  }

  if (isMultiTurn) {
    return [
      ...condPorts,
      {
        id: 'user_ended',
        label: 'User Ended',
        type: 'system',
        isUserConfigured: false,
      },
      {
        id: 'max_turns',
        label: 'Max Turns',
        type: 'system',
        isUserConfigured: false,
      },
      { id: 'error', label: 'Error', type: 'error', isUserConfigured: false },
    ];
  }
  return [
    ...condPorts,
    { id: 'out', label: 'Output', type: 'system', isUserConfigured: false },
    { id: 'error', label: 'Error', type: 'error', isUserConfigured: false },
  ];
}

function presentationButtonPorts(
  config: Record<string, unknown>,
  spec: Extract<DynamicPortsSpec, { kind: 'presentation-buttons' }>,
  fallbackOutputs: NodePort[],
): ResolvedPort[] {
  const globalButtons = (config.buttons as ButtonEntry[] | undefined) ?? [];
  const portDefs: ResolvedPort[] = [];

  const resolveButtonId = (b: ButtonEntry, fallback: string): string =>
    typeof b.id === 'string' && b.id.length > 0 ? b.id : fallback;

  if (spec.supportsItems) {
    if (config.mode === 'static' && Array.isArray(config.items)) {
      const items = config.items as CarouselItem[];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.buttons) continue;
        for (let j = 0; j < item.buttons.length; j++) {
          const b = item.buttons[j];
          if (b.type !== 'port') continue;
          portDefs.push({
            id: resolveButtonId(b, `items_${i}_btn_${j}`),
            label: b.label || 'Button',
            type: 'data',
            isUserConfigured: true,
          });
        }
      }
    }
  }
  if (spec.supportsItemButtons && Array.isArray(config.itemButtons)) {
    const itemButtons = config.itemButtons as ButtonEntry[];
    for (let i = 0; i < itemButtons.length; i++) {
      const b = itemButtons[i];
      if (b.type !== 'port') continue;
      portDefs.push({
        id: resolveButtonId(b, `itemBtn_${i}`),
        label: b.label || 'Button',
        type: 'data',
        isUserConfigured: true,
      });
    }
  }

  for (let i = 0; i < globalButtons.length; i++) {
    const b = globalButtons[i];
    if (b.type !== 'port') continue;
    portDefs.push({
      id: resolveButtonId(b, `btn_${i}`),
      label: b.label || 'Button',
      type: 'data',
      isUserConfigured: true,
    });
  }

  if (portDefs.length > 0) return portDefs;

  // No port-type buttons — `continue` is a framework-synthesized fallback
  // when the node only has link-type buttons, or static defaults otherwise.
  const itemsHaveLink =
    !!spec.supportsItems &&
    config.mode === 'static' &&
    Array.isArray(config.items) &&
    (config.items as CarouselItem[]).some((item) =>
      item.buttons?.some((b) => b.type === 'link'),
    );
  const itemButtonsHaveLink =
    !!spec.supportsItemButtons &&
    Array.isArray(config.itemButtons) &&
    (config.itemButtons as ButtonEntry[]).some((b) => b.type === 'link');
  const globalHasLink = globalButtons.some((b) => b.type === 'link');

  if (globalHasLink || itemButtonsHaveLink || itemsHaveLink) {
    return [
      {
        id: spec.continueId,
        label: 'Continue',
        type: 'data',
        isUserConfigured: false,
      },
    ];
  }

  return fallbackOutputs.map((p) => ({
    id: p.id,
    label: p.label,
    type: p.type as ResolvedPortType,
    isUserConfigured: false,
  }));
}

/**
 * Compute the effective output ports for a node instance, mirroring the
 * frontend resolver. Returns deduped ports; `isUserConfigured` distinguishes
 * user-authored entries (strong) from framework-synthesized ones (weak).
 */
export function resolveEffectiveOutputPorts(
  config: Record<string, unknown>,
  def: NodeDefinitionView,
): ResolvedPort[] {
  const spec = def.metadata.dynamicPorts;
  const staticOutputs = def.ports.outputs;

  const resolved: ResolvedPort[] = (() => {
    if (spec) {
      switch (spec.kind) {
        case 'switch-cases':
          return switchPorts(config);
        case 'classifier-categories':
          return classifierCategoriesPorts(config, spec);
        case 'ai-agent-conditional':
          return aiAgentConditionalPorts(config, spec);
        case 'info-extractor-mode':
          return infoExtractorModePorts(config, spec);
        case 'presentation-buttons':
          return presentationButtonPorts(config, spec, staticOutputs);
        case 'parallel-branches':
          return parallelBranchPorts(config);
      }
    }
    return staticOutputs.map((p) => ({
      id: p.id,
      label: p.label,
      type: p.type as ResolvedPortType,
      isUserConfigured: false,
    }));
  })();

  return dedupeById(resolved);
}

function dedupeById(ports: ResolvedPort[]): ResolvedPort[] {
  const seen = new Set<string>();
  const out: ResolvedPort[] = [];
  for (const p of ports) {
    if (!p.id || seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
  }
  return out;
}
