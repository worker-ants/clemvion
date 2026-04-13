export type CoercibleType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'object'
  | 'array';

export function coerceToType(value: unknown, type: string): unknown {
  if (value === null || value === undefined) return null;

  switch (type) {
    case 'number': {
      if (typeof value === 'number') return value;
      const n = Number(value);
      return Number.isNaN(n) ? null : n;
    }
    case 'boolean': {
      if (typeof value === 'boolean') return value;
      if (value === 'true') return true;
      if (value === 'false') return false;
      return Boolean(value);
    }
    case 'array': {
      if (Array.isArray(value)) return value;
      if (typeof value === 'string' && value.trim().startsWith('[')) {
        try {
          const parsed: unknown = JSON.parse(value);
          if (Array.isArray(parsed)) return parsed;
        } catch {
          /* not valid JSON — return as-is */
        }
      }
      return value;
    }
    case 'object': {
      if (typeof value === 'object' && !Array.isArray(value)) return value;
      if (typeof value === 'string' && value.trim().startsWith('{')) {
        try {
          const parsed: unknown = JSON.parse(value);
          if (typeof parsed === 'object' && parsed !== null) return parsed;
        } catch {
          /* not valid JSON — return as-is */
        }
      }
      return value;
    }
    default:
      if (typeof value === 'string') return value;
      if (typeof value === 'number' || typeof value === 'boolean') {
        return value.toString();
      }
      return JSON.stringify(value);
  }
}
