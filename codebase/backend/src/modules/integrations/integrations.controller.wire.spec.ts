import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { IntegrationOAuthService } from './integration-oauth.service';
import { Integration } from './entities/integration.entity';
import { IntegrationUsageLog } from './entities/integration-usage-log.entity';
import { Node } from '../nodes/entities/node.entity';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { IntegrationCacheBus } from '../../common/redis/integration-cache-bus.service';
import { McpTestConnectionService } from '../mcp/mcp-test-connection.service';
import { McpAuthError, McpClientService } from '../mcp/mcp-client.service';
import { TransformInterceptor } from '../../common/interceptors/transform.interceptor';
import {
  assertMatchesContract,
  contractForDto,
} from '../../shared/testing/response-contract';
import { TestConnectionResultDto } from './dto/responses/integration-response.dto';

/**
 * `POST /integrations/:id/test` — **와이어에 실제로 실리는 것**을 본다. 자매
 * `llm-model-config.controller.spec.ts` 의 `POST /model-configs/:id/test` describe 와 같은 틀이다.
 *
 * ## 서비스 단위 대조로 부족한 이유
 *
 * `integrations.service.spec.ts` 는 서비스 **반환 객체**를 `TestConnectionResultDto` 와 대조한다. 반환과 응답
 * 본문 사이에는 전역 `TransformInterceptor` 가 한 층 더 있고, 단위 대조는 그 층을 태우지 않는다. 오늘 그 층은
 * `{ data }` 로 감싸기만 한다 — 그 «오늘» 을 고정하는 것이 이 describe 다.
 *
 * ## 무엇이 진짜이고 무엇이 mock 인가
 *
 * 컨트롤러 · `IntegrationsService` · `McpTestConnectionService` 는 진짜다. mock 은 그 아래(`McpClientService.connect`
 * · 레포지토리 · 워크스페이스 · 감사 로그 등)뿐이다.
 *
 * MCP 테스터까지 진짜로 두는 이유: 테스터를 mock 하면 `preview` 의 안쪽 키(`toolCount` · `resourceSupported` ·
 * `promptSupported`)를 내가 적고 내가 단언하게 된다 — 필드 이름 축에서 vacuous 하다. 서비스 spec 이 바로 그렇게
 * 테스터를 mock 하므로, 그 이름을 실제 생산자에게서 받는 자리는 여기뿐이다.
 */
describe('POST /integrations/:id/test — 와이어 계약 (HTTP)', () => {
  let app: INestApplication;
  let connect: jest.Mock;

  const INTEGRATION_UUID = '11111111-2222-4333-8444-555555555555';
  const WORKSPACE_UUID = '66666666-7777-4888-8999-aaaaaaaaaaaa';
  const CREATOR = 'user-1';

  // 본인의 personal 통합 — `requireVisible` 을 통과하는 최소 형태다.
  const mcpIntegration: Partial<Integration> = {
    id: INTEGRATION_UUID,
    workspaceId: WORKSPACE_UUID,
    serviceType: 'mcp',
    name: 'My MCP',
    authType: 'bearer_token',
    credentials: { url: 'https://mcp.example.com', token: 'abc' },
    scope: 'personal',
    status: 'connected',
    createdBy: CREATOR,
  };

  /** `connect` 가 돌려줄 세션 — `McpTestConnectionService` 가 읽는 것만 채운다. */
  const session = (
    capabilities: Record<string, unknown>,
    toolNames: string[] = [],
  ) => ({
    capabilities,
    serverInfo: { name: 'filesystem-mcp', version: '1.2.0' },
    listTools: jest.fn().mockResolvedValue({
      tools: toolNames.map((name) => ({
        name,
        inputSchema: { type: 'object' },
      })),
    }),
    close: jest.fn().mockResolvedValue(undefined),
  });

  // `@WorkspaceId()` 는 헤더·JWT 클레임이 없으면 400 `WORKSPACE_ID_REQUIRED` 를 먼저 던진다 — 헤더로 그 축을
  // 고정해 응답 shape 축만 남긴다.
  const post = () =>
    request(app.getHttpServer())
      .post(`/integrations/${INTEGRATION_UUID}/test`)
      .set('X-Workspace-Id', WORKSPACE_UUID);

  beforeAll(async () => {
    connect = jest.fn();
    const moduleRef = await Test.createTestingModule({
      controllers: [IntegrationsController],
      providers: [
        IntegrationsService,
        McpTestConnectionService,
        { provide: McpClientService, useValue: { connect } },
        {
          provide: getRepositoryToken(Integration),
          useValue: { findOne: jest.fn().mockResolvedValue(mcpIntegration) },
        },
        // 아래는 이 경로가 닿지 않는 의존이다 — 생성자 주입만 채운다.
        { provide: getRepositoryToken(IntegrationUsageLog), useValue: {} },
        { provide: getRepositoryToken(Node), useValue: {} },
        { provide: WorkspacesService, useValue: {} },
        { provide: IntegrationOAuthService, useValue: {} },
        { provide: AuditLogsService, useValue: {} },
        { provide: IntegrationCacheBus, useValue: {} },
        { provide: DataSource, useValue: {} },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    // `@CurrentUser()` 는 인증 가드가 채운 `req.user` 를 읽는다. 이 앱엔 가드가 없으므로 여기서 채운다.
    app.use((req: { user?: unknown }, _res: unknown, next: () => void) => {
      req.user = { sub: CREATOR };
      next();
    });
    // 봉투(`{ data }`)는 이 인터셉터가 만든다 — 붙이지 않으면 클라이언트가 실제로 읽는 자리를 보지 못한다.
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    connect.mockReset();
  });

  it('MCP 성공 — capability 미리보기 필드 셋이 봉투를 통과해 선언대로 실린다', async () => {
    connect.mockResolvedValue(
      session({ tools: {}, resources: {} }, ['read', 'write', 'list']),
    );

    const res = await post();

    expect(res.status).toBe(200);
    assertMatchesContract(
      res.body.data,
      await contractForDto(TestConnectionResultDto),
    );
    // 키 전수 — 검증자는 optional 필드가 통째로 빠져도 통과시킨다.
    expect(Object.keys(res.body.data).sort()).toEqual([
      'capabilities',
      'message',
      'preview',
      'serverInfo',
      'success',
    ]);
    expect(res.body.data.preview).toStrictEqual({
      toolCount: 3,
      resourceSupported: true,
      promptSupported: false,
    });
  });

  it('MCP 성공 — tools capability 가 없으면 toolCount 가 와이어에서 빠진다', async () => {
    connect.mockResolvedValue(session({ prompts: {} }));

    const res = await post();

    expect(res.status).toBe(200);
    // `McpConnectionPreviewDto.toolCount` 가 optional 로 선언된 근거가 이 케이스다 — required 였다면 여기서 RED.
    assertMatchesContract(
      res.body.data,
      await contractForDto(TestConnectionResultDto),
    );
    expect(res.body.data.preview).toStrictEqual({
      resourceSupported: false,
      promptSupported: true,
    });
  });

  it('MCP 실패 — 미리보기 필드 없이 code 가 실린다', async () => {
    connect.mockRejectedValue(
      new McpAuthError('MCP server rejected the credentials (401).'),
    );

    const res = await post();

    expect(res.status).toBe(200);
    assertMatchesContract(
      res.body.data,
      await contractForDto(TestConnectionResultDto),
    );
    expect(res.body.data).toStrictEqual({
      success: false,
      code: 'MCP_AUTH_FAILED',
      message: 'MCP server rejected the credentials (401).',
    });
  });
});
