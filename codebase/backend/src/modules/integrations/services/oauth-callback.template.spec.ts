import {
  ERROR_CLOSE_DELAY_MS,
  htmlEscape,
  renderCallbackHtml,
} from './oauth-callback.template';
import { readCallbackPayload } from '../__test-utils__/oauth-callback-payload';

describe('htmlEscape', () => {
  it('escapes all five special characters', () => {
    expect(htmlEscape(`<script>alert("x&y'z")</script>`)).toBe(
      '&lt;script&gt;alert(&quot;x&amp;y&#39;z&quot;)&lt;/script&gt;',
    );
  });
});

describe('renderCallbackHtml', () => {
  it('escapes attacker-controlled error messages in HTML body', () => {
    const html = renderCallbackHtml(
      {
        status: 'error',
        provider: 'google',
        code: 'OAUTH_CALLBACK_FAILED',
        error: '<img src=x onerror=1>',
      },
      'https://app.example.com',
    );
    expect(html).toContain('&lt;img');
    expect(html).not.toContain('<img src=x');
  });

  it('JSON payload cannot break out of script string', () => {
    const html = renderCallbackHtml(
      {
        status: 'error',
        provider: 'google',
        code: 'OAUTH_CALLBACK_FAILED',
        error: '</script><script>alert(1)</script>',
      },
      'https://app.example.com',
    );
    expect(html).not.toMatch(/<\/script>\s*<script>/);
    expect(html).toContain('\\u003c');
  });

  it('targets explicit origin', () => {
    const html = renderCallbackHtml(
      {
        status: 'success',
        result: {
          mode: 'new',
          provider: 'google',
          previewToken: 'tmp_abc',
        },
      },
      'https://app.example.com',
    );
    expect(html).toContain('https://app.example.com');
    expect(html).toContain('postMessage');
  });

  describe('postMessage payload', () => {
    it('carries the failure code next to the message string', () => {
      const html = renderCallbackHtml(
        {
          status: 'error',
          provider: 'cafe24',
          code: 'OAUTH_STATE_EXPIRED',
          error: 'OAuth state has expired',
        },
        'https://app.example.com',
      );
      expect(readCallbackPayload(html)).toEqual({
        type: 'oauth_callback',
        status: 'error',
        provider: 'cafe24',
        code: 'OAUTH_STATE_EXPIRED',
        error: 'OAuth state has expired',
      });
    });

    it('keeps code null when the failure has no code', () => {
      const html = renderCallbackHtml(
        {
          status: 'error',
          provider: 'nope',
          code: null,
          error: 'Unsupported OAuth provider',
        },
        'https://app.example.com',
      );
      expect(readCallbackPayload(html)).toMatchObject({
        status: 'error',
        code: null,
        error: 'Unsupported OAuth provider',
      });
    });

    it('sets code null on success', () => {
      const html = renderCallbackHtml(
        {
          status: 'success',
          result: {
            mode: 'reauthorize',
            provider: 'cafe24',
            integrationId: 'i-1',
          },
        },
        'https://app.example.com',
      );
      expect(readCallbackPayload(html)).toMatchObject({
        status: 'success',
        integrationId: 'i-1',
        code: null,
        error: null,
      });
    });
  });

  describe('auto-close delay', () => {
    it('closes immediately on success', () => {
      const html = renderCallbackHtml(
        {
          status: 'success',
          result: {
            mode: 'new',
            provider: 'google',
            previewToken: 'tmp_abc',
          },
        },
        'https://app.example.com',
      );
      // Success path: window.close() runs without a setTimeout wrapper.
      expect(html).toContain('window.close()');
      // No setTimeout wrapping the close call on success.
      expect(html).not.toMatch(/setTimeout\([^)]*window\.close/);
    });

    it('delays window.close on error so the user can read the message', () => {
      const html = renderCallbackHtml(
        {
          status: 'error',
          provider: 'google',
          code: 'OAUTH_TOKEN_EXCHANGE_FAILED',
          error: 'Failed to exchange authorization code for access token',
        },
        'https://app.example.com',
      );
      // Error path: delayed close with the exact configured delay.
      const match = html.match(/setTimeout\([^,]+,\s*(\d+)\s*\)/);
      expect(match).not.toBeNull();
      expect(Number(match![1])).toBe(ERROR_CLOSE_DELAY_MS);
      expect(html).toContain('window.close()');
      // The error message must be visible in the body so users see it before
      // the timeout fires.
      expect(html).toContain('Failed to exchange authorization code');
    });
  });
});
