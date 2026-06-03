import {
  evaluateWarnings,
  renderSummaryTemplate,
} from '@workflow/node-summary';
import {
  workflowNodeMetadata,
  validateWorkflowConfig,
} from './workflow.schema';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';

describe('workflowNodeMetadata.warningRules', () => {
  const firedIds = (config: unknown) =>
    evaluateWarnings(
      config as Record<string, unknown>,
      workflowNodeMetadata.warningRules,
    ).map((w) => w.id);

  describe('workflow:no-workflow-selected', () => {
    it('fires when workflowId is missing', () => {
      expect(firedIds({})).toContain('workflow:no-workflow-selected');
    });

    it('fires when workflowId is empty string', () => {
      expect(firedIds({ workflowId: '' })).toContain(
        'workflow:no-workflow-selected',
      );
    });

    it('does NOT fire when workflowId is set', () => {
      expect(firedIds({ workflowId: 'wf-123' })).not.toContain(
        'workflow:no-workflow-selected',
      );
    });
  });
});

describe('workflowNodeMetadata.summaryTemplate (spec §7)', () => {
  const render = (config: Record<string, unknown>) =>
    renderSummaryTemplate(workflowNodeMetadata.summaryTemplate, config);

  it('renders "<name> · <mode>" when a workflow is selected', () => {
    expect(
      render({ workflowId: 'wf-1', workflowName: 'Checkout', mode: 'async' }),
    ).toEqual({ text: 'Checkout · async', isWarning: false });
  });

  it('falls back to workflowId when only a manual UUID is present', () => {
    // `fallback:workflowId` resolves the id *value*, not the literal string.
    expect(render({ workflowId: 'wf-1', workflowName: '' })).toEqual({
      text: '⚠ Missing workflow',
      isWarning: true,
    });
  });

  it('defaults mode to sync in the rendered body', () => {
    expect(render({ workflowId: 'wf-1', workflowName: 'Checkout' })).toEqual({
      text: 'Checkout · sync',
      isWarning: false,
    });
  });

  describe('missing-workflow badge (warnWhen)', () => {
    it('fires when workflowId is set but workflowName is empty', () => {
      expect(render({ workflowId: 'wf-1', workflowName: '' })).toEqual({
        text: '⚠ Missing workflow',
        isWarning: true,
      });
    });

    it('fires when workflowId is set but workflowName is absent', () => {
      expect(render({ workflowId: 'wf-1' })).toEqual({
        text: '⚠ Missing workflow',
        isWarning: true,
      });
    });

    it('does NOT fire when both workflowId and workflowName are set', () => {
      expect(
        render({ workflowId: 'wf-1', workflowName: 'Checkout' }).isWarning,
      ).toBe(false);
    });

    it('does NOT fire when no workflowId is set (no-workflow-selected owns that)', () => {
      expect(render({ workflowId: '' }).isWarning).toBe(false);
    });
  });
});

describe('validateWorkflowConfig (imperative)', () => {
  it('returns [] for a fully valid sync invocation', () => {
    expect(
      validateWorkflowConfig({
        workflowId: 'wf-1',
        mode: 'sync',
        timeout: 30,
        inputMapping: [{ paramName: 'p1', expression: 'x' }],
      }),
    ).toEqual([]);
  });

  it('rejects negative timeout', () => {
    expect(validateWorkflowConfig({ timeout: -1 })).toContain(
      'timeout must be a non-negative number (0 = no timeout)',
    );
  });

  it('rejects non-numeric timeout', () => {
    expect(validateWorkflowConfig({ timeout: '10' })).toContain(
      'timeout must be a non-negative number (0 = no timeout)',
    );
  });

  it('accepts timeout = 0 (no timeout)', () => {
    expect(validateWorkflowConfig({ timeout: 0 })).toEqual([]);
  });

  it('rejects non-array inputMapping', () => {
    expect(
      validateWorkflowConfig({ inputMapping: { p: 'x' } as never }),
    ).toContain('inputMapping must be an array');
  });

  it('rejects inputMapping items missing paramName', () => {
    const errors = validateWorkflowConfig({
      inputMapping: [{ paramName: '', expression: 'x' }, { expression: 'y' }],
    });
    expect(errors).toContain(
      'inputMapping[0].paramName is required and must be a string',
    );
    expect(errors).toContain(
      'inputMapping[1].paramName is required and must be a string',
    );
  });
});

describe('evaluateMetadataBlockingErrors integration (workflow)', () => {
  it('emits the warning when no workflow is selected', () => {
    expect(evaluateMetadataBlockingErrors(workflowNodeMetadata, {})).toContain(
      'Target workflow must be selected.',
    );
  });

  it('returns [] when fully configured', () => {
    expect(
      evaluateMetadataBlockingErrors(workflowNodeMetadata, {
        workflowId: 'wf-1',
      }),
    ).toEqual([]);
  });

  it('combines warningRules + validateConfig errors', () => {
    const errors = evaluateMetadataBlockingErrors(workflowNodeMetadata, {
      timeout: -5,
    });
    expect(errors).toContain('Target workflow must be selected.');
    expect(errors).toContain(
      'timeout must be a non-negative number (0 = no timeout)',
    );
  });
});
