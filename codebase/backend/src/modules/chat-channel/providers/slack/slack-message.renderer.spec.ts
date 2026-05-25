/**
 * SlackMessage renderer 단위 테스트 — EIA event → ChannelMessage[] (Phase 3).
 */
import { escapeSlackMrkdwn, renderSlackEvent } from './slack-message.renderer';
import type { ChatChannelConfig, EiaEvent } from '../../types';

const CONFIG: ChatChannelConfig = {
  provider: 'slack',
  botTokenRef: 'r',
  languageHints: {
    executionCompleted: '완료!',
    executionCancelled: '취소됨',
  },
};

const BASE: Omit<
  Extract<EiaEvent, { type: 'execution.ai_message' }>,
  'message' | 'turnCount'
> = {
  type: 'execution.ai_message',
  executionId: 'e1',
  triggerId: 't1',
  workflowId: 'w1',
  seq: 1,
  timestamp: '2026-05-24T00:00:00Z',
};

describe('escapeSlackMrkdwn', () => {
  it('<, >, & 만 escape', () => {
    expect(escapeSlackMrkdwn('a & b < c > d')).toBe('a &amp; b &lt; c &gt; d');
  });
  it('일반 markdown chars 는 그대로', () => {
    expect(escapeSlackMrkdwn('*bold* _italic_ `code`')).toBe(
      '*bold* _italic_ `code`',
    );
  });
});

describe('renderSlackEvent — basic event types', () => {
  it('ai_message → text', () => {
    const msgs = renderSlackEvent(
      { ...BASE, message: 'hello', turnCount: 1 },
      CONFIG,
    );
    expect(msgs).toHaveLength(1);
    expect(msgs[0].body).toEqual({ kind: 'text', text: 'hello' });
  });

  it('completed → languageHints text', () => {
    const msgs = renderSlackEvent(
      {
        type: 'execution.completed',
        executionId: 'e',
        triggerId: 't',
        workflowId: 'w',
        seq: 1,
        timestamp: '2026-05-24T00:00:00Z',
        result: {},
      },
      CONFIG,
    );
    expect(msgs[0].body).toEqual({ kind: 'text', text: '완료!' });
  });

  it('failed → 사용자 안전 안내 (CCH-ERR-03: 민감정보 미노출)', () => {
    const msgs = renderSlackEvent(
      {
        type: 'execution.failed',
        executionId: 'exec-secret',
        triggerId: 'trig-1',
        workflowId: 'wf-secret',
        seq: 1,
        timestamp: '2026-05-24T00:00:00Z',
        error: {
          code: 'HTTP_TRANSPORT_FAILED',
          message: 'ENOTFOUND api.internal.example.com',
          nodeId: 'node-secret',
        },
      },
      CONFIG,
    );
    expect(msgs[0].body).toMatchObject({ kind: 'text' });
    const text = (msgs[0].body as { text: string }).text;
    // generic 안내 — 분류 helper 가 HTTP_TRANSPORT_FAILED → executionFailedThirdParty
    expect(text.length).toBeGreaterThan(0);
    // 민감정보 strip 검증
    expect(text).not.toContain('ENOTFOUND');
    expect(text).not.toContain('api.internal');
    expect(text).not.toContain('HTTP_TRANSPORT_FAILED');
    expect(text).not.toContain('exec-secret');
    expect(text).not.toContain('node-secret');
    expect(text).not.toContain('wf-secret');
  });

  it('failed (HTTP_4XX with statusCode) → {statusCode} placeholder 치환 (KO default)', () => {
    const msgs = renderSlackEvent(
      {
        type: 'execution.failed',
        executionId: 'e',
        triggerId: 't',
        workflowId: 'w',
        seq: 1,
        timestamp: '2026-05-24T00:00:00Z',
        error: {
          code: 'HTTP_4XX',
          message: 'should-not-leak',
          details: { statusCode: 404, url: 'https://internal' },
        },
      },
      CONFIG,
    );
    const text = (msgs[0].body as { text: string }).text;
    expect(text).toContain('404');
    expect(text).not.toContain('should-not-leak');
    expect(text).not.toContain('https://internal');
  });

  it('failed (HTTP_5XX with languageLocale=en) → EN default', () => {
    const msgs = renderSlackEvent(
      {
        type: 'execution.failed',
        executionId: 'e',
        triggerId: 't',
        workflowId: 'w',
        seq: 1,
        timestamp: '2026-05-24T00:00:00Z',
        error: {
          code: 'HTTP_5XX',
          message: 'should-not-leak',
          details: { statusCode: 502 },
        },
      },
      { ...CONFIG, languageLocale: 'en' },
    );
    const text = (msgs[0].body as { text: string }).text;
    expect(text).toContain('502');
    expect(text.toLowerCase()).toContain('try again');
  });

  it('failed (user override) → languageHints[key] 우선', () => {
    const msgs = renderSlackEvent(
      {
        type: 'execution.failed',
        executionId: 'e',
        triggerId: 't',
        workflowId: 'w',
        seq: 1,
        timestamp: '2026-05-24T00:00:00Z',
        error: { code: 'HTTP_5XX', message: 'x', details: { statusCode: 503 } },
      },
      {
        ...CONFIG,
        languageHints: {
          executionFailedThirdParty5xx: '커스텀 안내 ({statusCode})',
        },
      },
    );
    const text = (msgs[0].body as { text: string }).text;
    expect(text).toBe('커스텀 안내 (503)');
  });

  it('cancelled → languageHints text', () => {
    const msgs = renderSlackEvent(
      {
        type: 'execution.cancelled',
        executionId: 'e',
        triggerId: 't',
        workflowId: 'w',
        seq: 1,
        timestamp: '2026-05-24T00:00:00Z',
        result: {},
      },
      CONFIG,
    );
    expect(msgs[0].body).toEqual({ kind: 'text', text: '취소됨' });
  });
});

