import {
  MCP_ERROR_MESSAGE_MAX_LEN,
  redactMcpSecrets,
  sanitizeMcpErrorMessage,
} from './mcp-error-codes';

describe('redactMcpSecrets', () => {
  it('URL userinfo(user:pass@host) 를 마스킹하되 scheme·호스트는 보존한다 (공용 SoT 패턴)', () => {
    const out = redactMcpSecrets(
      'connect failed https://alice:s3cr3t@mcp.example.com/rpc',
    );
    expect(out).not.toContain('s3cr3t');
    expect(out).not.toContain('alice:');
    // 공용 SECRET_LEAK_PATTERNS 가 흡수 — scheme 보존 `scheme://***@host`.
    expect(out).toContain('https://***@mcp.example.com/rpc');
  });

  it('쿼리스트링 bare token 을 마스킹하고 비-시크릿 파라미터는 보존 (MCP 전용 패턴)', () => {
    const out = redactMcpSecrets('GET /rpc?token=abc123&foo=bar failed');
    expect(out).not.toContain('abc123');
    expect(out).toContain('foo=bar');
  });

  it('Bearer 토큰을 공용 패턴으로 마스킹한다', () => {
    const out = redactMcpSecrets('401 with Bearer abcDEF123456token');
    expect(out).not.toContain('abcDEF123456token');
    expect(out).toContain('***');
  });

  it('Authorization 헤더·labelled kv 시크릿을 공용 패턴으로 마스킹한다', () => {
    expect(
      redactMcpSecrets('sent Authorization: Bearer xxxxyyyyzzzz'),
    ).not.toContain('xxxxyyyyzzzz');
    expect(redactMcpSecrets('api_key=SECRETVALUE denied')).not.toContain(
      'SECRETVALUE',
    );
    expect(redactMcpSecrets('access_token=zzz; password=pw')).not.toMatch(
      /access_token=zzz|password=pw/,
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
    expect(out).not.toContain('u:p@');
  });

  it('토큰이 clamp 경계에 걸려 반쯤 노출되지 않도록 redact 후 clamp 한다', () => {
    const longPrefix = 'x'.repeat(MCP_ERROR_MESSAGE_MAX_LEN - 20);
    const out = sanitizeMcpErrorMessage(
      `${longPrefix} access_token=SUPERSECRETVALUE1234567890`,
    );
    expect(out).not.toContain('SUPERSECRET');
    expect(out.length).toBeLessThanOrEqual(MCP_ERROR_MESSAGE_MAX_LEN);
  });

  it('non-Error / null 입력도 안전하게 처리', () => {
    expect(sanitizeMcpErrorMessage(null)).toBe('');
    expect(sanitizeMcpErrorMessage({ a: 1 })).toBe('{"a":1}');
  });
});
