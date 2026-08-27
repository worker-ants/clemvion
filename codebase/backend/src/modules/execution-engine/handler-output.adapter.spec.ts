import { deepRedactSecrets } from '../../shared/utils/sanitize-error-message';
import {
  adaptHandlerReturn,
  toEngineFlatShape,
  wrapBareAsNodeHandlerOutput,
} from './handler-output.adapter';
import {
  NodeHandler,
  ValidationResult,
  ExecutionContext,
} from '../../nodes/core/node-handler.interface';

// INFO #2 / D-1 — 컴파일 차단 회귀 테스트.
// `NodeHandler.execute` 의 반환 타입이 strict `Promise<NodeHandlerOutput>` 임을
// 컴파일 시점에 검증한다. 향후 인터페이스가 다시 `| Promise<unknown>` 으로
// 느슨해지면 `@ts-expect-error` 가 사라져 컴파일 에러가 발생하므로, 본 회귀가
// drift 차단 1차 방어선으로 동작한다.
//
// 본 클래스는 의도적으로 비-canonical shape (`output` 누락) 을 반환한다.
// `NodeHandler` 인터페이스가 strict 인 한 `@ts-expect-error` 마커가 유효해야 한다.
class _BadReturnShapeHandler implements NodeHandler {
  validate(_config: Record<string, unknown>): ValidationResult {
    return { valid: true, errors: [] };
  }

