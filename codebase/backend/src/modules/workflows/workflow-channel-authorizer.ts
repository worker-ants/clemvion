import { Injectable } from '@nestjs/common';
import { isValidUuid } from '../../common/utils/uuid';
import {
  ChannelAuthorizer,
  ChannelAuthorizerContext,
} from '../websocket/channel-authorizer';
import { WorkflowsService } from './workflows.service';

/**
 * refactor 02 M-7 — `workflow:<workflowId>` 구독 인가 (옛 gateway 인라인 authorizer 이전).
 *
 * 04 M-6 (IDOR): 에디터 실행 알림 emit(`workflow:<workflowId>`)이 실존하므로, 타 workspace
 * workflowId 를 추측한 사용자가 이벤트를 수신하는 IDOR 를 join 전 차단. `findById` 는
 * 미소유/부재 시 NotFound throw(ID enumeration 차단) → boolean 평탄화.
 */
@Injectable()
export class WorkflowChannelAuthorizer implements ChannelAuthorizer {
  constructor(private readonly workflowsService: WorkflowsService) {}

  matches(channel: string): boolean {
    return channel.startsWith('workflow:');
  }

  async authorize(
    channel: string,
    { workspaceId }: ChannelAuthorizerContext,
  ): Promise<{ error: string } | null> {
    const workflowId = channel.slice('workflow:'.length);
    if (!isValidUuid(workflowId)) {
      return { error: 'Not authorized for this workflow' };
    }
    const allowed = await this.workflowsService
      .findById(workflowId, workspaceId)
      .then(() => true)
      .catch(() => false);
    return allowed ? null : { error: 'Not authorized for this workflow' };
  }
}
