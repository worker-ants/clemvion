import { registerAs } from '@nestjs/config';

/**
 * MCP 클라이언트 연결 튜닝 + insecure-URL escape hatch namespace (refactor M-6 — Option B).
 *
 * 기존 `McpClientService` 생성자의 `process.env.MCP_MAX_CONCURRENT_CONNECTIONS`/
 * `MCP_CONNECT_TIMEOUT_MS` 와 `isInsecureUrlAllowed()` 의 `MCP_ALLOW_INSECURE_URL`
 * 직접 접근을 ConfigService 로 중앙화한다.
 *
 * 동작 보존 계약:
 * - timeout/concurrency 는 raw env(`string | undefined`)를 그대로 노출 — 소비자가
 *   기존 `Number(...) || DEFAULT_*` 폴백을 적용해 byte-identical 동작을 유지한다
 *   (DEFAULT 상수의 단일 source 는 `mcp-client.service.ts` 잔류).
 * - `allowInsecureUrl`: SSRF 방어(https-only + 호스트 블록리스트)를 우회하는 escape hatch
 *   플래그. raw env(`string | undefined`)를 노출하고 `'true'`/`'1'` 만 ON 으로 보는 파싱은
 *   소비자(`McpClientService.allowInsecureUrl` getter)가 수행한다(기존 규칙 보존). production-guards
 *   가 `NODE_ENV=production` 부팅을 fail-closed 로 별도 차단한다.
 */
export const mcpConfig = registerAs('mcp', () => ({
  maxConcurrentConnections: process.env.MCP_MAX_CONCURRENT_CONNECTIONS,
  connectTimeoutMs: process.env.MCP_CONNECT_TIMEOUT_MS,
  allowInsecureUrl: process.env.MCP_ALLOW_INSECURE_URL,
}));
