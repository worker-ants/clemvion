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

  // §7.5 / 방안 D — rehydration 실패(RESUME_*) system cancel 은 generic 취소가
  // 아닌 graceful "세션 만료" 안내(sessionExpired)를 발송한다.
  it('cancelled(error.code=RESUME_INCOMPATIBLE_STATE) → sessionExpired 안내 (ko default)', () => {
    const event: EiaEvent = {
      ...BASE_EVENT_FIELDS,
      type: 'execution.cancelled',
      result: { cancelledBy: 'system' },
      error: { code: 'RESUME_INCOMPATIBLE_STATE' },
    };
    const m = renderTelegramMessages(event, BASE_CONFIG);
    expect(m).toHaveLength(1);
    if (m[0].body.kind === 'text') {
      expect(m[0].body.text).toContain('세션이 만료');
      expect(m[0].body.text).toContain('새 메시지');
    } else {
      fail('expected text body');
    }
  });

  it('cancelled(error.code=RESUME_CHECKPOINT_MISSING) → sessionExpired (en locale)', () => {
    const event: EiaEvent = {
      ...BASE_EVENT_FIELDS,
      type: 'execution.cancelled',
      result: { cancelledBy: 'system' },
      error: { code: 'RESUME_CHECKPOINT_MISSING' },
    };
    const m = renderTelegramMessages(event, {
      ...BASE_CONFIG,
      languageLocale: 'en',
    });
    const text = m[0].body.kind === 'text' ? m[0].body.text : '';
    expect(text.toLowerCase()).toContain('expired');
  });

  it('cancelled(error.code=RESUME_INCOMPATIBLE_STATE) → languageHints.sessionExpired override 우선', () => {
    const event: EiaEvent = {
      ...BASE_EVENT_FIELDS,
      type: 'execution.cancelled',
      result: { cancelledBy: 'system' },
      error: { code: 'RESUME_INCOMPATIBLE_STATE' },
    };
    const m = renderTelegramMessages(event, {
      ...BASE_CONFIG,
      languageHints: { sessionExpired: '커스텀 만료 안내' },
    });
    const text = m[0].body.kind === 'text' ? m[0].body.text : '';
    expect(text).toContain('커스텀 만료 안내');
  });

  it('cancelled(비-RESUME error.code) → generic 취소 (sessionExpired 미적용)', () => {
    const event: EiaEvent = {
      ...BASE_EVENT_FIELDS,
      type: 'execution.cancelled',
      result: { cancelledBy: 'system' },
      error: { code: 'SOME_OTHER_CODE' },
    };
    const m = renderTelegramMessages(event, BASE_CONFIG);
    const text = m[0].body.kind === 'text' ? m[0].body.text : '';
    expect(text).not.toContain('세션이 만료');
    expect(text).toContain('취소');
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

// ---------------------------------------------------------------------------
// 2026-05-25 — chat-channel outbound 회귀 ① + ② fix
// CCH-MP-06 (비-blocking presentation 발화) + CCH-MP-01 보강 (ai_message
// presentations[] sequential 발송) 의 telegram renderer 구현 검증.
// SoT: spec/5-system/15-chat-channel.md §3.3 / R-CC-16,
//      spec/conventions/chat-channel-adapter.md §3 / R-CCA-7.
// ---------------------------------------------------------------------------
describe('execution.node.completed (CCH-MP-06) — 비-blocking presentation 본문 발화', () => {
  it('template + output.rendered → MarkdownV2 escape 후 text 1건', () => {
    const event = {
      ...BASE_EVENT_FIELDS,
      type: 'execution.node.completed' as const,
      node: { id: 'tpl-1', type: 'template' as const, label: '템플릿 2' },
      output: { rendered: '카페24와 날씨에 대한 문의가 가능해요.' },
    };
    const m = renderTelegramMessages(event, BASE_CONFIG);
    expect(m).toHaveLength(1);
    expect(m[0].body.kind).toBe('text');
    if (m[0].body.kind === 'text') {
      // MarkdownV2 escape — `.` → `\.`
      expect(m[0].body.text).toContain('카페24와');
      expect(m[0].body.text).toContain('가능해요\\.');
    }
  });

  it('carousel + items[] → renderCarouselFallback (카드별 sequential text)', () => {
    const event = {
      ...BASE_EVENT_FIELDS,
      type: 'execution.node.completed' as const,
      node: { id: 'car-1', type: 'carousel' as const },
      output: {
        payload: {
          items: [
            { title: '상품 A', description: '설명 A' },
            { title: '상품 B', description: '설명 B' },
          ],
        },
      },
    };
    const m = renderTelegramMessages(event, BASE_CONFIG);
    const cardTexts = m
      .filter((msg) => msg.body.kind === 'text')
      .map((msg) => (msg.body.kind === 'text' ? msg.body.text : ''));
    expect(cardTexts.some((t) => t.includes('상품 A'))).toBe(true);
    expect(cardTexts.some((t) => t.includes('상품 B'))).toBe(true);
  });

  it('table → renderTableFallback (monospace table)', () => {
    const event = {
      ...BASE_EVENT_FIELDS,
      type: 'execution.node.completed' as const,
      node: { id: 'tbl-1', type: 'table' as const },
      output: {
        payload: {
          columns: [
            { key: 'a', label: 'A' },
            { key: 'b', label: 'B' },
          ],
          rows: [{ a: 1, b: 2 }],
        },
      },
    };
    const m = renderTelegramMessages(event, BASE_CONFIG);
    expect(m.length).toBeGreaterThan(0);
    const hasMonospace = m.some(
      (msg) => msg.body.kind === 'text' && msg.body.text.includes('```'),
    );
    expect(hasMonospace).toBe(true);
  });

  it('chart → renderChartFallback (monospace bar chart)', () => {
    const event = {
      ...BASE_EVENT_FIELDS,
      type: 'execution.node.completed' as const,
      node: { id: 'ch-1', type: 'chart' as const, label: 'My chart' },
      output: {
        payload: {
          title: 'My chart',
          series: [{ name: 's1', data: [1, 2, 3] }],
          labels: ['a', 'b', 'c'],
        },
      },
    };
    const m = renderTelegramMessages(event, BASE_CONFIG);
    expect(m.length).toBeGreaterThan(0);
  });
});

describe('execution.ai_message — presentations[] sequential 발송 (CCH-MP-01 보강)', () => {
  it('text 1건 + presentations 4종 → 5건 sequential', () => {
    const event: EiaEvent = {
      ...BASE_EVENT_FIELDS,
      type: 'execution.ai_message',
      message: 'AI 응답 본문',
      turnCount: 2,
      presentations: [
        {
          type: 'carousel',
          toolCallId: 'tc-1',
          renderedAt: '2026-05-25T07:00:00.000Z',
          payload: {
            items: [{ title: 'Card A' }],
          },
        },
        {
          type: 'table',
          toolCallId: 'tc-2',
          renderedAt: '2026-05-25T07:00:01.000Z',
          payload: {
            columns: [{ field: 'x', label: 'X' }],
            rows: [{ x: 'v1' }],
          },
        },
        {
          type: 'template',
          toolCallId: 'tc-3',
          renderedAt: '2026-05-25T07:00:02.000Z',
          payload: { rendered: '템플릿 결과' },
        },
        {
          type: 'chart',
          toolCallId: 'tc-4',
          renderedAt: '2026-05-25T07:00:03.000Z',
          payload: {
            title: 'C',
            series: [{ name: 's', data: [1] }],
            labels: ['a'],
          },
        },
      ],
    };
    const m = renderTelegramMessages(event, BASE_CONFIG);
    // 첫 메시지는 AI text. 그 뒤에 presentations 의 메시지들 sequential.
    expect(m.length).toBeGreaterThan(4);
    expect(m[0].body.kind).toBe('text');
    if (m[0].body.kind === 'text') {
      expect(m[0].body.text).toContain('AI 응답 본문');
    }
    // 후속 메시지들에 카드/표/템플릿/차트 흔적이 모두 보여야 한다.
    const after = m.slice(1);
    const allTexts = after
      .map((msg) => (msg.body.kind === 'text' ? msg.body.text : ''))
      .join('\n');
    expect(allTexts).toContain('Card A');
    expect(allTexts).toContain('템플릿 결과');
  });

  it('presentations 가 비어있으면 text 1건만 (기존 동작 회귀 차단)', () => {
    const event: EiaEvent = {
      ...BASE_EVENT_FIELDS,
      type: 'execution.ai_message',
      message: 'plain',
      turnCount: 1,
      presentations: [],
    };
    const m = renderTelegramMessages(event, BASE_CONFIG);
    expect(m).toHaveLength(1);
    expect(m[0].body.kind).toBe('text');
  });

  it('render_form (presentations[*].type === "form") → v1 임시 fallback text 발화 (사용자 보고 2026-05-25 회귀 ④ 해소)', () => {
    // SoT: spec/conventions/chat-channel-adapter.md §3 매핑 표 (2026-05-25 갱신)
    // 직전 정책 ("form 은 별 plan 추적 — skip") 은 사용자에게 메시지가 안 보이는
    // 회귀 유발. v1 임시 fallback (fields 목록 + 답변 안내) 로 발화 — full native
    // modal 은 별 plan `chat-channel-form-native-modal` v2.
    const event: EiaEvent = {
      ...BASE_EVENT_FIELDS,
      type: 'execution.ai_message',
      message: 'with form',
      turnCount: 1,
      presentations: [
        {
          type: 'form',
          toolCallId: 'tc-form',
          renderedAt: '2026-05-25T07:00:00.000Z',
          payload: {
            fields: [
              { name: 'name', label: '이름', type: 'text', required: true },
              { name: 'phone', label: '전화번호', type: 'phone' },
            ],
          },
        },
      ],
    };
    const m = renderTelegramMessages(event, BASE_CONFIG);
    // text 1건 (ai_message message) + form fallback text 1건+
    expect(m.length).toBeGreaterThan(1);
    const all = m
      .map((msg) => (msg.body.kind === 'text' ? msg.body.text : ''))
      .join('\n');
    expect(all).toContain('with form');
    // fallback 안에 fields 라벨이 들어있어야 함
    expect(all).toContain('이름');
    expect(all).toContain('전화번호');
  });

  it('ai_message empty body + render_form presentation → form fallback 만 발화 (회귀 ④ — LLM 이 form 만 호출하고 텍스트 없는 케이스)', () => {
    // LLM 이 render_form 호출하고 응답 텍스트는 비어있는 정상 패턴.
    // 기존 정책으로는 text 1건 (빈 string) → isEmptyTextBody skip → 사용자 0 메시지.
    // 본 fix: form fallback 메시지가 발화돼 사용자가 form 을 볼 수 있어야 함.
    const event: EiaEvent = {
      ...BASE_EVENT_FIELDS,
      type: 'execution.ai_message',
      message: '',
      turnCount: 1,
      presentations: [
        {
          type: 'form',
          toolCallId: 'tc-form',
          renderedAt: '2026-05-25T07:00:00.000Z',
          payload: {
            fields: [{ name: 'name', label: '이름', type: 'text' }],
          },
        },
      ],
    };
    const m = renderTelegramMessages(event, BASE_CONFIG);
    // form fallback 메시지가 최소 1건은 있어야 함
    const formMsg = m.find(
      (msg) => msg.body.kind === 'text' && msg.body.text.includes('이름'),
    );
    expect(formMsg).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 2026-05-25 — 회귀 ⑤ (사용자 보고): renderer 가 handler structured return shape
// (`{config, output: {rendered/items/...}}`) 을 처리하지 못해 "(카드가 없습니다.)"
// 잘못 표시. nodeOutput 의 여러 위치 (.payload / .output / .rendered top-level)
// 에서 본문을 추출해야 함.
// ---------------------------------------------------------------------------
describe('execution.node.completed — handler structured return shape 처리 (회귀 ⑤)', () => {
  it('template — nodeOutput.output.rendered (structured shape) 추출 — 회귀 ⑤ 핵심', () => {
    // Template handler 가 return {config, output: {rendered: 본문}} →
    // nodeExecution.outputData = 이 객체 → NODE_COMPLETED emit .output = 이 객체.
    // 본 fix 전: nodeOutput.rendered / nodeOutput.payload.rendered 둘 다 없음 →
    // null → 빈 array → 메시지 누락. 본 fix 후: nodeOutput.output.rendered 도 추출.
    const event = {
      ...BASE_EVENT_FIELDS,
      type: 'execution.node.completed' as const,
      node: { id: 'tpl-1', type: 'template' as const, label: '템플릿' },
      output: {
        config: { template: '본문 raw', outputFormat: 'text' },
        output: { rendered: '카페24와 날씨에 대한 문의가 가능해요.' },
      },
    };
    const m = renderTelegramMessages(event, BASE_CONFIG);
    expect(m).toHaveLength(1);
    expect(m[0].body.kind).toBe('text');
    if (m[0].body.kind === 'text') {
      expect(m[0].body.text).toContain('카페24');
    }
  });

  it('carousel — nodeOutput.output.items (structured shape) 추출', () => {
    const event = {
      ...BASE_EVENT_FIELDS,
      type: 'execution.node.completed' as const,
      node: { id: 'car-1', type: 'carousel' as const },
      output: {
        config: { items: [{ title: '상품 A' }] },
        output: { items: [{ title: '상품 A' }] },
      },
    };
    const m = renderTelegramMessages(event, BASE_CONFIG);
    const all = m
      .map((msg) => (msg.body.kind === 'text' ? msg.body.text : ''))
      .join('\n');
    expect(all).toContain('상품 A');
    expect(all).not.toContain('카드가 없습니다');
  });

  it('carousel static mode — items 가 config 안에만 있는 경우 (handler return shape)', () => {
    // Carousel static mode: handler 가 items 를 output 안 넣고 config.items 만 유지.
    // 회귀: renderer 가 config.items 도 fallback 으로 봐야 빈 items 오해 안 함.
    const event = {
      ...BASE_EVENT_FIELDS,
      type: 'execution.node.completed' as const,
      node: { id: 'car-2', type: 'carousel' as const },
      output: {
        config: {
          items: [
            { title: '카드 1', description: '본문' },
            { title: '카드 2' },
          ],
          mode: 'static',
        },
        output: {},
      },
    };
    const m = renderTelegramMessages(event, BASE_CONFIG);
    const all = m
      .map((msg) => (msg.body.kind === 'text' ? msg.body.text : ''))
      .join('\n');
    expect(all).toContain('카드 1');
    expect(all).toContain('카드 2');
  });
});
