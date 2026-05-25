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

  it('failed → 사용자 안전 안내 (CCH-ERR-03: 민감정보 미노출)', () => {
    const event: EiaEvent = {
      ...BASE_EVENT_FIELDS,
      type: 'execution.failed',
      error: {
        code: 'HTTP_TRANSPORT_FAILED',
        message: 'ENOTFOUND api.internal',
        nodeId: 'node-secret',
      },
    };
    const m = renderTelegramMessages(event, BASE_CONFIG);
    expect(m[0].body.kind).toBe('text');
    const text = (m[0].body as { text: string }).text;
    expect(text).not.toContain('ENOTFOUND');
    expect(text).not.toContain('api.internal');
    expect(text).not.toContain('HTTP_TRANSPORT_FAILED');
    expect(text).not.toContain('node-secret');
  });

  it('failed (HTTP_4XX with statusCode) → {statusCode} 치환 (MarkdownV2 escape 적용)', () => {
    const event: EiaEvent = {
      ...BASE_EVENT_FIELDS,
      type: 'execution.failed',
      error: {
        code: 'HTTP_4XX',
        message: 'x',
        details: { statusCode: 401 },
      },
    };
    const m = renderTelegramMessages(event, BASE_CONFIG);
    expect(m[0].body.kind).toBe('text');
    const text = (m[0].body as { text: string }).text;
    // MarkdownV2 escape 가 ( ) . 을 escape — 401 자체는 escape 영향 없음.
    expect(text).toContain('401');
  });

  it('failed (languageLocale=en) → EN default', () => {
    const event: EiaEvent = {
      ...BASE_EVENT_FIELDS,
      type: 'execution.failed',
      error: { code: 'LLM_RATE_LIMIT', message: 'x' },
    };
    const m = renderTelegramMessages(event, {
      ...BASE_CONFIG,
      languageLocale: 'en',
    });
    const text = (m[0].body as { text: string }).text;
    expect(text.toLowerCase()).toContain('too many requests');
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

  // chat channel 에서 ai_conversation / ai_form_render waiting 은 silent (빈 array) —
  // ai_message event 가 응답 본문 단독 발송 책임. 중복 발송 회귀 fix (R-CCA-6, 2026-05-25).
  it('waiting_for_input(ai_form_render) → silent (빈 array, R-CCA-6)', () => {
    const event: EiaEvent = {
      ...BASE_EVENT_FIELDS,
      type: 'execution.waiting_for_input',
      node: { id: 'n1', type: 'ai-agent', interactionType: 'ai_form_render' },
      interaction: {},
      context: { conversationConfig: { message: '폼을 작성해 주세요' } },
    };
    const m = renderTelegramMessages(event, BASE_CONFIG);
    expect(m).toEqual([]);
  });

  it('waiting_for_input(ai_conversation) → silent (빈 array, R-CCA-6) — conversationConfig.message 가 ai_message 와 중복이라 발송 안 함', () => {
    const event: EiaEvent = {
      ...BASE_EVENT_FIELDS,
      type: 'execution.waiting_for_input',
      node: { id: 'n1', type: 'ai-agent', interactionType: 'ai_conversation' },
      interaction: {},
      context: { conversationConfig: { message: 'how can I help?' } },
    };
    const m = renderTelegramMessages(event, BASE_CONFIG);
    expect(m).toEqual([]);
  });

  it('waiting_for_input(buttons) → buttons body (Phase 3 PR-B)', () => {
    const event: EiaEvent = {
      ...BASE_EVENT_FIELDS,
      type: 'execution.waiting_for_input',
      node: { id: 'n2', type: 'button', interactionType: 'buttons' },
      interaction: {},
      context: {
        buttonConfig: {
          prompt: '선택해주세요',
          buttons: [
            { id: 'b1', label: 'Yes', type: 'callback' },
            { id: 'b2', label: 'No', type: 'callback' },
          ],
        },
      },
    };
    const m = renderTelegramMessages(event, BASE_CONFIG);
    expect(m).toHaveLength(1);
    expect(m[0].body.kind).toBe('buttons');
    if (m[0].body.kind === 'buttons') {
      expect(m[0].body.buttons.map((b) => b.id)).toEqual(['b1', 'b2']);
    }
  });

  it('waiting_for_input(form) → form_prompt body 첫 필드 (Phase 4 PR-C)', () => {
    const event: EiaEvent = {
      ...BASE_EVENT_FIELDS,
      type: 'execution.waiting_for_input',
      node: { id: 'n3', type: 'form', interactionType: 'form' },
      interaction: {},
      context: {
        formConfig: {
          fields: [
            { name: 'email', label: '이메일', type: 'email', required: true },
            { name: 'age', label: '나이', type: 'number' },
          ],
        },
      },
    };
    const m = renderTelegramMessages(event, BASE_CONFIG);
    expect(m).toHaveLength(1);
    expect(m[0].body.kind).toBe('form_prompt');
    if (m[0].body.kind === 'form_prompt') {
      expect(m[0].body.fieldName).toBe('email');
      expect(m[0].body.label).toMatch(/이메일/);
      expect(m[0].body.hint).toBe('email');
    }
  });

  it('waiting_for_input(form) — currentFieldIdx 지정 시 해당 필드', () => {
    const event: EiaEvent = {
      ...BASE_EVENT_FIELDS,
      type: 'execution.waiting_for_input',
      node: { id: 'n4', type: 'form', interactionType: 'form' },
      interaction: { currentFieldIdx: 1 },
      context: {
        formConfig: {
          fields: [
            { name: 'first', label: 'First' },
            { name: 'second', label: 'Second' },
          ],
        },
      },
    };
    const m = renderTelegramMessages(event, BASE_CONFIG);
    expect(m[0].body.kind).toBe('form_prompt');
    if (m[0].body.kind === 'form_prompt') {
      expect(m[0].body.fieldName).toBe('second');
    }
  });
});

