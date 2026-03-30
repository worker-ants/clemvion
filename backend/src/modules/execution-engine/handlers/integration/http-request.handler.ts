import {
  ExecutionContext,
  NodeHandler,
  ValidationResult,
} from '../node-handler.interface.js';

export class HttpRequestHandler implements NodeHandler {
  validate(config: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];

    if (!config.method || typeof config.method !== 'string') {
      errors.push('method is required and must be a string');
    } else {
      const allowed = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
      if (!allowed.includes((config.method as string).toUpperCase())) {
        errors.push(`method must be one of: ${allowed.join(', ')}`);
      }
    }

    if (!config.url || typeof config.url !== 'string') {
      errors.push('url is required and must be a string');
    }

    if (config.timeout !== undefined && (typeof config.timeout !== 'number' || config.timeout <= 0)) {
      errors.push('timeout must be a positive number');
    }

    return { valid: errors.length === 0, errors };
  }

  async execute(
    input: unknown,
    config: Record<string, unknown>,
    _context: ExecutionContext,
  ): Promise<unknown> {
    const method = (config.method as string).toUpperCase();
    let url = config.url as string;
    const headers = (config.headers as Record<string, string>) ?? {};
    const queryParams = config.queryParams as Record<string, string> | undefined;
    const body = config.body;
    const bodyType = (config.bodyType as string) ?? 'json';
    const responseType = (config.responseType as string) ?? 'json';
    const timeout = (config.timeout as number) ?? 30000;

    if (queryParams && typeof queryParams === 'object') {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(queryParams)) {
        params.append(key, String(value));
      }
      const separator = url.includes('?') ? '&' : '?';
      url = `${url}${separator}${params.toString()}`;
    }

    const fetchOptions: RequestInit = {
      method,
      headers: { ...headers },
    };

    if (body !== undefined && !['GET', 'HEAD'].includes(method)) {
      if (bodyType === 'json') {
        (fetchOptions.headers as Record<string, string>)['Content-Type'] =
          (fetchOptions.headers as Record<string, string>)['Content-Type'] ?? 'application/json';
        fetchOptions.body = JSON.stringify(body);
      } else if (bodyType === 'form') {
        const formData = new URLSearchParams();
        if (typeof body === 'object' && body !== null) {
          for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
            formData.append(key, String(value));
          }
        }
        fetchOptions.body = formData.toString();
        (fetchOptions.headers as Record<string, string>)['Content-Type'] =
          (fetchOptions.headers as Record<string, string>)['Content-Type'] ??
          'application/x-www-form-urlencoded';
      } else {
        fetchOptions.body = String(body);
      }
    }

    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    fetchOptions.signal = controller.signal;

    try {
      const res = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      const duration = Date.now() - startTime;

      let responseData: unknown;
      if (responseType === 'json') {
        responseData = await res.json().catch(() => null);
      } else if (responseType === 'text') {
        responseData = await res.text();
      } else {
        responseData = await res.text();
      }

      const meta = { statusCode: res.status, duration };

      if (res.ok) {
        return { port: 'success', data: { response: responseData, meta } };
      }
      return { port: 'error', data: { response: responseData, meta } };
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;
      const message = error instanceof Error ? error.message : String(error);
      return {
        port: 'error',
        data: {
          response: { error: message },
          meta: { statusCode: 0, duration },
        },
      };
    }
  }
}
