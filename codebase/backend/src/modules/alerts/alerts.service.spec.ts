import { BadRequestException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { AlertsService } from './alerts.service';
import type { AlertRule } from './entities/alert-rule.entity';
import type { Workflow } from '../workflows/entities/workflow.entity';
import type { CreateAlertRuleDto } from './dto/alert-rule.dto';

// spec 1-data-model §1.1 — 규칙이 가리키는 워크플로는 같은 워크스페이스의 것만. 평가 SQL 이 워크스페이스로 걸러 끊긴 참조로
// 남던 자리다(`review/code/2026/09/27/21_43_01` W1 — 같은 헬퍼를 붙인 자리 중 여기만 단위 테스트가 없었다).
describe('AlertsService.create — workflowId 소속', () => {
  const repo = {
    create: jest.fn((row: unknown) => row),
    save: jest.fn((row: unknown) => Promise.resolve(row)),
  };
  const workflowRepo = { exists: jest.fn() };
  const service = new AlertsService(
    repo as unknown as Repository<AlertRule>,
    workflowRepo as unknown as Repository<Workflow>,
  );
  const base = { type: 'failure_rate', threshold: 10 } as CreateAlertRuleDto;

  beforeEach(() => jest.clearAllMocks());

  it('workflowId 가 이 워크스페이스의 워크플로가 아니면 400 이고 저장하지 않는다', async () => {
    workflowRepo.exists.mockResolvedValue(false);
    const err = await service
      .create('ws-1', 'u-1', { ...base, workflowId: 'other-ws-wf' })
      .catch((err_: unknown) => err_);
    expect(workflowRepo.exists).toHaveBeenCalledWith({
      where: { id: 'other-ws-wf', workspaceId: 'ws-1' },
    });
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err as BadRequestException).getResponse()).toMatchObject({
      code: 'VALIDATION_ERROR',
      details: [{ field: 'workflowId', code: 'INVALID_FIELD' }],
    });
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('같은 워크스페이스의 워크플로면 저장한다', async () => {
    workflowRepo.exists.mockResolvedValue(true);
    await service.create('ws-1', 'u-1', { ...base, workflowId: 'wf-1' });
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ workflowId: 'wf-1', workspaceId: 'ws-1' }),
    );
  });

  it('workflowId 가 없으면(워크스페이스 전역 규칙) 조회하지 않는다', async () => {
    await service.create('ws-1', 'u-1', base);
    expect(workflowRepo.exists).not.toHaveBeenCalled();
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ workflowId: null }),
    );
  });
});
