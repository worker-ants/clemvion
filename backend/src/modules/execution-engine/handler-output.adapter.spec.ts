import {
  adaptHandlerReturn,
  toEngineFlatShape,
  wrapBareAsNodeHandlerOutput,
} from './handler-output.adapter';

describe('adaptHandlerReturn', () => {
  describe('canonical NodeHandlerOutput shape', () => {
    it('preserves config/output/meta/port/status as-is', () => {
      const raw = {
        config: { url: 'https://x' },
        output: { response: 'ok' },
        meta: { durationMs: 10 },
        port: 'success',
        status: 'ended',
      };
      expect(adaptHandlerReturn(raw)).toEqual(raw);
    });

    it('defaults config to {} when null/undefined', () => {
      expect(adaptHandlerReturn({ config: null, output: 1 })).toEqual({
        config: {},
        output: 1,
      });
    });

    it('drops undefined control fields', () => {
      const result = adaptHandlerReturn({
        config: {},
        output: 0,
        meta: undefined,
        port: undefined,
        status: undefined,
      });
      expect(result).toEqual({ config: {}, output: 0 });
    });

    it('preserves _resumeState when handler emits canonical shape', () => {
      const resumeState = { messages: [], turnCount: 3 };
      const result = adaptHandlerReturn({
        config: {},
        output: { messages: [] },
        status: 'waiting_for_input',
        _resumeState: resumeState,
      });
      expect(result._resumeState).toBe(resumeState);
    });

    // INFO #5 (Security) — boundary 자동 마스킹.
    it('masks credential-like keys in echoed config', () => {
      const result = adaptHandlerReturn({
        config: {
          model: 'gpt-4',
          apiKey: 'sk-secret-1234567890',
          headers: {
            Authorization: 'Bearer xyz-token-abcdef',
            'x-trace-id': 'trace-1',
          },
          nested: { password: 'p@ssw0rd', other: 'public' },
        },
        output: { ok: true },
      });
      const cfg = result.config;
      // 일반 필드는 그대로 통과
      expect(cfg.model).toBe('gpt-4');
      // top-level credential 마스킹
      expect(cfg.apiKey).toBe('****7890');
      // 중첩 credential 마스킹
      const headers = cfg.headers as Record<string, string>;
      expect(headers.Authorization).toBe('****cdef');
      expect(headers['x-trace-id']).toBe('trace-1');
      const nested = cfg.nested as Record<string, string>;
      expect(nested.password).toBe('****w0rd');
      expect(nested.other).toBe('public');
    });

    it('masks non-string credential values as ****', () => {
      const result = adaptHandlerReturn({
        config: {
          token: { complex: 'object' },
          secret: 12345,
        },
        output: {},
      });
      const cfg = result.config;
      expect(cfg.token).toBe('****');
      expect(cfg.secret).toBe('****');
    });
  });

  describe('production-strict mode (NODE_ENV=production)', () => {
    const prevEnv = process.env.NODE_ENV;
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });
    afterEach(() => {
      process.env.NODE_ENV = prevEnv;
    });

    it('throws when a handler returns a bare object in production', () => {
      expect(() => adaptHandlerReturn({ foo: 1 })).toThrow(
        /NodeHandlerOutput contract/,
      );
    });

    it('throws when a handler returns null in production', () => {
      expect(() => adaptHandlerReturn(null)).toThrow(/contract/);
    });

    it('throws when a handler returns a primitive in production', () => {
      expect(() => adaptHandlerReturn(42)).toThrow(/contract/);
    });

    it('throws when a handler returns legacy port-selector in production', () => {
      expect(() => adaptHandlerReturn({ port: 'x', data: { y: 1 } })).toThrow(
        /contract/,
      );
    });

    it('still passes canonical shape through in production', () => {
      const raw = {
        config: { url: 'https://x' },
        output: { response: 'ok' },
        port: 'success',
      };
      expect(adaptHandlerReturn(raw)).toEqual(raw);
    });

    it('passes conversation waiting shape (ai_agent / info_extractor) through in production', () => {
      // Regression for the production-strict throw that fired on the legacy
      // bare waiting shape. Both multi-turn handlers now return canonical
      // shape with output.{messages,message,turnCount,maxTurns,partial?}
      // and meta.interactionType === 'ai_conversation'.
      const aiAgentWaiting = {
        config: { mode: 'multi_turn', maxTurns: 0, maxToolCalls: 100 },
        output: {
          messages: [{ role: 'system', content: 'You are helpful' }],
          message: '',
          turnCount: 0,
          maxTurns: 0,
        },
        meta: { interactionType: 'ai_conversation' },
        status: 'waiting_for_input',
        _resumeState: { messages: [], turnCount: 0 },
      };
      expect(() => adaptHandlerReturn(aiAgentWaiting)).not.toThrow();

      const ieWaiting = {
        config: { schema: [], mode: 'multi_turn', maxCollectionRetries: 3 },
        output: {
          messages: [],
          message: '주문번호를 알려주세요',
          turnCount: 1,
          maxTurns: 5,
          partial: {
            extracted: {},
            missingFields: ['orderNumber'],
            collectionRetryCount: 0,
          },
        },
        meta: { interactionType: 'ai_conversation' },
        status: 'waiting_for_input',
        _resumeState: { partialResult: {}, turnCount: 1 },
      };
      const adapted = adaptHandlerReturn(ieWaiting);
      expect(adapted.status).toBe('waiting_for_input');
      expect(adapted._resumeState).toEqual({ partialResult: {}, turnCount: 1 });
    });

    it('truncates long bare shapes in the error preview', () => {
      const big = { a: 'x'.repeat(1000) };
      expect(() => adaptHandlerReturn(big)).toThrow(/got \{[^]{1,220}/);
    });

    it('handles unserialisable values gracefully in the error message', () => {
      const circular: Record<string, unknown> = { self: null };
      circular.self = circular;
      expect(() => adaptHandlerReturn(circular)).toThrow(/contract/);
    });
  });

  describe('wrapBareAsNodeHandlerOutput (exported test helper)', () => {
    it('wraps bare objects identically to the non-strict branch', () => {
      expect(wrapBareAsNodeHandlerOutput({ a: 1 })).toEqual({
        config: {},
        output: { a: 1 },
      });
    });

    it('lifts status / port / _resumeState from bare objects', () => {
      const state = { turn: 1 };
      const adapted = wrapBareAsNodeHandlerOutput({
        status: 'waiting_for_input',
        port: 'out',
        _resumeState: state,
        rest: true,
      });
      expect(adapted.status).toBe('waiting_for_input');
      expect(adapted.port).toBe('out');
      expect(adapted._resumeState).toBe(state);
    });

    it('is callable in production mode (bypasses strict guard)', () => {
      const prevEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        expect(wrapBareAsNodeHandlerOutput({ foo: 1 })).toEqual({
          config: {},
          output: { foo: 1 },
        });
      } finally {
        process.env.NODE_ENV = prevEnv;
      }
    });
  });

  describe('legacy bare-object coercion', () => {
    it('wraps a bare object as { config: {}, output: raw }', () => {
      const raw = { foo: 1 };
      expect(adaptHandlerReturn(raw)).toEqual({ config: {}, output: raw });
    });

    it('wraps null/undefined output directly', () => {
      expect(adaptHandlerReturn(null)).toEqual({ config: {}, output: null });
      expect(adaptHandlerReturn(undefined)).toEqual({
        config: {},
        output: undefined,
      });
    });

    it('wraps primitives / arrays', () => {
      expect(adaptHandlerReturn(42)).toEqual({ config: {}, output: 42 });
      expect(adaptHandlerReturn([1, 2])).toEqual({
        config: {},
        output: [1, 2],
      });
    });

    it('lifts top-level status / port from legacy bare objects', () => {
      expect(
        adaptHandlerReturn({
          foo: 'x',
          status: 'waiting_for_input',
          port: 'true',
        }),
      ).toEqual({
        config: {},
        output: { foo: 'x', status: 'waiting_for_input', port: 'true' },
        status: 'waiting_for_input',
        port: 'true',
      });
    });

    it('lifts _resumeState when handler returns the legacy bare waiting shape', () => {
      const state = { messages: [], partialResult: {} };
      const raw = {
        type: 'ai_conversation',
        status: 'waiting_for_input',
        config: { mode: 'multi_turn' },
        _resumeState: state,
      };
      const adapted = adaptHandlerReturn(raw);
      expect(adapted._resumeState).toBe(state);
      expect(adapted.status).toBe('waiting_for_input');
    });

    it('ignores non-object _resumeState', () => {
      const adapted = adaptHandlerReturn({ any: 1, _resumeState: 'bad' });
      expect(adapted._resumeState).toBeUndefined();
    });

    it('ignores _resumeState arrays (arrays are never resume state)', () => {
      const adapted = adaptHandlerReturn({ any: 1, _resumeState: [1, 2] });
      expect(adapted._resumeState).toBeUndefined();
    });
  });
});

