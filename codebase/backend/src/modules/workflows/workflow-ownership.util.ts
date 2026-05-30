import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Workflow } from './entities/workflow.entity';

/**
 * Cross-workspace IDOR guard: ensure the workflow belongs to the caller's
 * workspace before any nested resource (node/edge) read/mutation. Mirrors
 * WorkflowsService.findById's NotFoundException shape so callers cannot probe
 * foreign-workspace rows.
 *
 * Pure helper — takes the repository explicitly so it adds no module coupling
 * (NodesModule/EdgesModule need not import WorkflowsModule).
 */
export async function assertWorkflowInWorkspace(
  repo: Repository<Workflow>,
  workflowId: string,
  workspaceId: string,
): Promise<void> {
  const workflow = await repo.findOne({
    where: { id: workflowId, workspaceId },
  });
  if (!workflow) {
    throw new NotFoundException({
      code: 'RESOURCE_NOT_FOUND',
      message: 'Workflow not found',
    });
  }
}
