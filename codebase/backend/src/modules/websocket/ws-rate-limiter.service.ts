import { Injectable } from '@nestjs/common';

/**
 * WS 명령 빈도 제한 — **socket 당** 분당 60 메시지 (Spec §7.1).
 *
 * WebSocket 소켓은 특정 인스턴스에 상주하므로(연결이 한 프로세스에 고정) Redis 없이
 * **in-memory fixed-window** 카운터로 충분하다 — 외부 interaction REST rate-limit
 * (execution 단위, Redis)과 달리 프로세스-로컬 상태가 곧 권위다. 소켓 종료 시
 * `release()` 로 카운터를 정리한다(누수 방지).
 *
 * 초과 판정은 `WsRateLimitGuard` 가 소비하며, 초과 시 `WsException(RATE_LIMITED)` 로
 * 거부한다. Redis/분산이 필요한 시나리오(단일 사용자의 다중 소켓 합산 등)는 본 spec
 * 범위 밖(§7.1 은 "WS 명령 빈도 60/min" 만 규정).
 */
@Injectable()
export class WsRateLimiterService {
  /** 한도: 분당 60 메시지 per socket (Spec §7.1). */
  static readonly LIMIT_PER_MINUTE = 60;
  static readonly WINDOW_MS = 60_000;

  private readonly state = new Map<
    string,
    { count: number; windowStart: number }
  >();

  /**
   * socket 의 이번 메시지를 카운트하고 한도 이내인지 반환한다(fixed-window).
   * 윈도우가 지났으면 리셋. 한도 초과면 false(거부).
   */
  consume(socketId: string): boolean {
    const now = Date.now();
    const s = this.state.get(socketId);
    if (!s || now - s.windowStart >= WsRateLimiterService.WINDOW_MS) {
      this.state.set(socketId, { count: 1, windowStart: now });
      return true;
    }
    s.count += 1;
    return s.count <= WsRateLimiterService.LIMIT_PER_MINUTE;
  }

  /** 소켓 종료 시 카운터 정리 (handleDisconnect 에서 호출). */
  release(socketId: string): void {
    this.state.delete(socketId);
  }

  /** 현재 추적 중인 소켓 수(테스트/관찰용). */
  get trackedCount(): number {
    return this.state.size;
  }
}
