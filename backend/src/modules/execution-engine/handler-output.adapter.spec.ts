import {
  adaptHandlerReturn,
  toEngineFlatShape,
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
      expect(
        adaptHandlerReturn({ config: null, output: 1 } as unknown),
      ).toEqual({ config: {}, output: 1 });
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
});
