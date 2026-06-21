import { Injectable } from '@nestjs/common';
import { isValidUuid } from '../../common/utils/uuid';
import {
  ChannelAuthorizer,
  ChannelAuthorizerContext,
} from '../websocket/channel-authorizer';
import { ExecutionsService } from './executions.service';

/**
 * refactor 02 M-7 — `execution:<executionId>` 구독 인가 (옛 gateway 인라인 authorizer 이전).
 *
 * CRIT (IDOR): `execution:` 구독은 join 전 workspace 소유 검증을 받는다. 과거에는 1회성
 * snapshot 만 verifyOwnership 으로 보호되고 room join 은 무검증이라, 타 workspace
 * executionId 를 추측한 사용자가 증분 broadcast 이벤트를 수신할 수 있었다. authorize 로
 * join 이전에 동기 차단한다. `verifyOwnership` 은 미소유/부재 시 throw(NotFound 통일 —
 * ID enumeration 차단) → boolean 평탄화.
 */
@Injectable()
export class ExecutionChannelAuthorizer implements ChannelAuthorizer {
  constructor(private readonly executionsService: ExecutionsService) {}

  matches(channel: string): boolean {
    return channel.startsWith('execution:');
  }

  async authorize(
    channel: string,
    { workspaceId }: ChannelAuthorizerContext,
  ): Promise<{ error: string } | null> {
    const executionId = channel.slice('execution:'.length);
    // UUID 형식 검증 — 비-UUID 입력은 DB 조회 전 차단 (background:run 과 동일 정책).
    if (!isValidUuid(executionId)) {
      return { error: 'Not authorized for this execution' };
    }
    const allowed = await this.executionsService
      .verifyOwnership(executionId, workspaceId)
      .then(() => true)
      .catch(() => false);
    return allowed ? null : { error: 'Not authorized for this execution' };
  }
}
