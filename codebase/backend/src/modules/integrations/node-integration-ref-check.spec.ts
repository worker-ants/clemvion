import { BadRequestException } from '@nestjs/common';
import { integrationNotFoundError } from './integration-visibility';
import {
  type IntegrationRefCheckPath,
  INTEGRATION_REF_INVALID_MESSAGE,
  assertNodeIntegrationRefsUsable,
  clearUnusableNodeIntegrationRefs,
  findUnusableIntegrationRefs,
} from './node-integration-ref-check';
import type { NodeIntegrationRef } from './node-integration-refs';
import type { SqlRunner } from './personal-integration-use-facts';

const ORG = '11111111-1111-4111-8111-111111111111';
const PERSONAL = '22222222-2222-4222-8222-222222222222';
const MISSING = '33333333-3333-4333-8333-333333333333';
const OWNER = '44444444-4444-4444-8444-444444444444';
const OTHER = '55555555-5555-4555-8555-555555555555';

function ref(
  integrationId: string | null,
  expression = false,
): NodeIntegrationRef {
  return {
    kind: 'integrationId',
    field: 'config.integrationId',
    integrationId,
    expression,
  };
}

function makeRunner(memberIds: string[] = [OWNER]) {
  const query = jest.fn(async (sql: string, _params?: unknown[]) => {
    if (sql.includes('FROM integration')) {
      return [
        { id: ORG, scope: 'organization', created_by: OTHER },
        { id: PERSONAL, scope: 'personal', created_by: OWNER },
      ];
    }
    return memberIds.map((user_id) => ({ user_id }));
  });
  // `EntityManager.query` 는 반환형이 제네릭이라 mock 을 그대로 넘기지 못한다.
  return { query } as unknown as SqlRunner & { query: typeof query };
}

async function unusable(
  check: IntegrationRefCheckPath,
  workflowAuthorId: string | null,
  refs: NodeIntegrationRef[],
  runner = makeRunner(),
  logger = { warn: jest.fn() },
) {
  const out = await findUnusableIntegrationRefs(runner, logger, {
    workspaceId: 'ws-1',
    workflowAuthorId,
    check,
    candidates: refs.map((r, i) => ({ nodeId: `node-${i}`, ref: r })),
  });
  return out.map((c) => c.ref.integrationId);
}

