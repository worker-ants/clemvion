import type { Repository } from 'typeorm';
import { Workflow } from '../../workflows/entities/workflow.entity';

/**
 * 외부 이벤트(웹훅 · 채팅 채널 · 스케줄)로 실행을 시작하기 전에 워크플로우가 꺼져 있는지 본다.
 * 워크플로우를 끄면 이 이벤트들로 실행이 생기지 않는다(NERV Task `CLE-T-XRWFMJ`).
 *
 * **호출 규칙: 외부 이벤트로 실행을 시작하는 진입점은 `execute()` 를 부르기 직전에 이 관문을 거친다.**
 * 새 진입점을 만들면 여기에 더한다. 지금 호출하는 곳은 셋이다.
 * - 일반 웹훅: `HooksService.handleWebhook` — 꺼진 트리거 검사 바로 뒤, 인증 앞. 410 `WORKFLOW_INACTIVE`.
 * - 채팅 채널: `HooksService.handleChatChannelWebhook` — 새 실행을 시작하기 직전. 202 ignored.
 *   이미 진행 중인 실행으로 가는 입력과 `/cancel` · `/help` 는 이 관문 앞에서 처리한다. 관문 앞의
 *   미지원 update 안내 · 재도착 억제(dedup) · rate limit · 첨부 보강(`enrichInbound`)도 그대로 거친다.
 *   그래서 꺼진 워크플로우로 오는 새 시작 입력도 이 단계의 외부 호출과 Redis · DB 쓰기를 탄다.
 * - 스케줄: `ScheduleRunnerService.process` — job 을 받은 뒤 건너뛴다.
 *
 * 거치지 않는 경로는 사람이 직접 시작하거나 이미 시작된 실행에 쓰는 것이다. 편집기 수동 실행 ·
 * 재실행 · 스케줄 "지금 실행"(`SchedulesService.runNow`) · External Interaction 의 진행 중 실행 명령은
 * 워크플로우가 꺼져 있어도 동작한다.
 *
 * Rationale: 엔진 `execute()` 에 백스톱을 두는 안은 택하지 않았다. 편집기 수동 실행 · 재실행이 같은
 * `execute()` 를 쓰므로 호출자를 가르는 인자가 필요하고 범위가 커진다. 이번에는 이 호출 규칙과 호출
 * 지점을 문서에 남기는 것으로 처리했다.
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
