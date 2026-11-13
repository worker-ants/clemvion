import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerException, ThrottlerStorageService } from '@nestjs/throttler';
import { DeferGlobalThrottle } from '../../common/guards/user-throttler.guard';
import type { Trigger } from '../triggers/entities/trigger.entity';
import { HookTriggerThrottlerGuard } from './hook-trigger-throttler.guard';

/**
 * `POST /hooks/:endpointPath` 의 전역 요청 한도(REQ-CHAT-079).
 *
 * 전역 가드는 이 라우트를 `@DeferGlobalThrottle()` 로 넘기고, 이 가드가 공개 웹훅 가드가 붙인
 * `req.__publicWebhookTrigger` 를 보고 채팅 채널 트리거만 빼고 같은 한도를 건다. 한도 설정 ·
 * 저장소 · tracker 는 전역 가드와 같으므로 채팅이 아닌 웹훅의 동작은 그대로다.
 */
describe('HookTriggerThrottlerGuard', () => {
  class HooksControllerStub {
    @DeferGlobalThrottle()
    receiveWebhook(): void {}
  }

  const buildGuard = async (): Promise<HookTriggerThrottlerGuard> => {
    const guard = new HookTriggerThrottlerGuard(
      { throttlers: [{ name: 'default', ttl: 60_000, limit: 2 }] },
      new ThrottlerStorageService(),
      new Reflector(),
    );
    await guard.onModuleInit();
    return guard;
  };

  const chatTrigger = (provider: string): Partial<Trigger> => ({
    endpointPath: 'chat-hook',
    config: {
      chatChannel: {
        provider,
        inboundSigningRef: 'secret://triggers/t/inbound-signing',
      },
    },
  });
  // 서명 참조가 없는 채팅 채널 트리거(옛 트리거 · 채널 연결 전). 인증기가 서명 검증을 건너뛴다.
  const unsignedChatTrigger: Partial<Trigger> = {
    endpointPath: 'unsigned-chat-hook',
    config: { chatChannel: { provider: 'telegram' } },
  };
  const plainTrigger: Partial<Trigger> = {
    endpointPath: 'plain-hook',
    config: {},
  };

  const buildContext = (
    req: Record<string, unknown>,
    type: 'http' | 'ws' = 'http',
  ): ExecutionContext =>
    ({
      getType: () => type,
      getHandler: () => HooksControllerStub.prototype.receiveWebhook,
      getClass: () => HooksControllerStub,
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => ({ header: jest.fn() }),
      }),
    }) as unknown as ExecutionContext;

  const hit = (guard: HookTriggerThrottlerGuard, trigger: unknown) =>
    guard.canActivate(
      buildContext({ ip: '203.0.113.7', __publicWebhookTrigger: trigger }),
    );

  it.each(['slack', 'discord', 'telegram'])(
    '서명 참조가 있는 채팅 채널 트리거(%s)는 limit 을 넘겨도 통과시킨다',
    async (provider) => {
      const guard = await buildGuard();
      for (let i = 0; i < 5; i += 1) {
        await expect(hit(guard, chatTrigger(provider))).resolves.toBe(true);
      }
    },
  );

  it('채팅 채널 요청은 세지 않는다 — 같은 IP 의 일반 웹훅 한도를 쓰지 않는다', async () => {
    const guard = await buildGuard();
    for (let i = 0; i < 5; i += 1) {
      await hit(guard, chatTrigger('slack'));
    }
    // limit 2 — 채팅 요청이 셌다면 첫 일반 요청부터 막힌다.
    await expect(hit(guard, plainTrigger)).resolves.toBe(true);
    await expect(hit(guard, plainTrigger)).resolves.toBe(true);
  });

  it('채팅이 아닌 웹훅 트리거는 limit 을 넘으면 막는다', async () => {
    // 스텁 핸들러에는 `@DeferGlobalThrottle()` 이 붙어 있다. 이 가드까지 그 메타데이터로 자신을
    // 건너뛰면 일반 웹훅의 전역 한도가 통째로 사라지므로, 여기서 막히는 것이 그 회귀를 잡는다.
    const guard = await buildGuard();
    await expect(hit(guard, plainTrigger)).resolves.toBe(true);
    await expect(hit(guard, plainTrigger)).resolves.toBe(true);
    await expect(hit(guard, plainTrigger)).rejects.toBeInstanceOf(
      ThrottlerException,
    );
  });

  // 근거: NERV 질문 `01a1d322-7833-756b-a20d-2e3e247411f3` 답 A(2026-11-13). 서명을 검증하지 않는
  // 트리거를 빼면 IP 단위 한도가 하나도 남지 않는다(서명 검증 실패 한도도 걸리지 않는다).
  it('서명 참조가 없는 채팅 채널 트리거는 limit 을 넘으면 막는다', async () => {
    const guard = await buildGuard();
    await expect(hit(guard, unsignedChatTrigger)).resolves.toBe(true);
    await expect(hit(guard, unsignedChatTrigger)).resolves.toBe(true);
    await expect(hit(guard, unsignedChatTrigger)).rejects.toBeInstanceOf(
      ThrottlerException,
    );
  });

  it.each([
    ['트리거 없음(null) — 404 로 끝날 요청', null],
    ['조회 실패로 첨부되지 않음(undefined)', undefined],
    ['provider 가 빈 문자열', { config: { chatChannel: { provider: '' } } }],
  ])('%s 은 한도를 건다', async (_label, trigger) => {
    const guard = await buildGuard();
    await expect(hit(guard, trigger)).resolves.toBe(true);
    await expect(hit(guard, trigger)).resolves.toBe(true);
    await expect(hit(guard, trigger)).rejects.toBeInstanceOf(
      ThrottlerException,
    );
  });

  it('HTTP 가 아닌 컨텍스트는 세지 않는다', async () => {
    const guard = await buildGuard();
    for (let i = 0; i < 3; i += 1) {
      await expect(
        guard.canActivate(buildContext({ id: 'socket-1' }, 'ws')),
      ).resolves.toBe(true);
    }
  });
});
