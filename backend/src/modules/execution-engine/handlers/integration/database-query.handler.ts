import { Client as PgClient } from 'pg';
import {
  ExecutionContext,
  NodeHandler,
  ValidationResult,
} from '../node-handler.interface.js';
import {
  IntegrationError,
  IntegrationHandlerBase,
  toLogError,
} from './integration-handler-base.js';
import { IntegrationsService } from '../../../integrations/integrations.service.js';

interface DbCredentials {
  driver: 'postgres' | 'mysql';
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: 'disable' | 'require' | 'verify-full';
}

export class DatabaseQueryHandler
  extends IntegrationHandlerBase
  implements NodeHandler
{
  constructor(integrationsService?: IntegrationsService) {
    super(integrationsService);
  }

  validate(config: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];

    if (!config.integrationId || typeof config.integrationId !== 'string') {
      errors.push('integrationId is required');
    }
    if (!config.query || typeof config.query !== 'string') {
      errors.push('query is required and must be a string');
    }
    if (
      config.queryType !== undefined &&
      !['select', 'insert', 'update', 'delete', 'raw'].includes(
        config.queryType as string,
      )
    ) {
      errors.push(
        'queryType must be one of: select, insert, update, delete, raw',
      );
    }
    if (
      config.parameters !== undefined &&
      config.parameters !== null &&
      !Array.isArray(config.parameters) &&
      typeof config.parameters !== 'string'
    ) {
      errors.push('parameters must be an array or a JSON array string');
    }

    return { valid: errors.length === 0, errors };
  }

  async execute(
    _input: unknown,
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<unknown> {
    const integrationId = config.integrationId as string;
    const query = config.query as string;
    const queryType = (config.queryType as string) ?? 'select';
    const parameters = parseParameters(config.parameters);

    if (!this.integrationsService) {
      return {
        rows: [],
        rowCount: 0,
        query,
        queryType,
        message: 'Database execution requires integration connection',
      };
    }

    const start = Date.now();
    try {
      const integration = await this.resolveIntegration(
        integrationId,
        context,
        'database',
      );
      const creds = integration.credentials as Partial<DbCredentials>;
      const missing = missingDbFields(creds);
      if (missing.length > 0) {
        throw new IntegrationError(
          'INTEGRATION_INCOMPLETE',
          `Database integration is missing fields: ${missing.join(', ')}`,
        );
      }
      if (creds.driver === 'mysql') {
        throw new IntegrationError(
          'DRIVER_NOT_SUPPORTED',
          'MySQL driver is not yet implemented — add `mysql2` dependency to enable',
        );
      }

      const client = new PgClient(buildPgConnection(creds as DbCredentials));
      await client.connect();
      try {
        const result = await client.query(query, parameters);
        const durationMs = Date.now() - start;
        await this.logUsage(context, {
          integrationId,
          status: 'success',
          durationMs,
        });
        return {
          rows: result.rows,
          rowCount: result.rowCount ?? result.rows.length,
          fields: result.fields?.map((f) => ({
            name: f.name,
            dataTypeID: f.dataTypeID,
          })),
          query,
          queryType,
          durationMs,
          status: 'ok',
        };
      } finally {
        await client.end();
      }
    } catch (err) {
      await this.logUsage(context, {
        integrationId,
        status: 'failed',
        durationMs: Date.now() - start,
        error: toLogError(err),
      });
      throw err;
    }
  }
}

function buildPgConnection(creds: DbCredentials): {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean | { rejectUnauthorized: boolean };
} {
  let ssl: boolean | { rejectUnauthorized: boolean } = false;
  if (creds.ssl === 'require') ssl = { rejectUnauthorized: false };
  if (creds.ssl === 'verify-full') ssl = { rejectUnauthorized: true };
  return {
    host: creds.host,
    port: creds.port,
    database: creds.database,
    user: creds.username,
    password: creds.password,
    ssl,
  };
}

function missingDbFields(creds: Partial<DbCredentials>): string[] {
  const required: (keyof DbCredentials)[] = [
    'driver',
    'host',
    'port',
    'database',
    'username',
    'password',
  ];
  return required.filter(
    (k) => creds[k] === undefined || creds[k] === null || creds[k] === '',
  );
}

/** Parameters may arrive as array or as a JSON-array string from the UI. */
function parseParameters(raw: unknown): unknown[] {
  if (raw === undefined || raw === null || raw === '') return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      throw new IntegrationError(
        'INVALID_PARAMETERS',
        'parameters must be a JSON array (e.g. `["v1", 2]`)',
      );
    }
  }
  throw new IntegrationError(
    'INVALID_PARAMETERS',
    'parameters must be an array or a JSON array string',
  );
}
