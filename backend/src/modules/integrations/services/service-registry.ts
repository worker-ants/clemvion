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
  | 'webhook_outbound';

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
  oauthProvider?: 'google' | 'github';
}

const HTTP_COMMON: CredentialField[] = [
  {
    key: 'base_url',
    label: 'Base URL',
    type: 'string',
    required: false,
    placeholder: 'https://api.example.com',
  },
];

export const SERVICE_REGISTRY: ServiceDefinition[] = [
  {
    type: 'google',
    name: 'Google',
    oauthProvider: 'google',
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
