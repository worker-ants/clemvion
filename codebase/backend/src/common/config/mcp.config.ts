import { registerAs } from '@nestjs/config';

/**
 * MCP 클라이언트 연결 튜닝 + insecure-URL escape hatch namespace (refactor M-6 — Option B).
 *
 * 기존 `McpClientService` 생성자의 `process.env.MCP_MAX_CONCURRENT_CONNECTIONS`/
 * `MCP_CONNECT_TIMEOUT_MS` 와 `isInsecureUrlAllowed()` 의 `MCP_ALLOW_INSECURE_URL`
 * 직접 접근을 ConfigService 로 중앙화한다.
 *
 * 파싱 책임을 config 레이어에 두어 `oauth`/`interaction`/`llm` namespace 와 타입 일관성을
 * 맞춘다 (review W2):
 * - timeout/concurrency 는 `number | undefined`(미설정/비숫자 → undefined). 소비자는
 *   `(값) || DEFAULT_*` 로 폴백하며 `'0'`→DEFAULT 등 기존 `||` 의미가 보존된다 (DEFAULT 상수
 *   단일 source 는 `mcp-client.service.ts` 잔류).
 * - `allowInsecureUrl`: SSRF 방어(https-only + 호스트 블록리스트)를 우회하는 escape hatch
 *   `boolean`. `'true'`/`'1'` 만 ON (기존 규칙). production-guards 가 `NODE_ENV=production`
 *   부팅을 fail-closed 로 별도 차단한다.
 */
export interface McpEnvConfig {
  maxConcurrentConnections: number | undefined;
  connectTimeoutMs: number | undefined;
  allowInsecureUrl: boolean;
}

function parseOptionalNumber(raw: string | undefined): number | undefined {
  if (raw === undefined || raw === '') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

export const mcpConfig = registerAs(
  'mcp',
  (): McpEnvConfig => ({
    maxConcurrentConnections: parseOptionalNumber(
      process.env.MCP_MAX_CONCURRENT_CONNECTIONS,
    ),
    connectTimeoutMs: parseOptionalNumber(process.env.MCP_CONNECT_TIMEOUT_MS),
    allowInsecureUrl:
      process.env.MCP_ALLOW_INSECURE_URL === 'true' ||
      process.env.MCP_ALLOW_INSECURE_URL === '1',
  }),
);
