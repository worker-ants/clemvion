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

  it('render_form (type === form) → skip', () => {
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
            payload: { fields: [{ name: 'a', label: 'A' }] },
          },
        ],
      },
      CONFIG,
    );
    // form 은 skip — text 1건만
    expect(msgs).toHaveLength(1);
  });
});