// ----------------------------------------------------------------------------
// CCH-MP-04 — Carousel / Chart / Table visual fallback (MarkdownV2 텍스트)
// ----------------------------------------------------------------------------

function buttonsEvent(nodeOutput: unknown): EiaEvent {
  return {
    ...BASE_EVENT_FIELDS,
    type: 'execution.waiting_for_input',
    node: { id: 'visual', type: 'buttons', interactionType: 'buttons' },
    interaction: {},
    context: {
      buttonConfig: {
        prompt: '선택하세요',
        buttons: [{ id: 'ok', label: 'OK', type: 'callback' }],
        nodeOutput,
      },
    },
  };
}

describe('visual fallback — chart (CCH-MP-04 v1)', () => {
  it('series + labels → monospace bar chart + buttons 메시지 2건', () => {
    const event = buttonsEvent({
      nodeType: 'chart',
      title: '월별 매출',
      payload: {
        labels: ['1월', '2월', '3월', '4월'],
        series: [{ name: 'KRW', data: [100, 200, 50, 150] }],
      },
    });
    const m = renderTelegramMessages(event, BASE_CONFIG);
    expect(m.length).toBeGreaterThanOrEqual(2);
    const chartMsg = m[0];
    expect(chartMsg.body.kind).toBe('text');
    if (chartMsg.body.kind === 'text') {
      expect(chartMsg.body.text).toContain('📊 월별 매출');
      expect(chartMsg.body.text).toContain('```');
      expect(chartMsg.body.text).toContain('█'); // bar 문자
      expect(chartMsg.body.text).toContain('1월');
      expect(chartMsg.body.text).toContain('200');
    }
    const last = m[m.length - 1];
    expect(last.body.kind).toBe('buttons');
  });

  it('빈 series → title 만 안내', () => {
    const event = buttonsEvent({
      nodeType: 'chart',
      title: '비어있는 차트',
      payload: { labels: [], series: [] },
    });
    const m = renderTelegramMessages(event, BASE_CONFIG);
    const chartMsg = m[0];
    expect(chartMsg.body.kind).toBe('text');
    if (chartMsg.body.kind === 'text') {
      expect(chartMsg.body.text).toContain('비어있는 차트');
      expect(chartMsg.body.text).not.toContain('█');
    }
  });

  it('다중 series → first series + 안내 footer', () => {
    const event = buttonsEvent({
      nodeType: 'chart',
      payload: {
        labels: ['A', 'B'],
        series: [
          { name: 'X', data: [1, 2] },
          { name: 'Y', data: [3, 4] },
        ],
      },
    });
    const m = renderTelegramMessages(event, BASE_CONFIG);
    const text = m[0].body.kind === 'text' ? m[0].body.text : '';
    expect(text).toContain('전체 2개 시리즈');
    expect(text).toContain('"X"');
  });

  it('visualNode=text_only 설정 시 chart 미발송 (buttons 만)', () => {
    const event = buttonsEvent({
      nodeType: 'chart',
      title: 't',
      payload: { labels: ['A'], series: [{ data: [1] }] },
    });
    const config: ChatChannelConfig = {
      ...BASE_CONFIG,
      uiMapping: { visualNode: 'text_only' },
    };
    const m = renderTelegramMessages(event, config);
    expect(m).toHaveLength(1);
    expect(m[0].body.kind).toBe('buttons');
  });
});

