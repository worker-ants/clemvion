import {
  toEiaEvent,
  isEmptyTextBody,
  ChatChannelDispatcher,
} from './chat-channel.dispatcher';
import type { ExecutionChannelEvent } from '../websocket/websocket.service';
import type { ChannelMessage } from './types';

/**
 * toEiaEvent — WS protocol §4.4 flat emit shape ↔ EIA spec §6.2 nested
 * webhook shape 변환 검증.
 *
 * 회귀 배경 — plan/in-progress/chat-channel-outbound-still-broken.md
 * Follow-up #4: dispatcher 가 emit (flat) 을 받아 renderer 가 기대하는
 * EiaWaitingForInputEvent (nested) 로 변환하지 못해 모든
 * `execution.waiting_for_input` event 가 toEiaEvent null 로 silent skip 된
 * 회귀. 본 spec 은 buttons / form / ai_conversation 3 emit 케이스를 모두
 * 검증해 회귀 재발을 차단한다.
 */
describe('toEiaEvent — execution.waiting_for_input emit→EIA shape', () => {
  const baseEnvelope = {
    executionId: 'exec-1',
    eventType: 'execution.waiting_for_input',
    seq: 5,
  };
  const baseRouting = {
    triggerId: 'trig-1',
    workflowId: 'wf-1',
    timestamp: '2026-05-25T00:00:00.000Z',
  };

  it('buttons emit (flat) → nested with context.buttonConfig', () => {
    const event: ExecutionChannelEvent = {
      ...baseEnvelope,
      payload: {
        ...baseRouting,
        status: 'waiting_for_input',
        waitingNodeId: 'node-buttons',
        waitingNodeType: 'carousel',
        waitingNodeLabel: 'Choose product',
        interactionType: 'buttons',
        conversationThread: { messages: [] },
        buttonConfig: {
          buttons: [{ id: 'a', label: 'A' }],
          nodeOutput: { nodeType: 'carousel', payload: { items: [] } },
        },
      },
    };
    const eia = toEiaEvent(event);
    expect(eia).not.toBeNull();
    expect(eia?.type).toBe('execution.waiting_for_input');
    if (eia?.type !== 'execution.waiting_for_input') throw new Error();
    expect(eia.node).toEqual({
      id: 'node-buttons',
      type: 'carousel',
      interactionType: 'buttons',
    });
    expect(eia.context.buttonConfig).toEqual(event.payload.buttonConfig);
    expect(eia.context.conversationThread).toEqual({ messages: [] });
    expect(eia.triggerId).toBe('trig-1');
    expect(eia.workflowId).toBe('wf-1');
  });

  it('form emit (flat) → nested with context.formConfig from nodeOutput.config', () => {
    const event: ExecutionChannelEvent = {
      ...baseEnvelope,
      payload: {
        ...baseRouting,
        status: 'waiting_for_input',
        waitingNodeId: 'node-form',
        waitingNodeType: 'form',
        waitingNodeLabel: 'Survey',
        interactionType: 'form',
        conversationThread: { messages: [] },
        nodeOutput: {
          config: { fields: [{ name: 'email', type: 'text' }] },
        },
      },
    };
    const eia = toEiaEvent(event);
    expect(eia).not.toBeNull();
    if (eia?.type !== 'execution.waiting_for_input') throw new Error();
    expect(eia.node.interactionType).toBe('form');
    expect(eia.context.formConfig).toEqual({
      fields: [{ name: 'email', type: 'text' }],
    });
  });

  it('ai_conversation emit (flat) → nested with context.conversationConfig from nodeOutput', () => {
    const event: ExecutionChannelEvent = {
      ...baseEnvelope,
      payload: {
        ...baseRouting,
        status: 'waiting_for_input',
        waitingNodeId: 'node-ai',
        waitingNodeType: 'ai_agent',
        waitingNodeLabel: 'Chat',
        interactionType: 'ai_conversation',
        conversationThread: { messages: [] },
        nodeOutput: {
          interactionType: 'ai_conversation',
          conversationConfig: { message: 'Hello, how can I help?' },
        },
      },
    };
    const eia = toEiaEvent(event);
    expect(eia).not.toBeNull();
    if (eia?.type !== 'execution.waiting_for_input') throw new Error();
    expect(eia.node.interactionType).toBe('ai_conversation');
    expect(eia.context.conversationConfig).toEqual({
      message: 'Hello, how can I help?',
    });
  });

  it('back-compat: nested emit (node/interaction/context already present) passes through', () => {
    const event: ExecutionChannelEvent = {
      ...baseEnvelope,
      payload: {
        ...baseRouting,
        node: {
          id: 'node-x',
          type: 'form',
          interactionType: 'form',
        },
        interaction: { someStateKey: 1 },
        context: {
          formConfig: { fields: [{ name: 'q1' }] },
        },
      },
    };
    const eia = toEiaEvent(event);
    expect(eia).not.toBeNull();
    if (eia?.type !== 'execution.waiting_for_input') throw new Error();
    expect(eia.node.id).toBe('node-x');
    expect(eia.interaction).toEqual({ someStateKey: 1 });
    expect(eia.context.formConfig).toEqual({ fields: [{ name: 'q1' }] });
  });

  it('missing waitingNodeId → null', () => {
    const event: ExecutionChannelEvent = {
      ...baseEnvelope,
      payload: {
        ...baseRouting,
        // waitingNodeId missing
        waitingNodeType: 'form',
        interactionType: 'form',
      },
    };
    expect(toEiaEvent(event)).toBeNull();
  });

  it('unknown interactionType → null', () => {
    const event: ExecutionChannelEvent = {
      ...baseEnvelope,
      payload: {
        ...baseRouting,
        waitingNodeId: 'node-bad',
        waitingNodeType: 'form',
        interactionType: 'unknown',
      },
    };
    expect(toEiaEvent(event)).toBeNull();
  });

  // interaction-type-registry §1: WaitingInteractionType 4종 (ai_form_render 2026-05-23 추가).
  // dispatcher 가 ai_form_render 도 인지해야 함 — null 반환 → outbound skip 버그 fix 회귀 보호.
  it('ai_form_render emit → nested with context.conversationConfig (ai-agent render_form blocking sub-state)', () => {
    const event: ExecutionChannelEvent = {
      ...baseEnvelope,
      payload: {
        ...baseRouting,
        status: 'waiting_for_input',
        waitingNodeId: 'node-aiagent',
        waitingNodeType: 'ai_agent',
        interactionType: 'ai_form_render',
        conversationThread: { messages: [] },
        nodeOutput: {
          conversationConfig: {
            message: '폼을 작성해 주세요',
            pendingFormToolCall: { toolCallId: 'tc-1' },
          },
        },
      },
    };
    const eia = toEiaEvent(event);
    expect(eia).not.toBeNull();
    if (eia?.type !== 'execution.waiting_for_input') throw new Error();
    expect(eia.node).toEqual({
      id: 'node-aiagent',
      type: 'ai_agent',
      interactionType: 'ai_form_render',
    });
    expect(eia.context.conversationConfig).toEqual({
      message: '폼을 작성해 주세요',
      pendingFormToolCall: { toolCallId: 'tc-1' },
    });
  });

  it('missing triggerId or workflowId → null (base contract)', () => {
    const event: ExecutionChannelEvent = {
      ...baseEnvelope,
      payload: {
        // triggerId / workflowId missing
        timestamp: '2026-05-25T00:00:00.000Z',
        waitingNodeId: 'node-z',
        waitingNodeType: 'form',
        interactionType: 'form',
      },
    };
    expect(toEiaEvent(event)).toBeNull();
  });
});

