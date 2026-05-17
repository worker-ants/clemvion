import { redactConfig } from './redact';

/**
 * redactConfig lints out likely secret fields before config ever reaches the
 * LLM (via the system-prompt snapshot or the `get_current_workflow` tool
 * response). These tests lock in the key-pattern coverage so silent drift
 * (e.g. a rename loosening the regex) would fail CI.
 */
describe('redactConfig', () => {
  it('redacts common credential keys at any nesting level and case', () => {
    const input = {
      apiKey: 'sk-123',
      api_key: 'sk-456',
      'api-key': 'sk-789',
      Authorization: 'Bearer abc',
      PASSWORD: 'hunter2',
      passwd: 'legacy',
      pwd: 'short',
      token: 'tkn',
      bearer: 'b',
      credential: 'cred',
      privateKey: '---BEGIN',
      private_key: '---BEGIN',
      clientSecret: 'cs',
      client_secret: 'cs',
      nested: {
        headers: { authorization: 'Bearer zzz' },
        list: [{ secret: 'nope' }],
      },
      safe: 'keep-me',
    };

    const out = redactConfig(input);

    expect(out.apiKey).toBe('[REDACTED]');
    expect(out.api_key).toBe('[REDACTED]');
    expect(out['api-key']).toBe('[REDACTED]');
    expect(out.Authorization).toBe('[REDACTED]');
    expect(out.PASSWORD).toBe('[REDACTED]');
    expect(out.passwd).toBe('[REDACTED]');
    expect(out.pwd).toBe('[REDACTED]');
    expect(out.token).toBe('[REDACTED]');
    expect(out.bearer).toBe('[REDACTED]');
    expect(out.credential).toBe('[REDACTED]');
    expect(out.privateKey).toBe('[REDACTED]');
    expect(out.private_key).toBe('[REDACTED]');
    expect(out.clientSecret).toBe('[REDACTED]');
    expect(out.client_secret).toBe('[REDACTED]');
    expect(out.nested.headers.authorization).toBe('[REDACTED]');
    expect(out.nested.list[0].secret).toBe('[REDACTED]');
    expect(out.safe).toBe('keep-me');
  });

  it('preserves {{ ... }} expression references even under secret keys', () => {
    // integration 참조나 runtime expression 은 실제 secret 이 아니므로 가리면
    // 런타임에 값을 쓸 수 없게 된다. LLM 이 표현식을 관찰해야 downstream 설계가
    // 가능하므로 통과시켜야 한다.
    const out = redactConfig({
      apiKey: '{{ $integration.shopApi.apiKey }}',
      token: '{{ $env.TOKEN }}',
    });
    expect(out.apiKey).toBe('{{ $integration.shopApi.apiKey }}');
    expect(out.token).toBe('{{ $env.TOKEN }}');
  });

  it('is null-safe and returns primitives unchanged', () => {
    expect(redactConfig(null)).toBeNull();
    expect(redactConfig(undefined)).toBeUndefined();
    expect(redactConfig(42)).toBe(42);
    expect(redactConfig('plain string')).toBe('plain string');
    expect(redactConfig([])).toEqual([]);
    expect(redactConfig({})).toEqual({});
  });

  it('leaves empty string values alone (no "[REDACTED]" noise for missing fields)', () => {
    // 값이 비어 있으면 그 자리에 credential 도 없다는 의미 — 굳이 가릴 필요가
    // 없고, "[REDACTED]" 로 덮어쓰면 빈 필드와 실제 secret 필드의 구분이
    // 사라진다.
    const out = redactConfig({ apiKey: '', token: '' });
    expect(out.apiKey).toBe('');
    expect(out.token).toBe('');
  });
});
