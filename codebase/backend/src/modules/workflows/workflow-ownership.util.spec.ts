import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Workflow } from './entities/workflow.entity';
import { assertWorkflowInWorkspace } from './workflow-ownership.util';

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
