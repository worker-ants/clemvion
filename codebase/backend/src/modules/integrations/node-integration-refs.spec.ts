import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { ALL_NODE_COMPONENTS } from '../../nodes/index';
import {
  INTEGRATION_ID_FIELD,
  INTEGRATION_ID_REF_NODE_TYPES,
  MCP_SERVER_REF_NODE_TYPES,
  changedNodeIntegrationRefs,
  clearNodeIntegrationRefs,
  extractNodeIntegrationRefs,
  mcpServerRefField,
} from './node-integration-refs';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';

describe('extractNodeIntegrationRefs — 통합 참조의 자리', () => {
  it.each(
    [...INTEGRATION_ID_REF_NODE_TYPES].filter((t) => t !== 'http_request'),
  )('%s 는 config.integrationId 를 본다', (type) => {
    expect(extractNodeIntegrationRefs(type, { integrationId: A })).toEqual([
      {
        kind: 'integrationId',
        field: 'config.integrationId',
        integrationId: A,
        expression: false,
      },
    ]);
  });

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
        kind: 'mcpServer',
        field: 'config.mcpServers[0].integrationId',
        integrationId: A,
        expression: false,
      },
      {
        kind: 'mcpServer',
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
    expect(extractNodeIntegrationRefs('send_email', { integrationId })).toEqual(
      [],
    );
  });

  it('문자열이 아닌 값은 어느 통합도 가리키지 못하는 참조다', () => {
    expect(extractNodeIntegrationRefs('cafe24', { integrationId: 42 })).toEqual(
      [
        {
          kind: 'integrationId',
          field: 'config.integrationId',
          integrationId: null,
          expression: false,
        },
      ],
    );
  });

  it('통합을 참조하지 않는 노드와 객체가 아닌 config 는 참조가 없다', () => {
    expect(extractNodeIntegrationRefs('code', { integrationId: A })).toEqual(
      [],
    );
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
      {
        kind: 'integrationId',
        field: 'config.integrationId',
        integrationId: B,
        expression: false,
      },
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
        kind: 'mcpServer',
        field: 'config.mcpServers[1].integrationId',
        integrationId: C,
        expression: false,
      },
    ]);
  });

  describe('MCP 서버의 문자열이 아닌 integrationId 도 저장된 원본 값 그대로 견준다', () => {
    const storedWith = (integrationId: unknown) => ({
      type: 'ai_agent',
      config: { mcpServers: [{ integrationId }] },
    });

    it.each<[string, unknown, unknown]>([
      ['숫자 → 다른 숫자', 123, 456],
      ['숫자 → 문자열 "null"', 123, 'null'],
      ['문자열 "null" → 숫자', 'null', 123],
      ['문자열 "null" → 객체', 'null', { id: A }],
      ['객체 → 다른 객체', { id: A }, { id: B }],
      ['불리언 → 문자열 UUID', true, A],
      ['문자열 UUID → 숫자', A, 123],
    ])('%s 는 바뀐 참조다', (_label, before, after) => {
      const changed = changedNodeIntegrationRefs(
        'ai_agent',
        { mcpServers: [{ integrationId: after }] },
        storedWith(before),
      );
      expect(changed).toHaveLength(1);
      expect(changed[0]).toMatchObject({
        kind: 'mcpServer',
        field: 'config.mcpServers[0].integrationId',
      });
    });

    it.each<[string, unknown]>([
      ['숫자', 123],
      ['객체', { id: A }],
      ['문자열 "null"', 'null'],
    ])('같은 %s 값이면 바뀌지 않은 참조다', (_label, value) => {
      expect(
        changedNodeIntegrationRefs(
          'ai_agent',
          { mcpServers: [{ integrationId: value }] },
          storedWith(value),
        ),
      ).toEqual([]);
    });

    it('숫자 123 과 문자열 "123" 은 다른 값이다', () => {
      expect(
        changedNodeIntegrationRefs(
          'ai_agent',
          { mcpServers: [{ integrationId: '123' }] },
          storedWith(123),
        ),
      ).toHaveLength(1);
    });

    it('config.integrationId 갈래도 같은 기준으로 견준다', () => {
      expect(
        changedNodeIntegrationRefs(
          'send_email',
          { integrationId: '123' },
          { type: 'send_email', config: { integrationId: 123 } },
        ),
      ).toHaveLength(1);
    });

    it('정상 UUID 문자열은 바뀐 값만 돌려주고 같은 값은 건너뛴다', () => {
      const stored = storedWith(A);
      expect(
        changedNodeIntegrationRefs(
          'ai_agent',
          { mcpServers: [{ integrationId: A }] },
          stored,
        ),
      ).toEqual([]);
      expect(
        changedNodeIntegrationRefs(
          'ai_agent',
          { mcpServers: [{ integrationId: B }] },
          stored,
        ),
      ).toEqual([
        {
          kind: 'mcpServer',
          field: 'config.mcpServers[0].integrationId',
          integrationId: B,
          expression: false,
        },
      ]);
    });
  });
});

