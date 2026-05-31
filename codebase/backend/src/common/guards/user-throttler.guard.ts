import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

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
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
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