describe('renderSlackEvent — chunking (3500자)', () => {
  it('3500자 이하 → 1 chunk', () => {
    const text = 'a'.repeat(3499);
    const msgs = renderSlackEvent(
      { ...BASE, message: text, turnCount: 1 },
      CONFIG,
      'D1',
    );
    expect(msgs).toHaveLength(1);
    expect((msgs[0].body as { text: string }).text).toBe(text);
  });

  it('3500자 초과 → 분할 + continued suffix', () => {
    const text = 'a'.repeat(7000);
    const msgs = renderSlackEvent(
      { ...BASE, message: text, turnCount: 1 },
      CONFIG,
      'D1',
    );
    expect(msgs.length).toBeGreaterThan(1);
    // 마지막 외 chunk 에 continued suffix
    for (let i = 0; i < msgs.length - 1; i += 1) {
      expect((msgs[i].body as { text: string }).text).toContain('(continued');
      expect((msgs[i].body as { chunked: boolean }).chunked).toBe(true);
    }
  });
});

describe('renderSlackEvent — buttons (CCH-MP-02)', () => {
  it('waiting_for_input(buttons) → buttons body', () => {
    const msgs = renderSlackEvent(
      {
        type: 'execution.waiting_for_input',
        executionId: 'e',
        triggerId: 't',
        workflowId: 'w',
        seq: 1,
        timestamp: '2026-05-24T00:00:00Z',
        node: { id: 'n', type: 'button', interactionType: 'buttons' },
        interaction: {},
        context: {
          buttonConfig: {
            prompt: '선택?',
            buttons: [
              { id: 'b1', label: 'OK', style: 'primary' },
              { id: 'b2', label: 'Cancel', style: 'danger' },
            ],
          },
        },
      },
      CONFIG,
    );
    expect(msgs[0].body).toMatchObject({
      kind: 'buttons',
      text: '선택?',
      buttons: [
        { id: 'b1', label: 'OK', style: 'primary' },
        { id: 'b2', label: 'Cancel', style: 'danger' },
      ],
    });
  });

  it('buttons 없으면 빈 배열', () => {
    const msgs = renderSlackEvent(
      {
        type: 'execution.waiting_for_input',
        executionId: 'e',
        triggerId: 't',
        workflowId: 'w',
        seq: 1,
        timestamp: '2026-05-24T00:00:00Z',
        node: { id: 'n', type: 'button', interactionType: 'buttons' },
        interaction: {},
        context: { buttonConfig: { buttons: [] } },
      },
      CONFIG,
    );
    expect(msgs).toEqual([]);
  });

  it('chart nodeOutput → text fallback 메시지 + buttons message (2건)', () => {
    const msgs = renderSlackEvent(
      {
        type: 'execution.waiting_for_input',
        executionId: 'e',
        triggerId: 't',
        workflowId: 'w',
        seq: 1,
        timestamp: '2026-05-24T00:00:00Z',
        node: { id: 'n', type: 'button', interactionType: 'buttons' },
        interaction: {},
        context: {
          buttonConfig: {
            buttons: [{ id: 'b1', label: 'OK' }],
            nodeOutput: {
              nodeType: 'chart',
              payload: {
                title: 'Q1',
                labels: ['Jan', 'Feb'],
                series: [10, 20],
              },
            },
          },
        },
      },
      CONFIG,
    );
    expect(msgs).toHaveLength(2);
    expect(msgs[0].body.kind).toBe('text');
    expect((msgs[0].body as { text: string }).text).toContain('Q1');
    expect(msgs[1].body.kind).toBe('buttons');
  });
});