  // @ts-expect-error — 의도적인 비-canonical 반환. NodeHandler.execute 가
  // `Promise<NodeHandlerOutput>` 으로 narrowing 된 후엔 `output` 누락이
  // 컴파일 에러로 차단되어야 한다.
  async execute(
    _input: unknown,
    _config: Record<string, unknown>,
    _context: ExecutionContext,
  ): Promise<{ processed: boolean }> {
    return { processed: true };
  }
}

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

    it('preserves _retryState when handler emits canonical shape (spec §4.2.1)', () => {
      const retryState = { messages: [], turnCount: 3, expiresAt: 'iso' };
      const result = adaptHandlerReturn({
        config: {},
        output: { result: {}, error: { code: 'LLM_RATE_LIMIT' } },
        status: 'ended',
        port: 'error',
        _retryState: retryState,
      });
      expect(result._retryState).toBe(retryState);
    });

    /**
     * **이 표면은 더 이상 마스킹하지 않는다** (2026-08-24, C2 (a)).
     *
     * 종전 이 자리의 테스트들은 `adaptHandlerReturn` 이 `config` 를 마스킹함을 단언했다
     * (`****4321` 형태). **의도적으로 뒤집는다** — 그 마스킹이 표현식까지 덮어
     * `migrate-node-output-refs.ts` 가 사용자를 이주시킨 `$node["X"].config.<field>` 참조가
     * 리터럴 `****abcd` 를 읽고 있었다. 가시성 저하가 아니라 **기능 오염**이다.
     *
     * 종전 테스트의 대조군 주석이 이미 그 위험을 알고 있었다 — *"이 표면은 그 값을 DB·WS·
     * 표현식으로 내보내므로 **과잉 마스킹이 곧 기능 회귀**다."* 그 문장이 옳았고, 이 변경이
     * 그 나머지 절반을 집행한다.
     *
     * **egress 는 그대로다** — WS `maskWireEnvelope` · REST `redactStoredDataForResponse`
     * 가 각자 마스킹하고, 그 키 축이 `DEFAULT_SENSITIVE_KEYS` 를 포함한다
     * (`mask-sensitive-fields.util.spec.ts` 의 포함관계 캐너리). 아래 캐너리들이
     * **어댑터는 원문 · 두 출구는 마스킹** 을 각각 고정한다.
     */
    it.each([
      ['csrf_token'],
      ['authToken'],
      ['sessionToken'],
      ['idToken'],
      ['apiKey'],
    ])('[캐너리] echoed config 의 `%s` 를 **원문 그대로** 둔다 (표현식이 읽는 값)', (key) => {
      const raw = 'AAAABBBB4321';
      const out = adaptHandlerReturn({
        config: { [key]: raw, endpoint: 'https://api.example.com' },
        output: {},
      });
      const cfg = out.config as Record<string, unknown>;
      expect(cfg[key]).toBe(raw);
      expect(cfg.endpoint).toBe('https://api.example.com');
    });

    it('[캐너리] 중첩 config 도 원문 — 어댑터는 어느 깊이에서도 손대지 않는다', () => {
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
      expect(cfg.model).toBe('gpt-4');
      expect(cfg.apiKey).toBe('sk-secret-1234567890');
      const headers = cfg.headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer xyz-token-abcdef');
      expect(headers['x-trace-id']).toBe('trace-1');
      const nested = cfg.nested as Record<string, string>;
      expect(nested.password).toBe('p@ssw0rd');
      expect(nested.other).toBe('public');
    });

    /**
     * **egress 대조군** — 어댑터가 원문을 두더라도 **나가는 자리에서는 가려진다**.
     * 이게 이 PR 의 안전 주장이므로 같은 파일에서 함께 못박는다: 위 캐너리만 있으면
     * *"마스킹을 없앴다"* 로만 읽힌다.
     */
    it('[캐너리] 어댑터가 남긴 원문을 egress 마스커가 가린다 (안전 주장)', () => {
      const adapted = adaptHandlerReturn({
        config: { apiKey: 'sk-secret-1234567890', endpoint: 'https://api.example.com' },
        output: {},
      });
      const atEgress = deepRedactSecrets(adapted.config) as Record<string, unknown>;
      expect(String(atEgress.apiKey)).not.toContain('1234567890');
      // 대조군 — 민감하지 않은 값은 egress 에서도 그대로다.
      expect(atEgress.endpoint).toBe('https://api.example.com');
    });

    /**
     * 종전엔 비-문자열 자격증명 값도 `****` 로 눌렀다. **이제 원문이다** — 어댑터는
     * 어떤 타입도 손대지 않는다(위 캐너리와 같은 이유). egress 는 여전히 가린다:
     * 아래 대조군이 같은 값에 `deepRedactSecrets` 를 걸어 그 사실을 함께 못박는다.
     */
    it('[캐너리] 비-문자열 자격증명 값도 어댑터는 원문으로 둔다', () => {
      const tokenObj = { complex: 'object' };
      const result = adaptHandlerReturn({
        config: { token: tokenObj, secret: 12345 },
        output: {},
      });
      const cfg = result.config;
      expect(cfg.token).toEqual(tokenObj);
      expect(cfg.secret).toBe(12345);

      // egress 대조군 — 나가는 자리에서는 둘 다 가려진다.
      const atEgress = deepRedactSecrets(cfg) as Record<string, unknown>;
      expect(atEgress.token).not.toEqual(tokenObj);
      expect(atEgress.secret).not.toBe(12345);
    });
  });

  // INFO #2 — strict regardless of NODE_ENV. lenient fallback removed; any
  // non-canonical return throws. Tests that used to be guarded by
  // `NODE_ENV=production` now run unconditionally.
  describe('strict throw on non-canonical return', () => {
    it('throws on a bare object', () => {
      expect(() => adaptHandlerReturn({ foo: 1 })).toThrow(
        /NodeHandlerOutput contract/,
      );
    });

    it('throws on null', () => {
      expect(() => adaptHandlerReturn(null)).toThrow(/contract/);
    });

    it('throws on undefined', () => {
      expect(() => adaptHandlerReturn(undefined)).toThrow(/contract/);
    });

    it('throws on a primitive', () => {
      expect(() => adaptHandlerReturn(42)).toThrow(/contract/);
    });

    it('throws on an array', () => {
      expect(() => adaptHandlerReturn([1, 2])).toThrow(/contract/);
    });

    it('throws on legacy port-selector shape', () => {
      expect(() => adaptHandlerReturn({ port: 'x', data: { y: 1 } })).toThrow(
        /contract/,
      );
    });

    it('throws on legacy bare waiting shape (status without config/output)', () => {
      expect(() =>
        adaptHandlerReturn({
          type: 'ai_conversation',
          status: 'waiting_for_input',
          _resumeState: { messages: [] },
        }),
      ).toThrow(/contract/);
    });

    it('passes canonical shape through (regression for production-strict path)', () => {
      const raw = {
        config: { url: 'https://x' },
        output: { response: 'ok' },
        port: 'success',
      };
      expect(adaptHandlerReturn(raw)).toEqual(raw);
    });

    it('passes conversation waiting canonical shape (ai_agent / info_extractor)', () => {
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
    it('wraps bare objects', () => {
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

    it('handles null / undefined / primitive / array', () => {
      expect(wrapBareAsNodeHandlerOutput(null)).toEqual({
        config: {},
        output: null,
      });
      expect(wrapBareAsNodeHandlerOutput(undefined)).toEqual({
        config: {},
        output: undefined,
      });
      expect(wrapBareAsNodeHandlerOutput(42)).toEqual({
        config: {},
        output: 42,
      });
      expect(wrapBareAsNodeHandlerOutput([1, 2])).toEqual({
        config: {},
        output: [1, 2],
      });
    });

    it('ignores non-object _resumeState', () => {
      const adapted = wrapBareAsNodeHandlerOutput({
        any: 1,
        _resumeState: 'bad',
      });
      expect(adapted._resumeState).toBeUndefined();
    });

    it('ignores _resumeState arrays (arrays are never resume state)', () => {
      const adapted = wrapBareAsNodeHandlerOutput({
        any: 1,
        _resumeState: [1, 2],
      });
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

  it('carries _retryState forward on object outputs (spec §4.2.1)', () => {
    const retryState = { messages: [], turnCount: 3, expiresAt: 'iso' };
    const flat = toEngineFlatShape({
      config: {},
      output: { result: {}, error: { code: 'LLM_RATE_LIMIT' } },
      status: 'ended',
      port: 'error',
      _retryState: retryState,
    });
    expect((flat as Record<string, unknown>)._retryState).toBe(retryState);
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
    expect((flat as Record<string, unknown>)._resumeState).toBe(outputState);
  });

  describe('control-field override (port/status are authoritative from handler)', () => {
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
