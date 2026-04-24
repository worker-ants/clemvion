import { resolveEffectiveOutputPorts } from './resolve-dynamic-ports';
import type { NodeDefinitionView } from '../../../nodes/core/node-component.registry';
import type {
  DynamicPortsSpec,
  NodeComponentMetadata,
  NodePorts,
} from '../../../nodes/core/node-component.interface';

/**
 * These tests mirror `frontend/src/lib/node-definitions/resolve-dynamic-ports.*.spec`
 * for each DynamicPortsSpec kind. The backend resolver must match the canvas's
 * behavior — otherwise the review guard would flag ports the UI doesn't show
 * (false positives) or miss ports the UI does show (false negatives).
 *
 * Additionally asserts the `isUserConfigured` flag, which the review guard
 * uses to skip framework-synthesized ports (error / default / fallback /
 * continue / static defaults).
 */
function makeDef(
  type: string,
  opts: {
    dynamicPorts?: DynamicPortsSpec;
    outputs?: NodePorts['outputs'];
  } = {},
): NodeDefinitionView {
  const metadata: NodeComponentMetadata = {
    type,
    category: 'logic',
    label: type,
    description: '',
    icon: 'Box',
    color: '#000',
    ...(opts.dynamicPorts ? { dynamicPorts: opts.dynamicPorts } : {}),
  };
  return {
    metadata,
    ports: {
      inputs: [{ id: 'in', label: 'Input', type: 'data' }],
      outputs: opts.outputs ?? [{ id: 'out', label: 'Output', type: 'data' }],
    },
    configSchema: {},
    defaultConfig: {},
  };
}

