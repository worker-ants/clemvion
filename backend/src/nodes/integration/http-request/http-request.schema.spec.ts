import { evaluateWarnings } from '@workflow/node-summary';
import {
  httpRequestNodeMetadata,
  validateHttpRequestConfig,
} from './http-request.schema';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';

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
  it('emits both Korean warnings on a freshly-created integration-auth node', () => {
    const errors = evaluateMetadataBlockingErrors(httpRequestNodeMetadata, {
      authentication: 'integration',
    });
    expect(errors).toContain('URL 을 입력해야 합니다.');
    expect(errors).toContain(
      'Integration 인증을 사용하려면 integration 을 선택해야 합니다.',
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
