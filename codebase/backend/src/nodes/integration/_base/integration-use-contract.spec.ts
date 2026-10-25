import { Cafe24Handler } from '../cafe24/cafe24.handler.js';
import type { Cafe24ApiClient } from '../cafe24/cafe24-api.client.js';
import { DatabaseQueryHandler } from '../database-query/database-query.handler.js';
import { HttpRequestHandler } from '../http-request/http-request.handler.js';
import { MakeshopHandler } from '../makeshop/makeshop.handler.js';
import type { MakeshopApiClient } from '../makeshop/makeshop-api.client.js';
import { SendEmailHandler } from '../send-email/send-email.handler.js';
import type { ExecutionContext } from '../../core/node-handler.interface.js';
import type { IntegrationsService } from '../../../modules/integrations/integrations.service.js';
import { integrationNotFoundError } from '../../../modules/integrations/integration-visibility.js';
import {
  asIntegrationsService,
  makeIntegrationsServiceMock,
} from '../../../modules/integrations/__test-utils__/integrations-service.mock.js';
import { createEmptyConversationThread } from '../../../shared/conversation-thread/conversation-thread.types';

/**
 * 통합 노드 다섯 종이 공통 베이스로 실행 시점 조회 인자(`use`)를 넘기는지 본다(CLE-NODE-INT-COMMON 「IntegrationsService
 * API (실행 엔진용)」). 핸들러가 평가한 `config.integrationId` 를 조회 ID 로 넘기고, 리터럴 판정은 평가 전 원본
 * (`context.rawConfig`)을 본다. 핸들러가 원본을 조회 ID 로 넘기면 원본과 평가값이 늘 같아 표현식 참조가 리터럴로 통과한다.
 *
 * 조회가 거절되면 없는 통합과 같은 노드 에러로 끝나고 활동 로그는 남지 않는다(REQ-INTMGMT-052 · 053).
 */
const ID = '11111111-1111-4111-8111-111111111111';
const TEMPLATE = '{{ $vars.integrationId }}';

interface HandlerCase {
  name: string;
  make: (service: IntegrationsService) => {
    execute: (
      input: unknown,
      config: Record<string, unknown>,
      context: ExecutionContext,
    ) => Promise<unknown>;
  };
  config: Record<string, unknown>;
}

const apiClient = { call: jest.fn() };

const CASES: HandlerCase[] = [
  {
    name: 'send_email',
    make: (s) => new SendEmailHandler(s),
    config: {
      integrationId: ID,
      to: ['a@example.com'],
      subject: 's',
      body: 'b',
      bodyType: 'text',
    },
  },
  {
    name: 'database_query',
    make: (s) => new DatabaseQueryHandler(s),
    config: { integrationId: ID, query: 'SELECT 1', queryType: 'select' },
  },
  {
    name: 'http_request',
    make: (s) => new HttpRequestHandler(s),
    config: {
      integrationId: ID,
      authentication: 'integration',
      method: 'GET',
      url: 'https://api.example.com/x',
    },
  },
  {
    name: 'cafe24',
    make: (s) => new Cafe24Handler(s, apiClient as unknown as Cafe24ApiClient),
    config: {
      integrationId: ID,
      resource: 'product',
      operation: 'product_list',
      fields: { shop_no: 1 },
    },
  },
  {
    name: 'makeshop',
    make: (s) =>
      new MakeshopHandler(s, apiClient as unknown as MakeshopApiClient),
    config: {
      integrationId: ID,
      resource: 'product',
      operation: 'get-product',
      fields: {},
    },
  },
];

function contextFor(
  config: Record<string, unknown>,
  rawIntegrationId: unknown,
): ExecutionContext {
  return {
    executionId: 'exec-1',
    workflowId: 'wf-1',
    nodeId: 'node-1',
    nodeExecutionId: 'ne-1',
    variables: { __workspaceId: 'ws-1' },
    nodeOutputCache: {},
    structuredOutputCache: {},
    engineResolvedConfigCache: {},
    conversationThread: createEmptyConversationThread(),
    recursionDepth: 0,
    rawConfig: Object.freeze({ ...config, integrationId: rawIntegrationId }),
  };
}

describe.each(CASES)('$name — 실행 시점 조회 인자', ({ make, config }) => {
  it.each<[string, unknown, boolean]>([
    ['리터럴 참조', ID, false],
    ['표현식 참조', TEMPLATE, true],
  ])('%s → 평가한 ID 와 use 를 넘긴다', async (_label, raw, fromExpression) => {
    const service = makeIntegrationsServiceMock();
    service.getForExecution.mockRejectedValue(integrationNotFoundError());
    await make(asIntegrationsService(service)).execute(
      null,
      config,
      contextFor(config, raw),
    );
    expect(service.getForExecution).toHaveBeenCalledWith(ID, 'ws-1', {
      nodeId: 'node-1',
      fromExpression,
    });
  });

  it('조회가 거절되면 error 포트로 끝나고 활동 로그를 남기지 않는다', async () => {
    const service = makeIntegrationsServiceMock();
    service.getForExecution.mockRejectedValue(integrationNotFoundError());
    const result = (await make(asIntegrationsService(service)).execute(
      null,
      config,
      contextFor(config, TEMPLATE),
    )) as { port?: string };
    expect(result.port).toBe('error');
    expect(service.logUsage).not.toHaveBeenCalled();
  });
});
