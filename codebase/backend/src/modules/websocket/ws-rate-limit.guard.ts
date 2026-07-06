import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { WsErrorCode } from './ws-error-codes';
import { WsRateLimiterService } from './ws-rate-limiter.service';

/**
 * WS 명령 rate-limit 가드 (Spec §7.1). `@SubscribeMessage` 핸들러 실행 **전에** 소켓의
 * 메시지 빈도(60/min)를 검사하고, 초과 시 `WsException(RATE_LIMITED)` 를 던져 핸들러를
 * 실행하지 않는다 — NestJS WsExceptionsHandler 가 클라이언트에 `exception` 이벤트로
 * `{ code: 'RATE_LIMITED', message }` 를 emit 한다.
 *
 * 카운터는 `WsRateLimiterService`(in-memory per-socket)가 소유하고 gateway 의
 * `handleDisconnect` 가 `release()` 로 정리한다.
 */
@Injectable()
export class WsRateLimitGuard implements CanActivate {
  constructor(private readonly limiter: WsRateLimiterService) {}

  canActivate(context: ExecutionContext): boolean {
    // HTTP 등 non-ws 컨텍스트에는 적용하지 않는다(방어적 — gateway 전용이라 정상 경로엔 ws 만).
    if (context.getType() !== 'ws') return true;

    const client = context.switchToWs().getClient<Socket>();
    if (!this.limiter.consume(client.id)) {
      throw new WsException({
        code: WsErrorCode.RATE_LIMITED,
        message: 'WS 명령 빈도 제한(분당 60건)을 초과했습니다. 잠시 후 다시 시도해 주세요.',
      });
    }
    return true;
  }
}
