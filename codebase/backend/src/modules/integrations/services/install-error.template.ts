/**
 * Renders the HTML page shown when Cafe24's "테스트 실행" / "앱으로 가기"
 * call to the App URL fails (404 / 403 / 400). The page is opened directly
 * in the user's browser by Cafe24, so a JSON body is unfriendly — render a
 * minimal styled page with the error code, message, and a recovery hint.
 *
 * Inputs are HTML-escaped before interpolation; the template never
 * interpolates anything that touches DOM-as-attribute. Inline CSS only
 * (no external assets — this endpoint is hit from inside Cafe24 admin).
 */

import { htmlEscape } from './oauth-callback.template';

export function renderInstallErrorHtml(code: string, message: string): string {
  const safeCode = htmlEscape(code);
  const safeMessage = htmlEscape(message);
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <title>설치 실패 — ${safeCode}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root { color-scheme: light dark; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        max-width: 640px;
        margin: 60px auto;
        padding: 0 24px;
        line-height: 1.6;
        color: #1a1a1a;
        background: #fafafa;
      }
      @media (prefers-color-scheme: dark) {
        body { color: #e5e5e5; background: #181818; }
        .card { background: #222; border-color: #333; }
        code { background: #2a2a2a; }
      }
      .card {
        background: #fff;
        border: 1px solid #e0e0e0;
        border-radius: 12px;
        padding: 24px;
      }
      h1 { font-size: 18px; margin: 0 0 12px; color: #c0392b; }
      p { margin: 8px 0; font-size: 14px; }
      code {
        background: #f0f0f0;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 13px;
      }
      ul { font-size: 13px; padding-left: 20px; }
      li { margin: 4px 0; }
      .muted { color: #888; font-size: 12px; margin-top: 16px; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Cafe24 앱 설치 실패</h1>
      <p><strong>Error code:</strong> <code>${safeCode}</code></p>
      <p>${safeMessage}</p>
      <p style="margin-top:16px;"><strong>해결 방법:</strong></p>
      <ul>
        <li>Cafe24 Developers Console 의 앱 정보 화면을 열고, 현재 App URL 이 우리 서비스의 통합 상세 페이지에 표시된 URL 과 일치하는지 확인하세요.</li>
        <li>일치하지 않으면 통합 상세 페이지의 URL 로 갱신한 뒤 "테스트 실행" 을 다시 클릭하세요.</li>
        <li>통합이 삭제된 상태라면 통합을 새로 등록하세요.</li>
      </ul>
      <p class="muted">이 창은 자동으로 닫히지 않습니다. 메시지를 확인한 뒤 직접 닫아 주세요.</p>
    </div>
  </body>
</html>`;
}
