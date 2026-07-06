import {
  MCP_ERROR_MESSAGE_MAX_LEN,
  MCP_REDACTED_PLACEHOLDER,
  redactMcpSecrets,
  sanitizeMcpErrorMessage,
} from './mcp-error-codes';

describe('redactMcpSecrets', () => {
  it('URL userinfo(user:pass@host) 를 마스킹한다', () => {
    expect(
      redactMcpSecrets(
        'connect failed https://alice:s3cr3t@mcp.example.com/rpc',
      ),
    ).toBe(
      `connect failed https://${MCP_REDACTED_PLACEHOLDER}@mcp.example.com/rpc`,
    );
  });

  it('Bearer 토큰을 마스킹한다 (대소문자 무관)', () => {
    expect(redactMcpSecrets('401 with Bearer abcDEF123456._~-token')).toBe(
      `401 with Bearer ${MCP_REDACTED_PLACEHOLDER}`,
    );
    expect(redactMcpSecrets('header bearer AAAABBBBCCCC')).toBe(
      `header bearer ${MCP_REDACTED_PLACEHOLDER}`,
    );
  });

  it('Authorization / X-Api-Key 헤더 할당을 마스킹한다', () => {
    expect(
      redactMcpSecrets('sent Authorization: Bearer xxxxxxxxyyyy'),
    ).toContain(MCP_REDACTED_PLACEHOLDER);
    expect(redactMcpSecrets('X-Api-Key: live_key_12345')).toBe(
      `X-Api-Key: ${MCP_REDACTED_PLACEHOLDER}`,
    );
  });

  it('query/kv 형태의 라벨된 시크릿을 마스킹한다', () => {
    expect(redactMcpSecrets('GET /rpc?token=abc123&foo=bar failed')).toBe(
      `GET /rpc?token=${MCP_REDACTED_PLACEHOLDER}&foo=bar failed`,
    );
    expect(redactMcpSecrets('api_key=SECRETVALUE denied')).toBe(
      `api_key=${MCP_REDACTED_PLACEHOLDER} denied`,
    );
    expect(redactMcpSecrets('access_token=zzz; password=pw')).toBe(
      `access_token=${MCP_REDACTED_PLACEHOLDER}; password=${MCP_REDACTED_PLACEHOLDER}`,
    );
  });

  it('시크릿이 없는 일반 프로즈는 그대로 보존한다', () => {
    const msg = 'tools/list failed: upstream returned 503 Service Unavailable';
    expect(redactMcpSecrets(msg)).toBe(msg);
  });
});

describe('sanitizeMcpErrorMessage', () => {
  it('제어문자 제거 + redaction + clamp 를 함께 적용한다', () => {
    const out = sanitizeMcpErrorMessage(
      new Error('boom\n\tat https://u:p@h/x?token=leaked'),
    );
    expect(out).not.toContain('\n');
    expect(out).not.toContain('\t');
    expect(out).not.toContain('leaked');
    expect(out).not.toContain('u:p@h');
    expect(out).toContain(MCP_REDACTED_PLACEHOLDER);
  });

  it('토큰이 clamp 경계에 걸려 반쯤 노출되지 않도록 redact 후 clamp 한다', () => {
    const longPrefix = 'x'.repeat(MCP_ERROR_MESSAGE_MAX_LEN - 20);
    const out = sanitizeMcpErrorMessage(
      `${longPrefix} token=SUPERSECRETVALUE1234567890`,
    );
    expect(out).not.toContain('SUPERSECRET');
    expect(out.length).toBeLessThanOrEqual(MCP_ERROR_MESSAGE_MAX_LEN);
  });

  it('non-Error / null 입력도 안전하게 처리', () => {
    expect(sanitizeMcpErrorMessage(null)).toBe('');
    expect(sanitizeMcpErrorMessage({ a: 1 })).toBe('{"a":1}');
  });
});
