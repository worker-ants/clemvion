import {
  ERROR_CLOSE_DELAY_MS,
  htmlEscape,
  renderCallbackHtml,
} from './oauth-callback.template';

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
      { status: 'error', provider: 'google', error: '<img src=x onerror=1>' },
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

  describe('auto-close delay (변경 0)', () => {
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
