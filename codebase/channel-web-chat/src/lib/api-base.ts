// `apiBase` 문자열의 단일 정규화 규칙. 종전엔 같은 `replace(/\/$/, "")` 가 세 곳
// (`eia-client.joinUrl` · `use-widget.fetchEmbedConfig` · 세션 origin 비교)에 독립 존재해,
// 규칙이 바뀌면 한 곳만 고치고 나머지를 놓칠 drift 위험이 있었다(ai-review maintainability W1).
//
// **경로는 보존한다**: `apiBase` 는 `/api` 등 경로 포함이 정상이므로(direct-load 쿼리 하드닝
// 참고) origin 만 남기면 `…/api` 와 `…/api-v2` 를 같다고 보게 된다 — 세션 origin 비교에서는
// 그것이 곧 토큰 오전송이다.
export function stripTrailingSlash(base: string): string {
  return base.replace(/\/$/, "");
}