describe('findUnusableIntegrationRefs', () => {
  it('조직 통합은 작성자 · 저장자와 관계없이 쓸 수 있다', async () => {
    expect(
      await unusable({ path: 'save', saverId: OTHER }, null, [ref(ORG)]),
    ).toEqual([]);
  });

  it('없는 통합과 문자열이 아닌 값은 쓸 수 없다', async () => {
    expect(
      await unusable({ path: 'clone' }, OWNER, [ref(MISSING), ref(null)]),
    ).toEqual([MISSING, null]);
  });

  it('표현식 참조는 판정하지 않고 쿼리도 보내지 않는다', async () => {
    const runner = makeRunner();
    expect(
      await unusable(
        { path: 'save', saverId: OTHER },
        OTHER,
        [ref('{{ $var.id }}', true)],
        runner,
      ),
    ).toEqual([]);
    expect(runner.query).not.toHaveBeenCalled();
  });

  it('UUID 모양이 아닌 값은 쿼리에 넣지 않고 없는 통합으로 본다', async () => {
    const runner = makeRunner();
    expect(
      await unusable({ path: 'clone' }, OWNER, [ref('not-a-uuid')], runner),
    ).toEqual(['not-a-uuid']);
    expect(runner.query).not.toHaveBeenCalled();
  });

  it.each<
    [
      string,
      IntegrationRefCheckPath,
      string | null,
      boolean,
      string | undefined,
    ]
  >([
    [
      'save: 작성자 · 저장자가 소유자',
      { path: 'save', saverId: OWNER },
      OWNER,
      true,
      undefined,
    ],
    [
      'save: 저장자가 소유자가 아님',
      { path: 'save', saverId: OTHER },
      OWNER,
      false,
      'saver_not_owner',
    ],
    [
      'save: 작성자를 알 수 없음',
      { path: 'save', saverId: OWNER },
      null,
      false,
      'workflow_author_unknown',
    ],
    ['clone: 요청자가 소유자', { path: 'clone' }, OWNER, true, undefined],
    [
      'clone: 요청자가 소유자가 아님',
      { path: 'clone' },
      OTHER,
      false,
      'workflow_author_not_owner',
    ],
    [
      'restore: 작성자가 소유자이고 멤버',
      { path: 'restore' },
      OWNER,
      true,
      undefined,
    ],
  ])('%s', async (_label, check, author, ok, reason) => {
    const logger = { warn: jest.fn() };
    const out = await unusable(
      check,
      author,
      [ref(PERSONAL)],
      makeRunner(),
      logger,
    );
    expect(out).toEqual(ok ? [] : [PERSONAL]);
    if (ok) {
      expect(logger.warn).not.toHaveBeenCalled();
    } else {
      expect(logger.warn).toHaveBeenCalledWith({
        message: 'Personal integration use rejected',
        workspaceId: 'ws-1',
        context: {
          path: check.path,
          nodeId: 'node-0',
          integrationId: PERSONAL,
          reason,
        },
      });
    }
  });

  it('restore: 소유자가 멤버가 아니면 쓸 수 없다', async () => {
    const logger = { warn: jest.fn() };
    const runner = makeRunner([]);
    expect(
      await unusable(
        { path: 'restore' },
        OWNER,
        [ref(PERSONAL)],
        runner,
        logger,
      ),
    ).toEqual([PERSONAL]);
    expect(runner.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM workspace_member'),
      ['ws-1', [OWNER]],
    );
    expect(logger.warn.mock.calls[0][0].context.reason).toBe(
      'owner_not_member',
    );
  });

  it('save · clone 은 멤버십을 읽지 않는다', async () => {
    const runner = makeRunner();
    await unusable(
      { path: 'save', saverId: OWNER },
      OWNER,
      [ref(PERSONAL)],
      runner,
    );
    await unusable({ path: 'clone' }, OWNER, [ref(PERSONAL)], runner);
    expect(
      runner.query.mock.calls.filter(([sql]) =>
        sql.includes('FROM workspace_member'),
      ),
    ).toEqual([]);
  });

  it('통합 조회는 워크스페이스로 거른다', async () => {
    const runner = makeRunner();
    await unusable({ path: 'clone' }, OWNER, [ref(ORG), ref(PERSONAL)], runner);
    expect(runner.query).toHaveBeenCalledWith(
      expect.stringContaining('workspace_id = $2'),
      [[ORG, PERSONAL], 'ws-1'],
    );
  });
});

describe('assertNodeIntegrationRefsUsable', () => {
  it('바뀐 참조 가운데 쓸 수 없는 것을 모두 모아 400 으로 거절한다', async () => {
    const logger = { warn: jest.fn() };
    const error = await assertNodeIntegrationRefsUsable(makeRunner(), logger, {
      workspaceId: 'ws-1',
      workflowAuthorId: OWNER,
      saverId: OTHER,
      nodes: [
        {
          nodeId: 'n-1',
          type: 'send_email',
          config: { integrationId: PERSONAL },
          fieldPrefix: 'nodes[0].',
        },
        {
          nodeId: 'n-2',
          type: 'ai_agent',
          config: {
            mcpServers: [{ integrationId: ORG }, { integrationId: MISSING }],
          },
          fieldPrefix: 'nodes[1].',
        },
      ],
    }).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getResponse()).toMatchObject({
      code: 'VALIDATION_ERROR',
      details: [
        {
          field: 'nodes[0].config.integrationId',
          code: 'INVALID_FIELD',
          message: 'Integration not found',
        },
        {
          field: 'nodes[1].config.mcpServers[1].integrationId',
          code: 'INVALID_FIELD',
          message: 'Integration not found',
        },
      ],
    });
  });

  it('저장된 노드와 같은 참조는 판정하지 않는다', async () => {
    const runner = makeRunner();
    await expect(
      assertNodeIntegrationRefsUsable(
        runner,
        { warn: jest.fn() },
        {
          workspaceId: 'ws-1',
          workflowAuthorId: OWNER,
          saverId: OTHER,
          nodes: [
            {
              nodeId: 'n-1',
              type: 'send_email',
              config: { integrationId: PERSONAL, subject: '바뀐 제목' },
              stored: {
                type: 'send_email',
                config: { integrationId: PERSONAL },
              },
              fieldPrefix: '',
            },
          ],
        },
      ),
    ).resolves.toBeUndefined();
    expect(runner.query).not.toHaveBeenCalled();
  });

  it('MCP 서버의 문자열이 아닌 integrationId 를 다른 값으로 바꾸면 400 INVALID_FIELD 로 거절한다', async () => {
    const error = await assertNodeIntegrationRefsUsable(
      makeRunner(),
      { warn: jest.fn() },
      {
        workspaceId: 'ws-1',
        workflowAuthorId: OWNER,
        saverId: OTHER,
        nodes: [
          {
            nodeId: 'n-1',
            type: 'ai_agent',
            config: { mcpServers: [{ integrationId: 456 }] },
            stored: {
              type: 'ai_agent',
              config: { mcpServers: [{ integrationId: 123 }] },
            },
            fieldPrefix: '',
          },
        ],
      },
    ).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getResponse()).toMatchObject({
      code: 'VALIDATION_ERROR',
      details: [
        {
          field: 'config.mcpServers[0].integrationId',
          code: 'INVALID_FIELD',
          message: 'Integration not found',
        },
      ],
    });
  });
});

