import {
  toChatChannelEvent,
  isEmptyTextBody,
  ChatChannelDispatcher,
} from './chat-channel.dispatcher';
import { Logger } from '@nestjs/common';
import type { ExecutionChannelEvent } from '../websocket/websocket-events.types';
import type { ChannelMessage } from './types';

/**
 * toChatChannelEvent — WS protocol §4.4 flat emit shape ↔ EIA spec §6.2 nested
 * webhook shape 변환 검증.
 *
 * 회귀 배경 — plan/in-progress/chat-channel-outbound-still-broken.md
 * Follow-up #4: dispatcher 가 emit (flat) 을 받아 renderer 가 기대하는
 * EiaWaitingForInputEvent (nested) 로 변환하지 못해 모든
 * `execution.waiting_for_input` event 가 toChatChannelEvent null 로 silent skip 된
 * 회귀. 본 spec 은 buttons / form / ai_conversation 3 emit 케이스를 모두
 * 검증해 회귀 재발을 차단한다.
 */
describe('toChatChannelEvent — execution.waiting_for_input emit→EIA shape', () => {
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
    const eia = toChatChannelEvent(event);
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
    const eia = toChatChannelEvent(event);
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
    const eia = toChatChannelEvent(event);
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
    const eia = toChatChannelEvent(event);
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
    expect(toChatChannelEvent(event)).toBeNull();
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
    expect(toChatChannelEvent(event)).toBeNull();
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
    const eia = toChatChannelEvent(event);
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
    expect(toChatChannelEvent(event)).toBeNull();
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
 * `toChatChannelEvent` — `execution.failed` 의 **레거시 문자열 흡수 경로**.
 *
 * 엔진은 2026-08-14 부터 전 경로에서 §6.4 object 를 emit 한다(`toTerminalErrorPayload`).
 * 이 경로는 **배포 경계에서 재생되는 이벤트** 전용이다 — 제거하면 그 창 동안 dispatcher 가
 * null 을 반환해 outbound 가 skip 되고, 사용자가 CCH-ERR-* 안내를 못 받는다
 * (2026-05-25 에 고친 그 회귀).
 *
 * 종전 JSDoc 은 형제 파일에서 방금 걷어낸 것과 **같은 죽은 참조**(존재한 적 없는 plan
 * 이름·지금은 다른 코드를 가리키는 줄 번호)를 갖고 있었다. 소스만 고치고 스펙 파일을
 * 놓친 것이다 (`23_34_12` requirement W3).
 */
describe('toChatChannelEvent — execution.failed back-compat (string error wrap, 2026-05-25)', () => {
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
    const eia = toChatChannelEvent(event);
    expect(eia).not.toBeNull();
    if (eia?.type !== 'execution.failed') throw new Error();
    expect(eia.error.code).toBe('HTTP_4XX');
    expect((eia.error.details as { statusCode: number }).statusCode).toBe(401);
  });

  it('payload.error 가 string → wrap (레거시 흡수, code=null)', () => {
    const event: ExecutionChannelEvent = {
      ...baseEnvelope,
      payload: {
        ...baseRouting,
        status: 'failed',
        error: 'Error: {"error":{"code":429,"message":"You exceeded quota"}}',
      },
    };
    const eia = toChatChannelEvent(event);
    expect(eia).not.toBeNull();
    if (eia?.type !== 'execution.failed') throw new Error();
    // §6.4 는 부재를 명시적 `null` 로 표현한다. 존재하지 않는 코드를 지어내면
    // unknown warn 로그가 유령 코드를 보고해 조사자를 헤매게 한다.
    expect(eia.error.code).toBeNull();
    expect(eia.error.message).toContain('quota');
  });

  it('payload.error 가 undefined / 잘못된 타입 → wrap (placeholder, code=null)', () => {
    const event: ExecutionChannelEvent = {
      ...baseEnvelope,
      payload: {
        ...baseRouting,
        status: 'failed',
        // error 미존재
      },
    };
    const eia = toChatChannelEvent(event);
    expect(eia).not.toBeNull();
    if (eia?.type !== 'execution.failed') throw new Error();
    // §6.4 는 부재를 명시적 `null` 로 표현한다. 존재하지 않는 코드를 지어내면
    // unknown warn 로그가 유령 코드를 보고해 조사자를 헤매게 한다.
    expect(eia.error.code).toBeNull();
    expect(eia.error.message).toBe('unknown error');
  });

  it('payload.error 가 number → 스칼라 문자열화 (placeholder 아님)', () => {
    const event: ExecutionChannelEvent = {
      ...baseEnvelope,
      payload: {
        ...baseRouting,
        status: 'failed',
        error: 42,
      },
    };
    const eia = toChatChannelEvent(event);
    expect(eia).not.toBeNull();
    if (eia?.type !== 'execution.failed') throw new Error();
    // §6.4 는 부재를 명시적 `null` 로 표현한다. 존재하지 않는 코드를 지어내면
    // unknown warn 로그가 유령 코드를 보고해 조사자를 헤매게 한다.
    expect(eia.error.code).toBeNull();
    // **placeholder 가 아니다.** 공용 헬퍼로 통일한 뒤 스칼라는 문자열화된다 —
    // 제목·주석이 "placeholder" 라 부르는 동안 실제 동작은 달랐고, `message` 를 단언하지
    // 않아 그 차이가 드러나지 않았다 (`00_02_43` testing W2).
    expect(eia.error.message).toBe('42');
  });
});

