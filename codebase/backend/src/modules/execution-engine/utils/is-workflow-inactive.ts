import type { Repository } from 'typeorm';
import { Workflow } from '../../workflows/entities/workflow.entity';

/**
 * 외부 이벤트(웹훅 · 채팅 채널 · 스케줄)로 실행을 시작하기 전에 워크플로우가 꺼져 있는지 본다.
 * 워크플로우를 끄면 이 이벤트들로 실행이 생기지 않는다(NERV Task `CLE-T-XRWFMJ`). 편집기 수동 실행과
 * 재실행은 이 관문을 거치지 않는다.
 *
 * `workspaceId` 는 실행을 시작하는 쪽의 워크스페이스다(`execute()` 에 넘기는 값과 같다). 워크플로우가
 * 그 워크스페이스에 없으면 `false` 다. 그 경우의 거부는 뒤의 `execute()` 가 한다(NERV Task
 * `CLE-T-XYR067`). 여기서 따로 답하면 다른 워크스페이스 워크플로우의 활성 상태가 응답으로 샌다.
 */
export async function isWorkflowInactive(
  workflowRepository: Pick<Repository<Workflow>, 'findOne'>,
  workflowId: string,
  workspaceId: string,
): Promise<boolean> {
  const workflow = await workflowRepository.findOne({
    where: { id: workflowId, workspaceId },
    select: { id: true, isActive: true },
  });
  return workflow?.isActive === false;
}
