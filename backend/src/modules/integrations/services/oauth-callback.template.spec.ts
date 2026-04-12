import { htmlEscape, renderCallbackHtml } from './oauth-callback.template';

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
      { status: 'error', provider: 'slack', error: '<img src=x onerror=1>' },
      'https://app.example.com',
    );
    expect(html).toContain('&lt;img');
    expect(html).not.toContain('<img src=x');
  });

  it('JSON payload cannot break out of script string', () => {
    const html = renderCallbackHtml(
      {
        status: 'error',
        provider: 'slack',
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
          provider: 'slack',
          previewToken: 'tmp_abc',
        },
      },
      'https://app.example.com',
    );
    expect(html).toContain('https://app.example.com');
    expect(html).toContain('postMessage');
  });
});
