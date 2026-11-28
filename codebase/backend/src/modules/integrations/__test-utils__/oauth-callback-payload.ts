/**
 * 콜백 HTML 의 `var payload = JSON.parse("…")` 인자(postMessage payload)를 꺼낸다.
 * 템플릿은 JSON 을 `\uXXXX` 로 이스케이프한 문자열 리터럴로 싣는다. 리터럴을 한 번 풀고 다시 JSON 으로 읽는다.
 */
export function readCallbackPayload(html: string): unknown {
  const match = html.match(/var payload = JSON\.parse\("([^"]*)"\);/);
  if (!match) throw new Error('payload literal not found');
  return JSON.parse(JSON.parse(`"${match[1]}"`) as string);
}
