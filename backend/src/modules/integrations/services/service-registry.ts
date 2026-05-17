/**
 * Service registry: authentication schema and scope metadata for
 * each supported integration service. Mirrors spec/2-navigation/4-integration.md §5.
 *
 * Credential schemas describe the shape of `Integration.credentials` JSONB.
 * Fields marked `secret: true` are write-only — responses mask them.
 */

export type AuthType =
  | 'oauth2'
  | 'api_key'
  | 'bearer_token'
  | 'basic'
  | 'connection_string'
  | 'smtp'
  | 'webhook_outbound'
  | 'none';

export interface CredentialField {
  key: string;
  label: string;
  type: 'string' | 'number' | 'enum' | 'record';
  required: boolean;
  secret?: boolean;
  enum?: readonly string[];
  default?: string | number;
  placeholder?: string;
  description?: string;
}

export interface AuthVariant {
  authType: AuthType;
  label: string;
  fields: CredentialField[];
}

export interface ScopeOption {
  value: string;
  label: string;
  recommended?: boolean;
}

export interface ServiceDefinition {
  type: string;
  name: string;
  authVariants: AuthVariant[];
  scopes?: ScopeOption[];
  /** OAuth provider identifier, if any variant is oauth2 */
  oauthProvider?: 'google' | 'github' | 'cafe24';
  /**
   * Whether this service supports background token auto-refresh.
   * True means the provider issues a `refresh_token` AND we run a refresh
   * mechanism for it (proactive or scheduled) — so the user doesn't need
   * to take action on `token_expires_at` countdown.
   *
   * Currently `cafe24` (background queue + proactive `ensureFreshToken`)
   * and `google` (refresh_token at OAuth callback, on-demand refresh on
   * 401). `github` is intentionally false — its OAuth tokens are long-
   * lived and don't issue refresh_token (spec §10.3 Refresh: ✗).
   *
   * Surfaced to the client as `IntegrationDto.autoRefresh: boolean`
   * (derived, not a DB column). Used for UI branching: attention/expiring
   * 술어 제외, 상세 페이지 헤더의 "Auto-renews" 보조 라벨, Reauthorize
   * hover 안내. spec/2-navigation/4-integration.md §9.1 + Rationale
   * "자동 갱신 통합을 attention 술어에서 제외 (2026-05-17)".
   */
  supportsTokenAutoRefresh?: boolean;
}

/**
 * Cafe24 — Korean e-commerce SaaS. Same Integration drives both the
 * `cafe24` node and the AI Agent MCP tool surface (Internal Bridge,
 * spec/5-system/11-mcp-client.md §2.3). OAuth flow is mall_id-dependent
 * — see spec/2-navigation/4-integration.md §3.2 / §5.8 / §10.3.
 */
const CAFE24_OAUTH_FIELDS: CredentialField[] = [
  {
    key: 'mall_id',
    label: 'Mall ID',
    type: 'string',
    required: true,
    placeholder: 'myshop',
    description:
      'Cafe24 쇼핑몰 식별자. base URL `https://{mall_id}.cafe24api.com` 의 prefix',
  },
  {
    key: 'app_type',
    label: 'App Type',
    type: 'enum',
    required: true,
    enum: ['public', 'private'] as const,
    default: 'public',
    description:
      'public=Cafe24 앱스토어 앱 (서버 env client_id/secret) / private=사용자 자체 발급',
  },
  {
    key: 'client_id',
    label: 'Client ID',
    type: 'string',
    required: false,
    description: 'app_type=private 한정 — 자체 발급 앱의 OAuth client_id',
  },
  {
    key: 'client_secret',
    label: 'Client Secret',
    type: 'string',
    required: false,
    secret: true,
    description: 'app_type=private 한정 — 자체 발급 앱의 OAuth client_secret',
  },
  {
    key: 'access_token',
    label: 'Access Token',
    type: 'string',
    // System-managed — populated by the OAuth callback handler, never
    // typed in by the user. Marked `required: false` so the Step 2 form
    // doesn't gate the [Connect with Cafe24] button on pre-existing
    // values.
    required: false,
    secret: true,
  },
  {
    key: 'refresh_token',
    label: 'Refresh Token',
    type: 'string',
    required: false,
    secret: true,
  },
  {
    key: 'cafe24_operator_id',
    label: 'Operator',
    type: 'string',
    required: false,
    description:
      'Cafe24 응답 body 의 `user_id` 매핑 — 내부 User.id 와 명명 충돌 회피 (OAuth 콜백에서 자동 채워짐)',
  },
];

