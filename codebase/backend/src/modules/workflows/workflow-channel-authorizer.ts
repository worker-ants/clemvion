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
 * 04 M-6 (IDOR): 서버에는 `workflow:<workflowId>` 채널로 보내는 이벤트가 없다. 인가는
 * fail-closed 로 둔다. 다른 workspace 의 workflowId 를 추측한 소켓은 join 전에 막는다. `findById` 는
 * 미소유/부재 시 NotFound throw(ID enumeration 차단) → boolean 평탄화.
 *
 * 근거: [WebSocket 연결과 채널 구독 — 메시지 · 구독 · 에러 「`workflow:`·`notifications:` 채널 인가를 더한 이유」](CLE-API-WS-MSG#workflownotifications-채널-인가를-더한-이유)
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
