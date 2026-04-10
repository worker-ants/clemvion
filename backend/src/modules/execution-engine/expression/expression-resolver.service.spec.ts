import { ExpressionResolverService } from './expression-resolver.service';
import { ExecutionContext } from '../handlers/node-handler.interface';
import { Node, NodeCategory } from '../../nodes/entities/node.entity';

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

describe('ExpressionResolverService', () => {
  let service: ExpressionResolverService;

  beforeEach(() => {
    service = new ExpressionResolverService();
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
      $today: '2026-01-01',
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

    it('builds context with loop/item context', () => {
      const nodeMap = new Map<string, Node>();
      const execContext: ExecutionContext = {
        executionId: 'exec-1',
        workflowId: 'wf-1',
        variables: {},
        nodeOutputCache: {},
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
    });

    it('handles null input gracefully', () => {
      const nodeMap = new Map<string, Node>();
      const execContext: ExecutionContext = {
        executionId: 'exec-1',
        workflowId: 'wf-1',
        variables: {},
        nodeOutputCache: {},
      };

      const ctx = service.buildExpressionContext(null, execContext, nodeMap);
      expect(ctx.$input).toEqual({});
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
