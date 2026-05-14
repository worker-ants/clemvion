import {
  applyCap,
  MAX_INJECTED_CHARS,
  MAX_INJECTED_TURNS,
  MAX_TURN_TEXT_CHARS,
  renderInteractionText,
  renderThreadAsSystemText,
} from './thread-renderer';
import { ConversationTurn } from './conversation-thread.types';

function makeTurn(overrides: Partial<ConversationTurn> = {}): ConversationTurn {
  return {
    seq: 0,
    nodeId: 'node-1',
    nodeLabel: 'Form',
    nodeType: 'form',
    timestamp: '2026-05-14T10:00:00.000Z',
    source: 'presentation_user',
    text: '',
    ...overrides,
  };
}

describe('renderInteractionText', () => {
  describe('form_submitted', () => {
    it('renders flat key=value pairs joined by comma', () => {
      const text = renderInteractionText({
        type: 'form_submitted',
        data: { name: 'John', age: 30 },
      });
      expect(text).toBe('name=John, age=30');
    });

    it('serializes nested objects/arrays via JSON', () => {
      const text = renderInteractionText({
        type: 'form_submitted',
        data: { tags: ['a', 'b'], meta: { x: 1 } },
      });
      expect(text).toContain('tags=["a","b"]');
      expect(text).toContain('meta={"x":1}');
    });

    it('caps total length at 200 chars with ellipsis', () => {
      const big = 'x'.repeat(500);
      const text = renderInteractionText({
        type: 'form_submitted',
        data: { huge: big },
      });
      expect(text.length).toBeLessThanOrEqual(200 + 3);
      expect(text.endsWith('...')).toBe(true);
    });

    it('handles empty data as empty string', () => {
      expect(renderInteractionText({ type: 'form_submitted', data: {} })).toBe(
        '',
      );
    });

    it('coerces null/undefined values to literal token', () => {
      expect(
        renderInteractionText({
          type: 'form_submitted',
          data: { a: null, b: undefined },
        }),
      ).toBe('a=null, b=undefined');
    });
  });

  describe('button_click', () => {
    it('uses buttonLabel when present', () => {
      expect(
        renderInteractionText({
          type: 'button_click',
          data: { buttonId: 'btn-1', buttonLabel: '동의' },
        }),
      ).toBe('clicked: 동의');
    });

    it('falls back to buttonId when label missing', () => {
      expect(
        renderInteractionText({
          type: 'button_click',
          data: { buttonId: 'btn-1' },
        }),
      ).toBe('clicked: btn-1');
    });
  });

  describe('button_continue', () => {
    it('renders url when present', () => {
      expect(
        renderInteractionText({
          type: 'button_continue',
          data: { buttonId: 'btn-1', buttonLabel: 'Open', url: 'https://x' },
        }),
      ).toBe('continued: https://x');
    });

    it('falls back to bare "continued" when url missing', () => {
      expect(
        renderInteractionText({
          type: 'button_continue',
          data: { buttonId: 'btn-1' },
        }),
      ).toBe('continued');
    });
  });

  it('returns empty string for unknown interaction type', () => {
    expect(
      renderInteractionText({
        type: 'message_received',
        data: { content: 'hi', role: 'user' },
      } as never),
    ).toBe('');
  });
});

describe('renderThreadAsSystemText', () => {
  it('returns empty string when no turns', () => {
    expect(renderThreadAsSystemText([])).toBe('');
  });

  it('wraps turns with header and footer markers', () => {
    const out = renderThreadAsSystemText([
      makeTurn({ seq: 0, source: 'presentation_user', text: 'name=Alice' }),
      makeTurn({
        seq: 1,
        nodeLabel: 'Agent',
        nodeType: 'ai_agent',
        source: 'ai_assistant',
        text: '안녕하세요',
      }),
    ]);
    expect(out.startsWith('[Conversation Context')).toBe(true);
    expect(out.endsWith('[End of Conversation Context]')).toBe(true);
    expect(out).toContain('#0');
    expect(out).toContain('#1');
    expect(out).toContain('Form (form)');
    expect(out).toContain('Agent (ai_agent)');
    expect(out).toContain('name=Alice');
    expect(out).toContain('안녕하세요');
  });

  it('header includes seq, timestamp, label, type, source', () => {
    const out = renderThreadAsSystemText([
      makeTurn({
        seq: 7,
        nodeLabel: 'X',
        nodeType: 'form',
        source: 'presentation_user',
        timestamp: '2026-01-01T00:00:00.000Z',
      }),
    ]);
    expect(out).toMatch(/#7/);
    expect(out).toMatch(/2026-01-01T00:00:00.000Z/);
    expect(out).toMatch(/X \(form\)/);
    expect(out).toMatch(/presentation_user/);
  });

  it('renders empty body line when text is empty', () => {
    const out = renderThreadAsSystemText([
      makeTurn({ seq: 0, text: '' }),
      makeTurn({ seq: 1, text: 'hello' }),
    ]);
    expect(out).toContain('hello');
  });
});

describe('applyCap', () => {
  function makeBulkTurns(n: number): ConversationTurn[] {
    return Array.from({ length: n }, (_, i) =>
      makeTurn({ seq: i, text: `t${i}` }),
    );
  }

  it('passes through under all caps', () => {
    const turns = makeBulkTurns(5);
    const result = applyCap(turns);
    expect(result.turns).toHaveLength(5);
    expect(result.droppedCount).toBe(0);
  });

  it('drops oldest turns when count exceeds MAX_INJECTED_TURNS', () => {
    const turns = makeBulkTurns(MAX_INJECTED_TURNS + 5);
    const result = applyCap(turns);
    expect(result.turns).toHaveLength(MAX_INJECTED_TURNS);
    expect(result.droppedCount).toBe(5);
    // oldest 5 are dropped — first kept turn should be seq 5
    expect(result.turns[0].seq).toBe(5);
  });

  it('truncates per-turn text exceeding MAX_TURN_TEXT_CHARS', () => {
    const turns = [makeTurn({ text: 'x'.repeat(MAX_TURN_TEXT_CHARS + 100) })];
    const result = applyCap(turns);
    expect(result.turns[0].text.length).toBeLessThanOrEqual(
      MAX_TURN_TEXT_CHARS + 3,
    );
    expect(result.turns[0].text.endsWith('...')).toBe(true);
  });

  it('respects MAX_INJECTED_CHARS as final safety net', () => {
    // 100 turns, each with 4000 char text → 400_000 chars, exceeds 200_000 cap
    const turns = Array.from({ length: 100 }, (_, i) =>
      makeTurn({ seq: i, text: 'x'.repeat(MAX_TURN_TEXT_CHARS) }),
    );
    const result = applyCap(turns);
    expect(result.totalChars).toBeLessThanOrEqual(MAX_INJECTED_CHARS);
    expect(result.droppedCount).toBeGreaterThan(0);
  });

  it('reports totalChars after all caps applied', () => {
    const turns = [
      makeTurn({ text: 'hi' }),
      makeTurn({ seq: 1, text: 'world' }),
    ];
    const result = applyCap(turns);
    expect(result.totalChars).toBe(7);
  });

  it('does not mutate input array', () => {
    const input = makeBulkTurns(3);
    const copy = [...input];
    applyCap(input);
    expect(input).toEqual(copy);
  });
});