/**
 * isEmptyTextBody — sendMessage 호출 직전 빈 text guard.
 *
 * 회귀 보호: upstream emit (예: ai_message.message 가 empty string) 으로 renderer 가 빈 text 를
 * 반환했을 때 provider API 가 400 ("message text is empty" — Telegram Bot API documented) 으로
 * reject 하던 버그 fix. dispatcher 가 호출 직전 skip + warn log.
 */
describe('isEmptyTextBody — sendMessage 호출 직전 빈 text guard', () => {
  it('text body — 빈 string → true', () => {
    expect(isEmptyTextBody({ kind: 'text', text: '' })).toBe(true);
  });
  it('text body — whitespace only (공백/탭/개행) → true (trim 적용)', () => {
    expect(isEmptyTextBody({ kind: 'text', text: '   \n\t  ' })).toBe(true);
  });
  it('text body — non-empty → false', () => {
    expect(isEmptyTextBody({ kind: 'text', text: 'hello' })).toBe(false);
  });
  it('buttons body — 빈 text → true (buttons 도 prompt text 필요)', () => {
    expect(
      isEmptyTextBody({
        kind: 'buttons',
        text: '',
        buttons: [{ id: 'a', label: 'A', type: 'callback' }],
      }),
    ).toBe(true);
  });
  it('buttons body — non-empty text → false', () => {
    expect(
      isEmptyTextBody({
        kind: 'buttons',
        text: '선택해주세요',
        buttons: [{ id: 'a', label: 'A', type: 'callback' }],
      }),
    ).toBe(false);
  });
  it('image body → false (다른 자원, 본 guard 비대상)', () => {
    expect(
      isEmptyTextBody({
        kind: 'image',
        bytes: Buffer.from('x'),
        fallbackText: '',
      }),
    ).toBe(false);
  });
  it('form_prompt / typing → false (본 guard 비대상)', () => {
    expect(
      isEmptyTextBody({ kind: 'form_prompt', fieldName: 'q', label: 'Q' }),
    ).toBe(false);
    expect(isEmptyTextBody({ kind: 'typing' })).toBe(false);
  });
});

