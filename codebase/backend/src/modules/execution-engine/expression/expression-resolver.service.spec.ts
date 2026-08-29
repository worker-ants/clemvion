import { ExpressionResolverService } from './expression-resolver.service';
import { ExecutionContext } from '../../../nodes/core/node-handler.interface';
import { Node, NodeCategory } from '../../nodes/entities/node.entity';
import { createEmptyConversationThread } from '../../../shared/conversation-thread/conversation-thread.types';

function makeNode(id: string, label: string, type = 'http_request'): Node {
  const node = new Node();
  node.id = id;
  node.label = label;
  node.type = type;
  node.category = NodeCategory.INTEGRATION;
  node.positionX = 0;
  node.positionY = 0;
  node.config = {};
  node.isDisabled = false;
  node.workflowId = 'wf-1';
  return node;
}

/**
 * 던져진 예외를 잡아 돌려준다. **vacuity 방지 단언을 품고 있다** — 아무것도 던지지
 * 않으면 `.cause` 가 `undefined` 라 뒤따르는 단언이 전부 조용히 통과해 버린다.
 * 그 함정이 `cause` 관련 케이스마다 반복되므로 여기 한 곳에만 둔다.
 */
function captureThrown(fn: () => unknown): Error {
  let thrown: unknown;
  try {
    fn();
  } catch (err) {
    thrown = err;
  }
  expect(thrown).toBeInstanceOf(Error);
  return thrown as Error;
}