const CAFE24_SCOPES: ScopeOption[] = [
  // Default-recommended is intentionally minimal because Cafe24 enforces a
  // *pre-registered scope whitelist* on the app side — if a requested scope
  // is absent from the Cafe24 Developers app's permission settings, the
  // *entire* OAuth call fails with `invalid_scope`. Defaulting to 1 scope
  // lets the user verify their app's scope wiring incrementally instead of
  // hitting an all-or-nothing rejection on first attempt.
  { value: 'mall.read_product', label: '상품 조회', recommended: true },
  { value: 'mall.write_product', label: '상품 수정' },
  { value: 'mall.read_order', label: '주문 조회' },
  { value: 'mall.write_order', label: '주문 수정' },
  { value: 'mall.read_customer', label: '회원 조회' },
  { value: 'mall.write_customer', label: '회원 수정' },
  { value: 'mall.read_category', label: '카테고리 조회' },
  { value: 'mall.write_category', label: '카테고리 수정' },
  { value: 'mall.read_promotion', label: '프로모션 조회' },
  { value: 'mall.write_promotion', label: '프로모션 수정' },
  { value: 'mall.read_mileage', label: '적립금 조회' },
  { value: 'mall.write_mileage', label: '적립금 수정' },
  { value: 'mall.read_shipping', label: '배송 조회' },
  { value: 'mall.write_shipping', label: '배송 수정' },
  { value: 'mall.read_salesreport', label: '매출 통계 조회' },
  { value: 'mall.read_translation', label: '번역 조회' },
  { value: 'mall.write_translation', label: '번역 수정' },
  { value: 'mall.read_notification', label: '알림 조회' },
  { value: 'mall.write_notification', label: '알림 발송' },
  // Less common — kept under the "고급" toggle in the UI
  { value: 'mall.read_application', label: '앱 관리 조회' },
  { value: 'mall.write_application', label: '앱 관리 수정' },
  { value: 'mall.read_store', label: '상점 정보 조회' },
  { value: 'mall.write_store', label: '상점 정보 수정' },
  { value: 'mall.read_design', label: '디자인 조회' },
  { value: 'mall.write_design', label: '디자인 수정' },
  { value: 'mall.read_community', label: '게시판 조회' },
  { value: 'mall.write_community', label: '게시판 수정' },
  { value: 'mall.read_collection', label: '판매분류 조회' },
  { value: 'mall.write_collection', label: '판매분류 수정' },
  { value: 'mall.read_supply', label: '공급사 조회' },
  { value: 'mall.write_supply', label: '공급사 수정' },
  { value: 'mall.read_personal', label: '개인화 조회' },
  { value: 'mall.write_personal', label: '개인화 수정' },
  { value: 'mall.read_privacy', label: '개인정보 조회' },
  { value: 'mall.write_privacy', label: '개인정보 수정' },
];

const HTTP_COMMON: CredentialField[] = [
  {
    key: 'base_url',
    label: 'Base URL',
    type: 'string',
    required: false,
    placeholder: 'https://api.example.com',
  },
];

/**
 * Fields shared by every MCP auth variant: the server URL and optional
 * default headers. Hoisted so the three auth variants stay structurally
 * identical when we add or rename a shared field.
 */
const MCP_URL_FIELD: CredentialField = {
  key: 'url',
  label: 'Server URL',
  type: 'string',
  required: true,
  placeholder: 'https://mcp.example.com',
  description: 'Streamable HTTP endpoint of the MCP server. HTTPS is required.',
};

const MCP_DEFAULT_HEADERS_FIELD: CredentialField = {
  key: 'default_headers',
  label: 'Default Headers',
  type: 'record',
  required: false,
};

function buildMcpAuthVariants(): AuthVariant[] {
  return [
    {
      authType: 'bearer_token',
      label: 'Bearer Token',
      fields: [
        MCP_URL_FIELD,
        {
          key: 'token',
          label: 'Bearer Token',
          type: 'string',
          required: true,
          secret: true,
        },
        MCP_DEFAULT_HEADERS_FIELD,
      ],
    },
    {
      authType: 'api_key',
      label: 'API Key (Custom Header)',
      fields: [
        MCP_URL_FIELD,
        {
          key: 'header_name',
          label: 'Header Name',
          type: 'string',
          required: true,
          placeholder: 'X-Api-Key',
        },
        {
          key: 'value',
          label: 'API Key',
          type: 'string',
          required: true,
          secret: true,
        },
        MCP_DEFAULT_HEADERS_FIELD,
      ],
    },
    {
      authType: 'none',
      label: 'No Authentication',
      fields: [MCP_URL_FIELD, MCP_DEFAULT_HEADERS_FIELD],
    },
  ];
}

