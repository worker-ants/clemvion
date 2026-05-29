/**
 * Discord renderer 단위 테스트 — execution.failed CCH-ERR-* 분기 위주.
 *
 * 기존 discord.adapter.spec.ts 가 happy path 를 커버. 본 spec 은 신규 §5.6 분기.
 */
import { Logger } from '@nestjs/common';
import { renderDiscordEvent } from './discord-message.renderer';
import type { ChatChannelConfig, EiaEvent } from '../../types';

const CONFIG: ChatChannelConfig = {
  provider: 'discord',
  botTokenRef: 'r',
  languageHints: {
    executionCompleted: '완료!',
    executionCancelled: '취소됨',
  },
};

const BASE: Pick<
  Extract<EiaEvent, { type: 'execution.failed' }>,
  'executionId' | 'triggerId' | 'workflowId' | 'seq' | 'timestamp'
> = {
  executionId: 'e',
  triggerId: 't',
  workflowId: 'w',
  seq: 1,
  timestamp: '2026-05-25T00:00:00Z',
};

describe('renderDiscordEvent — execution.failed (CCH-ERR-*)', () => {
  it('CCH-ERR-03 민감정보 strip — error.message / nodeId / executionId 미노출', () => {
    const msgs = renderDiscordEvent(
      {
        ...BASE,
        type: 'execution.failed',
        executionId: 'exec-leak',
        workflowId: 'wf-leak',
        error: {
          code: 'HTTP_TRANSPORT_FAILED',
          message: 'ENOTFOUND api.internal.example.com',
          nodeId: 'node-leak',
        },
      },
      CONFIG,
    );
    expect(msgs[0].body.kind).toBe('text');
    const text = (msgs[0].body as { text: string }).text;
    expect(text.length).toBeGreaterThan(0);
    expect(text).not.toContain('ENOTFOUND');
    expect(text).not.toContain('api.internal');
    expect(text).not.toContain('HTTP_TRANSPORT_FAILED');
    expect(text).not.toContain('node-leak');
    expect(text).not.toContain('exec-leak');
    expect(text).not.toContain('wf-leak');
  });

  it('HTTP_4XX with statusCode → {statusCode} 치환 (Discord plain text — 대괄호 escape 없음)', () => {
    const msgs = renderDiscordEvent(
      {
        ...BASE,
        type: 'execution.failed',
        error: {
          code: 'HTTP_4XX',
          message: 'x',
          details: { statusCode: 429 },
        },
      },
      CONFIG,
    );
    const text = (msgs[0].body as { text: string }).text;
    expect(text).toContain('429');
  });

  it('HTTP_5XX without statusCode → key 분기는 5xx, placeholder omit ("?" 치환)', () => {
    const msgs = renderDiscordEvent(
      {
        ...BASE,
        type: 'execution.failed',
        error: { code: 'HTTP_5XX', message: 'x' },
      },
      CONFIG,
    );
    const text = (msgs[0].body as { text: string }).text;
    // {statusCode} omit → '?' 치환 (applyPlaceholders 기본값 — W#7 강화)
    expect(text).toContain('?');
    // KO default 문구의 prefix 확인 (5xx 분기 올바른지 검증)
    expect(text).toContain('일시적');
  });

  it('LLM_RATE_LIMIT → executionFailedRateLimit', () => {
    const msgs = renderDiscordEvent(
      {
        ...BASE,
        type: 'execution.failed',
        error: { code: 'LLM_RATE_LIMIT', message: 'x' },
      },
      CONFIG,
    );
    const text = (msgs[0].body as { text: string }).text;
    expect(text).toContain('요청량이 많아');
  });

  it('LLM_TIMEOUT → executionFailedTimeout (KO default)', () => {
    const msgs = renderDiscordEvent(
      {
        ...BASE,
        type: 'execution.failed',
        error: { code: 'LLM_TIMEOUT', message: 'x' },
      },
      CONFIG,
    );
    const text = (msgs[0].body as { text: string }).text;
    expect(text).toContain('처리 시간이 초과');
  });

  it('DB_QUERY_FAILED → executionFailedInternal', () => {
    const msgs = renderDiscordEvent(
      {
        ...BASE,
        type: 'execution.failed',
        error: {
          code: 'DB_QUERY_FAILED',
          message: 'SELECT * FROM users WHERE password = ...',
        },
      },
      CONFIG,
    );
    const text = (msgs[0].body as { text: string }).text;
    expect(text).toContain('서비스에 일시적');
    // SQL 절대 노출 금지
    expect(text).not.toContain('SELECT');
    expect(text).not.toContain('password');
  });

  it('unknown code → executionFailedInternal fallback (CCH-ERR-04) + warn log', () => {
    const warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const msgs = renderDiscordEvent(
      {
        ...BASE,
        type: 'execution.failed',
        error: { code: 'BRAND_NEW_CODE', message: 'x' },
      },
      CONFIG,
    );
    const text = (msgs[0].body as { text: string }).text;
    expect(text).toContain('서비스에 일시적');
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('user override 우선 — languageHints[key] 가 default 위에', () => {
    const msgs = renderDiscordEvent(
      {
        ...BASE,
        type: 'execution.failed',
        error: { code: 'HTTP_4XX', message: 'x', details: { statusCode: 400 } },
      },
      {
        ...CONFIG,
        languageHints: {
          executionFailedThirdParty4xx: 'CUSTOM-{statusCode}',
        },
      },
    );
    const text = (msgs[0].body as { text: string }).text;
    expect(text).toBe('CUSTOM-400');
  });

  it('languageLocale=en → EN default', () => {
    const msgs = renderDiscordEvent(
      {
        ...BASE,
        type: 'execution.failed',
        error: { code: 'HTTP_5XX', message: 'x', details: { statusCode: 503 } },
      },
      { ...CONFIG, languageLocale: 'en' },
    );
    const text = (msgs[0].body as { text: string }).text;
    expect(text).toContain('503');
    expect(text.toLowerCase()).toContain('temporarily unavailable');
  });
});

// ---------------------------------------------------------------------------
// 2026-05-25 — CCH-MP-06 / CCH-MP-01 보강 (회귀 ①+② 해소).
// SoT: spec/conventions/chat-channel-adapter.md §3 / §1.3 / §R-CCA-7.
// ---------------------------------------------------------------------------
describe('renderDiscordEvent — execution.node.completed (CCH-MP-06)', () => {
  it('template + output.rendered → text 1건', () => {
    const msgs = renderDiscordEvent(
      {
        ...BASE,
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
    const msgs = renderDiscordEvent(
      {
        ...BASE,
        type: 'execution.node.completed',
        node: { id: 'tpl-1', type: 'template' },
        output: { rendered: '' },
      },
      CONFIG,
    );
    expect(msgs).toHaveLength(0);
  });

  it('carousel → markdown fallback text 발화', () => {
    const msgs = renderDiscordEvent(
      {
        ...BASE,
        type: 'execution.node.completed',
        node: { id: 'car-1', type: 'carousel' },
        output: { payload: { items: [{ title: 'Card A' }] } },
      },
      CONFIG,
    );
    expect(msgs.length).toBeGreaterThan(0);
  });
});

describe('renderDiscordEvent — execution.ai_message presentations[] (CCH-MP-01 보강)', () => {
  it('text + presentations 4종 → sequential 추가 발송', () => {
    const msgs = renderDiscordEvent(
      {
        ...BASE,
        type: 'execution.ai_message',
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
    const msgs = renderDiscordEvent(
      {
        ...BASE,
        type: 'execution.ai_message',
        message: 'plain',
        turnCount: 1,
      },
      CONFIG,
    );
    expect(msgs).toHaveLength(1);
    expect(msgs[0].body.kind).toBe('text');
  });

  it('render_form (type === form) → v1 임시 fallback text 발화 (회귀 ④ fix, 2026-05-25)', () => {
    // 직전 정책 (skip) 은 사용자에게 메시지 안 보이는 회귀.
    // SoT: spec/conventions/chat-channel-adapter.md §3 (2026-05-25 갱신).
    const msgs = renderDiscordEvent(
      {
        ...BASE,
        type: 'execution.ai_message',
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
    // text 1건 (ai_message) + form fallback 1건+
    expect(msgs.length).toBeGreaterThan(1);
    const all = msgs
      .map((m) => (m.body.kind === 'text' ? m.body.text : ''))
      .join('\n');
    expect(all).toContain('with form');
    expect(all).toContain('이름');
  });
});

// ---------------------------------------------------------------------------
// 2026-05-25 — 회귀 ⑤ (Discord): handler structured return shape 처리.
// ---------------------------------------------------------------------------
describe('renderDiscordEvent — execution.node.completed structured return shape (회귀 ⑤)', () => {
  it('template — nodeOutput.output.rendered 추출', () => {
    const msgs = renderDiscordEvent(
      {
        ...BASE,
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
    const msgs = renderDiscordEvent(
      {
        ...BASE,
        type: 'execution.node.completed',
        node: { id: 'car-1', type: 'carousel' },
        output: {
          config: { items: [{ title: '카드 X' }, { title: '카드 Y' }] },
          output: {},
        },
      },
      CONFIG,
    );
    const all = msgs
      .map((m) => (m.body.kind === 'text' ? m.body.text : ''))
      .join('\n');
    // Discord 의 renderVisualFallback carousel 분기: items 인식되면 무언가 발화
    // (빈 string 또는 카드 내용). 빈 fallback 회귀 차단.
    expect(all.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// §4.1 native modal 게이팅 — Discord MODAL 은 TEXT_INPUT only (text 계열만).
// ---------------------------------------------------------------------------
describe('renderDiscordEvent — form §4.1 native modal 게이팅', () => {
  function formEvent(
    fields: Array<Record<string, unknown>>,
  ): Extract<EiaEvent, { type: 'execution.waiting_for_input' }> {
    return {
      ...BASE,
      type: 'execution.waiting_for_input',
      node: { id: 'n', type: 'form', interactionType: 'form' },
      interaction: {},
      context: { formConfig: { fields } },
    };
  }

  it('≤5 text-family fields → form_modal', () => {
    const msgs = renderDiscordEvent(
      formEvent([
        { name: 'name', label: 'Name', type: 'text', required: true },
        { name: 'email', label: 'Email', type: 'email' },
      ]),
      CONFIG,
    );
    expect(msgs).toHaveLength(1);
    expect(msgs[0].body).toMatchObject({
      kind: 'form_modal',
      openLabel: '양식 작성하기',
    });
  });

  it('select 필드 포함 → form_prompt (Discord modal TEXT_INPUT only)', () => {
    const msgs = renderDiscordEvent(
      formEvent([
        { name: 'name', label: 'Name', type: 'text' },
        {
          name: 'role',
          label: 'Role',
          type: 'select',
          options: [{ label: 'A', value: 'a' }],
        },
      ]),
      CONFIG,
    );
    expect(msgs[0].body).toMatchObject({ kind: 'form_prompt' });
  });

  it('6 fields → form_prompt (modal max 5 초과)', () => {
    const fields = Array.from({ length: 6 }, (_, i) => ({
      name: `f${i}`,
      label: `F${i}`,
      type: 'text',
    }));
    const msgs = renderDiscordEvent(formEvent(fields), CONFIG);
    expect(msgs[0].body).toMatchObject({ kind: 'form_prompt' });
  });
});
