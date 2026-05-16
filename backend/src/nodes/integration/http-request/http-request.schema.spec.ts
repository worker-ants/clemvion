import { evaluateWarnings } from '@workflow/node-summary';
import {
  httpRequestNodeMetadata,
  keyValueSchema,
  validateHttpRequestConfig,
} from './http-request.schema';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';

describe('keyValueSchema (headers / queryParams 공용)', () => {
  it('필수 key/value 정상 파싱', () => {
    const parsed = keyValueSchema.parse({
      key: 'Authorization',
      value: 'Bearer xyz',
    });
    expect(parsed.key).toBe('Authorization');
    expect(parsed.value).toBe('Bearer xyz');
  });

  it('passthrough — 추가 메타 필드(description, enabled 등) 보존', () => {
    const parsed = keyValueSchema.parse({
      key: 'X-Custom',
      value: 'foo',
      description: 'optional metadata',
      enabled: true,
      // Zod passthrough 는 런타임에 추가 필드를 보존하지만 추론 타입에는
      // 미반영되므로 cast 가 불가피.
    } as Record<string, unknown>);
    const extra = parsed as Record<string, unknown>;
    expect(extra.description).toBe('optional metadata');
    expect(extra.enabled).toBe(true);
  });

  it('key/value 누락 시 거부', () => {
    expect(keyValueSchema.safeParse({ key: 'X' }).success).toBe(false);
    expect(keyValueSchema.safeParse({ value: 'v' }).success).toBe(false);
  });

  it('CRLF 가 포함된 key/value 는 거부 (header injection 방어, review W-1)', () => {
    expect(
      keyValueSchema.safeParse({ key: 'X\r\nInjected', value: 'foo' }).success,
    ).toBe(false);
    expect(
      keyValueSchema.safeParse({ key: 'X', value: 'foo\nLF' }).success,
    ).toBe(false);
    expect(
      keyValueSchema.safeParse({ key: 'X\rCR', value: 'foo' }).success,
    ).toBe(false);
  });
});

describe('httpRequestNodeMetadata.warningRules', () => {
  const firedIds = (config: unknown) =>
    evaluateWarnings(
      config as Record<string, unknown>,
      httpRequestNodeMetadata.warningRules,
    ).map((w) => w.id);

  describe('http_request:no-url', () => {
    it('fires when url is missing', () => {
      expect(firedIds({})).toContain('http_request:no-url');
    });

    it('fires when url is empty string', () => {
      expect(firedIds({ url: '' })).toContain('http_request:no-url');
    });

    it('does NOT fire when url is set', () => {
      expect(firedIds({ url: 'https://example.com' })).not.toContain(
        'http_request:no-url',
      );
    });
  });

  describe('http_request:integration-auth-needs-integration-id', () => {
    it('fires when authentication=integration and integrationId is missing', () => {
      expect(firedIds({ url: 'x', authentication: 'integration' })).toContain(
        'http_request:integration-auth-needs-integration-id',
      );
    });

    it('does NOT fire when authentication=none', () => {
      expect(firedIds({ url: 'x', authentication: 'none' })).not.toContain(
        'http_request:integration-auth-needs-integration-id',
      );
    });

    it('does NOT fire when authentication=integration and integrationId is set', () => {
      expect(
        firedIds({
          url: 'x',
          authentication: 'integration',
          integrationId: 'i-1',
        }),
      ).not.toContain('http_request:integration-auth-needs-integration-id');
    });
  });
});

describe('validateHttpRequestConfig (imperative)', () => {
  it('returns [] when timeout is omitted', () => {
    expect(validateHttpRequestConfig({ url: 'x' })).toEqual([]);
  });

  it('returns [] when timeout is a positive number', () => {
    expect(validateHttpRequestConfig({ timeout: 30000 })).toEqual([]);
  });

  it('rejects non-numeric timeout', () => {
    expect(validateHttpRequestConfig({ timeout: '30000' })).toContain(
      'timeout must be a positive number',
    );
  });

  it('rejects timeout = 0 or negative', () => {
    expect(validateHttpRequestConfig({ timeout: 0 })).toContain(
      'timeout must be a positive number',
    );
    expect(validateHttpRequestConfig({ timeout: -1 })).toContain(
      'timeout must be a positive number',
    );
  });
});

describe('evaluateMetadataBlockingErrors integration (http_request)', () => {
  it('emits both warnings on a freshly-created integration-auth node', () => {
    const errors = evaluateMetadataBlockingErrors(httpRequestNodeMetadata, {
      authentication: 'integration',
    });
    expect(errors).toContain('URL must be entered.');
    expect(errors).toContain(
      'Integration must be selected when using Integration auth.',
    );
  });

  it('returns [] when fully configured', () => {
    expect(
      evaluateMetadataBlockingErrors(httpRequestNodeMetadata, {
        url: 'https://example.com',
      }),
    ).toEqual([]);
  });
});
