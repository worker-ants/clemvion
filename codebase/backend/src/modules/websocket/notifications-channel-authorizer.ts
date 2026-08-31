import { Injectable } from '@nestjs/common';
import {
  ChannelAuthorizer,
  ChannelAuthorizerContext,
} from './channel-authorizer';

/**
 * refactor 02 M-7 — `notifications:<userId>` 구독 인가. 도메인 서비스 의존이 없어(userId 비교만)
 * WS 모듈 로컬 provider 로 둔다.
 *
 * 04 M-6 (IDOR, 선제): user 단위 채널이므로 JWT sub(userId)와 채널의 userId 가 일치할 때만
 * 구독 허용. 이 가드는 선제로 들어왔으나 **더 이상 가정이 아니다** — `notification.new`
 * emit 은 구현·배선 완료(`WebsocketService.emitNotificationEvent` ← `NotificationsService`)라
 * 이 비교가 실제 트래픽에서 사용자간 알림 누출을 막고 있다 (spec §4.5).
 */
@Injectable()
export class NotificationsChannelAuthorizer implements ChannelAuthorizer {
  matches(channel: string): boolean {
    return channel.startsWith('notifications:');
  }

  // 동기 판별(userId 비교)이지만 ChannelAuthorizer.authorize 계약은 Promise 반환이다.
  // `async` 무-await 는 ESLint `@typescript-eslint/require-await` 위반이라 `Promise.resolve`
  // 래퍼로 시그니처를 맞춘다(다른 authorizer 는 실제 await 가 있어 `async` 사용).
  authorize(
    channel: string,
    { userId }: ChannelAuthorizerContext,
  ): Promise<{ error: string } | null> {
    const targetUserId = channel.slice('notifications:'.length);
    // userId 는 workspace 와 달리 JWT sub 에서 옴 — 빈 값/불일치 모두 거부.
    const allowed = !!userId && targetUserId === userId;
    return Promise.resolve(
      allowed ? null : { error: 'Not authorized for these notifications' },
    );
  }
}
