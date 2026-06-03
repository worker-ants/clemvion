import {
  MAKESHOP_OPERATIONS_BY_RESOURCE,
  MAKESHOP_RESOURCES,
  findMakeshopOperation,
  listAllMakeshopOperations,
  scopeForOperation,
} from './index.js';

/**
 * MCP §5.2 sanitize: operationId 의 하이픈은 도구 이름 토큰에서 `_` 로 치환된다
 * (`get-product` → `get_product`). resource 안에서 sanitize 이후에도 unique 해야
 * 충돌 없는 MCP 도구 노출이 가능하다 (makeshop-api-metadata §7 / 5-makeshop §8.1).
 */
function sanitizeToolName(id: string): string {
  return id.replace(/-/g, '_');
}

describe('Makeshop metadata', () => {
  describe('MAKESHOP_RESOURCES', () => {
    it('lists all 7 sections', () => {
      expect(MAKESHOP_RESOURCES).toHaveLength(7);
    });
  });

  describe('MAKESHOP_OPERATIONS_BY_RESOURCE', () => {
    it('has an entry for every resource', () => {
      for (const resource of MAKESHOP_RESOURCES) {
        const ops = MAKESHOP_OPERATIONS_BY_RESOURCE[resource];
        if (!ops || ops.length === 0) {
          throw new Error(
            `${resource} resource must declare at least one operation`,
          );
        }
      }
    });

    it('total REST operation count is 161', () => {
      const total = listAllMakeshopOperations().length;
      expect(total).toBe(161);
    });

    it('operation ids are unique within each resource', () => {
      for (const resource of MAKESHOP_RESOURCES) {
        const ids = MAKESHOP_OPERATIONS_BY_RESOURCE[resource].map(
          (op) => op.id,
        );
        const seen = new Set<string>();
        for (const id of ids) {
          expect(seen.has(id)).toBe(false);
          seen.add(id);
        }
      }
    });

    // makeshop-api-metadata §7 / 5-makeshop §8.1 — operationId 하이픈은 MCP 도구
    // 이름에서 `_` 로 sanitize 된다. sanitize 이후에도 resource 안에서 unique 여야
    // MCP 도구 이름 충돌이 없다.
    it('sanitized (hyphen→underscore) operation ids are unique within each resource', () => {
      for (const resource of MAKESHOP_RESOURCES) {
        const seen = new Set<string>();
        for (const op of MAKESHOP_OPERATIONS_BY_RESOURCE[resource]) {
          const name = sanitizeToolName(op.id);
          if (seen.has(name)) {
            throw new Error(
              `${resource}: sanitized tool name "${name}" collides (from id "${op.id}")`,
            );
          }
          seen.add(name);
        }
      }
    });

    it('method is GET or POST only (no PUT/DELETE)', () => {
      for (const { resource, operation } of listAllMakeshopOperations()) {
        // Read through `string` so the literal-union does not narrow to `never`
        // (the type already forbids other values; this guards runtime drift).
        const method: string = operation.method;
        if (method !== 'GET' && method !== 'POST') {
          throw new Error(
            `${resource}.${operation.id} has invalid method "${method}" (MakeShop is GET/POST only)`,
          );
        }
      }
    });

    it('scopeType is read or write', () => {
      for (const { resource, operation } of listAllMakeshopOperations()) {
        const scopeType: string = operation.scopeType;
        if (scopeType !== 'read' && scopeType !== 'write') {
          throw new Error(
            `${resource}.${operation.id} has invalid scopeType "${scopeType}"`,
          );
        }
      }
    });

    it('every path placeholder is declared in fields', () => {
      for (const { resource, operation } of listAllMakeshopOperations()) {
        const placeholders = operation.path.match(/\{([a-zA-Z0-9_]+)\}/g) ?? [];
        for (const ph of placeholders) {
          const fieldName = ph.slice(1, -1);
          const label = `${resource}.${operation.id} placeholder ${ph}`;
          if (!operation.fields[fieldName]) {
            throw new Error(`${label} must have a matching field`);
          }
          if (operation.fields[fieldName].location !== 'path') {
            throw new Error(`${label} field must be location='path'`);
          }
        }
      }
    });

    it('requiredFields is a subset of fields keys', () => {
      for (const { resource, operation } of listAllMakeshopOperations()) {
        const fieldNames = Object.keys(operation.fields);
        for (const required of operation.requiredFields) {
          if (!fieldNames.includes(required)) {
            throw new Error(
              `${resource}.${operation.id} requiredFields includes "${required}" not in fields`,
            );
          }
        }
      }
    });

    // makeshop-api-metadata §2 (cafe24-api-metadata §2) — MakeshopFieldConstraint
    // invariant: (1) all referenced field names must be keys of `fields`,
    // (2) oneOf/allOrNone length >= 2, implies.then length >= 1.
    it('constraints reference only declared fields and satisfy length invariants', () => {
      const violations: string[] = [];
      for (const { resource, operation } of listAllMakeshopOperations()) {
        if (!operation.constraints || operation.constraints.length === 0)
          continue;
        const fieldNames = new Set(Object.keys(operation.fields));
        const label = `${resource}.${operation.id}`;
        for (const [idx, c] of operation.constraints.entries()) {
          if (c.kind === 'oneOf' || c.kind === 'allOrNone') {
            if (c.fields.length < 2) {
              violations.push(
                `${label}.constraints[${idx}].fields: kind="${c.kind}" requires length >= 2 (got ${c.fields.length})`,
              );
            }
            for (const f of c.fields) {
              if (!fieldNames.has(f)) {
                violations.push(
                  `${label}.constraints[${idx}].fields includes "${f}" not in fields`,
                );
              }
            }
          } else if (c.kind === 'implies' || c.kind === 'impliesValue') {
            if (!fieldNames.has(c.if)) {
              violations.push(
                `${label}.constraints[${idx}].if = "${c.if}" not in fields`,
              );
            }
            if (c.then.length < 1) {
              violations.push(
                `${label}.constraints[${idx}].then: ${c.kind} requires length >= 1`,
              );
            }
            for (const f of c.then) {
              if (!fieldNames.has(f)) {
                violations.push(
                  `${label}.constraints[${idx}].then includes "${f}" not in fields`,
                );
              }
            }
            if (c.kind === 'impliesValue') {
              const v: unknown = c.value;
              if (
                typeof v !== 'string' &&
                typeof v !== 'number' &&
                typeof v !== 'boolean'
              ) {
                violations.push(
                  `${label}.constraints[${idx}].value: impliesValue requires a scalar string/number/boolean (got ${typeof v})`,
                );
              }
            }
          }
        }
      }
      if (violations.length > 0) {
        throw new Error(
          `makeshop-api-metadata §2 constraints invariant violation:\n${violations.join('\n')}`,
        );
      }
    });

    it('enum fields declare an enum array', () => {
      for (const { resource, operation } of listAllMakeshopOperations()) {
        for (const [name, spec] of Object.entries(operation.fields)) {
          if (spec.type === 'enum') {
            if (!Array.isArray(spec.enum) || spec.enum.length === 0) {
              throw new Error(
                `${resource}.${operation.id}.fields.${name} type='enum' must declare enum: string[]`,
              );
            }
          }
        }
      }
    });
  });

  describe('findMakeshopOperation', () => {
    it('returns the matching operation', () => {
      const op = findMakeshopOperation('board', 'get-board');
      expect(op).toBeDefined();
      expect(op?.method).toBe('GET');
      expect(op?.path).toBe('board');
    });

    it('returns undefined for unknown resource', () => {
      expect(
        findMakeshopOperation('not_a_resource', 'whatever'),
      ).toBeUndefined();
    });

    it('returns undefined for unknown operation', () => {
      expect(findMakeshopOperation('board', 'not_an_op')).toBeUndefined();
    });
  });

  describe('scopeForOperation', () => {
    it('builds <scope-group>.read for read operations', () => {
      const op = findMakeshopOperation('product', 'get-brand')!;
      expect(scopeForOperation('product', op)).toBe('product.read');
    });

    it('builds <scope-group>.write for write operations', () => {
      const op = findMakeshopOperation('board', 'post-board-store')!;
      expect(scopeForOperation('board', op)).toBe('board.write');
    });

    it('maps shop section to the store scope group', () => {
      const op = MAKESHOP_OPERATIONS_BY_RESOURCE.shop[0];
      expect(scopeForOperation('shop', op)).toBe(`store.${op.scopeType}`);
    });

    it('maps cpik section to the order scope group (Phase 0 default)', () => {
      const op = MAKESHOP_OPERATIONS_BY_RESOURCE.cpik[0];
      expect(scopeForOperation('cpik', op)).toBe(`order.${op.scopeType}`);
    });
  });
});
