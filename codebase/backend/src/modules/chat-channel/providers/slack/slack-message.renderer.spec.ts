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

// ---------------------------------------------------------------------------
// 2026-05-25 — CCH-MP-06 / CCH-MP-01 보강 (회귀 ①+② 해소).
// SoT: spec/conventions/chat-channel-adapter.md §3 / §1.3 / §R-CCA-7.
// ---------------------------------------------------------------------------
describe('renderSlackEvent — execution.node.completed (CCH-MP-06)', () => {
  const BASE_NODE = {
    executionId: 'e1',
    triggerId: 't1',
    workflowId: 'w1',
    seq: 1,
    timestamp: '2026-05-25T07:00:00.000Z',
  };

  it('template + output.rendered → text 1건', () => {
    const msgs = renderSlackEvent(
      {
        ...BASE_NODE,
        type: 'execution.node.completed',
        node: { id: 'tpl-1', type: 'template' },
        output: { rendered: '카페24와 날씨에 대한 문의가 가능해요.' },
      },
      CONFIG,
    );
    expect(msgs).toHaveLength(1);
    expect(msgs[0].body.kind).toBe('text');
    if (msgs[0].body.kind === 'text') {
      expect(msgs[0].body.text).toContain('카페24');
    }
  });

  it('template + 빈 rendered → 빈 array (guard)', () => {
    const msgs = renderSlackEvent(
      {
        ...BASE_NODE,
        type: 'execution.node.completed',
        node: { id: 'tpl-1', type: 'template' },
        output: { rendered: '' },
      },
      CONFIG,
    );
    expect(msgs).toHaveLength(0);
  });

  it('carousel → mrkdwn fallback text 발화', () => {
    const msgs = renderSlackEvent(
      {
        ...BASE_NODE,
        type: 'execution.node.completed',
        node: { id: 'car-1', type: 'carousel' },
        output: { payload: { items: [{ title: 'Card A' }] } },
      },
      CONFIG,
    );
    expect(msgs.length).toBeGreaterThan(0);
  });
});

describe('renderSlackEvent — execution.ai_message presentations[] (CCH-MP-01 보강)', () => {
  it('text + presentations 4종 → sequential 추가 발송', () => {
    const msgs = renderSlackEvent(
      {
        ...BASE,
        message: 'AI 응답',
        turnCount: 1,
        presentations: [
          {
            type: 'template',
            toolCallId: 't1',
            renderedAt: '2026-05-25T07:00:00.000Z',
            payload: { rendered: '템플릿 결과' },
          },
        ],
      },
      CONFIG,
    );
    expect(msgs.length).toBeGreaterThan(1);
    const allTexts = msgs
      .map((m) => (m.body.kind === 'text' ? m.body.text : ''))
      .join('\n');
    expect(allTexts).toContain('AI 응답');
    expect(allTexts).toContain('템플릿 결과');
  });

  it('presentations 미정의 → text 1건만 (기존 동작)', () => {
    const msgs = renderSlackEvent(
      { ...BASE, message: 'plain', turnCount: 1 },
      CONFIG,
    );
    expect(msgs).toHaveLength(1);
    expect(msgs[0].body.kind).toBe('text');
  });

  it('render_form (type === form) → v1 임시 fallback text 발화 (회귀 ④ fix, 2026-05-25)', () => {
    // 직전 정책 (skip) 은 사용자에게 메시지 안 보이는 회귀.
    // SoT: spec/conventions/chat-channel-adapter.md §3 (2026-05-25 갱신).
    const msgs = renderSlackEvent(
      {
        ...BASE,
        message: 'with form',
        turnCount: 1,
        presentations: [
          {
            type: 'form',
            toolCallId: 't1',
            renderedAt: '2026-05-25T07:00:00.000Z',
            payload: {
              fields: [
                { name: 'name', label: '이름', type: 'text', required: true },
              ],
            },
          },
        ],
      },
      CONFIG,
    );
    expect(msgs.length).toBeGreaterThan(1);
    const all = msgs
      .map((m) => (m.body.kind === 'text' ? m.body.text : ''))
      .join('\n');
    expect(all).toContain('with form');
    expect(all).toContain('이름');
  });
});

// ---------------------------------------------------------------------------
// 2026-05-25 — 회귀 ⑤ (Slack): handler structured return shape 처리.
// ---------------------------------------------------------------------------
describe('renderSlackEvent — execution.node.completed structured return shape (회귀 ⑤)', () => {
  const BASE_NODE = {
    executionId: 'e1',
    triggerId: 't1',
    workflowId: 'w1',
    seq: 1,
    timestamp: '2026-05-25T07:00:00.000Z',
  };

  it('template — nodeOutput.output.rendered 추출', () => {
    const msgs = renderSlackEvent(
      {
        ...BASE_NODE,
        type: 'execution.node.completed',
        node: { id: 'tpl-1', type: 'template' },
        output: {
          config: { template: '본문 raw' },
          output: { rendered: '카페24와 날씨에 대한 문의가 가능해요.' },
        },
      },
      CONFIG,
    );
    expect(msgs).toHaveLength(1);
    if (msgs[0].body.kind === 'text') {
      expect(msgs[0].body.text).toContain('카페24');
    }
  });

  it('carousel — config.items (static mode) 추출', () => {
    const msgs = renderSlackEvent(
      {
        ...BASE_NODE,
        type: 'execution.node.completed',
        node: { id: 'car-1', type: 'carousel' },
        output: {
          config: { items: [{ title: '카드 X' }] },
          output: {},
        },
      },
      CONFIG,
    );
    const all = msgs
      .map((m) => (m.body.kind === 'text' ? m.body.text : ''))
      .join('\n');
    expect(all.length).toBeGreaterThan(0);
  });
});
