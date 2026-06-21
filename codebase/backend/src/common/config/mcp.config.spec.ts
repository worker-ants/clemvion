import { mcpConfig } from './mcp.config';

/**
 * refactor M-6 (review W2) — `mcp` namespace 의 env 파싱 계약을 고정.
 * raw env 문자열 → typed(number|undefined / boolean) 변환이 config 레이어에 있으므로
 * 그 파싱 규칙(`'true'`/`'1'` 만 ON, 숫자 외/미설정 → undefined)을 여기서 단언한다.
 */
describe('mcpConfig (refactor M-6 — env 파싱)', () => {
  const KEYS = [
    'MCP_ALLOW_INSECURE_URL',
    'MCP_MAX_CONCURRENT_CONNECTIONS',
    'MCP_CONNECT_TIMEOUT_MS',
  ] as const;
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('allowInsecureUrl: "true"/"1" 만 ON, 그 외·미설정은 OFF', () => {
    process.env.MCP_ALLOW_INSECURE_URL = 'true';
    expect(mcpConfig().allowInsecureUrl).toBe(true);
    process.env.MCP_ALLOW_INSECURE_URL = '1';
    expect(mcpConfig().allowInsecureUrl).toBe(true);
    process.env.MCP_ALLOW_INSECURE_URL = 'yes-please';
    expect(mcpConfig().allowInsecureUrl).toBe(false);
    delete process.env.MCP_ALLOW_INSECURE_URL;
    expect(mcpConfig().allowInsecureUrl).toBe(false);
  });

  it('max/timeout: 숫자 파싱, 미설정·비숫자는 undefined', () => {
    process.env.MCP_MAX_CONCURRENT_CONNECTIONS = '5';
    process.env.MCP_CONNECT_TIMEOUT_MS = '15000';
    let c = mcpConfig();
    expect(c.maxConcurrentConnections).toBe(5);
    expect(c.connectTimeoutMs).toBe(15000);

    delete process.env.MCP_MAX_CONCURRENT_CONNECTIONS;
    process.env.MCP_CONNECT_TIMEOUT_MS = 'abc';
    c = mcpConfig();
    expect(c.maxConcurrentConnections).toBeUndefined();
    expect(c.connectTimeoutMs).toBeUndefined();
  });
});