export const SERVICE_REGISTRY: ServiceDefinition[] = [
  {
    type: 'google',
    name: 'Google',
    oauthProvider: 'google',
    supportsTokenAutoRefresh: true,
    authVariants: [
      {
        authType: 'oauth2',
        label: 'OAuth 2.0',
        fields: [
          {
            key: 'access_token',
            label: 'Access Token',
            type: 'string',
            required: true,
            secret: true,
          },
          {
            key: 'refresh_token',
            label: 'Refresh Token',
            type: 'string',
            required: true,
            secret: true,
          },
          {
            key: 'account_email',
            label: 'Account Email',
            type: 'string',
            required: true,
          },
        ],
      },
    ],
    scopes: [
      { value: 'https://www.googleapis.com/auth/drive', label: 'Drive' },
      {
        value: 'https://www.googleapis.com/auth/spreadsheets',
        label: 'Sheets',
      },
      {
        value: 'https://www.googleapis.com/auth/gmail.send',
        label: 'Gmail (send)',
      },
      { value: 'https://www.googleapis.com/auth/calendar', label: 'Calendar' },
    ],
  },
  {
    type: 'github',
    name: 'GitHub',
    oauthProvider: 'github',
    authVariants: [
      {
        authType: 'oauth2',
        label: 'OAuth 2.0',
        fields: [
          {
            key: 'access_token',
            label: 'Access Token',
            type: 'string',
            required: true,
            secret: true,
          },
          { key: 'login', label: 'Login', type: 'string', required: true },
        ],
      },
      {
        authType: 'bearer_token',
        label: 'Personal Access Token',
        fields: [
          {
            key: 'token',
            label: 'Personal Access Token',
            type: 'string',
            required: true,
            secret: true,
          },
        ],
      },
    ],
    scopes: [
      { value: 'repo', label: 'Repository access', recommended: true },
      { value: 'read:org', label: 'Read organization', recommended: true },
      { value: 'workflow', label: 'Actions workflows' },
      { value: 'gist', label: 'Gists' },
    ],
  },
  {
    type: 'http',
    name: 'HTTP/REST',
    authVariants: [
      {
        authType: 'api_key',
        label: 'API Key',
        fields: [
          ...HTTP_COMMON,
          {
            key: 'location',
            label: 'Location',
            type: 'enum',
            required: true,
            enum: ['header', 'query'] as const,
            default: 'header',
          },
          {
            key: 'key_name',
            label: 'Key Name',
            type: 'string',
            required: true,
            placeholder: 'X-Api-Key',
          },
          {
            key: 'value',
            label: 'API Key',
            type: 'string',
            required: true,
            secret: true,
          },
        ],
      },
      {
        authType: 'bearer_token',
        label: 'Bearer Token',
        fields: [
          ...HTTP_COMMON,
          {
            key: 'token',
            label: 'Token',
            type: 'string',
            required: true,
            secret: true,
          },
        ],
      },
      {
        authType: 'basic',
        label: 'Basic Auth',
        fields: [
          ...HTTP_COMMON,
          {
            key: 'username',
            label: 'Username',
            type: 'string',
            required: true,
          },
          {
            key: 'password',
            label: 'Password',
            type: 'string',
            required: true,
            secret: true,
          },
        ],
      },
    ],
  },
  {
    type: 'database',
    name: 'Database',
    authVariants: [
      {
        authType: 'connection_string',
        label: 'Direct Connection',
        fields: [
          {
            key: 'driver',
            label: 'Driver',
            type: 'enum',
            required: true,
            enum: ['postgres', 'mysql'] as const,
            default: 'postgres',
          },
          {
            key: 'host',
            label: 'Host',
            type: 'string',
            required: true,
            placeholder: 'db.example.com',
          },
          {
            key: 'port',
            label: 'Port',
            type: 'number',
            required: true,
            default: 5432,
          },
          {
            key: 'database',
            label: 'Database',
            type: 'string',
            required: true,
          },
          {
            key: 'username',
            label: 'Username',
            type: 'string',
            required: true,
          },
          {
            key: 'password',
            label: 'Password',
            type: 'string',
            required: true,
            secret: true,
          },
          {
            key: 'ssl',
            label: 'SSL Mode',
            type: 'enum',
            required: true,
            enum: ['disable', 'require', 'verify-full'] as const,
            default: 'require',
          },
        ],
      },
    ],
  },
  {
    type: 'email',
    name: 'Email (SMTP)',
    authVariants: [
      {
        authType: 'smtp',
        label: 'SMTP',
        fields: [
          {
            key: 'host',
            label: 'SMTP Host',
            type: 'string',
            required: true,
            placeholder: 'smtp.example.com',
          },
          {
            key: 'port',
            label: 'Port',
            type: 'number',
            required: true,
            default: 587,
          },
          {
            key: 'secure',
            label: 'Security',
            type: 'enum',
            required: true,
            enum: ['none', 'starttls', 'tls'] as const,
            default: 'starttls',
          },
          {
            key: 'username',
            label: 'Username',
            type: 'string',
            required: true,
          },
          {
            key: 'password',
            label: 'Password',
            type: 'string',
            required: true,
            secret: true,
          },
          {
            key: 'default_from',
            label: 'Default From',
            type: 'string',
            required: true,
            placeholder: 'no-reply@example.com',
          },
        ],
      },
    ],
  },
  {
    type: 'mcp',
    name: 'MCP Server',
    authVariants: buildMcpAuthVariants(),
  },
  {
    type: 'cafe24',
    name: 'Cafe24',
    oauthProvider: 'cafe24',
    supportsTokenAutoRefresh: true,
    authVariants: [
      {
        authType: 'oauth2',
        label: 'OAuth 2.0',
        fields: CAFE24_OAUTH_FIELDS,
      },
    ],
    scopes: CAFE24_SCOPES,
  },
  {
    type: 'webhook',
    name: 'Webhook (Outbound)',
    authVariants: [
      {
        authType: 'webhook_outbound',
        label: 'Outbound Webhook',
        fields: [
          {
            key: 'url',
            label: 'Target URL',
            type: 'string',
            required: true,
            placeholder: 'https://hooks.example.com/receive',
          },
          {
            key: 'method',
            label: 'HTTP Method',
            type: 'enum',
            required: true,
            enum: ['POST', 'PUT', 'PATCH'] as const,
            default: 'POST',
          },
          {
            key: 'default_headers',
            label: 'Default Headers',
            type: 'record',
            required: false,
          },
          {
            key: 'signing_secret',
            label: 'Signing Secret',
            type: 'string',
            required: false,
            secret: true,
          },
          {
            key: 'signature_header',
            label: 'Signature Header',
            type: 'string',
            required: false,
            default: 'X-Signature',
          },
        ],
      },
    ],
  },
];

