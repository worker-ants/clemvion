import { NotificationFanout } from './notification-fanout.service';
import type { ExecutionChannelEvent } from '../websocket/websocket.service';

type Mock = jest.Mock;

/**
 * NotificationFanout 단위 테스트 — [Spec EIA §3.3 EIA-AU-04 / §6].
 *
 * 핵심 invariant: terminal event (`completed`/`failed`/`cancelled`) 시 해당 execution 의
 * iext jti 무효화(`revokeAllForExecution`)는 **outbound notification config 유무와 독립** 해야 한다.
 * interaction-only 트리거 (notification 미설정) 도 종료 시 토큰을 즉시 invalidate 해야 EIA-AU-04 충족.
 */

function makeFanout(deps: {
  dispatcher?: { enqueue: Mock };
  triggerRepository?: { findOne: Mock };
  tokenService?: { revokeAllForExecution: Mock };
}) {
  const websocketService = {
    executionEvents$: {
      subscribe: jest.fn(() => ({ unsubscribe: jest.fn() })),
    },
  };
  const dispatcher = deps.dispatcher ?? { enqueue: jest.fn() };
  const triggerRepository = deps.triggerRepository ?? {
    findOne: jest.fn().mockResolvedValue(null),
  };
  const tokenService = deps.tokenService ?? {
    revokeAllForExecution: jest.fn().mockResolvedValue({ revoked: 0 }),
  };
  const fanout = new NotificationFanout(
    websocketService as never,
    dispatcher as never,
    triggerRepository as never,
    tokenService as never,
  );
  return { fanout, dispatcher, triggerRepository, tokenService };
}

function event(
  eventType: string,
  payload: Record<string, unknown> = {},
): ExecutionChannelEvent {
  return {
    executionId: 'exec-1',
    eventType,
    seq: 1,
    payload,
  };
}

/** private handle() 직접 호출 — 결정적 테스트 (subscription 의 fire-and-forget 우회). */
function invoke(
  fanout: NotificationFanout,
  evt: ExecutionChannelEvent,
): Promise<void> {
  return (
    fanout as unknown as { handle: (e: ExecutionChannelEvent) => Promise<void> }
  ).handle(evt);
}

describe('NotificationFanout — terminal revoke 게이트 [EIA-AU-04]', () => {
  it('terminal + notification 미설정 트리거 → revokeAllForExecution 호출 (enqueue 는 skip)', async () => {
    // interaction-only 트리거: config 에 notification 없음.
    const { fanout, dispatcher, tokenService } = makeFanout({
      triggerRepository: {
        findOne: jest.fn().mockResolvedValue({ id: 'trg-1', config: {} }),
      },
    });
    await invoke(fanout, event('execution.completed', { triggerId: 'trg-1' }));
    expect(tokenService.revokeAllForExecution).toHaveBeenCalledWith('exec-1');
    expect(dispatcher.enqueue).not.toHaveBeenCalled();
  });

  it('terminal + notification 구독 → revoke + enqueue 둘 다 호출', async () => {
    const { fanout, dispatcher, tokenService } = makeFanout({
      triggerRepository: {
        findOne: jest.fn().mockResolvedValue({
          id: 'trg-1',
          workflowId: 'wf-1',
          config: {
            notification: { events: ['execution.completed'] },
          },
        }),
      },
    });
    await invoke(fanout, event('execution.completed', { triggerId: 'trg-1' }));
    expect(tokenService.revokeAllForExecution).toHaveBeenCalledWith('exec-1');
    expect(dispatcher.enqueue).toHaveBeenCalledTimes(1);
  });

  it('terminal + notification 설정됐으나 해당 event 미구독 → revoke 는 호출, enqueue 는 skip', async () => {
    const { fanout, dispatcher, tokenService } = makeFanout({
      triggerRepository: {
        findOne: jest.fn().mockResolvedValue({
          id: 'trg-1',
          config: { notification: { events: ['execution.waiting_for_input'] } },
        }),
      },
    });
    await invoke(fanout, event('execution.cancelled', { triggerId: 'trg-1' }));
    expect(tokenService.revokeAllForExecution).toHaveBeenCalledWith('exec-1');
    expect(dispatcher.enqueue).not.toHaveBeenCalled();
  });

  it('terminal + trigger 미발견 → revoke 는 호출 (토큰 무효화는 trigger lookup 과 독립)', async () => {
    const { fanout, tokenService } = makeFanout({
      triggerRepository: { findOne: jest.fn().mockResolvedValue(null) },
    });
    await invoke(fanout, event('execution.failed', { triggerId: 'trg-1' }));
    expect(tokenService.revokeAllForExecution).toHaveBeenCalledWith('exec-1');
  });

  it('non-terminal event (waiting_for_input) → revoke 미호출', async () => {
    const { fanout, tokenService } = makeFanout({
      triggerRepository: {
        findOne: jest.fn().mockResolvedValue({
          id: 'trg-1',
          config: { notification: { events: ['execution.waiting_for_input'] } },
        }),
      },
    });
    await invoke(
      fanout,
      event('execution.waiting_for_input', { triggerId: 'trg-1' }),
    );
    expect(tokenService.revokeAllForExecution).not.toHaveBeenCalled();
  });

  it('triggerId 없는 manual 실행 terminal → revoke 미호출 (불필요 쿼리 회피)', async () => {
    const { fanout, tokenService, triggerRepository } = makeFanout({});
    await invoke(fanout, event('execution.completed', {}));
    expect(tokenService.revokeAllForExecution).not.toHaveBeenCalled();
    expect(triggerRepository.findOne).not.toHaveBeenCalled();
  });

  it('revokeAllForExecution throw 해도 fail-open — notification 구독 시 enqueue 는 계속', async () => {
    const { fanout, dispatcher, tokenService } = makeFanout({
      tokenService: {
        revokeAllForExecution: jest
          .fn()
          .mockRejectedValue(new Error('redis down')),
      },
      triggerRepository: {
        findOne: jest.fn().mockResolvedValue({
          id: 'trg-1',
          workflowId: 'wf-1',
          config: { notification: { events: ['execution.completed'] } },
        }),
      },
    });
    await invoke(fanout, event('execution.completed', { triggerId: 'trg-1' }));
    expect(tokenService.revokeAllForExecution).toHaveBeenCalled();
    expect(dispatcher.enqueue).toHaveBeenCalledTimes(1);
  });
});