describe('renderSlackEvent — form 다단계 (CCH-MP-03)', () => {
  it('첫 필드 → form_prompt + hint', () => {
    const msgs = renderSlackEvent(
      {
        type: 'execution.waiting_for_input',
        executionId: 'e',
        triggerId: 't',
        workflowId: 'w',
        seq: 1,
        timestamp: '2026-05-24T00:00:00Z',
        node: { id: 'n', type: 'form', interactionType: 'form' },
        interaction: {},
        context: {
          formConfig: {
            fields: [
              { name: 'email', label: 'Email', type: 'email', required: true },
              { name: 'age', label: 'Age', type: 'number' },
            ],
          },
        },
      },
      CONFIG,
    );
    expect(msgs[0].body).toMatchObject({
      kind: 'form_prompt',
      fieldName: 'email',
      hint: 'email',
    });
    expect((msgs[0].body as { label: string }).label).toContain('Email *');
  });
});

describe('renderSlackEvent — ai_conversation / ai_form_render (R-CCA-6)', () => {
  // chat channel 에서 ai_conversation / ai_form_render waiting 은 silent (빈 array) —
  // ai_message event 가 응답 본문 단독 발송 책임. 중복 발송 회귀 fix (R-CCA-6, 2026-05-25).
  it('ai_conversation → silent (빈 array) — conversationConfig.message 가 ai_message 와 중복이라 발송 안 함', () => {
    const msgs = renderSlackEvent(
      {
        type: 'execution.waiting_for_input',
        executionId: 'e',
        triggerId: 't',
        workflowId: 'w',
        seq: 1,
        timestamp: '2026-05-24T00:00:00Z',
        node: { id: 'n', type: 'ai', interactionType: 'ai_conversation' },
        interaction: {},
        context: { conversationConfig: { message: 'hi' } },
      },
      CONFIG,
    );
    expect(msgs).toEqual([]);
  });

  it('ai_form_render → silent (빈 array, ai_conversation 과 동일 정책)', () => {
    const msgs = renderSlackEvent(
      {
        type: 'execution.waiting_for_input',
        executionId: 'e',
        triggerId: 't',
        workflowId: 'w',
        seq: 1,
        timestamp: '2026-05-24T00:00:00Z',
        node: { id: 'n', type: 'ai', interactionType: 'ai_form_render' },
        interaction: {},
        context: { conversationConfig: { message: '폼 작성' } },
      },
      CONFIG,
    );
    expect(msgs).toEqual([]);
  });
});
