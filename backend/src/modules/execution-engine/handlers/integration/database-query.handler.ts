import {
  ExecutionContext,
  NodeHandler,
  ValidationResult,
} from '../node-handler.interface.js';

export class DatabaseQueryHandler implements NodeHandler {
  validate(config: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];

    if (!config.query || typeof config.query !== 'string') {
      errors.push('query is required and must be a string');
    }

    if (
      config.queryType !== undefined &&
      !['select', 'insert', 'update', 'delete'].includes(
        config.queryType as string,
      )
    ) {
      errors.push('queryType must be one of: select, insert, update, delete');
    }

    if (config.parameters !== undefined && !Array.isArray(config.parameters)) {
      errors.push('parameters must be an array');
    }

    return { valid: errors.length === 0, errors };
  }

  async execute(
    _input: unknown,
    config: Record<string, unknown>,
    _context: ExecutionContext,
  ): Promise<unknown> {
    const query = config.query as string;
    const queryType = (config.queryType as string) ?? 'select';

    return {
      rows: [],
      rowCount: 0,
      query,
      queryType,
      message: 'Database execution requires integration connection',
    };
  }
}
