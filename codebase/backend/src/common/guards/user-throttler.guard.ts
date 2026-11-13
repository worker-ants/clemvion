import { ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { isHttpContext } from '../utils/http-context';

/** {@link DeferGlobalThrottle} 가 붙이는 메타데이터 키. */
export const DEFER_GLOBAL_THROTTLE_KEY = 'deferGlobalThrottle';

/**
 * 전역 {@link UserThrottlerGuard} 가 이 라우트를 세지 않고 라우트 가드에 넘기게 한다.
 *
 * 한도를 걸지 말지가 요청 대상에 따라 갈리는데 그 대상을 라우트 가드가 조회해야 알 수 있을 때 쓴다.
 * 전역 가드는 라우트 가드보다 먼저 돌아서 그 조회 결과를 볼 수 없다. 이 데코레이터를 붙인 라우트에는
 * `UserThrottlerGuard` 를 상속한 라우트 가드를 반드시 함께 둔다. 빠뜨리면 그 라우트는 전역 한도를
 * 전혀 받지 않는다. 지금 쓰는 곳은 `POST /hooks/:endpointPath` 와 `HookTriggerThrottlerGuard` 하나다.
 */
export const DeferGlobalThrottle = () =>
  SetMetadata(DEFER_GLOBAL_THROTTLE_KEY, true);

/**
 * 전역 ThrottlerGuard 를 **user 인지(user-aware)** 로 확장한다.
 *
 * 기본 `ThrottlerGuard` 는 `req.ip` 로만 키를 만들어 같은 IP(회사 NAT,
 * 단일 e2e 컨테이너 등) 의 여러 사용자가 한 버킷을 공유한다. 본 가드는
 * 인증된 요청이면 `user.sub` 로 키를 만들어 **사용자당** rate-limit 을
 * 보장하고, 미인증(로그인 전 auth 엔드포인트 등) 이면 IP 로 폴백한다.
 *
 * 도입 동기: Re-run rate-limit (spec/5-system/13-replay-rerun.md §12 — 사용자당
 * 분당 10회). 라우트의 `@Throttle({ default: { ttl, limit } })` 메타는 그대로
 * 적용되며, 키만 사용자 단위로 바뀐다. 미인증 라우트 동작은 IP 폴백으로 무변경.
 *
 * HTTP 요청만 센다. WebSocket 게이트웨이 핸들러는 건너뛰고 소켓 단위 `WsRateLimitGuard` 가 맡는다
 * (`shouldSkip` 참조). `@DeferGlobalThrottle()` 이 붙은 라우트도 건너뛰고 그 라우트 가드가 센다.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  /**
   * HTTP 요청만 센다. NestJS 12 부터 `APP_GUARD` 가 WebSocket 게이트웨이 핸들러에도 붙는데, 그
   * 컨텍스트의 요청은 소켓이라 `user` · `ip` 가 없어 모든 사용자가 `'unknown'` 한 버킷을 나눠 쓴다.
   * WebSocket 빈도 제한은 소켓 단위 `WsRateLimitGuard` 가 맡는다
   * ([WebSocket 연결과 채널 구독 「에러 코드」](CLE-API-WS#71-에러-코드)).
   *
   * `@DeferGlobalThrottle()` 이 붙은 라우트도 세지 않는다. 그 라우트의 라우트 가드가 같은 설정 ·
   * 저장소 · 키로 센다.
   */
  protected shouldSkip(context: ExecutionContext): Promise<boolean> {
    if (!isHttpContext(context)) return Promise.resolve(true);
    const deferred = this.reflector.getAllAndOverride<boolean | undefined>(
      DEFER_GLOBAL_THROTTLE_KEY,
      [context.getHandler(), context.getClass()],
    );
    return Promise.resolve(deferred === true);
  }

  // base `ThrottlerGuard.getTracker` 의 `Promise<string>` 반환 계약을 유지하되,
  // 내부에 await 가 없어 `async` 는 불필요(@typescript-eslint/require-await).
  // `Promise.resolve` 로 동일 계약을 충족한다.
  protected getTracker(req: Record<string, unknown>): Promise<string> {
    const user = req['user'] as { sub?: string; userId?: string } | undefined;
    const userId = user?.sub ?? user?.userId;
    if (userId) return Promise.resolve(`user:${userId}`);
    const ip = (req['ip'] as string | undefined) ?? 'unknown';
    return Promise.resolve(ip);
  }
}
