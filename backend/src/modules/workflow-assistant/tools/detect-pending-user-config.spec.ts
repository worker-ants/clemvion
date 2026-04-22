import { detectPendingUserConfig } from './detect-pending-user-config';

// z.toJSONSchema() 결과를 흉내낸 최소 스키마. .meta({ ui: {...} }) 는
// toJSONSchema 가 top-level `ui` 필드로 flatten 하는 것을 이 테스트가 의존한다.
const sendEmailSchema = {
  type: 'object',
  properties: {
    integrationId: {
      type: 'string',
      ui: { label: 'Integration', widget: 'integration-selector' },
    },
    to: { type: 'array', items: { type: 'string' } },
    subject: { type: 'string', ui: { widget: 'expression' } },
  },
};

const aiAgentSchema = {
  type: 'object',
  properties: {
    llmConfigId: {
      type: 'string',
      ui: { label: 'LLM', widget: 'llm-config-selector' },
    },
    knowledgeBaseIds: {
      type: 'array',
      items: { type: 'string' },
      ui: { label: 'Knowledge Bases', widget: 'kb-selector' },
    },
    systemPrompt: { type: 'string' },
  },
};

describe('detectPendingUserConfig', () => {
  it('returns the integration field when it is empty', () => {
    const pending = detectPendingUserConfig(sendEmailSchema, { to: ['x@y.z'] });
    expect(pending).toHaveLength(1);
    expect(pending[0]).toEqual({
      field: 'integrationId',
      widget: 'integration-selector',
      label: 'Integration',
    });
  });

  it('returns nothing when the integration id is filled', () => {
    const pending = detectPendingUserConfig(sendEmailSchema, {
      integrationId: 'int-123',
      to: ['x@y.z'],
    });
    expect(pending).toEqual([]);
  });

  it('flags whitespace-only strings as empty', () => {
    const pending = detectPendingUserConfig(sendEmailSchema, {
      integrationId: '   ',
    });
    expect(pending).toHaveLength(1);
    expect(pending[0].field).toBe('integrationId');
  });

  it('flags empty arrays as empty for kb-selector', () => {
    const pending = detectPendingUserConfig(aiAgentSchema, {
      llmConfigId: 'cfg-1',
      knowledgeBaseIds: [],
    });
    expect(pending).toHaveLength(1);
    expect(pending[0].field).toBe('knowledgeBaseIds');
    expect(pending[0].widget).toBe('kb-selector');
  });

  it('returns multiple pending fields when several selectors are empty', () => {
    const pending = detectPendingUserConfig(aiAgentSchema, {});
    const fields = pending.map((p) => p.field).sort();
    expect(fields).toEqual(['knowledgeBaseIds', 'llmConfigId']);
  });

  it('ignores non user-action widgets like expression', () => {
    const pending = detectPendingUserConfig(sendEmailSchema, {});
    // subject 는 `widget: 'expression'` 이라 user-action 이 아니다.
    // integrationId 만 남는다.
    expect(pending.map((p) => p.field)).toEqual(['integrationId']);
  });

  it('handles missing / malformed schemas gracefully', () => {
    expect(detectPendingUserConfig(undefined, {})).toEqual([]);
    expect(detectPendingUserConfig({ type: 'string' }, {})).toEqual([]);
    expect(detectPendingUserConfig({ properties: {} }, {})).toEqual([]);
  });

  it('falls back to a humanized field name when label is missing', () => {
    const schema = {
      type: 'object',
      properties: {
        workflowId: { type: 'string', ui: { widget: 'workflow-selector' } },
      },
    };
    const pending = detectPendingUserConfig(schema, {});
    expect(pending[0].label).toBe('Workflow Id');
  });
});
