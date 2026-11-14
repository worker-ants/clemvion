import { BadRequestException, NotFoundException } from '@nestjs/common';
import { IntegrationsTestHooksController } from './integrations-test-hooks.controller';

/**
 * e2e 전용 훅의 게이트(CLE-T-184JJD). 실행 컨트롤러의 `_test/*` 훅과 같이 `NODE_ENV==='test'` 와 `E2E_TEST_HOOKS==='1'`
 * 이 둘 다일 때만 동작한다. 하나라도 빠지면 라우트가 없는 것처럼 404 이고 통합 조회 · 사용 기록에 닿지 않는다.
 */
describe('IntegrationsTestHooksController', () => {
  const INTEGRATION_ID = '11111111-1111-4111-8111-111111111111';
  const NODE_EXECUTION_ID = '22222222-2222-4222-8222-222222222222';
  const WORKFLOW_ID = '33333333-3333-4333-8333-333333333333';
  const body = { nodeExecutionId: NODE_EXECUTION_ID, workflowId: WORKFLOW_ID };

  let integrationRepo: { findOne: jest.Mock };
  let integrationsService: { logUsage: jest.Mock };
  let controller: IntegrationsTestHooksController;
  const savedEnv = { ...process.env };

  beforeEach(() => {
    integrationRepo = {
      findOne: jest.fn().mockResolvedValue({ id: INTEGRATION_ID }),
    };
    integrationsService = { logUsage: jest.fn().mockResolvedValue(undefined) };
    controller = new IntegrationsTestHooksController(
      integrationRepo as never,
      integrationsService as never,
    );
    process.env.NODE_ENV = 'test';
    process.env.E2E_TEST_HOOKS = '1';
  });

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it.each([
    [
      'NODE_ENV 가 test 가 아니면',
      { NODE_ENV: 'production', E2E_TEST_HOOKS: '1' },
    ],
    [
      'E2E_TEST_HOOKS 가 없으면',
      { NODE_ENV: 'test', E2E_TEST_HOOKS: undefined },
    ],
  ])('%s 404 이고 아무것도 읽거나 쓰지 않는다', async (_label, env) => {
    process.env.NODE_ENV = env.NODE_ENV;
    if (env.E2E_TEST_HOOKS === undefined) delete process.env.E2E_TEST_HOOKS;
    else process.env.E2E_TEST_HOOKS = env.E2E_TEST_HOOKS;
    await expect(
      controller.recordMcpAuthFailureForTest(INTEGRATION_ID, 'ws-1', body),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(integrationRepo.findOne).not.toHaveBeenCalled();
    expect(integrationsService.logUsage).not.toHaveBeenCalled();
  });

  it('게이트가 열리면 요청 워크스페이스의 통합에 MCP_AUTH_FAILED 사용 기록을 남긴다', async () => {
    await expect(
      controller.recordMcpAuthFailureForTest(INTEGRATION_ID, 'ws-1', body),
    ).resolves.toEqual({ success: true });
    expect(integrationRepo.findOne).toHaveBeenCalledWith({
      where: { id: INTEGRATION_ID, workspaceId: 'ws-1' },
    });
    expect(integrationsService.logUsage).toHaveBeenCalledWith(
      { id: INTEGRATION_ID },
      expect.objectContaining({
        nodeExecutionId: NODE_EXECUTION_ID,
        workflowId: WORKFLOW_ID,
        status: 'failed',
        error: expect.objectContaining({ code: 'MCP_AUTH_FAILED' }),
      }),
    );
  });

  it('다른 워크스페이스 통합처럼 찾지 못하면 404 다', async () => {
    integrationRepo.findOne.mockResolvedValue(null);
    await expect(
      controller.recordMcpAuthFailureForTest(INTEGRATION_ID, 'ws-1', body),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(integrationsService.logUsage).not.toHaveBeenCalled();
  });

  it.each([
    ['본문이 없으면', undefined],
    ['nodeExecutionId 가 UUID 가 아니면', { ...body, nodeExecutionId: 'x' }],
    ['workflowId 가 없으면', { nodeExecutionId: NODE_EXECUTION_ID }],
  ])('%s 400 이다', async (_label, input) => {
    await expect(
      controller.recordMcpAuthFailureForTest(INTEGRATION_ID, 'ws-1', input),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(integrationsService.logUsage).not.toHaveBeenCalled();
  });
});
