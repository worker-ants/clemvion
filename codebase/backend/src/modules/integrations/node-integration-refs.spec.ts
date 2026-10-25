import { z } from 'zod';
import { ALL_NODE_COMPONENTS } from '../../nodes/index';
import {
  INTEGRATION_ID_REF_NODE_TYPES,
  MCP_SERVER_REF_NODE_TYPES,
  changedNodeIntegrationRefs,
  clearNodeIntegrationRefs,
  extractNodeIntegrationRefs,
} from './node-integration-refs';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';

describe('extractNodeIntegrationRefs — 통합 참조의 자리', () => {
  it.each([...INTEGRATION_ID_REF_NODE_TYPES].filter((t) => t !== 'http_request'))(
    '%s 는 config.integrationId 를 본다',
    (type) => {
      expect(extractNodeIntegrationRefs(type, { integrationId: A })).toEqual([
        { field: 'config.integrationId', integrationId: A, expression: false },
      ]);
    },
  );

  it.each<[string, unknown, number]>([
    ['integration', 'integration', 1],
    ['none', 'none', 0],
    ['basic', 'basic', 0],
    ['값 없음', undefined, 0],
  ])(
    'http_request 는 authentication=%s 이면 참조 %i 개',
    (_label, authentication, count) => {
      expect(
        extractNodeIntegrationRefs('http_request', {
          authentication,
          integrationId: A,
        }),
      ).toHaveLength(count);
    },
  );

  it('ai_agent 는 MCP 서버 항목마다 본다(순서는 비우기 전 첨자)', () => {
    expect(
      extractNodeIntegrationRefs('ai_agent', {
        integrationId: C,
        mcpServers: [
          { integrationId: A, enabledTools: ['x'] },
          'not-an-object',
          { integrationId: '{{ $var.server }}' },
          { integrationId: '' },
        ],
      }),
    ).toEqual([
      {
        field: 'config.mcpServers[0].integrationId',
        integrationId: A,
        expression: false,
      },
      {
        field: 'config.mcpServers[2].integrationId',
        integrationId: '{{ $var.server }}',
        expression: true,
      },
    ]);
  });

  it('MCP 서버 목록 자체가 표현식이면 항목을 알 수 없어 참조가 없다', () => {
    expect(
      extractNodeIntegrationRefs('ai_agent', {
        mcpServers: '{{ $var.servers }}',
      }),
    ).toEqual([]);
  });

  it.each<[string, unknown]>([
    ['키 없음', undefined],
    ['null', null],
    ['빈 문자열', ''],
  ])('고르지 않은 자리(%s)는 참조가 아니다', (_label, integrationId) => {
    expect(
      extractNodeIntegrationRefs('send_email', { integrationId }),
    ).toEqual([]);
  });

  it('문자열이 아닌 값은 어느 통합도 가리키지 못하는 참조다', () => {
    expect(extractNodeIntegrationRefs('cafe24', { integrationId: 42 })).toEqual(
      [{ field: 'config.integrationId', integrationId: null, expression: false }],
    );
  });

  it('통합을 참조하지 않는 노드와 객체가 아닌 config 는 참조가 없다', () => {
    expect(extractNodeIntegrationRefs('code', { integrationId: A })).toEqual([]);
    expect(extractNodeIntegrationRefs('send_email', null)).toEqual([]);
  });
});

describe('changedNodeIntegrationRefs — 새로 넣거나 바꾼 참조만', () => {
  it('저장된 노드가 없으면 모든 참조가 새 참조다', () => {
    expect(
      changedNodeIntegrationRefs('send_email', { integrationId: A }, undefined),
    ).toHaveLength(1);
  });

  it('config.integrationId 가 같으면 보지 않고 다르면 본다', () => {
    const stored = { type: 'send_email', config: { integrationId: A } };
    expect(
      changedNodeIntegrationRefs('send_email', { integrationId: A }, stored),
    ).toEqual([]);
    expect(
      changedNodeIntegrationRefs('send_email', { integrationId: B }, stored),
    ).toEqual([
      { field: 'config.integrationId', integrationId: B, expression: false },
    ]);
  });

  it('http_request 가 authentication 을 integration 으로 바꾸면 남아 있던 값도 바뀐 참조다', () => {
    const stored = {
      type: 'http_request',
      config: { authentication: 'none', integrationId: A },
    };
    expect(
      changedNodeIntegrationRefs(
        'http_request',
        { authentication: 'integration', integrationId: A },
        stored,
      ),
    ).toHaveLength(1);
  });

  it('MCP 서버는 integrationId 집합을 비교하고 순서는 보지 않는다', () => {
    const stored = {
      type: 'ai_agent',
      config: { mcpServers: [{ integrationId: A }, { integrationId: B }] },
    };
    expect(
      changedNodeIntegrationRefs(
        'ai_agent',
        { mcpServers: [{ integrationId: B }, { integrationId: A }] },
        stored,
      ),
    ).toEqual([]);
    expect(
      changedNodeIntegrationRefs(
        'ai_agent',
        {
          mcpServers: [
            { integrationId: B },
            { integrationId: C },
            { integrationId: A },
          ],
        },
        stored,
      ),
    ).toEqual([
      {
        field: 'config.mcpServers[1].integrationId',
        integrationId: C,
        expression: false,
      },
    ]);
  });
});

