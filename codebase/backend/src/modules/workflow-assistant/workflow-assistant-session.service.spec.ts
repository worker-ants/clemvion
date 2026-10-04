import { NotFoundException } from '@nestjs/common';
import type { DataSource, Repository } from 'typeorm';
import { WorkflowAssistantSessionService } from './workflow-assistant-session.service';
import type { WorkflowAssistantSession } from './entities/workflow-assistant-session.entity';
import type { WorkflowAssistantMessage } from './entities/workflow-assistant-message.entity';
import type { Workflow } from '../workflows/entities/workflow.entity';
import type { LlmService } from '../llm/llm.service';

// spec 1-data-model §1.1 — 세션에 고정하는 모델 설정은 같은 워크스페이스의 chat 설정만. 쓰는 시점(`resolveConfig`)과 같은 검증기를
// 저장 전에 돌린다(404 `MODEL_CONFIG_NOT_FOUND`). `review/code/2026/09/27/21_43_01` INFO 8 — 단위 테스트가 없던 자리다.
describe('WorkflowAssistantSessionService — llmConfigId 소속', () => {
  const sessionRepo = {
    create: jest.fn((row: unknown) => row),
    save: jest.fn((row: unknown) => Promise.resolve(row)),
    findOne: jest.fn(),
  };
  const workflowRepo = { exists: jest.fn().mockResolvedValue(true) };
  const llmService = { resolveConfig: jest.fn() };
  const service = new WorkflowAssistantSessionService(
    sessionRepo as unknown as Repository<WorkflowAssistantSession>,
    {} as Repository<WorkflowAssistantMessage>,
    workflowRepo as unknown as Repository<Workflow>,
    {} as DataSource,
    llmService as unknown as LlmService,
  );
  const notFound = () =>
    new NotFoundException({ code: 'MODEL_CONFIG_NOT_FOUND' });

  beforeEach(() => {
    jest.clearAllMocks();
    workflowRepo.exists.mockResolvedValue(true);
  });

  it('생성 — 다른 워크스페이스의 설정이면 resolveConfig 의 404 를 내고 저장하지 않는다', async () => {
    llmService.resolveConfig.mockRejectedValue(notFound());
    await expect(
      service.create('ws-1', 'u-1', {
        workflowId: 'wf-1',
        llmConfigId: 'other-ws-cfg',
      }),
    ).rejects.toMatchObject({ response: { code: 'MODEL_CONFIG_NOT_FOUND' } });
    expect(llmService.resolveConfig).toHaveBeenCalledWith(
      'other-ws-cfg',
      'ws-1',
    );
    expect(sessionRepo.save).not.toHaveBeenCalled();
  });

  it('생성 — llmConfigId 가 없으면 조회하지 않는다', async () => {
    await service.create('ws-1', 'u-1', { workflowId: 'wf-1' });
    expect(llmService.resolveConfig).not.toHaveBeenCalled();
    expect(sessionRepo.save).toHaveBeenCalled();
  });

  it('수정 — 같은 검증을 타고, null(고정 해제)은 조회하지 않는다', async () => {
    sessionRepo.findOne.mockResolvedValue({
      id: 's-1',
      workspaceId: 'ws-1',
      userId: 'u-1',
    });
    llmService.resolveConfig.mockRejectedValueOnce(notFound());
    await expect(
      service.update('s-1', 'ws-1', 'u-1', { llmConfigId: 'other-ws-cfg' }),
    ).rejects.toMatchObject({ response: { code: 'MODEL_CONFIG_NOT_FOUND' } });
    expect(sessionRepo.save).not.toHaveBeenCalled();

    await service.update('s-1', 'ws-1', 'u-1', { llmConfigId: null });
    expect(llmService.resolveConfig).toHaveBeenCalledTimes(1);
    expect(sessionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ llmConfigId: null }),
    );
  });
});
