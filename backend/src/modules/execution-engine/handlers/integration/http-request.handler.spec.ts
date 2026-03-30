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
});