export const SECRET_MASK = '********';

/** Look up a service definition by `service_type` identifier. */
export function findService(type: string): ServiceDefinition | undefined {
  return SERVICE_REGISTRY.find((s) => s.type === type);
}

/**
 * Look up the auth variant for a (serviceType, authType) pair. Returns
 * `undefined` when the combination is not registered — callers should treat
 * that as "unsupported service" and surface a 400 to the client.
 */
export function findVariant(
  serviceType: string,
  authType: string,
): AuthVariant | undefined {
  return findService(serviceType)?.authVariants.find(
    (v) => v.authType === authType,
  );
}

/** Field keys marked `secret: true` for the given service/auth combination. */
export function listSecretKeys(
  serviceType: string,
  authType: string,
): string[] {
  return (
    findVariant(serviceType, authType)
      ?.fields.filter((f) => f.secret)
      .map((f) => f.key) ?? []
  );
}

/**
 * Replace secret field values with {@link SECRET_MASK} so the shape of the
 * credentials object is preserved without leaking secrets to clients.
 * Non-secret fields pass through unchanged.
 */
export function maskCredentials(
  credentials: Record<string, unknown> | null | undefined,
  serviceType: string,
  authType: string,
): Record<string, unknown> {
  if (!credentials) return {};
  const secretKeys = new Set(listSecretKeys(serviceType, authType));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(credentials)) {
    out[k] = secretKeys.has(k) && v != null && v !== '' ? SECRET_MASK : v;
  }
  return out;
}

/**
 * Structurally validate a credentials payload against the registered schema.
 * Returns a list of human-readable error messages; an empty list indicates
 * the payload is structurally valid. Does NOT probe the external service.
 */
export function validateCredentials(
  serviceType: string,
  authType: string,
  credentials: Record<string, unknown>,
): string[] {
  const variant = findVariant(serviceType, authType);
  if (!variant) {
    return [`Unknown service/auth combination: ${serviceType}/${authType}`];
  }
  const errors: string[] = [];
  for (const field of variant.fields) {
    const value = credentials[field.key];
    if (
      field.required &&
      (value === undefined || value === null || value === '')
    ) {
      errors.push(`${field.key} is required`);
      continue;
    }
    if (value === undefined || value === null) continue;
    if (field.type === 'string' && typeof value !== 'string') {
      errors.push(`${field.key} must be a string`);
    } else if (field.type === 'number' && typeof value !== 'number') {
      errors.push(`${field.key} must be a number`);
    } else if (
      field.type === 'enum' &&
      !field.enum?.includes(value as string)
    ) {
      errors.push(`${field.key} must be one of ${field.enum?.join(', ')}`);
    } else if (
      field.type === 'record' &&
      (typeof value !== 'object' || Array.isArray(value))
    ) {
      errors.push(`${field.key} must be an object`);
    }
  }
  return errors;
}
