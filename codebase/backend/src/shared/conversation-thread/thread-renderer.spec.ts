import {
  applyCap,
  cloneThread,
  MAX_INJECTED_CHARS,
  MAX_INJECTED_TURNS,
  MAX_TURN_TEXT_CHARS,
  redactThreadForPublic,
  renderInteractionText,
  renderThreadAsSystemText,
} from './thread-renderer';
import {
  ConversationThread,
  ConversationTurn,
  createEmptyConversationThread,
} from './conversation-thread.types';

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
    it('renders flat key=value pairs joined by comma (wrapped in user-input marker)', () => {
      const text = renderInteractionText({
        type: 'form_submitted',
        data: { name: 'John', age: 30 },
      });
      // Prompt-injection defense: form values are wrapped so the LLM can
      // distinguish instructions from data.
      expect(text).toBe('[user-input]name=John, age=30[/user-input]');
    });

    it('serializes nested objects/arrays via JSON', () => {
      const text = renderInteractionText({
        type: 'form_submitted',
        data: { tags: ['a', 'b'], meta: { x: 1 } },
      });
      expect(text).toContain('tags=["a","b"]');
      expect(text).toContain('meta={"x":1}');
    });

    it('caps total length at 200 chars with ellipsis (cap applies to inner content)', () => {
      const big = 'x'.repeat(500);
      const text = renderInteractionText({
        type: 'form_submitted',
        data: { huge: big },
      });
      // Inner content capped at 200+ellipsis; outer marker adds fixed overhead.
      const innerLen = text.length - '[user-input][/user-input]'.length;
      expect(innerLen).toBeLessThanOrEqual(200 + 3);
      expect(text.endsWith('...[/user-input]')).toBe(true);
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
      ).toBe('[user-input]a=null, b=undefined[/user-input]');
    });
  });

  describe('button_click', () => {
    it('uses buttonLabel when present (wrapped in marker)', () => {
      expect(
        renderInteractionText({
          type: 'button_click',
          data: { buttonId: 'btn-1', buttonLabel: '동의' },
        }),
      ).toBe('clicked: [user-input]동의[/user-input]');
    });

    it('falls back to buttonId when label missing', () => {
      expect(
        renderInteractionText({
          type: 'button_click',
          data: { buttonId: 'btn-1' },
        }),
      ).toBe('clicked: [user-input]btn-1[/user-input]');
    });

    it('emits empty marker when both label and id missing (I12 fallback)', () => {
      // Defensive: schema guarantees at least one, but the helper must not
      // crash on a malformed payload.
      expect(
        renderInteractionText({
          type: 'button_click',
          data: {},
        }),
      ).toBe('clicked: ');
    });
  });

  describe('button_continue', () => {
    it('renders url when present (wrapped in marker)', () => {
      expect(
        renderInteractionText({
          type: 'button_continue',
          data: { buttonId: 'btn-1', buttonLabel: 'Open', url: 'https://x' },
        }),
      ).toBe('continued: [user-input]https://x[/user-input]');
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

describe('cloneThread (Background isolation §3.2)', () => {
  function makeThread(turnCount = 2): ConversationThread {
    const t = createEmptyConversationThread();
    for (let i = 0; i < turnCount; i++) {
      t.turns.push(makeTurn({ seq: i, text: `t${i}` }));
      t.nextSeq = i + 1;
      t.totalChars += 2;
    }
    return t;
  }

  it('produces a new wrapper object', () => {
    const original = makeThread();
    const clone = cloneThread(original);
    expect(clone).not.toBe(original);
  });

  it('produces a new turns array (push to clone leaves original unchanged)', () => {
    const original = makeThread();
    const clone = cloneThread(original);
    expect(clone.turns).not.toBe(original.turns);
    // Test scenario: assert turns array is a new wrapper — push only via cast
    // since runtime ConversationTurn[] but type is readonly. The runtime mutation
    // is the assertion target.
    (clone.turns as ConversationTurn[]).push(
      makeTurn({ seq: 999, text: 'leaked' }),
    );
    expect(original.turns).toHaveLength(2);
    expect(original.turns.find((t) => t.text === 'leaked')).toBeUndefined();
  });

  it('shares ConversationTurn objects (turns are immutable post-push, deeper clone unnecessary)', () => {
    const original = makeThread();
    const clone = cloneThread(original);
    expect(clone.turns[0]).toBe(original.turns[0]);
  });

  it('preserves totalChars and id', () => {
    const original = makeThread(3);
    const clone = cloneThread(original);
    expect(clone.id).toBe(original.id);
    expect(clone.nextSeq).toBe(original.nextSeq);
    expect(clone.totalChars).toBe(original.totalChars);
  });
});

describe('redactThreadForPublic (EIA egress secret masking §R17)', () => {
  function makeThread(turns: ConversationTurn[]): ConversationThread {
    return {
      id: 'default',
      nextSeq: turns.length,
      turns,
      totalChars: turns.reduce((n, t) => n + t.text.length, 0),
    };
  }

  it('masks Bearer tokens in turn text', () => {
    const thread = makeThread([
      makeTurn({
        source: 'ai_tool',
        text: 'called API with Authorization: Bearer sk-live-abc123DEF.tok',
      }),
    ]);
    const out = redactThreadForPublic(thread);
    expect(out.turns[0].text).not.toContain('sk-live-abc123DEF');
    expect(out.turns[0].text).toContain('***');
  });

  it('masks secret-keyword assignments (api_key / password / secret)', () => {
    const thread = makeThread([
      makeTurn({ text: 'api_key=AKIAIOSFODNN7EXAMPLE and password: hunter2' }),
    ]);
    const out = redactThreadForPublic(thread);
    expect(out.turns[0].text).not.toContain('AKIAIOSFODNN7EXAMPLE');
    expect(out.turns[0].text).not.toContain('hunter2');
  });

  it('masks secret-shaped tokens inside toolCalls[].arguments', () => {
    const thread = makeThread([
      makeTurn({
        source: 'ai_assistant',
        text: 'calling tool',
        toolCalls: [
          {
            id: 'tc1',
            name: 'http_request',
            arguments: '{"header":"Authorization: Bearer leakedtoken12345"}',
          },
        ],
      }),
    ]);
    const out = redactThreadForPublic(thread);
    expect(out.turns[0].toolCalls?.[0].arguments).not.toContain(
      'leakedtoken12345',
    );
    expect(out.turns[0].toolCalls?.[0].arguments).toContain('***');
    // Non-secret tool metadata is preserved.
    expect(out.turns[0].toolCalls?.[0].name).toBe('http_request');
  });

  it('masks secret-shaped tokens in runningSummary', () => {
    const thread: ConversationThread = {
      ...makeThread([makeTurn({ text: 'hi' })]),
      runningSummary: 'user shared client_secret=super-secret-value earlier',
    };
    const out = redactThreadForPublic(thread);
    expect(out.runningSummary).not.toContain('super-secret-value');
    expect(out.runningSummary).toContain('***');
  });

  it('returns clean turns by reference (no re-allocation when nothing to mask)', () => {
    const thread = makeThread([
      makeTurn({ seq: 0, text: 'hello there' }),
      makeTurn({ seq: 1, source: 'ai_assistant', text: '반갑습니다' }),
    ]);
    const out = redactThreadForPublic(thread);
    // Wrapper + turns array are fresh (safe to hand outside the boundary)...
    expect(out).not.toBe(thread);
    expect(out.turns).not.toBe(thread.turns);
    // ...but unchanged turn objects are shared (mirrors applyCap copy strategy).
    expect(out.turns[0]).toBe(thread.turns[0]);
    expect(out.turns[1]).toBe(thread.turns[1]);
  });

  it('does not mutate the input thread or its turns', () => {
    const turn = makeTurn({
      text: 'Authorization: Bearer secrettoken0987654321',
    });
    const thread = makeThread([turn]);
    redactThreadForPublic(thread);
    expect(thread.turns[0].text).toBe(
      'Authorization: Bearer secrettoken0987654321',
    );
    expect(thread.turns[0]).toBe(turn);
  });

  it('preserves non-text metadata (seq, nodeId, source, timestamp)', () => {
    const thread = makeThread([
      makeTurn({
        seq: 7,
        nodeId: 'node-x',
        source: 'ai_tool',
        text: 'token=Bearer abcdefghijklmnop',
        timestamp: '2026-07-09T00:00:00.000Z',
      }),
    ]);
    const out = redactThreadForPublic(thread);
    expect(out.turns[0]).toMatchObject({
      seq: 7,
      nodeId: 'node-x',
      source: 'ai_tool',
      timestamp: '2026-07-09T00:00:00.000Z',
    });
    expect(out.nextSeq).toBe(thread.nextSeq);
    expect(out.id).toBe(thread.id);
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