/**
 * toEiaEvent — execution.failed back-compat (string error wrap).
 *
 * 회귀 보호: execution-engine 이 emit 하는 payload.error 가 EIA §6.4 의 object shape 가
 * 아닌 string (errMessage) 인 경우 (execution-engine.service.ts line 1339-1346 / 2526-2533) —
 * dispatcher 가 object 만 인정해 null 반환 → outbound skip → CCH-ERR-* 안내 미발송.
 * dispatcher 차원 back-compat: string 도 generic object 로 wrap (classifier unknown
 * fallback → executionFailedInternal 안내 발송).
 */
describe('toEiaEvent — execution.failed back-compat (string error wrap, 2026-05-25)', () => {
  const baseEnvelope: Pick<
    ExecutionChannelEvent,
    'executionId' | 'eventType' | 'seq'
  > = {
    executionId: 'exec-1',
    eventType: 'execution.failed',
    seq: 9,
  };
  const baseRouting = {
    triggerId: 'trig-1',
    workflowId: 'wf-1',
    timestamp: '2026-05-25T00:00:00.000Z',
  };

  it('payload.error 가 object → 기존 처리 (정상 path)', () => {
    const event: ExecutionChannelEvent = {
      ...baseEnvelope,
      payload: {
        ...baseRouting,
        status: 'failed',
        error: {
          code: 'HTTP_4XX',
          message: 'Bad request',
          details: { statusCode: 401 },
        },
      },
    };
    const eia = toEiaEvent(event);
    expect(eia).not.toBeNull();
    if (eia?.type !== 'execution.failed') throw new Error();
    expect(eia.error.code).toBe('HTTP_4XX');
    expect((eia.error.details as { statusCode: number }).statusCode).toBe(401);
  });

  it('payload.error 가 string → wrap (back-compat, code=INTERNAL_ERROR)', () => {
    const event: ExecutionChannelEvent = {
      ...baseEnvelope,
      payload: {
        ...baseRouting,
        status: 'failed',
        error: 'Error: {"error":{"code":429,"message":"You exceeded quota"}}',
      },
    };
    const eia = toEiaEvent(event);
    expect(eia).not.toBeNull();
    if (eia?.type !== 'execution.failed') throw new Error();
    expect(eia.error.code).toBe('INTERNAL_ERROR');
    expect(eia.error.message).toContain('quota');
  });

  it('payload.error 가 undefined / 잘못된 타입 → wrap (placeholder, code=INTERNAL_ERROR)', () => {
    const event: ExecutionChannelEvent = {
      ...baseEnvelope,
      payload: {
        ...baseRouting,
        status: 'failed',
        // error 미존재
      },
    };
    const eia = toEiaEvent(event);
    expect(eia).not.toBeNull();
    if (eia?.type !== 'execution.failed') throw new Error();
    expect(eia.error.code).toBe('INTERNAL_ERROR');
    expect(eia.error.message).toBe('unknown error');
  });

  it('payload.error 가 number → wrap (placeholder)', () => {
    const event: ExecutionChannelEvent = {
      ...baseEnvelope,
      payload: {
        ...baseRouting,
        status: 'failed',
        error: 42,
      },
    };
    const eia = toEiaEvent(event);
    expect(eia).not.toBeNull();
    if (eia?.type !== 'execution.failed') throw new Error();
    expect(eia.error.code).toBe('INTERNAL_ERROR');
  });
});

