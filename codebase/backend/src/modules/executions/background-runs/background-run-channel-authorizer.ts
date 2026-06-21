import { Injectable } from '@nestjs/common';
import { isValidUuid } from '../../../common/utils/uuid';
import {
  ChannelAuthorizer,
  ChannelAuthorizerContext,
} from '../../websocket/channel-authorizer';
import { BackgroundRunsService } from './background-runs.service';

/**
 * refactor 02 M-7 — `background:run:<id>` 구독 인가 (옛 gateway 인라인 authorizer 이전).
 * `BackgroundRunsService` 가 `ExecutionsModule` 소속이라 본 authorizer 도 같은 모듈에 둔다.
 * UUID 형식 검증으로 DB 쿼리 진입 전 비-UUID 선차단 (다른 채널 authorizer 와 동일 정책).
 */
@Injectable()
export class BackgroundRunChannelAuthorizer implements ChannelAuthorizer {
  constructor(private readonly backgroundRunsService: BackgroundRunsService) {}

  matches(channel: string): boolean {
    return channel.startsWith('background:run:');
  }

  async authorize(
    channel: string,
    { workspaceId }: ChannelAuthorizerContext,
  ): Promise<{ error: string } | null> {
    const backgroundRunId = channel.slice('background:run:'.length);
    if (!isValidUuid(backgroundRunId)) {
      return { error: 'Not authorized for this background run' };
    }
    const allowed = await this.backgroundRunsService
      .verifyBackgroundRunOwnership(backgroundRunId, workspaceId)
      .catch(() => false);
    return allowed ? null : { error: 'Not authorized for this background run' };
  }
}