// `durationMs` wire 변환 (2026-08-15). CHANGELOG 가 breaking 으로 고지한 계약인데
// 이 경계에 회귀 테스트가 없었다 (`10_34_51` testing W4). 세 상태를 각각 고정한다.
describe('toChatChannelEvent — durationMs 전파', () => {
  const mk = (status: 'completed' | 'failed' | 'cancelled', extra: object) =>
    toChatChannelEvent({
      executionId: 'exec-dur',
      eventType: `execution.${status}`,
      seq: 7,
      payload: {
        triggerId: 'trig-1',
        workflowId: 'wf-1',
        timestamp: '2026-08-15T00:00:00.000Z',
        status,
        ...extra,
      },
    } as unknown as ExecutionChannelEvent);

  it.each([
    ['completed', 4242],
    ['failed', 0],
    ['cancelled', 999],
  ] as const)('%s — 숫자를 그대로 싣는다', (status, ms) => {
    const eia = mk(status, {
      durationMs: ms,
      error: { code: null, message: 'x' },
    });
    expect((eia as { durationMs?: number | null } | null)?.durationMs).toBe(ms);
  });

  it('null 을 그대로 싣는다 — 값을 모르는 것과 필드 없음을 구분한다', () => {
    const eia = mk('completed', { durationMs: null });
    expect(
      (eia as { durationMs?: number | null } | null)?.durationMs,
    ).toBeNull();
  });

  it('레거시(키 부재) 이벤트도 깨지지 않는다', () => {
    // 배포 경계에서 재생되는 이벤트에는 이 키가 없다.
    const eia = mk('completed', {});
    expect(eia).not.toBeNull();
    expect(
      (eia as { durationMs?: number | null } | null)?.durationMs,
    ).toBeUndefined();
  });
});