// §7.5 / 방안 D — execution.cancelled 의 payload.error (RESUME_*) 전파.
// 채널 어댑터가 graceful 세션 만료 안내로 분기하려면 error.code 가 EIA 이벤트로
// 전달돼야 한다. 일반 cancel (사용자 /cancel 등) 에는 error 미포함.
describe('toEiaEvent — execution.cancelled error 전파 (방안 D)', () => {
  const baseEnvelope: Pick<
    ExecutionChannelEvent,
    'executionId' | 'eventType' | 'seq'
  > = {
    executionId: 'exec-1',
    eventType: 'execution.cancelled',
    seq: 11,
  };
  const baseRouting = {
    triggerId: 'trig-1',
    workflowId: 'wf-1',
    timestamp: '2026-05-31T00:00:00.000Z',
  };

  it('payload.error.code=RESUME_INCOMPATIBLE_STATE → error 전파', () => {
    const event: ExecutionChannelEvent = {
      ...baseEnvelope,
      payload: {
        ...baseRouting,
        status: 'cancelled',
        result: { cancelledBy: 'system' },
        error: { code: 'RESUME_INCOMPATIBLE_STATE', message: 'expired' },
      },
    };
    const eia = toEiaEvent(event);
    expect(eia).not.toBeNull();
    if (eia?.type !== 'execution.cancelled') throw new Error();
    expect(eia.error?.code).toBe('RESUME_INCOMPATIBLE_STATE');
  });

  it('payload.error 부재 (일반 cancel) → error 미포함', () => {
    const event: ExecutionChannelEvent = {
      ...baseEnvelope,
      payload: {
        ...baseRouting,
        status: 'cancelled',
        result: { cancelledBy: 'user' },
      },
    };
    const eia = toEiaEvent(event);
    expect(eia).not.toBeNull();
    if (eia?.type !== 'execution.cancelled') throw new Error();
    expect(eia.error).toBeUndefined();
  });

  it('payload.error 가 non-object (string) → error 미포함', () => {
    const event: ExecutionChannelEvent = {
      ...baseEnvelope,
      payload: {
        ...baseRouting,
        status: 'cancelled',
        result: { cancelledBy: 'system' },
        error: 'some string',
      },
    };
    const eia = toEiaEvent(event);
    expect(eia).not.toBeNull();
    if (eia?.type !== 'execution.cancelled') throw new Error();
    expect(eia.error).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 2026-05-25 — toEiaEvent 의 `execution.ai_message` 분기가 payload 의
// `presentations?: PresentationPayload[]` 필드를 추출하는지 회귀 차단.
// 추출 누락 시 chat-channel renderer 가 event.presentations === undefined 로
// 보아 회귀 ② (AI render_* sequential 발송) 가 실패. SoT: spec §6.5 line 536 +
// chat-channel-adapter.md §1.2 line 89.
// ---------------------------------------------------------------------------
describe('toEiaEvent — execution.ai_message presentations[] 추출 (CCH-MP-01 보강)', () => {
  const baseRouting = {
    triggerId: 'trig-1',
    workflowId: 'wf-1',
    timestamp: '2026-05-25T07:00:00.000Z',
  };

  it('payload.presentations[] 가 있으면 EiaAiMessageEvent.presentations 에 그대로 옮긴다', () => {
    const presentations = [
      {
        type: 'carousel',
        toolCallId: 'tc-1',
        renderedAt: '2026-05-25T07:00:00.000Z',
        payload: { items: [{ title: 'A' }] },
      },
    ];
    const event: ExecutionChannelEvent = {
      executionId: 'exec-1',
      eventType: 'execution.ai_message',
      seq: 7,
      payload: {
        ...baseRouting,
        message: 'hi',
        turnCount: 2,
        presentations,
      },
    };
    const eia = toEiaEvent(event);
    expect(eia).not.toBeNull();
    if (eia?.type !== 'execution.ai_message') throw new Error();
    expect(eia.presentations).toEqual(presentations);
  });

  it('payload.presentations 가 없으면 EiaAiMessageEvent.presentations 미정의 (회귀 차단)', () => {
    const event: ExecutionChannelEvent = {
      executionId: 'exec-1',
      eventType: 'execution.ai_message',
      seq: 7,
      payload: {
        ...baseRouting,
        message: 'hi',
        turnCount: 2,
      },
    };
    const eia = toEiaEvent(event);
    expect(eia).not.toBeNull();
    if (eia?.type !== 'execution.ai_message') throw new Error();
    expect(eia.presentations).toBeUndefined();
  });

  it('payload.presentations 가 non-array (잘못된 타입) → 무시 (presentations 미정의)', () => {
    const event: ExecutionChannelEvent = {
      executionId: 'exec-1',
      eventType: 'execution.ai_message',
      seq: 7,
      payload: {
        ...baseRouting,
        message: 'hi',
        turnCount: 2,
        presentations: 'not-an-array',
      },
    };
    const eia = toEiaEvent(event);
    expect(eia).not.toBeNull();
    if (eia?.type !== 'execution.ai_message') throw new Error();
    expect(eia.presentations).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 2026-05-25 — chat-channel-internal listener (CCH-AD-07 / CCH-MP-06)
// presentation 노드 (carousel/table/chart/template) 비-blocking 완료 시
// `execution.node.completed` 를 in-process WS Subject 에서 추가 픽업해
// `ChatChannelInternalEvent` 로 변환. blocking 케이스는 sub-filter 가
// 사전 제외 (status === 'waiting_for_input' → null).
// SoT: spec/conventions/chat-channel-adapter.md §1.3 / §3 / §R-CCA-7,
//      spec/5-system/15-chat-channel.md §3.1 CCH-AD-07 / §3.3 CCH-MP-06.
// ---------------------------------------------------------------------------
describe('toEiaEvent — execution.node.completed (chat-channel-internal, CCH-AD-07)', () => {
  const baseRouting = {
    triggerId: 'trig-1',
    workflowId: 'wf-1',
    timestamp: '2026-05-25T07:00:00.000Z',
  };

  // template / carousel / table / chart 4종은 각각 동일 패턴으로 정상 픽업
  it('template 비-blocking 완료 → ChatChannelInternalEvent (output.rendered 보존)', () => {
    const event: ExecutionChannelEvent = {
      executionId: 'exec-tmpl',
      eventType: 'execution.node.completed',
      seq: 3,
      payload: {
        ...baseRouting,
        nodeId: 'node-tmpl',
        nodeType: 'template',
        nodeLabel: '템플릿 2',
        output: { rendered: '카페24와 날씨에 대한 문의가 가능해요.' },
      },
    };
    const eia = toEiaEvent(event);
    expect(eia).not.toBeNull();
    if (eia?.type !== 'execution.node.completed') throw new Error();
    expect(eia.node).toEqual({
      id: 'node-tmpl',
      type: 'template',
      label: '템플릿 2',
    });
    expect(eia.output).toEqual({
      rendered: '카페24와 날씨에 대한 문의가 가능해요.',
    });
    expect(eia.triggerId).toBe('trig-1');
    expect(eia.workflowId).toBe('wf-1');
    expect(eia.executionId).toBe('exec-tmpl');
  });

  it.each(['carousel', 'table', 'chart'] as const)(
    '%s 비-blocking 완료 → ChatChannelInternalEvent (output 보존)',
    (nodeType) => {
      const event: ExecutionChannelEvent = {
        executionId: `exec-${nodeType}`,
        eventType: 'execution.node.completed',
        seq: 4,
        payload: {
          ...baseRouting,
          nodeId: `node-${nodeType}`,
          nodeType,
          output: { payload: { items: [{ title: 'a' }] } },
        },
      };
      const eia = toEiaEvent(event);
      expect(eia).not.toBeNull();
      if (eia?.type !== 'execution.node.completed') throw new Error();
      expect(eia.node.type).toBe(nodeType);
    },
  );

  // sub-filter: presentation 4종 외 nodeType 은 null (다른 노드 발화 안 함)
  it('비-presentation 노드 (ai_agent / code / http) → null (sub-filter 제외)', () => {
    for (const nodeType of ['ai_agent', 'code', 'http_request', 'form']) {
      const event: ExecutionChannelEvent = {
        executionId: 'exec-other',
        eventType: 'execution.node.completed',
        seq: 1,
        payload: {
          ...baseRouting,
          nodeId: 'node-other',
          nodeType,
          output: { result: 'ok' },
        },
      };
      const eia = toEiaEvent(event);
      expect(eia).toBeNull();
    }
  });

  // blocking 케이스 사전 제외 — execution.waiting_for_input 이 별도 처리
  it('output.status === "waiting_for_input" (blocking) → null (별도 흐름 처리)', () => {
    const event: ExecutionChannelEvent = {
      executionId: 'exec-block',
      eventType: 'execution.node.completed',
      seq: 2,
      payload: {
        ...baseRouting,
        nodeId: 'node-carousel-block',
        nodeType: 'carousel',
        output: {
          status: 'waiting_for_input',
          payload: { items: [] },
          buttonConfig: { buttons: [{ id: 'a', label: 'A' }] },
        },
      },
    };
    const eia = toEiaEvent(event);
    expect(eia).toBeNull();
  });

  // base contract: triggerId/workflowId 없으면 base 가드로 null
  it('triggerId 누락 → null', () => {
    const event: ExecutionChannelEvent = {
      executionId: 'exec-x',
      eventType: 'execution.node.completed',
      seq: 1,
      payload: {
        workflowId: 'wf-1',
        timestamp: '2026-05-25T00:00:00.000Z',
        nodeId: 'node-tmpl',
        nodeType: 'template',
        output: { rendered: 'x' },
      },
    };
    const eia = toEiaEvent(event);
    expect(eia).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// §4.1 native modal 게이팅 — waiting_for_input(form) 도착 시 renderNode 결과를 보고
// form_modal → pendingFormModal persist, form_prompt → formState persist.
// SoT: spec/conventions/chat-channel-adapter.md §4.1.
// ---------------------------------------------------------------------------
describe('ChatChannelDispatcher.handle — form 게이팅 state persist', () => {
  function buildDispatcher(renderResult: ChannelMessage[]) {
    const state: Record<string, unknown> = {
      executionId: 'exec-1',
      threadId: 'default',
      channelUserKey: 'U1',
      startedAt: '2026-05-28T00:00:00Z',
      lastUpdateAt: '2026-05-28T00:00:00Z',
    };
    const upsert = jest.fn(async () => undefined);
    const conversationService = {
      lookup: jest.fn(async () => state),
      upsert,
      updateExecutionId: jest.fn(async () => undefined),
    };
    const adapter = {
      provider: 'slack',
      supportsNativeForm: true,
      renderNode: jest.fn(async () => renderResult),
      sendMessage: jest.fn(async () => ({
        externalMsgId: 'm',
        sentAt: '2026-05-28T00:00:00Z',
      })),
    };
    const registry = { get: jest.fn(() => adapter) };
    const listenerRegistry = { has: jest.fn(() => true) };
    const triggerRepository = {
      findOne: jest.fn(async () => ({
        id: 'trig-1',
        workspaceId: 'ws',
        workflowId: 'wf-1',
        config: { chatChannel: { provider: 'slack' } },
        chatChannelHealth: 'healthy',
      })),
      update: jest.fn(async () => undefined),
    };
    const dispatcher = new ChatChannelDispatcher(
      { executionEvents$: { subscribe: jest.fn() } } as never,
      registry as never,
      listenerRegistry as never,
      conversationService as never,
      triggerRepository as never,
    );
    return { dispatcher, state, upsert };
  }

  const formEvent: ExecutionChannelEvent = {
    executionId: 'exec-1',
    eventType: 'execution.waiting_for_input',
    seq: 1,
    payload: {
      triggerId: 'trig-1',
      workflowId: 'wf-1',
      timestamp: '2026-05-28T00:00:00Z',
      chatChannel: { conversationKey: 'D1' },
      waitingNodeId: 'node-form',
      waitingNodeType: 'form',
      interactionType: 'form',
      nodeOutput: {
        config: { fields: [{ name: 'email', label: 'Email', type: 'email' }] },
      },
    },
  };

  it('renderNode → form_modal → pendingFormModal persist (formState 미설정)', async () => {
    const formModalMsg: ChannelMessage = {
      conversationKey: '',
      body: {
        kind: 'form_modal',
        openLabel: '양식 작성하기',
        formConfig: {
          fields: [{ name: 'email', label: 'Email', type: 'email' }],
        },
      },
    };
    const { dispatcher, state } = buildDispatcher([formModalMsg]);
    await (
      dispatcher as unknown as {
        handle: (e: ExecutionChannelEvent) => Promise<void>;
      }
    ).handle(formEvent);
    expect(state.pendingFormModal).toMatchObject({ nodeId: 'node-form' });
    expect(
      (state.pendingFormModal as { fields: unknown[] }).fields,
    ).toHaveLength(1);
    expect(state.formState).toBeUndefined();
  });

  it('renderNode → form_prompt → formState persist (pendingFormModal 미설정)', async () => {
    const formPromptMsg: ChannelMessage = {
      conversationKey: '',
      body: { kind: 'form_prompt', fieldName: 'email', label: 'Email' },
    };
    const { dispatcher, state } = buildDispatcher([formPromptMsg]);
    await (
      dispatcher as unknown as {
        handle: (e: ExecutionChannelEvent) => Promise<void>;
      }
    ).handle(formEvent);
    expect(state.formState).toMatchObject({
      nodeId: 'node-form',
      currentFieldIdx: 0,
    });
    expect(state.pendingFormModal).toBeUndefined();
  });
});