describe('resolveEffectiveOutputPorts', () => {
  describe('switch-cases', () => {
    it('emits one port per case plus a weak default', () => {
      const def = makeDef('switch', { dynamicPorts: { kind: 'switch-cases' } });
      const ports = resolveEffectiveOutputPorts(
        {
          cases: [
            { id: 'case_korean', label: '한식' },
            { id: 'case_western', label: '양식' },
          ],
        },
        def,
      );
      expect(ports).toEqual([
        {
          id: 'case_korean',
          label: '한식',
          type: 'data',
          isUserConfigured: true,
        },
        {
          id: 'case_western',
          label: '양식',
          type: 'data',
          isUserConfigured: true,
        },
        {
          id: 'default',
          label: 'Default',
          type: 'data',
          isUserConfigured: false,
        },
      ]);
    });

    it('falls back to case_${i} when id is missing, keeping the port user-configured', () => {
      const def = makeDef('switch', { dynamicPorts: { kind: 'switch-cases' } });
      const ports = resolveEffectiveOutputPorts(
        { cases: [{ label: 'A' }, { label: 'B' }] },
        def,
      );
      expect(ports.slice(0, 2)).toEqual([
        { id: 'case_0', label: 'A', type: 'data', isUserConfigured: true },
        { id: 'case_1', label: 'B', type: 'data', isUserConfigured: true },
      ]);
    });

    it('falls back to case_${i} when id is whitespace-only (truthy edge)', () => {
      const def = makeDef('switch', { dynamicPorts: { kind: 'switch-cases' } });
      const ports = resolveEffectiveOutputPorts(
        {
          cases: [
            { id: '  ', label: 'A' },
            { id: '\t', label: 'B' },
          ],
        },
        def,
      );
      expect(ports.slice(0, 2).map((p) => p.id)).toEqual(['case_0', 'case_1']);
    });

    it('returns only the default port when cases is empty', () => {
      const def = makeDef('switch', { dynamicPorts: { kind: 'switch-cases' } });
      const ports = resolveEffectiveOutputPorts({ cases: [] }, def);
      expect(ports).toEqual([
        {
          id: 'default',
          label: 'Default',
          type: 'data',
          isUserConfigured: false,
        },
      ]);
    });
  });

  describe('presentation-buttons (carousel)', () => {
    const def = makeDef('carousel', {
      dynamicPorts: {
        kind: 'presentation-buttons',
        supportsItems: true,
        supportsItemButtons: true,
        continueId: 'continue',
      },
    });

    it('static mode: one port per item button of type "port"', () => {
      const ports = resolveEffectiveOutputPorts(
        {
          mode: 'static',
          items: [
            {
              title: '한식',
              buttons: [
                { id: 'btn_bibimbap', label: '비빔밥', type: 'port' },
                { id: 'btn_bulgogi', label: '불고기', type: 'port' },
              ],
            },
            {
              title: '양식',
              buttons: [{ id: 'btn_pasta', label: '파스타', type: 'port' }],
            },
          ],
        },
        def,
      );
      expect(ports.map((p) => p.id)).toEqual([
        'btn_bibimbap',
        'btn_bulgogi',
        'btn_pasta',
      ]);
      expect(ports.every((p) => p.isUserConfigured)).toBe(true);
    });

    it('dynamic mode: itemButtons + global buttons all become strong ports', () => {
      const ports = resolveEffectiveOutputPorts(
        {
          mode: 'dynamic',
          itemButtons: [{ id: 'btn_detail', label: '상세', type: 'port' }],
          buttons: [{ id: 'btn_back', label: '돌아가기', type: 'port' }],
        },
        def,
      );
      expect(ports.map((p) => p.id)).toEqual(['btn_detail', 'btn_back']);
      expect(ports.every((p) => p.isUserConfigured)).toBe(true);
    });

    it('ignores link-type buttons and falls back to `continue` (weak) when only link buttons exist', () => {
      const ports = resolveEffectiveOutputPorts(
        {
          mode: 'static',
          items: [
            {
              title: '상품',
              buttons: [{ label: 'Go', type: 'link', url: 'https://x' }],
            },
          ],
        },
        def,
      );
      expect(ports).toEqual([
        {
          id: 'continue',
          label: 'Continue',
          type: 'data',
          isUserConfigured: false,
        },
      ]);
    });

    it('deduplicates colliding port ids (first wins)', () => {
      const ports = resolveEffectiveOutputPorts(
        {
          mode: 'static',
          items: [
            {
              title: 'A',
              buttons: [{ id: 'btn_x', label: 'First', type: 'port' }],
            },
          ],
          buttons: [{ id: 'btn_x', label: 'Second', type: 'port' }],
        },
        def,
      );
      expect(ports).toHaveLength(1);
      expect(ports[0].label).toBe('First');
    });

    it('no buttons at all: returns static fallback outputs as weak ports', () => {
      const ports = resolveEffectiveOutputPorts({}, def);
      expect(ports).toEqual([
        { id: 'out', label: 'Output', type: 'data', isUserConfigured: false },
      ]);
    });
  });

  describe('ai-agent-conditional', () => {
    const def = makeDef('ai_agent', {
      dynamicPorts: {
        kind: 'ai-agent-conditional',
        modeField: 'mode',
        conditionsField: 'conditions',
        multiTurnValue: 'multi_turn',
      },
    });

    it('single_turn + conditions: each cond port strong, `out` and `error` weak', () => {
      const ports = resolveEffectiveOutputPorts(
        {
          mode: 'single_turn',
          conditions: [
            { id: 'cond_refund', label: '환불' },
            { id: 'cond_exchange', label: '교환' },
          ],
        },
        def,
      );
      expect(ports).toEqual([
        {
          id: 'cond_refund',
          label: '환불',
          type: 'data',
          isUserConfigured: true,
        },
        {
          id: 'cond_exchange',
          label: '교환',
          type: 'data',
          isUserConfigured: true,
        },
        { id: 'out', label: 'Output', type: 'system', isUserConfigured: false },
        { id: 'error', label: 'Error', type: 'error', isUserConfigured: false },
      ]);
    });

    it('multi_turn + conditions: cond ports strong, multi_turn system ports weak', () => {
      // condPorts 경로 + multi_turn 분기가 동시에 타는 케이스 — `if (isMultiTurn)`
      // 뒤 `[...condPorts, user_ended, max_turns, error]` 합성이 실제로 테스트됨.
      const ports = resolveEffectiveOutputPorts(
        {
          mode: 'multi_turn',
          conditions: [
            { id: 'cond_refund', label: '환불' },
            { id: 'cond_exchange', label: '교환' },
          ],
        },
        def,
      );
      expect(ports.map((p) => p.id)).toEqual([
        'cond_refund',
        'cond_exchange',
        'user_ended',
        'max_turns',
        'error',
      ]);
      expect(ports.slice(0, 2).every((p) => p.isUserConfigured)).toBe(true);
      expect(ports.slice(2).every((p) => !p.isUserConfigured)).toBe(true);
    });

    it('multi_turn + no conditions: only system ports (all weak)', () => {
      const ports = resolveEffectiveOutputPorts(
        { mode: 'multi_turn', conditions: [] },
        def,
      );
      expect(ports.map((p) => p.id)).toEqual([
        'user_ended',
        'max_turns',
        'error',
      ]);
      expect(ports.every((p) => !p.isUserConfigured)).toBe(true);
    });
  });

  describe('classifier-categories', () => {
    const def = makeDef('text_classifier', {
      dynamicPorts: {
        kind: 'classifier-categories',
        fallbackId: 'fallback',
        errorId: 'error',
      },
    });

    it('each category is strong; fallback / error are weak', () => {
      const ports = resolveEffectiveOutputPorts(
        { categories: [{ name: 'Positive' }, { name: 'Negative' }] },
        def,
      );
      expect(
        ports.map((p) => ({ id: p.id, strong: p.isUserConfigured })),
      ).toEqual([
        { id: 'class_0', strong: true },
        { id: 'class_1', strong: true },
        { id: 'fallback', strong: false },
        { id: 'error', strong: false },
      ]);
    });
  });

  describe('info-extractor-mode', () => {
    const def = makeDef('information_extractor', {
      dynamicPorts: {
        kind: 'info-extractor-mode',
        modeField: 'mode',
        multiTurnValue: 'multi_turn',
      },
    });

    it('single turn: `out` and `error` (weak)', () => {
      const ports = resolveEffectiveOutputPorts({ mode: 'single_turn' }, def);
      expect(ports.every((p) => !p.isUserConfigured)).toBe(true);
      expect(ports.map((p) => p.id)).toEqual(['out', 'error']);
    });

    it('multi turn: completed / user_ended / max_turns / error (weak)', () => {
      const ports = resolveEffectiveOutputPorts({ mode: 'multi_turn' }, def);
      expect(ports.every((p) => !p.isUserConfigured)).toBe(true);
      expect(ports.map((p) => p.id)).toEqual([
        'completed',
        'user_ended',
        'max_turns',
        'error',
      ]);
    });
  });

  describe('parallel-branches', () => {
    const def = makeDef('parallel', {
      dynamicPorts: { kind: 'parallel-branches' },
    });

    it('emits strong branches + weak done port', () => {
      const ports = resolveEffectiveOutputPorts({ branchCount: 3 }, def);
      expect(ports.map((p) => p.id)).toEqual([
        'branch_0',
        'branch_1',
        'branch_2',
        'done',
      ]);
      expect(ports.slice(0, 3).every((p) => p.isUserConfigured)).toBe(true);
      expect(ports[3].isUserConfigured).toBe(false);
    });

    it('clamps branchCount to [2, 16]', () => {
      expect(
        resolveEffectiveOutputPorts({ branchCount: 100 }, def),
      ).toHaveLength(17);
      expect(resolveEffectiveOutputPorts({ branchCount: 1 }, def)).toHaveLength(
        3,
      );
    });
  });

  describe('no dynamicPorts (static)', () => {
    it('returns static outputs as weak ports', () => {
      const def = makeDef('http_request', {
        outputs: [
          { id: 'out', label: 'Output', type: 'data' },
          { id: 'error', label: 'Error', type: 'error' },
        ],
      });
      const ports = resolveEffectiveOutputPorts({}, def);
      expect(ports).toEqual([
        { id: 'out', label: 'Output', type: 'data', isUserConfigured: false },
        { id: 'error', label: 'Error', type: 'error', isUserConfigured: false },
      ]);
    });
  });
});
