import {
  findService,
  findVariant,
  listSecretKeys,
  maskCredentials,
  validateCredentials,
} from './service-registry';

describe('service-registry — mcp service', () => {
  it('registers the mcp service with three auth variants', () => {
    const service = findService('mcp');
    expect(service).toBeDefined();
    expect(service?.name).toBe('MCP Server');
    const authTypes = service?.authVariants.map((v) => v.authType).sort();
    expect(authTypes).toEqual(['api_key', 'bearer_token', 'none']);
  });

  it('bearer_token variant declares { url, default_headers, token } fields', () => {
    const variant = findVariant('mcp', 'bearer_token');
    expect(variant).toBeDefined();
    const keys = variant?.fields.map((f) => f.key).sort();
    expect(keys).toEqual(['default_headers', 'token', 'url']);
  });

  it('api_key variant declares { url, default_headers, header_name, value } fields', () => {
    const variant = findVariant('mcp', 'api_key');
    const keys = variant?.fields.map((f) => f.key).sort();
    expect(keys).toEqual(['default_headers', 'header_name', 'url', 'value']);
  });

  it('none variant declares { url, default_headers } only', () => {
    const variant = findVariant('mcp', 'none');
    const keys = variant?.fields.map((f) => f.key).sort();
    expect(keys).toEqual(['default_headers', 'url']);
  });

  it('marks token (bearer_token) and value (api_key) as secrets', () => {
    expect(listSecretKeys('mcp', 'bearer_token')).toEqual(['token']);
    expect(listSecretKeys('mcp', 'api_key')).toEqual(['value']);
    expect(listSecretKeys('mcp', 'none')).toEqual([]);
  });

  it('validates required url field for every variant', () => {
    expect(
      validateCredentials('mcp', 'bearer_token', { token: 'abc' }),
    ).toEqual(['url is required']);
    expect(
      validateCredentials('mcp', 'api_key', {
        header_name: 'X-Api-Key',
        value: 'abc',
      }),
    ).toEqual(['url is required']);
    expect(validateCredentials('mcp', 'none', {})).toEqual(['url is required']);
  });

  it('passes validation for fully-specified credentials', () => {
    expect(
      validateCredentials('mcp', 'bearer_token', {
        url: 'https://mcp.example.com',
        token: 'secret',
      }),
    ).toEqual([]);
    expect(
      validateCredentials('mcp', 'api_key', {
        url: 'https://mcp.example.com',
        header_name: 'X-Api-Key',
        value: 'secret',
      }),
    ).toEqual([]);
    expect(
      validateCredentials('mcp', 'none', {
        url: 'https://mcp.example.com',
      }),
    ).toEqual([]);
  });

  it('reports missing required credential fields by key', () => {
    const errors = validateCredentials('mcp', 'api_key', {
      url: 'https://mcp.example.com',
    });
    expect(errors).toContain('header_name is required');
    expect(errors).toContain('value is required');
  });

  it('masks the secret token but keeps url visible', () => {
    const masked = maskCredentials(
      {
        url: 'https://mcp.example.com',
        token: 'super-secret',
      },
      'mcp',
      'bearer_token',
    );
    expect(masked.url).toBe('https://mcp.example.com');
    expect(masked.token).toBe('********');
  });

  it('rejects unknown auth combinations', () => {
    expect(findVariant('mcp', 'oauth2')).toBeUndefined();
    expect(validateCredentials('mcp', 'oauth2', {})).toEqual([
      'Unknown service/auth combination: mcp/oauth2',
    ]);
  });
});

describe('service-registry — makeshop service', () => {
  it('registers makeshop with a single oauth2 variant + makeshop oauthProvider', () => {
    const service = findService('makeshop');
    expect(service).toBeDefined();
    expect(service?.name).toBe('MakeShop');
    expect(service?.oauthProvider).toBe('makeshop');
    expect(service?.authVariants.map((v) => v.authType)).toEqual(['oauth2']);
  });

  it('supports background token auto-refresh (auth-code + refresh rotation)', () => {
    expect(findService('makeshop')?.supportsTokenAutoRefresh).toBe(true);
  });

  it('declares the oauth field set — NO app_type (confidential single form)', () => {
    const variant = findVariant('makeshop', 'oauth2');
    const keys = variant?.fields.map((f) => f.key).sort();
    expect(keys).toEqual([
      'access_token',
      'client_id',
      'client_secret',
      'expires_at',
      'refresh_token',
      'scopes',
      'shop_uid',
    ]);
    expect(keys).not.toContain('app_type');
  });

  it('marks client_secret / access_token / refresh_token as secrets (shop_uid is not)', () => {
    const secrets = listSecretKeys('makeshop', 'oauth2').sort();
    expect(secrets).toEqual(['access_token', 'client_secret', 'refresh_token']);
    expect(secrets).not.toContain('shop_uid');
  });

  it('requires shop_uid / client_id / client_secret / access_token / refresh_token / scopes / expires_at', () => {
    const errors = validateCredentials('makeshop', 'oauth2', {});
    expect(errors).toContain('shop_uid is required');
    expect(errors).toContain('client_id is required');
    expect(errors).toContain('client_secret is required');
    expect(errors).toContain('access_token is required');
    expect(errors).toContain('refresh_token is required');
    expect(errors).toContain('scopes is required');
    expect(errors).toContain('expires_at is required');
  });

  it('exposes <group>.read / <group>.write scope presets with NO requiresApproval flags', () => {
    const scopes = findService('makeshop')?.scopes ?? [];
    const values = scopes.map((s) => s.value);
    expect(values).toEqual(
      expect.arrayContaining([
        'store.read',
        'store.write',
        'product.read',
        'product.write',
        'order.read',
        'order.write',
        'member.read',
        'member.write',
        'board.read',
        'board.write',
        'benefit.read',
        'benefit.write',
      ]),
    );
    // makeshop has no restricted (partner-approval) scope tier.
    expect(scopes.some((s) => s.requiresApproval)).toBe(false);
  });
});
