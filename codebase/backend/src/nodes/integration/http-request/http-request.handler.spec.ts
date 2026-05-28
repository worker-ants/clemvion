import { HttpRequestHandler, extractApiPath } from './http-request.handler.js';
import { ExecutionContext } from '../../core/node-handler.interface.js';
import { createEmptyConversationThread } from '../../../shared/conversation-thread/conversation-thread.types';

function makeContext(rawConfig?: Record<string, unknown>): ExecutionContext {
  return {
    executionId: 'exec-1',
    workflowId: 'wf-1',
    variables: {},
    nodeOutputCache: {},
    structuredOutputCache: {},
    engineResolvedConfigCache: {},
    conversationThread: createEmptyConversationThread(),
    recursionDepth: 0,
    ...(rawConfig ? { rawConfig: Object.freeze({ ...rawConfig }) } : {}),
  };
}

describe('HttpRequestHandler', () => {
  let handler: HttpRequestHandler;
  const context: ExecutionContext = {
    executionId: 'exec-1',
    workflowId: 'wf-1',
    variables: {},
    nodeOutputCache: {},
    structuredOutputCache: {},
    engineResolvedConfigCache: {},
    conversationThread: createEmptyConversationThread(),
    recursionDepth: 0,
  };

  beforeEach(() => {
    handler = new HttpRequestHandler();
  });

  describe('validate', () => {
    it('should pass with valid method and url', () => {
      const result = handler.validate({
        method: 'GET',
        url: 'https://api.example.com',
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept missing method (schema default is GET)', () => {
      const result = handler.validate({ url: 'https://api.example.com' });
      expect(result.valid).toBe(true);
    });

    it('should fail when url is missing', () => {
      const result = handler.validate({ method: 'GET' });
      expect(result.valid).toBe(false);
      // Schema warningRule "URL must be entered." fires.
      expect(result.errors.some((e) => e.includes('URL'))).toBe(true);
    });

    it('should fail with invalid method', () => {
      const result = handler.validate({
        method: 'INVALID',
        url: 'https://api.example.com',
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('method');
    });

    it('should fail with negative timeout', () => {
      const result = handler.validate({
        method: 'GET',
        url: 'https://api.example.com',
        timeout: -1,
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('timeout');
    });

    it('should accept all valid HTTP methods', () => {
      const methods = [
        'GET',
        'POST',
        'PUT',
        'PATCH',
        'DELETE',
        'HEAD',
        'OPTIONS',
      ];
      for (const method of methods) {
        const result = handler.validate({
          method,
          url: 'https://api.example.com',
        });
        expect(result.valid).toBe(true);
      }
    });
  });

  describe('execute', () => {
    let originalFetch: typeof global.fetch;

    beforeEach(() => {
      originalFetch = global.fetch;
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('sanitizes embedded URL credentials on config echo (CONVENTIONS §7)', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue('ok'),
        json: jest.fn().mockResolvedValue({}),
        headers: { get: jest.fn().mockReturnValue(null) },
      });

      const result = (await handler.execute(
        null,
        {
          method: 'GET',
          url: 'https://secret:p4ss@api.example.com/data',
          responseType: 'text',
        },
        context,
      )) as unknown as { config: { url: string } };

      expect(result.config.url).not.toContain('secret');
      expect(result.config.url).not.toContain('p4ss');
      expect(result.config.url).toContain('api.example.com');
    });

    it('should return success port on 2xx response', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ data: 'test' }),
      };
      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      const result = (await handler.execute(
        null,
        { method: 'GET', url: 'https://api.example.com/data' },
        context,
      )) as unknown as {
        port: string;
        output: { response: unknown };
        meta: { statusCode: number; durationMs: number };
      };

      expect(result.port).toBe('success');
      expect(result.output.response).toEqual({ data: 'test' });
      expect(result.meta.statusCode).toBe(200);
      expect(typeof result.meta.durationMs).toBe('number');
    });

    it('should return error port on non-2xx response', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        json: jest.fn().mockResolvedValue({ error: 'not found' }),
      };
      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      const result = (await handler.execute(
        null,
        { method: 'GET', url: 'https://api.example.com/missing' },
        context,
      )) as unknown as {
        port: string;
        output: { response: unknown };
        meta: { statusCode: number };
      };

      expect(result.port).toBe('error');
      expect(result.meta.statusCode).toBe(404);
    });

    it('should return error port on network failure', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const result = (await handler.execute(
        null,
        { method: 'GET', url: 'https://api.example.com/fail' },
        context,
      )) as unknown as {
        port: string;
        output: { response: { error: string } };
        meta: { statusCode: number };
      };

      expect(result.port).toBe('error');
      expect(result.output.response.error).toBe('Network error');
      expect(result.meta.statusCode).toBe(0);
    });

    it('should append array-shaped query params to URL', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({}),
      };
      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      await handler.execute(
        null,
        {
          method: 'GET',
          url: 'https://api.example.com/data',
          queryParams: [
            { key: 'page', value: '1' },
            { key: 'limit', value: '10' },
          ],
        },
        context,
      );

      const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(calledUrl).toContain('page=1');
      expect(calledUrl).toContain('limit=10');
    });

    it('should send array-shaped user headers to fetch', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({}),
      };
      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      await handler.execute(
        null,
        {
          method: 'GET',
          url: 'https://api.example.com/data',
          headers: [
            { key: 'Authorization', value: 'Bearer mytoken' },
            { key: 'X-Custom', value: 'custom-value' },
          ],
        },
        context,
      );

      const args = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit;
      const headers = args.headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer mytoken');
      expect(headers['X-Custom']).toBe('custom-value');
      // Array indices must not leak through as header names.
      expect(headers['0']).toBeUndefined();
      expect(headers['1']).toBeUndefined();
    });

    it('should drop header rows with empty keys', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({}),
      };
      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      await handler.execute(
        null,
        {
          method: 'GET',
          url: 'https://api.example.com/data',
          headers: [
            { key: '', value: 'ignored' },
            { key: '   ', value: 'ignored-too' },
            { key: 'X-Keep', value: 'yes' },
          ],
        },
        context,
      );

      const args = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit;
      const headers = args.headers as Record<string, string>;
      expect(Object.keys(headers)).toEqual(['X-Keep']);
      expect(headers['X-Keep']).toBe('yes');
    });

    it('should drop query param rows with empty keys', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({}),
      };
      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      await handler.execute(
        null,
        {
          method: 'GET',
          url: 'https://api.example.com/data',
          queryParams: [
            { key: '', value: 'skip' },
            { key: '   ', value: 'skip' },
            { key: 'keep', value: 'yes' },
          ],
        },
        context,
      );

      const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(url).toContain('keep=yes');
      expect(url).not.toContain('skip');
    });

    it('should accept legacy Record-shaped headers and queryParams', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({}),
      };
      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      await handler.execute(
        null,
        {
          method: 'GET',
          url: 'https://api.example.com/data',
          headers: { 'X-Legacy': 'on' },
          queryParams: { page: '1' },
        },
        context,
      );

      const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      const args = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit;
      expect(url).toContain('page=1');
      expect((args.headers as Record<string, string>)['X-Legacy']).toBe('on');
    });

    it('should strip CRLF from header keys and values (injection guard)', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({}),
      };
      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      await handler.execute(
        null,
        {
          method: 'GET',
          url: 'https://api.example.com/data',
          headers: [{ key: 'X-Safe\r\nX-Injected', value: 'ok\r\nEvil: yes' }],
        },
        context,
      );

      const args = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit;
      const headers = args.headers as Record<string, string>;
      expect(headers['X-SafeX-Injected']).toBe('okEvil: yes');
      expect(headers['X-Injected']).toBeUndefined();
      expect(headers['Evil']).toBeUndefined();
    });

    it('should treat legacy bodyType "form" as x-www-form-urlencoded', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({}),
      };
      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      await handler.execute(
        null,
        {
          method: 'POST',
          url: 'https://api.example.com/form',
          bodyType: 'form',
          body: { name: 'alice' },
        },
        context,
      );

      const args = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit;
      const headers = args.headers as Record<string, string>;
      expect(headers['Content-Type']).toBe('application/x-www-form-urlencoded');
      expect(args.body).toBe('name=alice');
    });

    it('should send x-www-form-urlencoded body with correct content-type', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({}),
      };
      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      await handler.execute(
        null,
        {
          method: 'POST',
          url: 'https://api.example.com/form',
          bodyType: 'x-www-form-urlencoded',
          body: { name: 'alice', age: 30 },
        },
        context,
      );

      const args = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit;
      const headers = args.headers as Record<string, string>;
      expect(headers['Content-Type']).toBe('application/x-www-form-urlencoded');
      expect(args.body).toBe('name=alice&age=30');
    });

    it('should send form-data body and omit explicit Content-Type', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({}),
      };
      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      await handler.execute(
        null,
        {
          method: 'POST',
          url: 'https://api.example.com/upload',
          bodyType: 'form-data',
          body: { field: 'value' },
        },
        context,
      );

      const args = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit;
      expect(args.body).toBeInstanceOf(FormData);
      expect((args.body as FormData).get('field')).toBe('value');
      const headers = args.headers as Record<string, string>;
      expect(headers['Content-Type']).toBeUndefined();
    });

    it('should send JSON body for POST requests', async () => {
      const mockResponse = {
        ok: true,
        status: 201,
        json: jest.fn().mockResolvedValue({ id: 1 }),
      };
      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      await handler.execute(
        null,
        {
          method: 'POST',
          url: 'https://api.example.com/data',
          body: { name: 'test' },
        },
        context,
      );

      const fetchArgs = (global.fetch as jest.Mock).mock
        .calls[0][1] as RequestInit;
      expect(fetchArgs.body).toBe(JSON.stringify({ name: 'test' }));
    });

    it('should handle text response type', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue('plain text response'),
      };
      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      const result = (await handler.execute(
        null,
        {
          method: 'GET',
          url: 'https://api.example.com/text',
          responseType: 'text',
        },
        context,
      )) as unknown as { port: string; output: { response: unknown } };

      expect(result.port).toBe('success');
      expect(result.output.response).toBe('plain text response');
    });
  });

  describe('integration-backed authentication', () => {
    const contextWithWorkspace: ExecutionContext = {
      executionId: 'exec-1',
      workflowId: 'wf-1',
      nodeExecutionId: 'ne-1',
      variables: { __workspaceId: 'ws-1' },
      nodeOutputCache: {},
      structuredOutputCache: {},
      engineResolvedConfigCache: {},
      conversationThread: createEmptyConversationThread(),
      recursionDepth: 0,
    };

    function makeService(
      authType: string,
      credentials: Record<string, unknown>,
    ) {
      const logUsage = jest.fn().mockResolvedValue(undefined);
      const getForExecution = jest.fn().mockResolvedValue({
        id: 'int-1',
        name: 'API',
        serviceType: 'http',
        authType,
        status: 'connected',
        credentials,
      });
      return { service: { getForExecution, logUsage }, logUsage };
    }

    beforeEach(() => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ ok: true }),
      });
    });

    it('attaches bearer token from integration credentials', async () => {
      const { service, logUsage } = makeService('bearer_token', {
        token: 'abc',
      });
      const handler = new HttpRequestHandler(service as never);
      await handler.execute(
        null,
        {
          method: 'GET',
          url: 'https://api.example.com/me',
          authentication: 'integration',
          integrationId: 'int-1',
        },
        contextWithWorkspace,
      );
      const args = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit;
      expect((args.headers as Record<string, string>).Authorization).toBe(
        'Bearer abc',
      );
      expect(logUsage).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'success' }),
      );
    });

    it('merges user-provided headers with integration credential headers', async () => {
      const { service } = makeService('bearer_token', { token: 'abc' });
      const handler = new HttpRequestHandler(service as never);
      await handler.execute(
        null,
        {
          method: 'GET',
          url: 'https://api.example.com/me',
          authentication: 'integration',
          integrationId: 'int-1',
          headers: [{ key: 'X-Request-Id', value: 'req-42' }],
        },
        contextWithWorkspace,
      );
      const args = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit;
      const headers = args.headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer abc');
      expect(headers['X-Request-Id']).toBe('req-42');
    });

    it('prioritizes integration credential headers over user headers', async () => {
      const { service } = makeService('bearer_token', { token: 'real' });
      const handler = new HttpRequestHandler(service as never);
      await handler.execute(
        null,
        {
          method: 'GET',
          url: 'https://api.example.com/me',
          authentication: 'integration',
          integrationId: 'int-1',
          headers: [{ key: 'Authorization', value: 'Bearer attacker' }],
        },
        contextWithWorkspace,
      );
      const args = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit;
      const headers = args.headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer real');
    });

    it('places API key in header when location=header', async () => {
      const { service } = makeService('api_key', {
        location: 'header',
        key_name: 'X-Api-Key',
        value: 'secret',
      });
      const handler = new HttpRequestHandler(service as never);
      await handler.execute(
        null,
        {
          method: 'GET',
          url: 'https://api.example.com/x',
          authentication: 'integration',
          integrationId: 'int-1',
        },
        contextWithWorkspace,
      );
      const args = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit;
      expect((args.headers as Record<string, string>)['X-Api-Key']).toBe(
        'secret',
      );
    });

    it('places API key in query when location=query', async () => {
      const { service } = makeService('api_key', {
        location: 'query',
        key_name: 'token',
        value: 'abc',
      });
      const handler = new HttpRequestHandler(service as never);
      await handler.execute(
        null,
        {
          method: 'GET',
          url: 'https://api.example.com/x',
          authentication: 'integration',
          integrationId: 'int-1',
        },
        contextWithWorkspace,
      );
      const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(url).toContain('token=abc');
    });

    it('uses base_url when URL is relative', async () => {
      const { service } = makeService('bearer_token', {
        token: 't',
        base_url: 'https://api.example.com',
      });
      const handler = new HttpRequestHandler(service as never);
      await handler.execute(
        null,
        {
          method: 'GET',
          url: '/me',
          authentication: 'integration',
          integrationId: 'int-1',
        },
        contextWithWorkspace,
      );
      const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(url).toBe('https://api.example.com/me');
    });

    it('builds basic auth header', async () => {
      const { service } = makeService('basic', {
        username: 'u',
        password: 'p',
      });
      const handler = new HttpRequestHandler(service as never);
      await handler.execute(
        null,
        {
          method: 'GET',
          url: 'https://api.example.com/x',
          authentication: 'integration',
          integrationId: 'int-1',
        },
        contextWithWorkspace,
      );
      const args = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit;
      const expected = `Basic ${Buffer.from('u:p').toString('base64')}`;
      expect((args.headers as Record<string, string>).Authorization).toBe(
        expected,
      );
    });

    it('rejects when authentication=integration without integrationId', () => {
      const { service } = makeService('bearer_token', { token: 't' });
      const handler = new HttpRequestHandler(service as never);
      const result = handler.validate({
        method: 'GET',
        url: 'https://x',
        authentication: 'integration',
      });
      expect(result.valid).toBe(false);
      void service;
    });

    it('blocks outbound requests to private IPv4 ranges', async () => {
      const { service, logUsage } = makeService('bearer_token', { token: 't' });
      const handler = new HttpRequestHandler(service as never);
      // D4 (2026-05-17) — SSRF 차단이 throw 대신 port:'error' + HTTP_BLOCKED 로 라우팅.
      const result = (await handler.execute(
        null,
        {
          method: 'GET',
          url: 'http://169.254.169.254/latest/meta-data/',
          authentication: 'integration',
          integrationId: 'int-1',
        },
        contextWithWorkspace,
      )) as unknown as Record<string, unknown>;
      expect(result.port).toBe('error');
      const output = result.output as {
        error: { code: string; message: string };
      };
      expect(output.error.code).toBe('HTTP_BLOCKED');
      expect(output.error.message).toMatch(/SSRF_BLOCKED/);
      expect(logUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          error: expect.objectContaining({ code: 'HTTP_BLOCKED' }),
        }),
      );
    });

    it('blocks localhost by name (D4 — port:error + HTTP_BLOCKED)', async () => {
      const { service } = makeService('bearer_token', { token: 't' });
      const handler = new HttpRequestHandler(service as never);
      const result = (await handler.execute(
        null,
        {
          method: 'GET',
          url: 'http://localhost:9000/admin',
          authentication: 'integration',
          integrationId: 'int-1',
        },
        contextWithWorkspace,
      )) as unknown as Record<string, unknown>;
      expect(result.port).toBe('error');
      const output = result.output as {
        error: { code: string; message: string };
      };
      expect(output.error.code).toBe('HTTP_BLOCKED');
      expect(output.error.message).toMatch(/SSRF_BLOCKED/);
    });

    it('logs HTTP transport failure with HTTP_TRANSPORT_FAILED', async () => {
      const { service, logUsage } = makeService('bearer_token', { token: 't' });
      global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
      const handler = new HttpRequestHandler(service as never);
      await handler.execute(
        null,
        {
          method: 'GET',
          url: 'https://api.example.com/x',
          authentication: 'integration',
          integrationId: 'int-1',
        },
        contextWithWorkspace,
      );
      expect(logUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          error: expect.objectContaining({ code: 'HTTP_TRANSPORT_FAILED' }),
        }),
      );
    });

    it('logs HTTP non-2xx as failed', async () => {
      const { service, logUsage } = makeService('bearer_token', { token: 't' });
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Server Error',
        json: jest.fn().mockResolvedValue({ error: 'boom' }),
      });
      const handler = new HttpRequestHandler(service as never);
      await handler.execute(
        null,
        {
          method: 'GET',
          url: 'https://api.example.com/x',
          authentication: 'integration',
          integrationId: 'int-1',
        },
        contextWithWorkspace,
      );
      expect(logUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          error: expect.objectContaining({ code: 'HTTP_500' }),
        }),
      );
    });

    // W3 — api field value assertion in logUsage (INT-US-05)
    it('passes api.method and api.path to logUsage on success (INT-US-05)', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ ok: true }),
      });
      const { service, logUsage } = makeService('bearer_token', {
        token: 'abc',
      });
      const handler = new HttpRequestHandler(service as never);
      await handler.execute(
        null,
        {
          method: 'GET',
          url: 'https://api.example.com/me',
          authentication: 'integration',
          integrationId: 'int-1',
        },
        contextWithWorkspace,
      );
      expect(logUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          api: expect.objectContaining({
            method: 'GET',
            path: 'api.example.com/me',
          }),
        }),
      );
    });

    it('passes api.method and api.path to logUsage on transport failure (INT-US-05)', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
      const { service, logUsage } = makeService('bearer_token', {
        token: 'abc',
      });
      const handler = new HttpRequestHandler(service as never);
      await handler.execute(
        null,
        {
          method: 'POST',
          url: 'https://api.example.com/orders',
          authentication: 'integration',
          integrationId: 'int-1',
        },
        contextWithWorkspace,
      );
      expect(logUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          api: expect.objectContaining({
            method: 'POST',
            path: 'api.example.com/orders',
          }),
        }),
      );
    });
  });

  // ENG-RC-* — Phase 2 raw-echo migration. Verifies that `config` carries
  // the **raw** (pre-evaluation) settings the workflow author entered,
  // `output.requestBody` carries the evaluated body that hit the wire, and
  // `output.responseHeaders` carries the response headers with credential-
  // shaped values redacted.
  describe('ENG-RC-* — raw config echo + output.requestBody / responseHeaders', () => {
    let originalFetch: typeof global.fetch;

    beforeEach(() => {
      originalFetch = global.fetch;
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('echoes rawConfig templates on config and evaluated body on output', async () => {
      const rawConfig = {
        method: 'POST',
        url: '{{ $input.endpoint }}',
        body: { user: '{{ $input.name }}' },
        bodyType: 'json',
      };
      const evaluated = {
        method: 'POST',
        url: 'https://api.example.com/users',
        body: { user: 'Alice' },
        bodyType: 'json',
      };
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ ok: true }),
        headers: new Headers({ 'Content-Type': 'application/json' }),
      });

      const result = (await handler.execute(
        null,
        evaluated,
        makeContext(rawConfig),
      )) as unknown as {
        config: { url: string; body: unknown; method: string };
        output: {
          requestBody: unknown;
          requestBodyType: string;
          responseHeaders: Record<string, string>;
        };
      };

      // config echoes the raw template
      expect(result.config.url).toBe('{{ $input.endpoint }}');
      expect(result.config.body).toEqual({ user: '{{ $input.name }}' });
      expect(result.config.method).toBe('POST');
      // output surfaces the evaluated body
      expect(result.output.requestBody).toEqual({ user: 'Alice' });
      expect(result.output.requestBodyType).toBe('json');
      expect(result.output.responseHeaders['content-type']).toBe(
        'application/json',
      );
    });

    it('omits requestBody for GET (no body) but still emits requestBodyType', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({}),
        headers: new Headers(),
      });

      const result = (await handler.execute(
        null,
        { method: 'GET', url: 'https://api.example.com/x' },
        makeContext(),
      )) as unknown as {
        output: { requestBody?: unknown; requestBodyType: string };
      };

      expect(result.output.requestBody).toBeUndefined();
      // requestBodyType uses the evaluated default ('json') even when no
      // body was sent — review W-5 (Principle 7 — output is evaluated).
      expect(result.output.requestBodyType).toBe('json');
    });

    it('omits requestBody for body: null', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({}),
        headers: new Headers(),
      });

      // `body: null` is treated identically to `body: undefined` in the
      // wire-encoding path (`fetchOptions.body` stays unset). The output
      // contract should mirror that — `requestBody` is null per the cap
      // helper's null-passthrough rule.
      const result = (await handler.execute(
        null,
        {
          method: 'POST',
          url: 'https://api.example.com/x',
          body: null,
          bodyType: 'json',
        },
        makeContext(),
      )) as unknown as {
        output: { requestBody?: unknown; requestBodyType: string };
      };

      // `truncateBodyForOutput(null) → { value: null, truncated: false }`,
      // so `null` is emitted explicitly; `undefined` would be omitted.
      expect(result.output.requestBody).toBeNull();
      expect(result.output.requestBodyType).toBe('json');
    });

    it('records x-www-form-urlencoded body verbatim on requestBody', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({}),
        headers: new Headers(),
      });

      const result = (await handler.execute(
        null,
        {
          method: 'POST',
          url: 'https://api.example.com/form',
          bodyType: 'x-www-form-urlencoded',
          body: { name: 'alice', age: 30 },
        },
        makeContext(),
      )) as unknown as {
        output: { requestBody: unknown; requestBodyType: string };
      };

      // The wire format is `name=alice&age=30` (URLSearchParams), but the
      // echoed `requestBody` is the structured input the user passed —
      // intentional, since the round-trip serialisation is lossy for booleans
      // and the Principle-7 contract is "evaluated value", not "wire bytes".
      expect(result.output.requestBody).toEqual({ name: 'alice', age: 30 });
      expect(result.output.requestBodyType).toBe('x-www-form-urlencoded');
    });

    it('records form-data entries on requestBody', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({}),
        headers: new Headers(),
      });

      const result = (await handler.execute(
        null,
        {
          method: 'POST',
          url: 'https://api.example.com/upload',
          bodyType: 'form-data',
          body: { field: 'value' },
        },
        makeContext(),
      )) as unknown as {
        output: {
          requestBody: Record<string, string>;
          requestBodyType: string;
        };
      };

      expect(result.output.requestBodyType).toBe('form-data');
      expect(result.output.requestBody).toEqual({ field: 'value' });
    });

    it('redacts sensitive response headers', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({}),
        headers: new Headers({
          'Content-Type': 'application/json',
          Authorization: 'Bearer leaked',
          'Set-Cookie': 'sid=abc',
          'X-Custom-Token': 't',
        }),
      });

      const result = (await handler.execute(
        null,
        { method: 'GET', url: 'https://api.example.com/x' },
        makeContext(),
      )) as unknown as { output: { responseHeaders: Record<string, string> } };

      expect(result.output.responseHeaders['content-type']).toBe(
        'application/json',
      );
      expect(result.output.responseHeaders.authorization).toBe('[REDACTED]');
      expect(result.output.responseHeaders['set-cookie']).toBe('[REDACTED]');
      expect(result.output.responseHeaders['x-custom-token']).toBe(
        '[REDACTED]',
      );
    });

    it('caps oversized request bodies and sets bodyTruncated', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({}),
        headers: new Headers(),
      });

      const huge = 'x'.repeat(300 * 1024);
      const result = (await handler.execute(
        null,
        {
          method: 'POST',
          url: 'https://api.example.com/x',
          body: huge,
          bodyType: 'raw',
        },
        makeContext(),
      )) as unknown as {
        output: { requestBody: string; bodyTruncated?: boolean };
      };

      expect(result.output.bodyTruncated).toBe(true);
      expect(typeof result.output.requestBody).toBe('string');
      expect(
        Buffer.byteLength(result.output.requestBody, 'utf8'),
      ).toBeLessThanOrEqual(256 * 1024);
    });

    it('still surfaces requestBody on non-2xx error port', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'boom',
        json: jest.fn().mockResolvedValue({ error: 'boom' }),
        headers: new Headers({ 'Content-Type': 'application/json' }),
      });

      const result = (await handler.execute(
        null,
        {
          method: 'POST',
          url: 'https://api.example.com/x',
          body: { x: 1 },
          bodyType: 'json',
        },
        makeContext(),
      )) as unknown as {
        port: string;
        output: {
          requestBody: unknown;
          requestBodyType: string;
          responseHeaders: Record<string, string>;
        };
      };

      expect(result.port).toBe('error');
      expect(result.output.requestBody).toEqual({ x: 1 });
      expect(result.output.requestBodyType).toBe('json');
      expect(result.output.responseHeaders['content-type']).toBe(
        'application/json',
      );
    });

    it('surfaces requestBody on transport-error port (no responseHeaders)', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      const result = (await handler.execute(
        null,
        {
          method: 'POST',
          url: 'https://api.example.com/x',
          body: { ping: 1 },
          bodyType: 'json',
        },
        makeContext(),
      )) as unknown as {
        port: string;
        output: {
          requestBody: unknown;
          requestBodyType: string;
          responseHeaders?: Record<string, string>;
        };
      };

      expect(result.port).toBe('error');
      expect(result.output.requestBody).toEqual({ ping: 1 });
      expect(result.output.requestBodyType).toBe('json');
      expect(result.output.responseHeaders).toBeUndefined();
    });
  });
});

// W1 — extractApiPath unit tests (INT-US-05)
describe('extractApiPath', () => {
  it('extracts host + pathname from an absolute URL (no query string)', () => {
    expect(extractApiPath('https://api.example.com/v1/orders')).toBe(
      'api.example.com/v1/orders',
    );
  });

  it('strips query string from an absolute URL', () => {
    expect(
      extractApiPath('https://api.example.com/v1/orders?page=1&limit=20'),
    ).toBe('api.example.com/v1/orders');
  });

  it('returns relative URL path as-is when no query string or fragment', () => {
    expect(extractApiPath('/v1/orders')).toBe('/v1/orders');
  });

  it('strips query string from a relative URL', () => {
    expect(extractApiPath('/v1/orders?page=1')).toBe('/v1/orders');
  });

  it('strips fragment from a relative URL (I4 fix)', () => {
    expect(extractApiPath('/v1/orders#section')).toBe('/v1/orders');
  });

  it('strips both query string and fragment from a relative URL, keeping the shorter cut', () => {
    expect(extractApiPath('/v1/orders?page=1#section')).toBe('/v1/orders');
  });
});
