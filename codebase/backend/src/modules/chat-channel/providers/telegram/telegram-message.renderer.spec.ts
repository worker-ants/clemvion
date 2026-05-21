import {
  renderTelegramMessages,
  escapeMarkdownV2,
} from './telegram-message.renderer';
import type { ChatChannelConfig, EiaEvent } from '../../types';

const BASE_CONFIG: ChatChannelConfig = {
  provider: 'telegram',
  botToken: 't',
};

const BASE_EVENT_FIELDS = {
  executionId: 'e1',
  triggerId: 'tr1',
  workflowId: 'wf1',
  seq: 0,
  timestamp: '2026-05-21T00:00:00.000Z',
};

describe('escapeMarkdownV2', () => {
  it('special 글자를 backslash escape', () => {
    expect(escapeMarkdownV2('hello.world')).toBe('hello\\.world');
    expect(escapeMarkdownV2('a_b*c')).toBe('a\\_b\\*c');
    expect(escapeMarkdownV2('(1)')).toBe('\\(1\\)');
  });
  it('일반 글자는 그대로', () => {
    expect(escapeMarkdownV2('abc 가나다')).toBe('abc 가나다');
  });
});

describe('renderTelegramMessages', () => {
  it('ai_message → text 1건', async () => {
    const event: EiaEvent = {
      ...BASE_EVENT_FIELDS,
      type: 'execution.ai_message',
      message: 'hi.',
      turnCount: 1,
    };
    const messages = await Promise.resolve(
      renderTelegramMessages(event, BASE_CONFIG),
    );
    expect(messages).toHaveLength(1);
    expect(messages[0].body).toEqual({
      kind: 'text',
      text: 'hi\\.',
      chunked: false,
    });
  });

  it('ai_message 4096자 초과 → chunked text', async () => {
    const long = 'a'.repeat(5000);
    const event: EiaEvent = {
      ...BASE_EVENT_FIELDS,
      type: 'execution.ai_message',
      message: long,
      turnCount: 1,
    };
    const messages = renderTelegramMessages(event, BASE_CONFIG);
    expect(messages.length).toBeGreaterThan(1);
    messages.forEach((m) => {
      if (m.body.kind === 'text') {
        expect(m.body.text.length).toBeLessThanOrEqual(4096);
        expect(m.body.chunked).toBe(true);
      } else {
        fail('expected text body');
      }
    });
  });

  it('completed → languageHints.executionCompleted', () => {
    const event: EiaEvent = {
      ...BASE_EVENT_FIELDS,
      type: 'execution.completed',
      result: {},
    };
    const messages = renderTelegramMessages(event, {
      ...BASE_CONFIG,
      languageHints: { executionCompleted: '끝!' },
    });
    expect(messages[0].body).toEqual({
      kind: 'text',
      text: '끝\\!',
      chunked: false,
    });
  });

  it('completed → default 안내 (languageHints 없음)', () => {
    const event: EiaEvent = {
      ...BASE_EVENT_FIELDS,
      type: 'execution.completed',
      result: {},
    };
    const m = renderTelegramMessages(event, BASE_CONFIG);
    expect(m[0].body.kind).toBe('text');
  });

  it('failed → 사용자 안내 text', () => {
    const event: EiaEvent = {
      ...BASE_EVENT_FIELDS,
      type: 'execution.failed',
      error: { code: 'X', message: 'internal' },
    };
    const m = renderTelegramMessages(event, BASE_CONFIG);
    expect(m[0].body.kind).toBe('text');
  });

  it('cancelled → text', () => {
    const event: EiaEvent = {
      ...BASE_EVENT_FIELDS,
      type: 'execution.cancelled',
      result: { cancelledBy: 'user' },
    };
    const m = renderTelegramMessages(event, BASE_CONFIG);
    expect(m[0].body.kind).toBe('text');
  });

  it('waiting_for_input(ai_conversation) → conversationConfig.message → text', () => {
    const event: EiaEvent = {
      ...BASE_EVENT_FIELDS,
      type: 'execution.waiting_for_input',
      node: { id: 'n1', type: 'ai-agent', interactionType: 'ai_conversation' },
      interaction: {},
      context: { conversationConfig: { message: 'how can I help?' } },
    };
    const m = renderTelegramMessages(event, BASE_CONFIG);
    expect(m[0].body).toEqual({
      kind: 'text',
      text: 'how can I help?',
      chunked: false,
    });
  });

  it('waiting_for_input(buttons) → v1 fallback text', () => {
    const event: EiaEvent = {
      ...BASE_EVENT_FIELDS,
      type: 'execution.waiting_for_input',
      node: { id: 'n2', type: 'button', interactionType: 'buttons' },
      interaction: {},
      context: {},
    };
    const m = renderTelegramMessages(event, BASE_CONFIG);
    expect(m[0].body.kind).toBe('text');
  });

  it('waiting_for_input(form) → v1 fallback text', () => {
    const event: EiaEvent = {
      ...BASE_EVENT_FIELDS,
      type: 'execution.waiting_for_input',
      node: { id: 'n3', type: 'form', interactionType: 'form' },
      interaction: {},
      context: {},
    };
    const m = renderTelegramMessages(event, BASE_CONFIG);
    expect(m[0].body.kind).toBe('text');
  });
});
