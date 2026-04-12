import { HttpRequestHandler } from './http-request.handler.js';
import { ExecutionContext } from '../node-handler.interface.js';

describe('HttpRequestHandler', () => {
  let handler: HttpRequestHandler;
  const context: ExecutionContext = {
    executionId: 'exec-1',
    workflowId: 'wf-1',
    variables: {},
    nodeOutputCache: {},
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

    it('should fail when method is missing', () => {
      const result = handler.validate({ url: 'https://api.example.com' });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('method');
    });

    it('should fail when url is missing', () => {
      const result = handler.validate({ method: 'GET' });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('url');
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

    it('should return success port on 2xx response', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ data: 'test' }),
      };
      global.fetch = jest
        .fn()
        .mockResolvedValue(mockResponse) as unknown as typeof fetch;

      const result = (await handler.execute(
        null,
        { method: 'GET', url: 'https://api.example.com/data' },
        context,
      )) as {
        port: string;
        data: {
          response: unknown;
          meta: { statusCode: number; duration: number };
        };
      };

      expect(result.port).toBe('success');
      expect(result.data.response).toEqual({ data: 'test' });
      expect(result.data.meta.statusCode).toBe(200);
      expect(typeof result.data.meta.duration).toBe('number');
    });

    it('should return error port on non-2xx response', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        json: jest.fn().mockResolvedValue({ error: 'not found' }),
      };
      global.fetch = jest
        .fn()
        .mockResolvedValue(mockResponse) as unknown as typeof fetch;

      const result = (await handler.execute(
        null,
        { method: 'GET', url: 'https://api.example.com/missing' },
        context,
      )) as {
        port: string;
        data: { response: unknown; meta: { statusCode: number } };
      };

      expect(result.port).toBe('error');
      expect(result.data.meta.statusCode).toBe(404);
    });

    it('should return error port on network failure', async () => {
      global.fetch = jest
        .fn()
        .mockRejectedValue(
          new Error('Network error'),
        ) as unknown as typeof fetch;

      const result = (await handler.execute(
        null,
        { method: 'GET', url: 'https://api.example.com/fail' },
        context,
      )) as {
        port: string;
        data: { response: { error: string }; meta: { statusCode: number } };
      };

      expect(result.port).toBe('error');
      expect(result.data.response.error).toBe('Network error');
      expect(result.data.meta.statusCode).toBe(0);
    });

    it('should append query params to URL', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({}),
      };
      global.fetch = jest
        .fn()
        .mockResolvedValue(mockResponse) as unknown as typeof fetch;

      await handler.execute(
        null,
        {
          method: 'GET',
          url: 'https://api.example.com/data',
          queryParams: { page: '1', limit: '10' },
        },
        context,
      );

      const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(calledUrl).toContain('page=1');
      expect(calledUrl).toContain('limit=10');
    });

    it('should send JSON body for POST requests', async () => {
      const mockResponse = {
        ok: true,
        status: 201,
        json: jest.fn().mockResolvedValue({ id: 1 }),
      };
      global.fetch = jest
        .fn()
        .mockResolvedValue(mockResponse) as unknown as typeof fetch;

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
      global.fetch = jest
        .fn()
        .mockResolvedValue(mockResponse) as unknown as typeof fetch;

      const result = (await handler.execute(
        null,
        {
          method: 'GET',
          url: 'https://api.example.com/text',
          responseType: 'text',
        },
        context,
      )) as { port: string; data: { response: unknown } };

      expect(result.port).toBe('success');
      expect(result.data.response).toBe('plain text response');
    });
  });

  describe('integration-backed authentication', () => {
    const contextWithWorkspace: ExecutionContext = {
      executionId: 'exec-1',
      workflowId: 'wf-1',
      nodeExecutionId: 'ne-1',
      variables: { __workspaceId: 'ws-1' },
      nodeOutputCache: {},
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
      }) as unknown as typeof fetch;
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

    it('rejects when authentication=integration without integrationId', async () => {
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

    it('logs HTTP non-2xx as failed', async () => {
      const { service, logUsage } = makeService('bearer_token', { token: 't' });
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Server Error',
        json: jest.fn().mockResolvedValue({ error: 'boom' }),
      }) as unknown as typeof fetch;
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
  });
});