describe('참조 자리의 경로 — 응답 field 의 형식', () => {
  it('상수와 함수가 와이어 형식을 만든다', () => {
    expect(INTEGRATION_ID_FIELD).toBe('config.integrationId');
    expect(mcpServerRefField(0)).toBe('config.mcpServers[0].integrationId');
    expect(mcpServerRefField(12)).toBe('config.mcpServers[12].integrationId');
  });

  it('꺼낸 참조의 field 는 비우기가 알아보는 경로와 같다', () => {
    const config = {
      mcpServers: [{ integrationId: A }, { integrationId: B }],
    };
    const [first, second] = extractNodeIntegrationRefs('ai_agent', config);
    expect(first.field).toBe(mcpServerRefField(0));
    expect(clearNodeIntegrationRefs(config, new Set([second.field]))).toEqual({
      mcpServers: [{ integrationId: A }],
    });
    const [direct] = extractNodeIntegrationRefs('send_email', {
      integrationId: A,
    });
    expect(direct.field).toBe(INTEGRATION_ID_FIELD);
    expect(
      clearNodeIntegrationRefs(
        { integrationId: A, subject: 's' },
        new Set([direct.field]),
      ),
    ).toEqual({ subject: 's' });
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

  const SELECTOR_WIDGETS = new Set([
    'integration-selector',
    'mcp-server-selector',
  ]);

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

/**
 * 프런트엔드 에디터가 붙여넣기 · 복제에서 같은 자리의 참조를 비운다(`codebase/frontend/src/lib/integrations/
 * node-integration-refs.ts`, CLE-WF-EDITOR R-5). 두 패키지가 공유하는 모듈이 없어서 목록이 사본으로 있고, 위젯과 대조하는
 * 위 테스트는 백엔드 목록만 지킨다. 새 통합 노드를 백엔드에만 더하면 프런트 사본이 조용히 낡아 붙여넣기가 그 노드의 참조를
 * 비우지 못하고 저장이 400 으로 막힌다. 그래서 프런트 소스의 `new Set([...])` 리터럴을 읽어 백엔드 목록과 맞춘다.
 */
describe('통합 참조 목록 ↔ 프런트엔드 사본', () => {
  const frontendSource = readFileSync(
    join(
      __dirname,
      '../../../../frontend/src/lib/integrations/node-integration-refs.ts',
    ),
    'utf8',
  );

  /** `const <name> ... = new Set([ "a", "b" ])` 리터럴의 문자열 원소. 프런트가 이 모양을 바꾸면 여기서 실패한다. */
  function frontendSet(name: string): string[] {
    const literal = new RegExp(
      `const\\s+${name}\\b[^=]*=\\s*new Set\\(\\[([\\s\\S]*?)\\]\\)`,
    ).exec(frontendSource);
    if (!literal) {
      throw new Error(
        `${name} 의 new Set([...]) 리터럴을 프런트 소스에서 찾지 못했다`,
      );
    }
    return [...literal[1].matchAll(/"([a-z0-9_]+)"/g)].map((m) => m[1]);
  }

  it('config.integrationId 를 참조하는 노드 유형이 같다', () => {
    expect(frontendSet('INTEGRATION_ID_REF_NODE_TYPES').sort()).toEqual(
      [...INTEGRATION_ID_REF_NODE_TYPES].sort(),
    );
  });

  it('config.mcpServers[].integrationId 를 참조하는 노드 유형이 같다', () => {
    expect(frontendSet('MCP_SERVER_REF_NODE_TYPES').sort()).toEqual(
      [...MCP_SERVER_REF_NODE_TYPES].sort(),
    );
  });
});