describe('visual fallback — table (CCH-MP-04 v1)', () => {
  it('rows + columns → monospace MarkdownV2 표 + header separator', () => {
    const event = buttonsEvent({
      nodeType: 'table',
      title: '주문 내역',
      payload: {
        columns: [
          { key: 'id', label: '#' },
          { key: 'name', label: '품목' },
          { key: 'qty', label: '수량' },
        ],
        rows: [
          { id: 1, name: '사과', qty: 3 },
          { id: 2, name: '바나나', qty: 5 },
        ],
      },
    });
    const m = renderTelegramMessages(event, BASE_CONFIG);
    const tableMsg = m[0];
    expect(tableMsg.body.kind).toBe('text');
    if (tableMsg.body.kind === 'text') {
      expect(tableMsg.body.text).toContain('📋 주문 내역');
      expect(tableMsg.body.text).toContain('```');
      expect(tableMsg.body.text).toContain('#');
      expect(tableMsg.body.text).toContain('품목');
      expect(tableMsg.body.text).toContain('사과');
      expect(tableMsg.body.text).toContain('바나나');
      expect(tableMsg.body.text).toContain('│');
      expect(tableMsg.body.text).toContain('─');
    }
  });

  it('row cap 20 — 초과 시 "외 N행" 안내', () => {
    const rows = Array.from({ length: 25 }, (_, i) => ({
      id: i + 1,
      name: `item-${i + 1}`,
    }));
    const event = buttonsEvent({
      nodeType: 'table',
      payload: {
        columns: [
          { key: 'id', label: 'ID' },
          { key: 'name', label: 'Name' },
        ],
        rows,
      },
    });
    const m = renderTelegramMessages(event, BASE_CONFIG);
    const text = m[0].body.kind === 'text' ? m[0].body.text : '';
    expect(text).toContain('외 5행');
    expect(text).toContain('전체 25행');
    expect(text).toContain('item-1');
    expect(text).toContain('item-20');
    expect(text).not.toContain('item-21');
  });

  it('cell 16자 초과 시 ellipsis truncate', () => {
    const event = buttonsEvent({
      nodeType: 'table',
      payload: {
        columns: [{ key: 'desc', label: 'desc' }],
        rows: [{ desc: 'a'.repeat(50) }],
      },
    });
    const m = renderTelegramMessages(event, BASE_CONFIG);
    const text = m[0].body.kind === 'text' ? m[0].body.text : '';
    expect(text).toContain('…');
    expect(text).not.toContain('a'.repeat(50));
  });

  it('columns 비어 있음 → 안내', () => {
    const event = buttonsEvent({
      nodeType: 'table',
      title: '빈 표',
      payload: { columns: [], rows: [] },
    });
    const m = renderTelegramMessages(event, BASE_CONFIG);
    const text = m[0].body.kind === 'text' ? m[0].body.text : '';
    expect(text).toContain('빈 표');
    expect(text).toContain('열 정보가 없습니다');
  });

  it('rowsTruncated flag → 안내', () => {
    const event = buttonsEvent({
      nodeType: 'table',
      payload: {
        columns: [{ key: 'id', label: 'ID' }],
        rows: [{ id: 1 }, { id: 2 }],
        rowsTruncated: true,
        rowsTotalCount: 100,
      },
    });
    const m = renderTelegramMessages(event, BASE_CONFIG);
    const text = m[0].body.kind === 'text' ? m[0].body.text : '';
    expect(text).toContain('상위 2행 표시');
    expect(text).toContain('전체 100행');
  });
});

