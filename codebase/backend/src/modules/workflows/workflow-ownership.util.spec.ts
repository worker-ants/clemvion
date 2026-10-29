import { NotFoundException } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { Workflow } from './entities/workflow.entity';
import {
  assertWorkflowInWorkspace,
  lockWorkflowInWorkspace,
} from './workflow-ownership.util';

describe('assertWorkflowInWorkspace', () => {
  let repo: { findOne: jest.Mock };

  beforeEach(() => {
    repo = { findOne: jest.fn() };
  });

  it('passes when the workflow belongs to the workspace', async () => {
    repo.findOne.mockResolvedValue({ id: 'wf-1', workspaceId: 'ws-1' });

    await expect(
      assertWorkflowInWorkspace(
        repo as unknown as Repository<Workflow>,
        'wf-1',
        'ws-1',
      ),
    ).resolves.toBeUndefined();

    expect(repo.findOne).toHaveBeenCalledWith({
      where: { id: 'wf-1', workspaceId: 'ws-1' },
    });
  });

  it('throws NotFoundException (RESOURCE_NOT_FOUND) for a foreign-workspace / missing workflow', async () => {
    repo.findOne.mockResolvedValue(null);

    await expect(
      assertWorkflowInWorkspace(
        repo as unknown as Repository<Workflow>,
        'wf-other',
        'ws-1',
      ),
    ).rejects.toMatchObject({
      response: { code: 'RESOURCE_NOT_FOUND' },
    });
    await expect(
      assertWorkflowInWorkspace(
        repo as unknown as Repository<Workflow>,
        'wf-other',
        'ws-1',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('lockWorkflowInWorkspace', () => {
  it('워크스페이스로 거른 워크플로우 행을 FOR UPDATE 로 잠그고 돌려준다', async () => {
    const workflow = { id: 'wf-1', workspaceId: 'ws-1' };
    const manager = { findOne: jest.fn().mockResolvedValue(workflow) };

    await expect(
      lockWorkflowInWorkspace(
        manager as unknown as EntityManager,
        'wf-1',
        'ws-1',
      ),
    ).resolves.toBe(workflow);

    expect(manager.findOne).toHaveBeenCalledWith(Workflow, {
      where: { id: 'wf-1', workspaceId: 'ws-1' },
      lock: { mode: 'for_no_key_update' },
    });
  });

  it('잠글 행이 없으면 assertWorkflowInWorkspace 와 같은 404 다', async () => {
    const manager = { findOne: jest.fn().mockResolvedValue(null) };

    await expect(
      lockWorkflowInWorkspace(
        manager as unknown as EntityManager,
        'wf-other',
        'ws-1',
      ),
    ).rejects.toMatchObject({
      response: { code: 'RESOURCE_NOT_FOUND', message: 'Workflow not found' },
    });
  });
});
