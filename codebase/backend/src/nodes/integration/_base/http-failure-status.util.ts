/**
 * Cafe24 · MakeShop 응답의 HTTP 상태가 실패인지 판정한다.
 * 2xx 만 성공이고 1xx · 3xx · 4xx · 5xx 와 비정상 값(0 등)은 실패다.
 * 핸들러와 MCP provider 가 같은 판정을 쓰도록 한 곳에 둔다.
 */
export function isHttpFailureStatus(status: number): boolean {
  return status < 200 || status >= 300;
}