describe('clearNodeIntegrationRefs — 비울 때', () => {
  it('config.integrationId 는 키를 지운다', () => {
    expect(
      clearNodeIntegrationRefs(
        { integrationId: A, subject: 's' },
        new Set(['config.integrationId']),
      ),
    ).toEqual({ subject: 's' });
  });

  it('MCP 서버 항목은 노출 도구 목록 · 토글과 함께 항목째 뺀다', () => {
    expect(
      clearNodeIntegrationRefs(
        {
          mcpServers: [
            { integrationId: A, enabledTools: ['x'], includeResources: false },
            { integrationId: B },
            { integrationId: C, enabledTools: ['y'] },
          ],
        },
        new Set([
          'config.mcpServers[0].integrationId',
          'config.mcpServers[2].integrationId',
        ]),
      ),
    ).toEqual({ mcpServers: [{ integrationId: B }] });
  });

  it('입력을 바꾸지 않는다', () => {
    const config = { integrationId: A, mcpServers: [{ integrationId: B }] };
    clearNodeIntegrationRefs(
      config,
      new Set(['config.integrationId', 'config.mcpServers[0].integrationId']),
    );
    expect(config).toEqual({
      integrationId: A,
      mcpServers: [{ integrationId: B }],
    });
  });
});

/**
 * 목록은 손으로 관리하므로 노드 스키마의 위젯 표시와 대조한다(CLE-PLAT-DATA 「참조의 소속」). 새 노드가 `integration-selector`
 * 나 `mcp-server-selector` 를 달면 이 테스트가 실패하고, 그때 `node-integration-refs.ts` 와 스펙 목록에 그 자리를 더한다.
 */
describe('통합 참조 목록 ↔ 노드 스키마 위젯', () => {
  interface JsonSchemaNode {
    properties?: Record<string, JsonSchemaNode>;
    items?: JsonSchemaNode | JsonSchemaNode[];
    anyOf?: JsonSchemaNode[];
    oneOf?: JsonSchemaNode[];
    allOf?: JsonSchemaNode[];
    ui?: { widget?: string };
  }

  const SELECTOR_WIDGETS = new Set(['integration-selector', 'mcp-server-selector']);

  function selectorFields(schema: JsonSchemaNode, path = ''): string[] {
    const found: string[] = [];
    const widget = schema.ui?.widget;
    if (widget && SELECTOR_WIDGETS.has(widget)) found.push(`${widget}:${path}`);
    for (const [key, child] of Object.entries(schema.properties ?? {})) {
      found.push(...selectorFields(child, path ? `${path}.${key}` : key));
    }
    const items = Array.isArray(schema.items)
      ? schema.items
      : schema.items
        ? [schema.items]
        : [];
    for (const child of [
      ...items,
      ...(schema.anyOf ?? []),
      ...(schema.oneOf ?? []),
      ...(schema.allOf ?? []),
    ]) {
      found.push(...selectorFields(child, path));
    }
    return found;
  }

  it('위젯이 붙은 필드가 목록의 자리와 같다', () => {
    const fromSchemas = ALL_NODE_COMPONENTS.flatMap((component) =>
      selectorFields(
        z.toJSONSchema(component.configSchema) as JsonSchemaNode,
      ).map((field) => `${component.metadata.type} ${field}`),
    ).sort();
    const fromList = [
      ...[...INTEGRATION_ID_REF_NODE_TYPES].map(
        (type) => `${type} integration-selector:integrationId`,
      ),
      ...[...MCP_SERVER_REF_NODE_TYPES].map(
        (type) => `${type} mcp-server-selector:mcpServers`,
      ),
    ].sort();
    expect(fromSchemas).toEqual(fromList);
  });
});
