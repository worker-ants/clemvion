import { NotFoundException } from '@nestjs/common';
import type { EntityManager, Repository } from 'typeorm';
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
  if (!workflow) throw workflowNotFound();
}

/**
 * 워크플로우 행을 `SELECT … FOR NO KEY UPDATE` 로 잠그고 돌려준다. 노드 `config` 를 쓰는 저장(캔버스 저장 · 버전 복원 · 노드
 * 생성 · 수정)이 트랜잭션의 첫 문장으로 부른다(CLE-WF-DATA 저장 3단계). 같은 워크플로우의 동시 저장은 여기서 줄을 서고, 그 뒤에
 * 읽는 저장된 노드가 통합 참조 검사의 기준선이다. 잠근 행이 없으면(그 사이 지워졌거나 다른 워크스페이스) `assertWorkflowInWorkspace`
 * 와 같은 404 다.
 *
 * `FOR UPDATE` 를 쓰지 않는다. 그 잠금은 이 워크플로우를 가리키는 자식 행 INSERT 의 FK 검사(`FOR KEY SHARE`)와 부딪쳐 실행
 * 생성 · 트리거 쓰기를 저장이 끝날 때까지 세운다. `FOR NO KEY UPDATE` 는 `FOR KEY SHARE` 를 막지 않고, 같은 잠금(과
 * `FOR SHARE` · `FOR UPDATE`)과는 부딪치므로 저장끼리는 줄을 선다.
 */
export async function lockWorkflowInWorkspace(
  manager: EntityManager,
  workflowId: string,
  workspaceId: string,
): Promise<Workflow> {
  const workflow = await manager.findOne(Workflow, {
    where: { id: workflowId, workspaceId },
    lock: { mode: 'for_no_key_update' },
  });
  if (!workflow) throw workflowNotFound();
  return workflow;
}

function workflowNotFound(): NotFoundException {
  return new NotFoundException({
    code: 'RESOURCE_NOT_FOUND',
    message: 'Workflow not found',
  });
}