describe('clearUnusableNodeIntegrationRefs', () => {
  it('쓸 수 없는 참조를 비운 config 를 입력 순서로 돌려주고 비운 자리를 알린다', async () => {
    const untouched = { integrationId: ORG };
    const { configs, cleared } = await clearUnusableNodeIntegrationRefs(
      makeRunner(),
      { warn: jest.fn() },
      {
        workspaceId: 'ws-1',
        workflowAuthorId: OTHER,
        check: { path: 'clone' },
        nodes: [
          {
            nodeId: 'new-1',
            nodeLabel: '메일',
            type: 'send_email',
            config: { integrationId: PERSONAL, subject: 's' },
          },
          {
            nodeId: 'new-2',
            nodeLabel: '조직 메일',
            type: 'send_email',
            config: untouched,
          },
          {
            nodeId: 'new-3',
            nodeLabel: '에이전트',
            type: 'ai_agent',
            config: {
              mcpServers: [
                { integrationId: MISSING },
                { integrationId: ORG },
                { integrationId: '{{ $var.server }}' },
              ],
            },
          },
        ],
      },
    );

    expect(configs).toEqual([
      { subject: 's' },
      { integrationId: ORG },
      {
        mcpServers: [
          { integrationId: ORG },
          { integrationId: '{{ $var.server }}' },
        ],
      },
    ]);
    expect(configs[1]).toBe(untouched);
    expect(cleared).toEqual([
      { nodeId: 'new-1', nodeLabel: '메일', field: 'config.integrationId' },
      {
        nodeId: 'new-3',
        nodeLabel: '에이전트',
        field: 'config.mcpServers[0].integrationId',
      },
    ]);
  });

  it('restore 는 지금 노드와 같은 참조를 비우지 않는다', async () => {
    const { configs, cleared } = await clearUnusableNodeIntegrationRefs(
      makeRunner([]),
      { warn: jest.fn() },
      {
        workspaceId: 'ws-1',
        workflowAuthorId: OWNER,
        check: { path: 'restore' },
        nodes: [
          {
            nodeId: 'n-1',
            nodeLabel: '메일',
            type: 'send_email',
            config: { integrationId: PERSONAL },
            stored: { type: 'send_email', config: { integrationId: PERSONAL } },
          },
        ],
      },
    );
    expect(configs).toEqual([{ integrationId: PERSONAL }]);
    expect(cleared).toEqual([]);
  });
});

describe('INTEGRATION_REF_INVALID_MESSAGE', () => {
  it('저장 검사 400 의 문구는 없는 통합 404 본문의 문구와 같다(존재 여부를 가르는 신호가 되지 않는다)', () => {
    expect(INTEGRATION_REF_INVALID_MESSAGE).toBe(
      (integrationNotFoundError().getResponse() as { message: string }).message,
    );
  });
});
