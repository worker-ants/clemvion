import {
  ExecutionContext,
  NodeHandler,
  ValidationResult,
} from '../node-handler.interface.js';

interface TransformOperation {
  type: string;
  field?: string;
  from?: string;
  to?: string;
  value?: unknown;
  targetType?: string;
  operation?: string;
  args?: unknown;
  operand?: number;
}

export class TransformHandler implements NodeHandler {
  validate(config: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];

    if (!config.operations || !Array.isArray(config.operations)) {
      errors.push('operations is required and must be an array');
      return { valid: false, errors };
    }

    const validTypes = [
      'rename_field',
      'remove_field',
      'set_field',
      'type_convert',
      'string_op',
      'math_op',
    ];

    for (let i = 0; i < config.operations.length; i++) {
      const op = config.operations[i] as TransformOperation;
      if (!op.type || !validTypes.includes(op.type)) {
        errors.push(
          `operations[${i}].type must be one of: ${validTypes.join(', ')}`,
        );
      }
    }

    return { valid: errors.length === 0, errors };
  }

  async execute(
    input: unknown,
    config: Record<string, unknown>,
    _context: ExecutionContext,
  ): Promise<unknown> {
    const operations = config.operations as TransformOperation[];
    let data = structuredClone(input) as Record<string, unknown>;

    for (const op of operations) {
      data = this.applyOperation(data, op);
    }

    return data;
  }

  private applyOperation(
    data: Record<string, unknown>,
    op: TransformOperation,
  ): Record<string, unknown> {
    switch (op.type) {
      case 'rename_field':
        return this.renameField(data, op);
      case 'remove_field':
        return this.removeField(data, op);
      case 'set_field':
        return this.setField(data, op);
      case 'type_convert':
        return this.typeConvert(data, op);
      case 'string_op':
        return this.stringOp(data, op);
      case 'math_op':
        return this.mathOp(data, op);
      default:
        return data;
    }
  }

  private renameField(
    data: Record<string, unknown>,
    op: TransformOperation,
  ): Record<string, unknown> {
    if (op.from && op.to && op.from in data) {
      data[op.to] = data[op.from];
      delete data[op.from];
    }
    return data;
  }

  private removeField(
    data: Record<string, unknown>,
    op: TransformOperation,
  ): Record<string, unknown> {
    if (op.field) {
      delete data[op.field];
    }
    return data;
  }

  private setField(
    data: Record<string, unknown>,
    op: TransformOperation,
  ): Record<string, unknown> {
    if (op.field) {
      data[op.field] = op.value;
    }
    return data;
  }

  private typeConvert(
    data: Record<string, unknown>,
    op: TransformOperation,
  ): Record<string, unknown> {
    if (!op.field || !(op.field in data)) return data;

    const value = data[op.field];

    switch (op.targetType) {
      case 'string':
        data[op.field] = String(value);
        break;
      case 'number':
        data[op.field] = Number(value);
        break;
      case 'boolean':
        data[op.field] = Boolean(value);
        break;
    }

    return data;
  }

  private stringOp(
    data: Record<string, unknown>,
    op: TransformOperation,
  ): Record<string, unknown> {
    if (!op.field || !(op.field in data)) return data;

    let value = String(data[op.field]);

    switch (op.operation) {
      case 'trim':
        value = value.trim();
        break;
      case 'uppercase':
        value = value.toUpperCase();
        break;
      case 'lowercase':
        value = value.toLowerCase();
        break;
      case 'replace': {
        const args = op.args as { search: string; replacement: string } | undefined;
        if (args) {
          value = value.replaceAll(args.search, args.replacement);
        }
        break;
      }
    }

    data[op.field] = value;
    return data;
  }

  private mathOp(
    data: Record<string, unknown>,
    op: TransformOperation,
  ): Record<string, unknown> {
    if (!op.field || !(op.field in data)) return data;

    let value = Number(data[op.field]);
    const operand = op.operand ?? 0;

    switch (op.operation) {
      case 'add':
        value = value + operand;
        break;
      case 'subtract':
        value = value - operand;
        break;
      case 'multiply':
        value = value * operand;
        break;
      case 'divide':
        if (operand !== 0) {
          value = value / operand;
        }
        break;
      case 'round':
        value = Math.round(value);
        break;
    }

    data[op.field] = value;
    return data;
  }
}
