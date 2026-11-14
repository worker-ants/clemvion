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

describe('renderDiscordEvent — execution.ai_message (§5.1(b) reply 버튼)', () => {
  it('AI 응답 마지막 텍스트 청크를 buttons 로 승격 + __reply__ 버튼 첨부', () => {
    const msgs = renderDiscordEvent(
      {
        ...BASE,
        type: 'execution.ai_message',
        message: 'AI 응답입니다',
        turnCount: 1,
      } as Extract<EiaEvent, { type: 'execution.ai_message' }>,
      CONFIG,
    );
    const last = msgs[msgs.length - 1];
    expect(last.body.kind).toBe('buttons');
    if (last.body.kind === 'buttons') {
      expect(last.body.text).toBe('AI 응답입니다');
      expect(last.body.buttons).toHaveLength(1);
      expect(last.body.buttons[0].id).toBe('__reply__');
    }
  });
});

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
    // C-11: ai_message 마지막 텍스트 청크는 Reply 버튼 첨부로 buttons body 가 된다.
    const allTexts = msgs
      .map((m) =>
        m.body.kind === 'text' || m.body.kind === 'buttons' ? m.body.text : '',
      )
      .join('\n');
    expect(allTexts).toContain('AI 응답');
    expect(allTexts).toContain('템플릿 결과');
  });

  // C-11: §5.1(b) — ai_message 끝에 Reply 버튼(custom_id __reply__)을 첨부한다.
  // 마지막 텍스트 청크가 buttons body 로 승격되며 본문 텍스트는 보존된다.
  it('presentations 미정의 → 단일 메시지에 Reply 버튼 첨부 (text 보존)', () => {
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
    expect(msgs[0].body.kind).toBe('buttons');
    if (msgs[0].body.kind === 'buttons') {
      expect(msgs[0].body.text).toBe('plain');
      expect(msgs[0].body.buttons.map((b) => b.id)).toContain('__reply__');
    }
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
    // text 1건 (ai_message, C-11 로 buttons body) + form fallback 1건+
    expect(msgs.length).toBeGreaterThan(1);
    const all = msgs
      .map((m) =>
        m.body.kind === 'text' || m.body.kind === 'buttons' ? m.body.text : '',
      )
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

// NERV Task CLE-T-ZGF71P — continued 접미사를 붙여도 조각마다 Discord `content` 한도 2000자 이하.
// NERV Task CLE-T-ZEWGJP — 그 한도 안에서 줄바꿈 → 공백 → 고정 길이 순으로 자를 자리를 고른다.
describe('renderDiscordEvent — 2000자 조각 한도와 경계 (REQ-DISCORD-010)', () => {
  const DISCORD_LIMIT = 2000;
  const SUFFIX = '\n_(continued…)_';
  const BODY_LIMIT = DISCORD_LIMIT - SUFFIX.length;

  /** 자리마다 글자가 다르고 공백이 없는 문자열. 위치가 어긋나면 이은 결과가 원문과 달라진다. */
  function distinct(length: number, seed = 0): string {
    const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let out = '';
    for (let i = 0; i < length; i += 1)
      out += alphabet[(i * 7 + seed) % alphabet.length];
    return out;
  }

  function renderTemplate(rendered: string): string[] {
    const msgs = renderDiscordEvent(
      {
        ...BASE,
        type: 'execution.node.completed',
        node: { id: 'tpl-1', type: 'template' },
        output: { rendered },
      },
      CONFIG,
    );
    return msgs.map((m) => {
      if (m.body.kind !== 'text') throw new Error(`unexpected ${m.body.kind}`);
      return m.body.text;
    });
  }

  function bodiesOf(chunks: string[]): string[] {
    chunks.slice(0, -1).forEach((c) => expect(c.endsWith(SUFFIX)).toBe(true));
    expect(chunks[chunks.length - 1].endsWith(SUFFIX)).toBe(false);
    return chunks.map((c, i) =>
      i < chunks.length - 1 ? c.slice(0, -SUFFIX.length) : c,
    );
  }

  it.each([2000, 2001, 1985, 1986, 3970, 3971, 4000, 10_000])(
    '경계 없는 길이 %i 본문 — 조각마다 접미사 포함 2000자 이하이고 이으면 원문',
    (length) => {
      const text = distinct(length, length);
      const chunks = renderTemplate(text);
      for (const c of chunks)
        expect(c.length).toBeLessThanOrEqual(DISCORD_LIMIT);
      expect(bodiesOf(chunks).join('')).toBe(text);
    },
  );

  it('2000자 본문은 나누지 않는다', () => {
    expect(renderTemplate(distinct(2000))).toHaveLength(1);
  });

  it('경계 없는 2001자 본문은 두 조각이고 첫 조각은 정확히 2000자다', () => {
    const chunks = renderTemplate(distinct(2001));
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(DISCORD_LIMIT);
  });

  it('본문 한도 안의 마지막 줄바꿈 바로 뒤에서 자른다', () => {
    const first = `${distinct(1200)}\n${distinct(300, 1)} ${distinct(200, 2)}`;
    const text = `${first}\n${distinct(1000, 3)}`;
    // 첫 줄바꿈(1200) 뒤와 공백(1501) 뒤가 본문 한도(1985) 안에 있다. 다음 줄바꿈(1702)이 가장 뒤다.
    const bodies = bodiesOf(renderTemplate(text));
    expect(bodies[0]).toBe(`${first}\n`);
    expect(bodies.join('')).toBe(text);
  });

  it('줄바꿈이 없으면 본문 한도 안의 마지막 공백 바로 뒤에서 자른다', () => {
    const text = `${distinct(1000)} ${distinct(900, 1)} ${distinct(500, 2)}`;
    const bodies = bodiesOf(renderTemplate(text));
    expect(bodies[0]).toBe(`${distinct(1000)} ${distinct(900, 1)} `);
    expect(bodies.join('')).toBe(text);
  });

  it('경계에서 자르면 본문이 한도 절반보다 짧아질 때 고정 길이로 자른다', () => {
    const text = `${distinct(500)} ${distinct(3000, 1)}`;
    const bodies = bodiesOf(renderTemplate(text));
    expect(bodies[0]).toHaveLength(BODY_LIMIT);
    expect(bodies.join('')).toBe(text);
  });

  it('여러 문단 본문 — 조각마다 2000자 이하이고 첫 조각 뒤로는 줄바꿈 뒤에서 시작한다', () => {
    const paragraphs = Array.from({ length: 20 }, (_, i) =>
      distinct(150 + i * 13, i),
    );
    const text = paragraphs.join('\n');
    const chunks = renderTemplate(text);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(DISCORD_LIMIT);
    const bodies = bodiesOf(chunks);
    bodies.slice(0, -1).forEach((b) => expect(b.endsWith('\n')).toBe(true));
    expect(bodies.join('')).toBe(text);
  });

  it('AI 응답 — 마지막 조각(버튼 메시지)까지 2000자 이하이고 이으면 원문', () => {
    const message = Array.from({ length: 60 }, (_, i) => distinct(70, i)).join(
      ' ',
    );
    const msgs = renderDiscordEvent(
      {
        ...BASE,
        type: 'execution.ai_message',
        message,
        turnCount: 1,
      } as Extract<EiaEvent, { type: 'execution.ai_message' }>,
      CONFIG,
    );
    expect(msgs.length).toBeGreaterThan(1);
    const texts = msgs.map((m) =>
      m.body.kind === 'text' || m.body.kind === 'buttons' ? m.body.text : '',
    );
    for (const t of texts) expect(t.length).toBeLessThanOrEqual(DISCORD_LIMIT);
    expect(bodiesOf(texts).join('')).toBe(message);
  });
});
