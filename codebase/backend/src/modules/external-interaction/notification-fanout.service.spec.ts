import { Logger } from '@nestjs/common';
import { NotificationFanout } from './notification-fanout.service';
import type { ExecutionChannelEvent } from '../websocket/websocket-events.types';

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
  tokenService?: { revokeAllForExecution: Mock; issuePerExecution?: Mock };
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
    issuePerExecution: jest.fn().mockResolvedValue({
      token: 'iext_jwt',
      expiresAt: '2026-11-20T15:00:00.000Z',
      jti: 'jti-1',
    }),
  };
  const fanout = new NotificationFanout(
    websocketService as never,
    dispatcher as never,
    triggerRepository as never,
    tokenService as never,
  );
  return {
    fanout,
    dispatcher,
    triggerRepository,
    tokenService,
    websocketService,
  };
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

  // 근거: CLE-API-EGRESS-PIPELINE §6 (NERV Task `CLE-T-DV6PN7`). 알림 웹훅 본문은 payload 만 싣는다.
  it('이벤트의 routing 은 알림 웹훅 본문에 싣지 않는다', async () => {
    const { fanout, dispatcher } = makeFanout({
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
    await invoke(fanout, {
      ...event('execution.completed', { triggerId: 'trg-1' }),
      routing: {
        chatChannel: {
          provider: 'telegram',
          conversationKey: 'conv-1',
          channelUserKey: 'user-1',
        },
      },
    });
    expect(dispatcher.enqueue).toHaveBeenCalledTimes(1);
    const [job] = dispatcher.enqueue.mock.calls[0] as [
      { eventBody: Record<string, unknown> },
    ];
    expect(job.eventBody).not.toHaveProperty('routing');
    expect(JSON.stringify(job)).not.toContain('user-1');
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

  it('triggerId 없는 terminal (수동 실행/routing context 미등록 webhook) → revoke 는 호출, notification fanout 은 skip [EIA-AU-04]', async () => {
    // EIA-AU-04 는 triggerId 조건이 없다 — terminal 이면 무조건 토큰 무효화 시도.
    // notification fanout 만 triggerId 게이트 뒤로 남는다 (trigger lookup 불가).
    const { fanout, tokenService, triggerRepository } = makeFanout({});
    await invoke(fanout, event('execution.completed', {}));
    expect(tokenService.revokeAllForExecution).toHaveBeenCalledWith('exec-1');
    expect(triggerRepository.findOne).not.toHaveBeenCalled();
  });

  it('non-terminal + triggerId 없음 → revoke 미호출, notification skip', async () => {
    const { fanout, tokenService, triggerRepository } = makeFanout({});
    await invoke(fanout, event('execution.waiting_for_input', {}));
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

// 근거: [EIA 알림 웹훅 「재시도와 실패 처리」](CLE-EIA-NOTIFY#재시도와-실패-처리) — 저장한 `retry.maxAttempts` 를
// 발송 큐의 `attempts` 로 넘긴다. 종전엔 읽지 않고 5회로 고정했다.
describe('NotificationFanout — retry.maxAttempts 를 발송 큐에 넘긴다', () => {
  function subscribedTrigger(retry?: unknown) {
    return {
      id: 'trg-1',
      workflowId: 'wf-1',
      config: {
        notification: {
          events: ['execution.completed'],
          ...(retry === undefined ? {} : { retry }),
        },
      },
    };
  }

  it('저장한 maxAttempts 를 attempts 로 넘긴다', async () => {
    const { fanout, dispatcher } = makeFanout({
      triggerRepository: {
        findOne: jest
          .fn()
          .mockResolvedValue(subscribedTrigger({ maxAttempts: 3 })),
      },
    });
    await invoke(fanout, event('execution.completed', { triggerId: 'trg-1' }));
    expect(dispatcher.enqueue).toHaveBeenCalledWith(expect.anything(), {
      attempts: 3,
    });
  });

  it('retry 가 없으면 기본 5회를 넘긴다', async () => {
    const { fanout, dispatcher } = makeFanout({
      triggerRepository: {
        findOne: jest.fn().mockResolvedValue(subscribedTrigger()),
      },
    });
    await invoke(fanout, event('execution.completed', { triggerId: 'trg-1' }));
    expect(dispatcher.enqueue).toHaveBeenCalledWith(expect.anything(), {
      attempts: 5,
    });
  });

  it('maxAttempts 0 은 1회(큐 재시도 없음)로 넘긴다', async () => {
    const { fanout, dispatcher } = makeFanout({
      triggerRepository: {
        findOne: jest
          .fn()
          .mockResolvedValue(subscribedTrigger({ maxAttempts: 0 })),
      },
    });
    await invoke(fanout, event('execution.completed', { triggerId: 'trg-1' }));
    expect(dispatcher.enqueue).toHaveBeenCalledWith(expect.anything(), {
      attempts: 1,
    });
  });
});

describe('NotificationFanout — 구독 라이프사이클', () => {
  it('onModuleInit → executionEvents$ 1회 구독', () => {
    const { fanout, websocketService } = makeFanout({});
    fanout.onModuleInit();
    expect(websocketService.executionEvents$.subscribe).toHaveBeenCalledTimes(
      1,
    );
  });

  it('onModuleDestroy → 구독 unsubscribe', () => {
    const unsubscribe = jest.fn();
    const { fanout, websocketService } = makeFanout({});
    websocketService.executionEvents$.subscribe.mockReturnValue({
      unsubscribe,
    });
    fanout.onModuleInit();
    fanout.onModuleDestroy();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('onModuleInit 없이 onModuleDestroy → no-op (구독 없음)', () => {
    const { fanout } = makeFanout({});
    expect(() => fanout.onModuleDestroy()).not.toThrow();
  });
});

// CLE-T-AB21M6 — fanout 은 이벤트마다 처리를 기다리지 않고 띄운다. 트리거 조회 · 적재가 실패해도 처리되지 않은
// 거부가 남으면 안 된다(Node 26 은 그 거부로 프로세스를 끝낸다). 실패는 경고 로그로 남기고 그 알림은 버린다.
// 근거: CLE-EIA-DATA 「알림 웹훅 발송」 적재 실패 · Rationale 「알림 적재 실패를 경고 로그로 받는다」.
describe('NotificationFanout — 조회 · 적재 실패를 경고 로그로 받는다', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    warn.mockRestore();
  });

  /** 이벤트 루프를 몇 번 돌려 띄운 처리(`handle`)와 그 `.catch` 가 끝나게 한다. */
  const flush = async (): Promise<void> => {
    for (let i = 0; i < 5; i += 1) await new Promise((r) => setImmediate(r));
  };

  it('트리거 조회가 실패하면 경고를 남기고 적재하지 않는다(거부 없이 끝난다)', async () => {
    const { fanout, dispatcher } = makeFanout({
      triggerRepository: {
        findOne: jest.fn().mockRejectedValue(new Error('db connection lost')),
      },
    });

    await expect(
      invoke(fanout, event('execution.completed', { triggerId: 'trg-1' })),
    ).resolves.toBeUndefined();

    expect(dispatcher.enqueue).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    const message = String(warn.mock.calls[0][0]);
    expect(message).toContain('trg-1');
    expect(message).toContain('execution.completed');
    expect(message).toContain('db connection lost');
  });

  it('트리거 조회가 실패해도 종료 이벤트의 토큰 무효화는 먼저 끝난다', async () => {
    const { fanout, tokenService } = makeFanout({
      triggerRepository: {
        findOne: jest.fn().mockRejectedValue(new Error('db connection lost')),
      },
    });
    await invoke(fanout, event('execution.failed', { triggerId: 'trg-1' }));
    expect(tokenService.revokeAllForExecution).toHaveBeenCalledWith('exec-1');
  });

  it('구독에서 띄운 처리가 거부되면 경고를 남긴다(처리되지 않은 거부가 남지 않는다)', async () => {
    const { fanout, websocketService } = makeFanout({
      dispatcher: {
        enqueue: jest.fn().mockRejectedValue(new Error('enqueue exploded')),
      },
      triggerRepository: {
        findOne: jest.fn().mockResolvedValue({
          id: 'trg-1',
          workflowId: 'wf-1',
          config: { notification: { events: ['execution.completed'] } },
        }),
      },
    });
    fanout.onModuleInit();
    const [[subscriber]] = websocketService.executionEvents$.subscribe.mock
      .calls as unknown as [[{ next: (e: ExecutionChannelEvent) => void }]];

    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown): void => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);
    try {
      subscriber.next(event('execution.completed', { triggerId: 'trg-1' }));
      await flush();
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }

    expect(unhandled).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
    const message = String(warn.mock.calls[0][0]);
    expect(message).toContain('execution.completed');
    expect(message).toContain('exec-1');
    expect(message).toContain('enqueue exploded');
  });
});

// 근거: CLE-EIA-NOTIFY REQ-EIANOTI-033, CLE-EIA-NOTIFY-EVENTS 「`execution.waiting_for_input`」. 블록은 마스킹이 끝난
// fanout 봉투에 붙이고 SSE 에는 싣지 않는다. 202 응답과 같은 빌더(`interaction-block.ts`)를 쓴다.
describe('NotificationFanout — 입력 대기 알림의 interaction 블록 [REQ-EIANOTI-033]', () => {
  const ENDPOINTS = {
    stream: '/api/external/executions/exec-1/stream',
    submit: '/api/external/executions/exec-1/interact',
    status: '/api/external/executions/exec-1',
    cancel: '/api/external/executions/exec-1/cancel',
    refresh: '/api/external/executions/exec-1/refresh-token',
  };

  function trigger(
    interaction: unknown,
    events: string[] = ['execution.waiting_for_input'],
  ) {
    return {
      id: 'trg-1',
      workflowId: 'wf-1',
      config: {
        notification: { events },
        ...(interaction === undefined ? {} : { interaction }),
      },
    };
  }

  function setup(interaction: unknown, events?: string[]) {
    return makeFanout({
      triggerRepository: {
        findOne: jest.fn().mockResolvedValue(trigger(interaction, events)),
      },
    });
  }

  function sentPayload(dispatcher: { enqueue: Mock }): Record<string, unknown> {
    const [[job]] = dispatcher.enqueue.mock.calls as [
      [{ eventBody: { payload: Record<string, unknown> } }],
    ];
    return job.eventBody.payload;
  }

  function waiting(interactionType: string): ExecutionChannelEvent {
    return event('execution.waiting_for_input', {
      triggerId: 'trg-1',
      status: 'waiting_for_input',
      waitingNodeId: 'node-1',
      interactionType,
    });
  }

  it.each([
    ['form', ['submit_form']],
    ['buttons', ['click_button']],
    ['ai_conversation', ['submit_message', 'end_conversation']],
  ])(
    'per_execution · %s → 새 토큰 · 만료 시각 · 엔드포인트 · 권장 명령을 싣는다',
    async (interactionType, expectedCommands) => {
      const { fanout, dispatcher, tokenService } = setup({ enabled: true });
      await invoke(fanout, waiting(interactionType));
      expect(tokenService.issuePerExecution).toHaveBeenCalledWith('exec-1');
      const payload = sentPayload(dispatcher);
      expect(payload.interaction).toEqual({
        token: 'iext_jwt',
        expiresAt: '2026-11-20T15:00:00.000Z',
        endpoints: ENDPOINTS,
        expectedCommands,
      });
      // 기존 평면 필드는 그대로 남는다.
      expect(payload).toMatchObject({
        triggerId: 'trg-1',
        status: 'waiting_for_input',
        waitingNodeId: 'node-1',
        interactionType,
      });
    },
  );

  it.each([
    ['form', ['submit_form']],
    ['buttons', ['click_button']],
    ['ai_conversation', ['submit_message', 'end_conversation']],
  ])(
    'per_trigger · %s → token · expiresAt 키 없이 엔드포인트와 권장 명령만 싣는다',
    async (interactionType, expectedCommands) => {
      const { fanout, dispatcher, tokenService } = setup({
        enabled: true,
        tokenStrategy: 'per_trigger',
      });
      await invoke(fanout, waiting(interactionType));
      expect(tokenService.issuePerExecution).not.toHaveBeenCalled();
      expect(sentPayload(dispatcher).interaction).toEqual({
        endpoints: ENDPOINTS,
        expectedCommands,
      });
    },
  );

  it.each([
    ['interaction 설정 없음', undefined],
    ['interaction 꺼짐', { enabled: false }],
  ])(
    '%s → 블록 없이 보내고 토큰을 발급하지 않는다',
    async (_l, interaction) => {
      const { fanout, dispatcher, tokenService } = setup(interaction);
      await invoke(fanout, waiting('form'));
      expect(dispatcher.enqueue).toHaveBeenCalledTimes(1);
      expect(sentPayload(dispatcher)).not.toHaveProperty('interaction');
      expect(tokenService.issuePerExecution).not.toHaveBeenCalled();
    },
  );

  it('입력 대기를 구독하지 않으면 토큰을 발급하지 않는다', async () => {
    const { fanout, dispatcher, tokenService } = setup({ enabled: true }, [
      'execution.completed',
    ]);
    await invoke(fanout, waiting('form'));
    expect(dispatcher.enqueue).not.toHaveBeenCalled();
    expect(tokenService.issuePerExecution).not.toHaveBeenCalled();
  });

  it.each([
    'execution.completed',
    'execution.failed',
    'execution.cancelled',
    'execution.ai_message',
  ])('%s 알림에는 블록을 싣지 않는다', async (eventType) => {
    const { fanout, dispatcher, tokenService } = setup({ enabled: true }, [
      eventType,
    ]);
    await invoke(fanout, event(eventType, { triggerId: 'trg-1' }));
    expect(dispatcher.enqueue).toHaveBeenCalledTimes(1);
    expect(sentPayload(dispatcher)).not.toHaveProperty('interaction');
    expect(tokenService.issuePerExecution).not.toHaveBeenCalled();
  });

  it('이벤트 원본 payload 를 바꾸지 않는다(같은 이벤트를 SSE 도 받는다)', async () => {
    const { fanout, dispatcher } = setup({ enabled: true });
    const evt = waiting('form');
    await invoke(fanout, evt);
    expect(sentPayload(dispatcher)).toHaveProperty('interaction');
    expect(evt.payload).not.toHaveProperty('interaction');
    expect(sentPayload(dispatcher)).not.toBe(evt.payload);
  });

  it('마스킹이 끝난 봉투에 붙이므로 token 원문이 그대로 나간다', async () => {
    // fanout 은 받은 봉투를 다시 가리지 않는다. `*token` 키를 가리는 마스커를 거치면 토큰이 쓸모없어진다.
    const { fanout, dispatcher } = setup({ enabled: true });
    await invoke(fanout, waiting('form'));
    const interaction = sentPayload(dispatcher).interaction as {
      token: string;
    };
    expect(interaction.token).toBe('iext_jwt');
  });

  describe('토큰 발급이 실패하면', () => {
    let warn: jest.SpyInstance;
    beforeEach(() => {
      warn = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
    });
    afterEach(() => warn.mockRestore());

    it('블록 없이 알림을 보내고 경고를 남긴다', async () => {
      const { fanout, dispatcher } = makeFanout({
        triggerRepository: {
          findOne: jest.fn().mockResolvedValue(trigger({ enabled: true })),
        },
        tokenService: {
          revokeAllForExecution: jest.fn(),
          issuePerExecution: jest
            .fn()
            .mockRejectedValue(new Error('sign failed')),
        },
      });
      await invoke(fanout, waiting('form'));
      expect(dispatcher.enqueue).toHaveBeenCalledTimes(1);
      expect(sentPayload(dispatcher)).not.toHaveProperty('interaction');
      expect(warn).toHaveBeenCalledTimes(1);
      const message = String(warn.mock.calls[0][0]);
      expect(message).toContain('exec-1');
      expect(message).toContain('sign failed');
    });
  });
});
