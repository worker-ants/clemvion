import {
  CAFE24_OPERATIONS_BY_RESOURCE,
  CAFE24_RESOURCES,
  findCafe24Operation,
  listAllCafe24Operations,
  scopeForOperation,
} from './index.js';

describe('Cafe24 metadata', () => {
  describe('CAFE24_RESOURCES', () => {
    it('lists all 18 categories', () => {
      expect(CAFE24_RESOURCES).toHaveLength(18);
    });
  });

  describe('CAFE24_OPERATIONS_BY_RESOURCE', () => {
    it('has an entry for every resource', () => {
      for (const resource of CAFE24_RESOURCES) {
        const ops = CAFE24_OPERATIONS_BY_RESOURCE[resource];
        if (!ops || ops.length === 0) {
          throw new Error(
            `${resource} resource must declare at least one operation`,
          );
        }
      }
    });

    it('operation ids are unique within each resource', () => {
      for (const resource of CAFE24_RESOURCES) {
        const ids = CAFE24_OPERATIONS_BY_RESOURCE[resource].map((op) => op.id);
        const seen = new Set<string>();
        for (const id of ids) {
          expect(seen.has(id)).toBe(false);
          seen.add(id);
        }
      }
    });

    it('every path placeholder is declared in fields', () => {
      for (const { resource, operation } of listAllCafe24Operations()) {
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
      for (const { resource, operation } of listAllCafe24Operations()) {
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

    it('enum fields declare an enum array', () => {
      for (const { resource, operation } of listAllCafe24Operations()) {
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

    // spec/conventions/cafe24-api-metadata.md §5.2 — date/time 필드 description
    // 은 KST 명시 (`(KST, UTC+9)` 또는 `(KST)`) 또는 `YYYY-MM-DD` 형식 명시를
    // 포함해야 한다. 단순 `'ISO8601 date'` 만 적는 것은 금지 (KST/UTC 모호성으로
    // AI Agent 가 9시간 어긋난 인자를 생성할 회귀 차단).
    it('date/time field descriptions declare KST or YYYY-MM-DD format (spec §5.2)', () => {
      const dateNamePattern =
        /(date|time|since|until|created|updated|expired)/i;
      const violations: string[] = [];
      for (const { resource, operation } of listAllCafe24Operations()) {
        for (const [name, spec] of Object.entries(operation.fields)) {
          if (spec.type !== 'string') continue;
          if (!dateNamePattern.test(name)) continue;
          const desc = spec.description;
          if (!desc) continue; // description 없는 row 는 도구 description suffix 가 보강
          // ISO 키워드를 적었다면 반드시 KST 명시 동반.
          const mentionsIso = /ISO|iso8601/i.test(desc);
          const mentionsKst = /KST|UTC\+9|Asia\/Seoul/i.test(desc);
          const mentionsLegacyFormat = /YYYY-MM-DD/.test(desc);
          if (mentionsIso && !mentionsKst) {
            violations.push(
              `${resource}.${operation.id}.fields.${name}: ISO 키워드 포함 시 KST/UTC+9 명시 필수 — "${desc}"`,
            );
          } else if (
            !mentionsIso &&
            !mentionsKst &&
            !mentionsLegacyFormat &&
            /date|time/i.test(desc)
          ) {
            violations.push(
              `${resource}.${operation.id}.fields.${name}: date/time 의미를 적은 description 은 KST/UTC+9 또는 YYYY-MM-DD 형식 명시 필요 — "${desc}"`,
            );
          }
        }
      }
      if (violations.length > 0) {
        throw new Error(
          `cafe24-api-metadata §5.2 violation:\n${violations.join('\n')}`,
        );
      }
    });
  });

  describe('findCafe24Operation', () => {
    it('returns the matching operation', () => {
      const op = findCafe24Operation('product', 'product_list');
      expect(op).toBeDefined();
      expect(op?.method).toBe('GET');
      expect(op?.path).toBe('products');
    });

    it('returns undefined for unknown resource', () => {
      expect(findCafe24Operation('not_a_resource', 'whatever')).toBeUndefined();
    });

    it('returns undefined for unknown operation', () => {
      expect(findCafe24Operation('product', 'not_an_op')).toBeUndefined();
    });
  });

  describe('scopeForOperation', () => {
    it('builds mall.read_<resource> for read operations', () => {
      const op = findCafe24Operation('product', 'product_list')!;
      expect(scopeForOperation('product', op)).toBe('mall.read_product');
    });

    it('builds mall.write_<resource> for write operations', () => {
      const op = findCafe24Operation('product', 'product_update')!;
      expect(scopeForOperation('product', op)).toBe('mall.write_product');
    });
  });

  describe('Core categories have CRUD coverage', () => {
    const expectations: Array<[string, string[]]> = [
      [
        'product',
        [
          'product_list',
          'product_get',
          'product_create',
          'product_update',
          'product_delete',
        ],
      ],
      ['order', ['order_list', 'order_get']],
      ['customer', ['customer_list', 'customer_get', 'customer_update']],
      [
        'category',
        [
          'category_list',
          'category_get',
          'category_create',
          'category_update',
          'category_delete',
        ],
      ],
      ['promotion', ['coupon_list', 'coupon_get', 'coupon_create']],
    ];

    for (const [resource, requiredOps] of expectations) {
      it(`${resource} resource exposes the expected operations`, () => {
        for (const opId of requiredOps) {
          if (!findCafe24Operation(resource, opId)) {
            throw new Error(`${resource}.${opId} must exist`);
          }
        }
      });
    }
  });
});
