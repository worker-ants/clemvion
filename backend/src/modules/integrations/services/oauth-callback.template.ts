/**
 * Renders the HTML page shown in the OAuth popup after the provider redirects
 * back to us. The page posts a message to the opener window and closes itself.
 *
 * All user/provider-supplied strings are HTML-escaped before interpolation.
 * The payload object is JSON-encoded with `<`, `>`, `&`, `'`, and `"` converted
 * to their `\uXXXX` escapes so it cannot close the script tag or break out of
 * the string context.
 */

export interface OAuthCallbackSuccess {
  status: 'success';
  result: {
    mode: string;
    provider: string;
    integrationId?: string;
    previewToken?: string;
  };
}

export interface OAuthCallbackFailure {
  status: 'error';
  provider: string;
  error: string;
}

export type OAuthCallbackInput = OAuthCallbackSuccess | OAuthCallbackFailure;

const HTML_ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function htmlEscape(value: string): string {
  return value.replace(/[&<>"']/g, (c) => HTML_ESCAPE[c] ?? c);
}

function jsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/'/g, '\\u0027')
    .replace(/"/g, '\\u0022');
}

export function renderCallbackHtml(
  input: OAuthCallbackInput,
  targetOrigin: string,
): string {
  const payload =
    input.status === 'success'
      ? {
          type: 'oauth_callback',
          status: 'success',
          mode: input.result.mode,
          provider: input.result.provider,
          integrationId: input.result.integrationId ?? null,
          previewToken: input.result.previewToken ?? null,
          error: null,
        }
      : {
          type: 'oauth_callback',
          status: 'error',
          provider: input.provider,
          error: input.error,
        };

  const body =
    input.status === 'success'
      ? 'Connected. This window will close.'
      : 'OAuth failed: ' + htmlEscape(input.error);

  const serialized = `"${jsonForScript(payload)}"`;
  const origin = `"${jsonForScript(targetOrigin)}"`;

  // Success closes immediately. Failure delays close so the user has time
  // to read the error message — popups opened by Cafe24 Developers (private
  // app "테스트 실행") never reach our postMessage listener, so this HTML
  // body is their only feedback channel.
  const closeScript =
    input.status === 'success'
      ? 'window.close();'
      : 'setTimeout(function(){ window.close(); }, 4000);';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Integration OAuth</title></head>
<body style="font-family:system-ui,sans-serif;padding:20px">
<p>${body}</p>
<script>
  try {
    if (window.opener) {
      var payload = JSON.parse(${serialized});
      var target = JSON.parse(${origin});
      window.opener.postMessage(payload, target);
    }
  } catch (e) { /* ignore */ }
  ${closeScript}
</script>
</body></html>`;
}
