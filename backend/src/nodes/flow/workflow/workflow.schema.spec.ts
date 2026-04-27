import { evaluateWarnings } from '@workflow/node-summary';
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
  it('emits the Korean warning when no workflow is selected', () => {
    expect(evaluateMetadataBlockingErrors(workflowNodeMetadata, {})).toContain(
      '실행할 워크플로우를 선택해야 합니다.',
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
    expect(errors).toContain('실행할 워크플로우를 선택해야 합니다.');
    expect(errors).toContain(
      'timeout must be a non-negative number (0 = no timeout)',
    );
  });
});