// §7.5 / 방안 D — execution.cancelled 의 payload.error (RESUME_*) 전파.
// 채널 어댑터가 graceful 세션 만료 안내로 분기하려면 error.code 가 EIA 이벤트로
// 전달돼야 한다. 일반 cancel (사용자 /cancel 등) 에는 error 미포함.
describe('toChatChannelEvent — execution.cancelled error 전파 (방안 D)', () => {
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
    const eia = toChatChannelEvent(event);
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
    const eia = toChatChannelEvent(event);
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
    const eia = toChatChannelEvent(event);
    expect(eia).not.toBeNull();
    if (eia?.type !== 'execution.cancelled') throw new Error();
    expect(eia.error).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 2026-05-25 — toChatChannelEvent 의 `execution.ai_message` 분기가 payload 의
// `presentations?: PresentationPayload[]` 필드를 추출하는지 회귀 차단.
// 추출 누락 시 chat-channel renderer 가 event.presentations === undefined 로
// 보아 회귀 ② (AI render_* sequential 발송) 가 실패. SoT: spec §6.5 line 536 +
// chat-channel-adapter.md §1.2 line 89.
// ---------------------------------------------------------------------------
describe('toChatChannelEvent — execution.ai_message presentations[] 추출 (CCH-MP-01 보강)', () => {
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
    const eia = toChatChannelEvent(event);
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
    const eia = toChatChannelEvent(event);
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
    const eia = toChatChannelEvent(event);
    expect(eia).not.toBeNull();
    if (eia?.type !== 'execution.ai_message') throw new Error();
    expect(eia.presentations).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// W-2 회귀 보호: fanout seam 에서 strip 된 llmCalls 가 toChatChannelEvent 를
// 거쳐 EiaAiMessageEvent 에도 나타나지 않음을 검증.
//
// llmCalls 는 WebsocketService.emitExecutionEvent 의 fanout seam 에서 이미
// strip 되므로, dispatcher 가 받는 ExecutionChannelEvent.payload 에는 도달하지
// 않는다. 본 테스트는 strip 이 실패한 경우(방어)에도 dispatcher 의 변환 결과
// (EiaAiMessageEvent) 에 llmCalls 가 없음을 단언한다 (이중 방어).
// SoT: WS spec §4.4 strip-only / EIA §6.5 / chat-channel CCH-MP-01.
// ---------------------------------------------------------------------------
describe('toChatChannelEvent — execution.ai_message llmCalls 미포함 회귀 (W-2)', () => {
  const baseRouting = {
    triggerId: 'trig-1',
    workflowId: 'wf-1',
    timestamp: '2026-06-03T09:00:00.000Z',
  };

  it('payload 에 llmCalls 가 있어도 EiaAiMessageEvent 에 llmCalls 없음 (strip 이 실패한 경우 방어)', () => {
    // 실제 운용에서는 fanout seam strip 이 먼저 제거하지만,
    // 만약 strip 이 실패해 payload 에 llmCalls 가 남아 있더라도
    // dispatcher 의 변환이 llmCalls 를 전달하지 않는지 검증.
    const event: ExecutionChannelEvent = {
      executionId: 'exec-llm',
      eventType: 'execution.ai_message',
      seq: 3,
      payload: {
        ...baseRouting,
        message: 'hello',
        turnCount: 1,
        messages: [{ role: 'assistant', content: 'hello' }],
        metadata: { model: 'claude' },
        llmCalls: [
          {
            requestPayload: { system: 'SECRET SYSTEM PROMPT', messages: [] },
            responsePayload: { content: 'hello' },
            durationMs: 150,
          },
        ],
      },
    };
    const eia = toChatChannelEvent(event);
    expect(eia).not.toBeNull();
    if (eia?.type !== 'execution.ai_message') throw new Error();
    // EiaAiMessageEvent 에 llmCalls 가 없어야 한다
    expect(eia).not.toHaveProperty('llmCalls');
    // 정상 필드는 보존
    expect(eia.message).toBe('hello');
    expect(eia.turnCount).toBe(1);
  });

  it('정상 경로 (llmCalls 없는 payload) — message/turnCount/metadata 보존', () => {
    const event: ExecutionChannelEvent = {
      executionId: 'exec-normal',
      eventType: 'execution.ai_message',
      seq: 4,
      payload: {
        ...baseRouting,
        message: 'world',
        turnCount: 2,
        metadata: { model: 'claude-3' },
      },
    };
    const eia = toChatChannelEvent(event);
    expect(eia).not.toBeNull();
    if (eia?.type !== 'execution.ai_message') throw new Error();
    expect(eia).not.toHaveProperty('llmCalls');
    expect(eia.message).toBe('world');
    expect(eia.metadata).toEqual({ model: 'claude-3' });
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
describe('toChatChannelEvent — execution.node.completed (chat-channel-internal, CCH-AD-07)', () => {
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
    const eia = toChatChannelEvent(event);
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
      const eia = toChatChannelEvent(event);
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
      const eia = toChatChannelEvent(event);
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
    const eia = toChatChannelEvent(event);
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
    const eia = toChatChannelEvent(event);
    expect(eia).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// §4.1 native modal 게이팅 — waiting_for_input(form) 도착 시 renderNode 결과를 보고
// form_modal → pendingFormModal persist, form_prompt → formState persist.
// SoT: spec/conventions/chat-channel-adapter.md §4.1.
// ---------------------------------------------------------------------------
/**
 * dispatcher 테스트용 공통 배선. 생성자 인자 5개와 fixture shape 이 한 곳에만 있도록 모은다 —
 * 종전에는 두 describe 가 같은 배선을 각자 복제하고 있었다(`14_01_46` maintainability WARNING 2).
 *
 * 두 축만 옵션으로 연다:
 *  - `renderResult` — adapter.renderNode 가 돌려줄 메시지 (기본 없음)
 *  - `lookupState`  — conversationService.lookup 이 돌려줄 상태 (기본 undefined = 대화 없음)
 */
function buildDispatcherHarness(
  opts: {
    renderResult?: ChannelMessage[];
    lookupState?: Record<string, unknown>;
  } = {},
) {
  const state = opts.lookupState;
  const upsert = jest.fn(async () => undefined);
  const conversationService = {
    lookup: jest.fn(async () => state),
    upsert,
    updateExecutionId: jest.fn(async () => undefined),
  };
  const adapter = {
    provider: 'slack',
    supportsNativeForm: true,
    renderNode: jest.fn(async () => opts.renderResult ?? []),
    sendMessage: jest.fn(async () => ({
      externalMsgId: 'm',
      sentAt: '2026-05-28T00:00:00Z',
    })),
  };
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
    { get: jest.fn(() => adapter) } as never,
    { has: jest.fn(() => true) } as never,
    conversationService as never,
    triggerRepository as never,
  );
  return { dispatcher, adapter, state, upsert, triggerRepository };
}

/**
 * `handle` 은 dispatcher 의 private 메서드다. 로그 레벨 분기·form persist 처럼 **호출부의
 * 판단**을 보는 테스트는 이 진입점을 거쳐야만 도달한다. 캐스트가 4곳에 복제돼 있던 것을
 * 한 자리로 모은다 (ai-review `18_38_10` maintainability INFO 9).
 */
function callHandle(
  dispatcher: unknown,
  event: ExecutionChannelEvent,
): Promise<void> {
  return (
    dispatcher as { handle: (e: ExecutionChannelEvent) => Promise<void> }
  ).handle(event);
}

/**
 * `toChatChannelEvent` 가 null 을 돌려줄 때 dispatcher 가 **debug 로 격하할지 warn 으로
 * 남길지** 가르는 분기(`isSubFilterNull`).
 *
 * 이 분기는 standalone `toChatChannelEvent` 테스트로는 도달할 수 없다 — 그 함수는 null 만
 * 돌려주고, "그 null 을 어떤 로그 레벨로 다룰지" 는 호출부의 판단이기 때문이다.
 * 그래서 `handle()` 를 통해 본다.
 *
 * **두 방향을 다 본다.** 한쪽만 고정하면 삼항을 뒤집는 회귀(정상 skip 을 warn 으로 쏟아내거나,
 * 진짜 에러를 debug 로 묻어 버리거나)가 절반은 통과한다. 전자는 운영 로그 노이즈, 후자는
 * 회귀 신호 유실 — 둘 다 이 분기가 막으려던 것이다.
 */
describe('ChatChannelDispatcher.handle — toChatChannelEvent null 의 로그 레벨 분기', () => {
  function buildNullEvent(
    eventType: string,
    extra: Record<string, unknown>,
  ): ExecutionChannelEvent {
    return {
      executionId: 'exec-1',
      eventType,
      seq: 1,
      payload: {
        triggerId: 'trig-1',
        workflowId: 'wf-1',
        timestamp: '2026-05-28T00:00:00Z',
        chatChannel: { conversationKey: 'D1' },
        ...extra,
      },
    } as ExecutionChannelEvent;
  }

  it('execution.node.completed 의 sub-filter null 은 debug 로 격하 (warn 아님)', async () => {
    const { dispatcher } = buildDispatcherHarness();
    const debugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    try {
      // 비-presentation 노드 타입 → toChatChannelEvent 가 정상적으로 null.
      await callHandle(
        dispatcher,
        buildNullEvent('execution.node.completed', {
          nodeId: 'n1',
          nodeType: 'http_request',
        }),
      );
      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringContaining('toChatChannelEvent null'),
      );
      expect(warnSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('toChatChannelEvent null'),
      );
    } finally {
      debugSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });

  it('그 외 eventType 의 null 은 warn 유지 (에러성 신호라 묻지 않는다)', async () => {
    const { dispatcher } = buildDispatcherHarness();
    const debugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    try {
      // message 가 string 이 아니라 toChatChannelEvent 가 null — 에러성.
      await callHandle(
        dispatcher,
        buildNullEvent('execution.ai_message', { message: { not: 'string' } }),
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('toChatChannelEvent null'),
      );
      expect(debugSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('toChatChannelEvent null'),
      );
    } finally {
      debugSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });
});

describe('ChatChannelDispatcher.handle — form 게이팅 state persist', () => {
  function buildDispatcher(renderResult: ChannelMessage[]) {
    const lookupState: Record<string, unknown> = {
      executionId: 'exec-1',
      threadId: 'default',
      channelUserKey: 'U1',
      startedAt: '2026-05-28T00:00:00Z',
      lastUpdateAt: '2026-05-28T00:00:00Z',
    };
    const { dispatcher, upsert } = buildDispatcherHarness({
      renderResult,
      lookupState,
    });
    return { dispatcher, state: lookupState, upsert };
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
    await callHandle(dispatcher, formEvent);
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
    await callHandle(dispatcher, formEvent);
    expect(state.formState).toMatchObject({
      nodeId: 'node-form',
      currentFieldIdx: 0,
    });
    expect(state.pendingFormModal).toBeUndefined();
  });
});