describe('visual fallback — carousel (CCH-MP-04 v1)', () => {
  it('items[] → 각 카드 sequential text message + 마지막에 buttons', () => {
    const event = buttonsEvent({
      nodeType: 'carousel',
      title: '추천 상품',
      payload: {
        items: [
          {
            title: '상품 A',
            description: '설명 A',
            imageUrl: 'https://x/a.jpg',
          },
          { title: '상품 B', description: '설명 B' },
        ],
      },
    });
    const m = renderTelegramMessages(event, BASE_CONFIG);
    // title + card A + card B + buttons = 4건
    expect(m).toHaveLength(4);
    expect(m[0].body.kind).toBe('text');
    if (m[0].body.kind === 'text') {
      expect(m[0].body.text).toContain('🎴');
      expect(m[0].body.text).toContain('추천 상품');
    }
    expect(m[1].body.kind).toBe('text');
    if (m[1].body.kind === 'text') {
      expect(m[1].body.text).toContain('상품 A');
      expect(m[1].body.text).toContain('설명 A');
      expect(m[1].body.text).toContain('🖼');
    }
    expect(m[2].body.kind).toBe('text');
    if (m[2].body.kind === 'text') {
      expect(m[2].body.text).toContain('상품 B');
      expect(m[2].body.text).not.toContain('🖼');
    }
    expect(m[m.length - 1].body.kind).toBe('buttons');
  });

  it('카드 10장 초과 시 cap + "외 N장" 안내', () => {
    const items = Array.from({ length: 13 }, (_, i) => ({
      title: `카드 ${i + 1}`,
    }));
    const event = buttonsEvent({
      nodeType: 'carousel',
      payload: { items },
    });
    const m = renderTelegramMessages(event, BASE_CONFIG);
    // 10 카드 + "외 3장" 안내 + buttons = 12건 (title 없으면 제외)
    const cardTexts = m
      .filter((msg) => msg.body.kind === 'text')
      .map((msg) => (msg.body.kind === 'text' ? msg.body.text : ''));
    expect(cardTexts.some((t) => t.includes('카드 1'))).toBe(true);
    expect(cardTexts.some((t) => t.includes('카드 10'))).toBe(true);
    expect(cardTexts.some((t) => t.includes('카드 11'))).toBe(false);
    expect(cardTexts.some((t) => t.includes('외 3장'))).toBe(true);
    expect(cardTexts.some((t) => t.includes('전체 13장'))).toBe(true);
  });

  it('items 비어 있음 → 안내', () => {
    const event = buttonsEvent({
      nodeType: 'carousel',
      title: '비어있는 carousel',
      payload: { items: [] },
    });
    const m = renderTelegramMessages(event, BASE_CONFIG);
    const cardTexts = m
      .filter((msg) => msg.body.kind === 'text')
      .map((msg) => (msg.body.kind === 'text' ? msg.body.text : ''));
    expect(cardTexts.some((t) => t.includes('카드가 없습니다'))).toBe(true);
  });

  it('카드 title escape 적용 (MarkdownV2 special 글자)', () => {
    const event = buttonsEvent({
      nodeType: 'carousel',
      payload: {
        items: [{ title: 'a.b_c', description: '(test)' }],
      },
    });
    const m = renderTelegramMessages(event, BASE_CONFIG);
    const cardMsg = m.find(
      (msg) => msg.body.kind === 'text' && msg.body.text.includes('a\\.b\\_c'),
    );
    expect(cardMsg).toBeTruthy();
  });
});

describe('visual fallback — unrecognized / template', () => {
  it('미인식 visualKind → nodeOutput.title 만 안내', () => {
    const event = buttonsEvent({
      nodeType: 'unknown_kind',
      title: '알 수 없는 시각형',
      payload: {},
    });
    const m = renderTelegramMessages(event, BASE_CONFIG);
    expect(m).toHaveLength(2); // title text + buttons
    if (m[0].body.kind === 'text') {
      expect(m[0].body.text).toContain('알 수 없는');
    }
  });

  it('template + plain text rendered → text 본문 발송', () => {
    const event = buttonsEvent({
      nodeType: 'template',
      rendered: '안녕하세요\n템플릿 본문입니다.',
    });
    const m = renderTelegramMessages(event, BASE_CONFIG);
    if (m[0].body.kind === 'text') {
      expect(m[0].body.text).toContain('안녕하세요');
      expect(m[0].body.text).toContain('템플릿 본문');
    }
  });
});