describe('toEngineFlatShape', () => {
  it('returns the raw output for successful object results without control fields', () => {
    const flat = toEngineFlatShape({
      config: {},
      output: { rows: [1, 2] },
    });
    expect(flat).toEqual({ rows: [1, 2] });
  });

  it('surfaces status on object outputs so the blocking check still fires', () => {
    const flat = toEngineFlatShape({
      config: {},
      output: { items: [] },
      status: 'waiting_for_input',
    });
    expect((flat as Record<string, unknown>).status).toBe('waiting_for_input');
  });

  it('synthesises { data, port, status } when output is a primitive with control fields', () => {
    const flat = toEngineFlatShape({
      config: {},
      output: 'result text',
      port: 'out',
      status: 'ended',
    });
    expect(flat).toEqual({
      data: 'result text',
      port: 'out',
      status: 'ended',
    });
  });

  it('carries _resumeState forward on object outputs', () => {
    const state = { turn: 1 };
    const flat = toEngineFlatShape({
      config: {},
      output: { messages: [] },
      status: 'waiting_for_input',
      _resumeState: state,
    });
    expect((flat as Record<string, unknown>)._resumeState).toBe(state);
  });

  it('carries _resumeState when output is null (config-only waiting declaration)', () => {
    const state = { turn: 0 };
    const flat = toEngineFlatShape({
      config: { fields: [] },
      output: null,
      status: 'waiting_for_input',
      _resumeState: state,
    });
    expect((flat as Record<string, unknown>)._resumeState).toBe(state);
    expect((flat as Record<string, unknown>).status).toBe('waiting_for_input');
  });

  it('carries _resumeState when output is a primitive', () => {
    const state = { turn: 2 };
    const flat = toEngineFlatShape({
      config: {},
      output: 'x',
      status: 'waiting_for_input',
      _resumeState: state,
    });
    expect((flat as Record<string, unknown>)._resumeState).toBe(state);
  });

  it('does not overwrite an existing _resumeState on the output object', () => {
    const outputState = { inner: true };
    const topState = { outer: true };
    const flat = toEngineFlatShape({
      config: {},
      output: { _resumeState: outputState, foo: 1 },
      _resumeState: topState,
    });
    // Existing field on output wins so handlers that deliberately stash
    // debugging state inside `output` are not stomped on.
    expect((flat as Record<string, unknown>)._resumeState).toBe(outputState);
  });

  describe('control-field override (port/status are authoritative from handler)', () => {
    // Regression: when a handler forwards an upstream object as `output`
    // (e.g. switch does `output: input` after a form resume), the object
    // carries inherited `port: "out"` / `status: "resumed"` control fields.
    // The handler's declared `port`/`status` must override — otherwise the
    // downstream port-routing sees the stale inherited port and filters
    // every outgoing edge.
    it('overrides inherited port from output object with adapted.port', () => {
      const flat = toEngineFlatShape({
        config: {},
        output: { interaction: {}, port: 'out', status: 'resumed' },
        port: 'default',
      });
      expect((flat as Record<string, unknown>).port).toBe('default');
    });

    it('overrides inherited status from output object with adapted.status', () => {
      const flat = toEngineFlatShape({
        config: {},
        output: { interaction: {}, status: 'resumed' },
        status: 'ended',
      });
      expect((flat as Record<string, unknown>).status).toBe('ended');
    });

    it('still preserves inherited port when adapted does not declare one', () => {
      const flat = toEngineFlatShape({
        config: {},
        output: { interaction: {}, port: 'out' },
      });
      // Without a handler-declared port, a pass-through handler can still
      // forward whatever port metadata rode in on the input.
      expect((flat as Record<string, unknown>).port).toBe('out');
    });

    it('synthesises base.data when the handler declares a port and output has no data', () => {
      const output = { interaction: {}, port: 'out' };
      const flat = toEngineFlatShape({
        config: {},
        output,
        port: 'case_korean',
      }) as Record<string, unknown>;
      expect(flat.port).toBe('case_korean');
      expect(flat.data).toBe(output);
    });
  });
});
