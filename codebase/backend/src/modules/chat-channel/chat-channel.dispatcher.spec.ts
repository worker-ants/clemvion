import { toEiaEvent, isEmptyTextBody } from './chat-channel.dispatcher';
import type { ExecutionChannelEvent } from '../websocket/websocket.service';

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