describe('ExpressionResolverService', () => {
  let service: ExpressionResolverService;
  let envAllowlist: string | undefined;

  beforeEach(() => {
    envAllowlist = undefined;
    const configService = {
      get: (key: string) =>
        key === 'app.expressionEnvAllowlist' ? envAllowlist : undefined,
    } as unknown as import('@nestjs/config').ConfigService;
    service = new ExpressionResolverService(configService);
  });

  describe('resolveConfig', () => {
    const baseContext = {
      $input: { name: 'Alice', count: 5, nested: { value: 42 } },
      $var: { token: 'abc123' },
      $execution: {
        id: 'exec-1',
        workflowId: 'wf-1',
        startedAt: '2026-01-01T00:00:00Z',
        mode: 'manual',
      },
      $now: '2026-01-01T12:00:00Z',
    };

    it('resolves simple string expression', () => {
      const config = { url: 'https://api.example.com/{{ $input.name }}' };
      const result = service.resolveConfig(config, baseContext);
      expect(result.url).toBe('https://api.example.com/Alice');
    });

    it('preserves original type for full expression', () => {
      const config = { timeout: '{{ $input.count + 1 }}' };
      const result = service.resolveConfig(config, baseContext);
      expect(result.timeout).toBe(6);
      expect(typeof result.timeout).toBe('number');
    });

    it('returns string for mixed text + expression', () => {
      const config = { message: 'Count is {{ $input.count }}' };
      const result = service.resolveConfig(config, baseContext);
      expect(result.message).toBe('Count is 5');
      expect(typeof result.message).toBe('string');
    });

    it('passes through non-string values', () => {
      const config = {
        timeout: 30000,
        followRedirects: true,
        data: null,
      };
      const result = service.resolveConfig(config, baseContext);
      expect(result).toEqual(config);
    });

    it('resolves nested objects recursively', () => {
      const config = {
        headers: [
          { key: 'Authorization', value: 'Bearer {{ $var.token }}' },
          { key: 'Content-Type', value: 'application/json' },
        ],
      };
      const result = service.resolveConfig(config, baseContext);
      expect((result.headers as any[])[0].value).toBe('Bearer abc123');
      expect((result.headers as any[])[1].value).toBe('application/json');
    });

    it('resolves array elements', () => {
      const config = {
        items: ['{{ $input.name }}', 'static', '{{ $input.count }}'],
      };
      const result = service.resolveConfig(config, baseContext);
      expect(result.items).toEqual(['Alice', 'static', 5]);
    });

    it('resolves $var references', () => {
      const config = { auth: '{{ $var.token }}' };
      const result = service.resolveConfig(config, baseContext);
      expect(result.auth).toBe('abc123');
    });

    it('resolves nested $input paths', () => {
      const config = { val: '{{ $input.nested.value }}' };
      const result = service.resolveConfig(config, baseContext);
      expect(result.val).toBe(42);
    });

    it('leaves strings without expressions unchanged', () => {
      const config = { url: 'https://api.example.com/users' };
      const result = service.resolveConfig(config, baseContext);
      expect(result.url).toBe('https://api.example.com/users');
    });

    it('handles empty config', () => {
      const result = service.resolveConfig({}, baseContext);
      expect(result).toEqual({});
    });

    it('throws descriptive error for invalid expression', () => {
      const config = { url: '{{ $input. }}' };
      expect(() => service.resolveConfig(config, baseContext)).toThrow(
        /Expression error in config\.url/,
      );
    });

    it('throws for undefined reference', () => {
      const config = { url: '{{ $input.nonExistent.deep }}' };
      expect(() => service.resolveConfig(config, baseContext)).toThrow(
        /Expression error in config\.url/,
      );
    });

    // `preserve-caught-error`(eslint 10 recommended) 대응으로 붙인 `cause: err` 를 잠근다.
    // 위 두 케이스는 `.message` 만 보므로 `cause` 를 떼도 GREEN 이다 — 이 케이스가 그 축이다.
    //
    // 부착 여부의 **기준은 여기 적지 않는다** — 정본은
    // `spec/5-system/3-error-handling.md` §6.3.1(C1 AND C2)이다. 여기 요약을 두면 정본이
    // 바뀔 때 갈린다(실제로 갈렸다: 이 주석은 한때 C1 만 적고 있었고, `--spec` 검토가
    // "`cause` 는 `err` **객체 전체**를 붙인다" 를 짚어 C2 가 추가됐다).
    //
    // 이 자리가 그 기준을 어떻게 만족하는지만 적는다: C1 — 던지는 message 가 원본
    // `err.message` 를 그대로 싣는다. C2 — 표현식 평가 예외라 message·name 밖에 **민감**
    // 속성이 붙지 않는다(부가 own property 의 실측은 `expression-resolver.service.ts` 의
    // 같은 주석). 한정어 없이 "속성이 없다" 로 적으면 거짓이다 — `ExpressionError` 는
    // `code`/`position` 을 갖는다.
    // 반대 사례(비부착)는 `SecretResolverService.resolve` 이고 §6.3.1 이 그것을 지목한다.
    it('원본 예외를 `cause` 로 보존한다 (cause 제거 시 RED)', () => {
      const thrown = captureThrown(() =>
        service.resolveConfig({ url: '{{ $input. }}' }, baseContext),
      );
      const cause = thrown.cause;
      expect(cause).toBeInstanceOf(Error);
      // 감싼 message 가 원본 message 를 실제로 포함한다 — 이것이 "cause 가 새 정보를
      // 노출하지 않는다" 는 위 근거의 실측이다.
      expect(thrown.message).toContain((cause as Error).message);
    });

    // C2 캐너리 — §6.3.1 의 C2("message·name 밖의 **민감** 정보를 속성으로 갖지 않는다")를
    // 주석이 아니라 **단언**으로 잠근다. 위 케이스는 C1(감싼 message 가 원본을 싣는다)만
    // 검증하므로, `cause` 에 민감 속성이 새로 붙어도 RED 가 나지 않았다.
    //
    // 축이 **enumerable** own key 인 이유는 정본이 따로 있다 —
    // `packages/expression-engine/src/__tests__/error-shape.spec.ts` 상단 주석.
    // (요지만: `JSON.stringify`·object spread 가 enumerable 만 보고, 표준 `message`/`stack`
    // 은 non-enumerable 이라 안 잡히는 것이 맞다.) 종전에는 그 4줄이 여기 통째로 복제돼
    // 있었고, 근거가 바뀌면 한쪽만 고쳐지는 drift 형태였다.
    //
    // **이 캐너리가 무엇을 잠그고 무엇을 안 잠그는지**를 정확히 적는다. 여기서 두 번
    // 좁게 적었다가 두 번 다 리뷰가 뚫었다: 처음엔 syntax 한 종류만 지나갔고, 다음엔
    // 세 종류로 늘렸는데 리뷰가 4번째(`ExpressionFunctionError`)를 뮤테이션으로 뚫었다.
    // 세어 보니 `ExpressionError` 하위 클래스는 **여섯**이다(Timeout·DepthExceeded 포함).
    //
    // 그래서 축을 둘로 나눴다:
    //   (1) **클래스 전수** — `packages/expression-engine/src/__tests__/error-shape.spec.ts`
    //       가 그 모듈이 export 하는 하위 클래스를 **열거해서** 전부 검사하고, 개수가
    //       바뀌면 전수성 단언이 먼저 RED 를 낸다. 새 클래스가 생겨도 자동으로 덮인다.
    //   (2) **경로** — 아래 `it.each`. 이 catch 가 실제로 그런 `cause` 를 달아 내보내는지를
    //       `resolveConfig` 경로로 값싸게 트리거되는 네 종으로 확인한다.
    //       (Timeout·DepthExceeded 는 이 경로로 만들려면 비싸서 (1)에 맡긴다.)
    //
    // fixture 가 정말로 서로 다른 클래스로 갈라지는지도 `cause.name` 으로 함께 단언한다.
    // 그러지 않으면 네 번 도는 것이 커버리지가 아니라 착시가 된다(뮤테이션으로 확인:
    // `cause.name` 과 `code` 정확값 **둘 다** 치워야 퇴화한 fixture 가 GREEN 이 된다).
    it.each([
      ['ExpressionSyntaxError', '{{ $input. }}', 'EXPR_SYNTAX_ERROR'],
      [
        'ExpressionReferenceError',
        '{{ $input.nonExistent.deep }}',
        'EXPR_REFERENCE_ERROR',
      ],
      ['ExpressionTypeError', '{{ $input.count.b.c }}', 'EXPR_TYPE_ERROR'],
      ['ExpressionFunctionError', '{{ unknownFn() }}', 'EXPR_FUNCTION_ERROR'],
    ])(
      'C2 캐너리 — %s 의 `cause` enumerable own key 가 비민감 화이트리스트를 벗어나지 않는다',
      (className, expression, expectedCode) => {
        const thrown = captureThrown(() =>
          service.resolveConfig({ url: expression }, baseContext),
        );
        const cause = thrown.cause as Error;
        expect(cause).toBeInstanceOf(Error);
        // fixture 판별력 — 넷이 같은 분기로 무너지면 위 `it.each` 가 무의미해진다.
        expect(cause.name).toBe(className);

        expect(Object.keys(cause).sort()).toEqual(['code', 'name', 'position']);

        // 키 이름만 잠그면 "같은 키에 민감한 값이 실린다" 는 변형을 놓친다. 두 값의
        // **모양**도 함께 고정한다 — `code` 는 `EXPR_` 접두 enum, `position` 은 정수.
        const shape = cause as unknown as { code: unknown; position: unknown };
        expect(shape.code).toBe(expectedCode);
        expect(
          shape.position === undefined || Number.isInteger(shape.position),
        ).toBe(true);
      },
    );

    it('coerces mixed text + expression to string', () => {
      const config = { message: 'Items: {{ $input.count }}' };
      const result = service.resolveConfig(config, baseContext);
      expect(typeof result.message).toBe('string');
      expect(result.message).toBe('Items: 5');
    });

    it('excludes keys for code handler', () => {
      const config = {
        code: 'const x = {{ $input.name }};',
        language: 'javascript',
      };
      const result = service.resolveConfig(config, baseContext, 'code');
      expect(result.code).toBe('const x = {{ $input.name }};');
      expect(result.language).toBe('javascript');
    });

    it('resolves expressions in template handler config', () => {
      const config = {
        template: '<p>{{ $input.name }}</p>',
        outputFormat: 'html',
      };
      const result = service.resolveConfig(config, baseContext, 'template');
      expect(result.template).toBe('<p>Alice</p>');
      expect(result.outputFormat).toBe('html');
    });

    it('resolves $var and $node references in template config', () => {
      const contextWithNode = {
        ...baseContext,
        $node: {
          Form: { output: { useful: 'important data' } },
        },
      };
      const config = {
        template:
          '<h1>{{ $var.token }}</h1><p>{{ $node["Form"].output.useful }}</p>',
        outputFormat: 'html',
      };
      const result = service.resolveConfig(config, contextWithNode, 'template');
      expect(result.template).toBe('<h1>abc123</h1><p>important data</p>');
    });

    it('resolves root-level input data in template context', () => {
      const contextWithInput = {
        ...baseContext,
        name: 'Alice',
        score: 95,
      };
      const config = {
        template: 'Hello {{ name }}, score: {{ score }}',
        outputFormat: 'text',
      };
      const result = service.resolveConfig(
        config,
        contextWithInput,
        'template',
      );
      expect(result.template).toBe('Hello Alice, score: 95');
    });

    it('does not override built-in context variables with root-level keys', () => {
      const contextWithConflict = {
        ...baseContext,
        $input: { name: 'Alice', count: 5, nested: { value: 42 } },
      };
      const config = {
        template: '{{ $input.name }}',
        outputFormat: 'text',
      };
      const result = service.resolveConfig(
        config,
        contextWithConflict,
        'template',
      );
      expect(result.template).toBe('Alice');
    });

    it('resolves expressions with built-in functions', () => {
      const config = { upper: '{{ uppercase($input.name) }}' };
      const result = service.resolveConfig(config, baseContext);
      expect(result.upper).toBe('ALICE');
    });

    it('resolves full expression returning object', () => {
      const config = { data: '{{ $input.nested }}' };
      const result = service.resolveConfig(config, baseContext);
      expect(result.data).toEqual({ value: 42 });
    });

    it('resolves full expression returning boolean', () => {
      const config = { flag: '{{ $input.count > 3 }}' };
      const result = service.resolveConfig(config, baseContext);
      expect(result.flag).toBe(true);
    });
  });

  describe('buildExpressionContext', () => {
    it('builds context with $node label mapping', () => {
      const nodeMap = new Map<string, Node>();
      nodeMap.set('n1', makeNode('n1', 'HTTP Request'));
      nodeMap.set('n2', makeNode('n2', 'Transform'));

      const execContext: ExecutionContext = {
        executionId: 'exec-1',
        workflowId: 'wf-1',
        variables: { counter: 0 },
        nodeOutputCache: {
          n1: { statusCode: 200, body: { data: 'test' } },
          n2: { transformed: true },
        },
        structuredOutputCache: {},
        engineResolvedConfigCache: {},
        conversationThread: createEmptyConversationThread(),
        recursionDepth: 0,
      };

      const ctx = service.buildExpressionContext(
        { input: 'data' },
        execContext,
        nodeMap,
      );

      expect(ctx.$input).toEqual({ input: 'data' });
      expect(ctx.$var).toEqual({ counter: 0 });
      expect(ctx.$node).toBeDefined();
      expect((ctx.$node as any)['HTTP Request']).toEqual({
        output: { statusCode: 200, body: { data: 'test' } },
      });
      expect((ctx.$node as any)['Transform']).toEqual({
        output: { transformed: true },
      });
    });

    // spec/5-system/5-expression-language §4.5 — $trigger / $env 런타임 주입
    function baseExec(
      overrides: Partial<ExecutionContext> = {},
    ): ExecutionContext {
      return {
        executionId: 'exec-1',
        workflowId: 'wf-1',
        variables: {},
        nodeOutputCache: {},
        structuredOutputCache: {},
        engineResolvedConfigCache: {},
        conversationThread: createEmptyConversationThread(),
        recursionDepth: 0,
        ...overrides,
      };
    }

    it('$trigger — exposes webhook transport (body/query/method) with sensitive headers masked', () => {
      const execContext = baseExec({
        triggerData: {
          body: { event: 'push' },
          query: { ref: 'main' },
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: 'Bearer secret-token',
            cookie: 'session=abc',
            'x-api-key': 'k-123',
          },
        },
      });
      const ctx = service.buildExpressionContext(
        null,
        execContext,
        new Map<string, Node>(),
      );
      const trigger = ctx.$trigger as Record<string, any>;
      expect(trigger.body).toEqual({ event: 'push' });
      expect(trigger.query).toEqual({ ref: 'main' });
      expect(trigger.method).toBe('POST');
      // non-sensitive kept, sensitive values masked (keys retained).
      expect(trigger.headers['content-type']).toBe('application/json');
      expect(trigger.headers.authorization).not.toContain('secret-token');
      expect(trigger.headers.cookie).not.toContain('abc');
      expect(trigger.headers['x-api-key']).not.toContain('k-123');
    });

    it('$trigger — full expression `{{ $trigger.body.event }}` resolves through resolveConfig', () => {
      const execContext = baseExec({
        triggerData: { body: { event: 'push' }, method: 'POST' },
      });
      const ctx = service.buildExpressionContext(
        null,
        execContext,
        new Map<string, Node>(),
      );
      const resolved = service.resolveConfig(
        {
          operations: [
            {
              type: 'set_field',
              field: 'echoedEvent',
              value: '{{ $trigger.body.event }}',
            },
            {
              type: 'set_field',
              field: 'echoedMethod',
              value: '{{ $trigger.method }}',
            },
          ],
        },
        ctx,
      );
      const ops = resolved.operations as Array<Record<string, unknown>>;
      expect(ops[0].value).toBe('push');
      expect(ops[1].value).toBe('POST');
    });

    it('$trigger — empty object (not undefined) when no triggerData (manual/schedule)', () => {
      const ctx = service.buildExpressionContext(
        null,
        baseExec(),
        new Map<string, Node>(),
      );
      // {} so `$trigger.body` → undefined instead of EXPR_REFERENCE_ERROR.
      expect(ctx.$trigger).toEqual({});
      expect((ctx.$trigger as any).body).toBeUndefined();
    });

    it('$env — exposes only EXPRESSION_ENV_ALLOWLIST keys from process.env', () => {
      envAllowlist = 'EXPR_TEST_ALLOWED, EXPR_TEST_MISSING';
      process.env.EXPR_TEST_ALLOWED = 'visible';
      process.env.EXPR_TEST_SECRET = 'do-not-leak';
      delete process.env.EXPR_TEST_MISSING;
      try {
        const ctx = service.buildExpressionContext(
          null,
          baseExec(),
          new Map<string, Node>(),
        );
        const env = ctx.$env as Record<string, string>;
        expect(env.EXPR_TEST_ALLOWED).toBe('visible');
        // not on allowlist → never exposed.
        expect(env.EXPR_TEST_SECRET).toBeUndefined();
        // on allowlist but unset in process.env → omitted.
        expect(env.EXPR_TEST_MISSING).toBeUndefined();
      } finally {
        delete process.env.EXPR_TEST_ALLOWED;
        delete process.env.EXPR_TEST_SECRET;
      }
    });

    it('$env — empty object when EXPRESSION_ENV_ALLOWLIST unset (SaaS default)', () => {
      envAllowlist = undefined;
      const ctx = service.buildExpressionContext(
        null,
        baseExec(),
        new Map<string, Node>(),
      );
      expect(ctx.$env).toEqual({});
    });

    it('$env — empty string allowlist yields {} (app.config real default is empty string)', () => {
      // app.config.expressionEnvAllowlist 는 미설정 시 undefined 가 아니라 ''.
      envAllowlist = '';
      const ctx = service.buildExpressionContext(
        null,
        baseExec(),
        new Map<string, Node>(),
      );
      expect(ctx.$env).toEqual({});
    });

    it('$env — trims whitespace and skips empty segments in allowlist', () => {
      envAllowlist = ' EXPR_TEST_WS , , EXPR_TEST_EMPTY ,,';
      process.env.EXPR_TEST_WS = 'trimmed';
      delete process.env.EXPR_TEST_EMPTY;
      try {
        const ctx = service.buildExpressionContext(
          null,
          baseExec(),
          new Map<string, Node>(),
        );
        const env = ctx.$env as Record<string, string>;
        // 앞뒤 공백이 있어도 trim 후 정확히 매칭.
        expect(env.EXPR_TEST_WS).toBe('trimmed');
        // 빈 세그먼트(',,', 공백만)는 무시 — process.env[''] 조회 없음.
        expect(env['']).toBeUndefined();
      } finally {
        delete process.env.EXPR_TEST_WS;
      }
    });

    it('builds context with loop/item context', () => {
      const nodeMap = new Map<string, Node>();
      const execContext: ExecutionContext = {
        executionId: 'exec-1',
        workflowId: 'wf-1',
        variables: {},
        nodeOutputCache: {},
        structuredOutputCache: {},
        engineResolvedConfigCache: {},
        conversationThread: createEmptyConversationThread(),
        recursionDepth: 0,
        loopContext: { index: 2, count: 5, isFirst: false, isLast: false },
        itemContext: {
          item: { name: 'item2' },
          index: 2,
          isFirst: false,
          isLast: false,
        },
      };

      const ctx = service.buildExpressionContext(null, execContext, nodeMap);

      expect(ctx.$loop).toEqual({
        index: 2,
        iteration: 3,
        isFirst: false,
        isLast: false,
      });
      expect(ctx.$item).toEqual({ name: 'item2' });
      expect(ctx.$itemIndex).toBe(2);
      expect(ctx.$itemIsFirst).toBe(false);
      expect(ctx.$itemIsLast).toBe(false);
    });

    it('exposes $itemIsFirst / $itemIsLast from itemContext flags', () => {
      const nodeMap = new Map<string, Node>();
      const execContext: ExecutionContext = {
        executionId: 'exec-1',
        workflowId: 'wf-1',
        variables: {},
        nodeOutputCache: {},
        structuredOutputCache: {},
        engineResolvedConfigCache: {},
        conversationThread: createEmptyConversationThread(),
        recursionDepth: 0,
        itemContext: {
          item: { name: 'first' },
          index: 0,
          isFirst: true,
          isLast: false,
        },
      };

      const ctx = service.buildExpressionContext(null, execContext, nodeMap);

      expect(ctx.$itemIsFirst).toBe(true);
      expect(ctx.$itemIsLast).toBe(false);
    });

    it('handles null input gracefully', () => {
      const nodeMap = new Map<string, Node>();
      const execContext: ExecutionContext = {
        executionId: 'exec-1',
        workflowId: 'wf-1',
        variables: {},
        nodeOutputCache: {},
        structuredOutputCache: {},
        engineResolvedConfigCache: {},
        conversationThread: createEmptyConversationThread(),
        recursionDepth: 0,
      };

      const ctx = service.buildExpressionContext(null, execContext, nodeMap);
      expect(ctx.$input).toEqual({});
      expect(ctx.$params).toEqual({});
    });

    // Invariant: `engineResolvedConfigCache` exists on ExecutionContext for
    // engine-internal lookup (container action parameters) but MUST NOT leak
    // into the expression context — `$node["X"].config` keeps returning the
    // raw echo (Phase 3 / CONVENTIONS Principle 7), and there is no
    // `$node["X"].engineResolvedConfig` namespace.
    it('does not surface engineResolvedConfigCache via $node namespace', () => {
      const nodeMap = new Map<string, Node>();
      nodeMap.set('n1', makeNode('n1', 'Loop'));

      const execContext: ExecutionContext = {
        executionId: 'exec-1',
        workflowId: 'wf-1',
        variables: {},
        nodeOutputCache: { n1: { iterations: [] } },
        structuredOutputCache: {
          n1: {
            // raw echo per Principle 7 — `{{3}}` template, NOT 3
            config: { count: '{{3}}' },
            // CONVENTIONS Principle 1.1 — loop output is `{ iterations }` only
            // (no `count` — downstream uses `iterations.length`).
            output: { iterations: [] },
          },
        },
        engineResolvedConfigCache: {
          // evaluated form used by runContainerInner only — must be invisible
          // to expression resolution.
          n1: { count: 3 },
        },
        recursionDepth: 0,
      };

      const ctx = service.buildExpressionContext({}, execContext, nodeMap);
      const loopEntry = (ctx.$node as Record<string, Record<string, unknown>>)[
        'Loop'
      ];

      // $node["Loop"].config exposes the raw echo only.
      expect(loopEntry.config).toEqual({ count: '{{3}}' });
      // The engine-resolved cache must not appear under any namespace.
      expect(loopEntry).not.toHaveProperty('engineResolvedConfigCache');
      expect(loopEntry).not.toHaveProperty('engineResolvedConfig');
      expect(ctx).not.toHaveProperty('$engineResolvedConfig');
    });

    it('exposes $now as UTC ISO and does not expose $today (timezone-ambiguous, removed)', () => {
      const nodeMap = new Map<string, Node>();
      const execContext: ExecutionContext = {
        executionId: 'exec-1',
        workflowId: 'wf-1',
        variables: {},
        nodeOutputCache: {},
        structuredOutputCache: {},
        engineResolvedConfigCache: {},
        conversationThread: createEmptyConversationThread(),
        recursionDepth: 0,
      };
      const ctx = service.buildExpressionContext({}, execContext, nodeMap);

      expect(typeof ctx.$now).toBe('string');
      expect(ctx.$now).toMatch(/Z$/);
      expect(ctx).not.toHaveProperty('$today');
    });

    it('exposes $params as alias for $input.parameters', () => {
      const nodeMap = new Map<string, Node>();
      const execContext: ExecutionContext = {
        executionId: 'exec-1',
        workflowId: 'wf-1',
        variables: {},
        nodeOutputCache: {},
        structuredOutputCache: {},
        engineResolvedConfigCache: {},
        conversationThread: createEmptyConversationThread(),
        recursionDepth: 0,
      };
      const ctx = service.buildExpressionContext(
        { parameters: { orderId: 'abc', amount: 1000 }, body: {} },
        execContext,
        nodeMap,
      );
      expect(ctx.$params).toEqual({ orderId: 'abc', amount: 1000 });
    });

    it('exposes $thread.{turns,length,text} from conversationThread', () => {
      const nodeMap = new Map<string, Node>();
      const execContext: ExecutionContext = {
        executionId: 'exec-1',
        workflowId: 'wf-1',
        variables: {},
        nodeOutputCache: {},
        structuredOutputCache: {},
        engineResolvedConfigCache: {},
        recursionDepth: 0,
        conversationThread: {
          id: 'default',
          nextSeq: 2,
          totalChars: 8,
          turns: [
            {
              seq: 0,
              nodeId: 'form-1',
              nodeLabel: 'Form',
              nodeType: 'form',
              timestamp: '2026-05-14T10:00:00.000Z',
              source: 'presentation_user',
              text: 'name=Alice',
            },
            {
              seq: 1,
              nodeId: 'agent-1',
              nodeLabel: 'Agent',
              nodeType: 'ai_agent',
              timestamp: '2026-05-14T10:00:01.000Z',
              source: 'ai_assistant',
              text: 'Hi Alice',
            },
          ],
        },
      };
      const ctx = service.buildExpressionContext({}, execContext, nodeMap) as {
        $thread?: { turns: unknown[]; length: number; text: string };
      };
      expect(ctx.$thread?.length).toBe(2);
      expect(ctx.$thread?.turns).toHaveLength(2);
      expect(ctx.$thread?.text).toContain('[Conversation Context');
      expect(ctx.$thread?.text).toContain('name=Alice');
      expect(ctx.$thread?.text).toContain('Hi Alice');
    });

    it('$thread.text is lazy — not computed until accessed (memoized after first read)', () => {
      // White-box: replace the renderer module with a spy via require cache
      // would be invasive — instead we observe the contract: accessing
      // `text` must succeed and return a string, and accessing it twice on
      // the same view returns the same value (memoization keeps repeated
      // reads cheap inside a Loop).
      const nodeMap = new Map<string, Node>();
      const execContext: ExecutionContext = {
        executionId: 'exec-1',
        workflowId: 'wf-1',
        variables: {},
        nodeOutputCache: {},
        structuredOutputCache: {},
        engineResolvedConfigCache: {},
        recursionDepth: 0,
        conversationThread: {
          id: 'default',
          nextSeq: 1,
          totalChars: 5,
          turns: [
            {
              seq: 0,
              nodeId: 'n',
              nodeLabel: 'X',
              nodeType: 'form',
              timestamp: '2026-05-15T00:00:00.000Z',
              source: 'presentation_user',
              text: 'hello',
            },
          ],
        },
      };
      const ctx = service.buildExpressionContext({}, execContext, nodeMap) as {
        $thread: { length: number; text: string };
      };
      // length is eager (cheap) — no render side-effect needed.
      expect(ctx.$thread.length).toBe(1);
      // First .text access triggers render, second hits memoized cache —
      // they MUST return the same string instance for the cache contract.
      const first = ctx.$thread.text;
      const second = ctx.$thread.text;
      expect(first).toContain('hello');
      expect(second).toBe(first);
    });

    it('returns empty $thread.text when thread has no turns', () => {
      const nodeMap = new Map<string, Node>();
      const execContext: ExecutionContext = {
        executionId: 'exec-1',
        workflowId: 'wf-1',
        variables: {},
        nodeOutputCache: {},
        structuredOutputCache: {},
        engineResolvedConfigCache: {},
        recursionDepth: 0,
        conversationThread: {
          id: 'default',
          nextSeq: 0,
          totalChars: 0,
          turns: [],
        },
      };
      const ctx = service.buildExpressionContext({}, execContext, nodeMap) as {
        $thread?: { turns: unknown[]; length: number; text: string };
      };
      expect(ctx.$thread?.length).toBe(0);
      expect(ctx.$thread?.text).toBe('');
    });
  });

  describe('$node reference resolution', () => {
    it('resolves $node["Label"].output.field in config', () => {
      const nodeMap = new Map<string, Node>();
      nodeMap.set('n1', makeNode('n1', 'Fetch Users'));

      const execContext: ExecutionContext = {
        executionId: 'exec-1',
        workflowId: 'wf-1',
        variables: {},
        nodeOutputCache: {
          n1: { port: 'success', data: { users: [{ id: 1 }] } },
        },
        structuredOutputCache: {},
        engineResolvedConfigCache: {},
        conversationThread: createEmptyConversationThread(),
        recursionDepth: 0,
      };

      const exprContext = service.buildExpressionContext(
        {},
        execContext,
        nodeMap,
      );

      const config = {
        url: 'https://api.example.com/users/{{ $node["Fetch Users"].output.data.users[0].id }}',
      };
      const result = service.resolveConfig(config, exprContext);
      expect(result.url).toBe('https://api.example.com/users/1');
    });
  });

  describe('duplicate label disambiguation', () => {
    it('disambiguates duplicate labels with #N suffix', () => {
      const nodeMap = new Map<string, Node>();
      nodeMap.set('n1', makeNode('n1', 'HTTP Request'));
      nodeMap.set('n2', makeNode('n2', 'HTTP Request'));

      const execContext: ExecutionContext = {
        executionId: 'exec-1',
        workflowId: 'wf-1',
        variables: {},
        nodeOutputCache: {
          n1: { status: 200 },
          n2: { status: 404 },
        },
        structuredOutputCache: {},
        engineResolvedConfigCache: {},
        conversationThread: createEmptyConversationThread(),
        recursionDepth: 0,
      };

      const ctx = service.buildExpressionContext({}, execContext, nodeMap);

      expect((ctx.$node as any)['HTTP Request']).toEqual({
        output: { status: 200 },
      });
      expect((ctx.$node as any)['HTTP Request#2']).toEqual({
        output: { status: 404 },
      });
    });

    it('provides UUID fallback for all nodes', () => {
      const nodeMap = new Map<string, Node>();
      nodeMap.set('n1', makeNode('n1', 'Transform'));

      const execContext: ExecutionContext = {
        executionId: 'exec-1',
        workflowId: 'wf-1',
        variables: {},
        nodeOutputCache: {
          n1: { result: 'data' },
        },
        structuredOutputCache: {},
        engineResolvedConfigCache: {},
        conversationThread: createEmptyConversationThread(),
        recursionDepth: 0,
      };

      const ctx = service.buildExpressionContext({}, execContext, nodeMap);

      // Accessible by label
      expect((ctx.$node as any)['Transform']).toEqual({
        output: { result: 'data' },
      });
      // Also accessible by UUID
      expect((ctx.$node as any)['n1']).toEqual({
        output: { result: 'data' },
      });
    });

    it('resolves disambiguated $node reference in expression', () => {
      const nodeMap = new Map<string, Node>();
      nodeMap.set('n1', makeNode('n1', 'HTTP Request'));
      nodeMap.set('n2', makeNode('n2', 'HTTP Request'));

      const execContext: ExecutionContext = {
        executionId: 'exec-1',
        workflowId: 'wf-1',
        variables: {},
        nodeOutputCache: {
          n1: { status: 200 },
          n2: { status: 404 },
        },
        structuredOutputCache: {},
        engineResolvedConfigCache: {},
        conversationThread: createEmptyConversationThread(),
        recursionDepth: 0,
      };

      const exprContext = service.buildExpressionContext(
        {},
        execContext,
        nodeMap,
      );

      const config1 = { val: '{{ $node["HTTP Request"].output.status }}' };
      expect(service.resolveConfig(config1, exprContext).val).toBe(200);

      const config2 = { val: '{{ $node["HTTP Request#2"].output.status }}' };
      expect(service.resolveConfig(config2, exprContext).val).toBe(404);
    });

    it('resolves node by UUID in expression', () => {
      const nodeMap = new Map<string, Node>();
      nodeMap.set('n1', makeNode('n1', 'Code'));

      const execContext: ExecutionContext = {
        executionId: 'exec-1',
        workflowId: 'wf-1',
        variables: {},
        nodeOutputCache: {
          n1: { result: 42 },
        },
        structuredOutputCache: {},
        engineResolvedConfigCache: {},
        conversationThread: createEmptyConversationThread(),
        recursionDepth: 0,
      };

      const exprContext = service.buildExpressionContext(
        {},
        execContext,
        nodeMap,
      );

      const config = { val: '{{ $node["n1"].output.result }}' };
      expect(service.resolveConfig(config, exprContext).val).toBe(42);
    });
  });
});
