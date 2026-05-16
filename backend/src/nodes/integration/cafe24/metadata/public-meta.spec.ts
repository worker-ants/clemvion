import {
  buildCafe24Extras,
  toPublicSupportedOperation,
} from './public-meta.js';
import {
  CAFE24_OPERATIONS_BY_RESOURCE,
  CAFE24_RESOURCES,
  findCafe24Operation,
} from './index.js';
import { CAFE24_PLANNED_BY_RESOURCE } from './planned.js';

/**
 * Frontend payload shape tests — `extras` shipped through
 * `GET /nodes/definitions` must:
 *   1. include every supported operation (typed projection of metadata),
 *   2. drop `method` / `path` (no URL structure leak),
 *   3. include every planned operation as `{ status: 'planned', id, label, paginated }`,
 *   4. mark each field's `required` based on `requiredFields`.
 */

describe('toPublicSupportedOperation', () => {
  it('strips method and path from the public projection', () => {
    const meta = findCafe24Operation('product', 'product_list')!;
    const pub = toPublicSupportedOperation(meta);
    expect((pub as unknown as Record<string, unknown>).method).toBeUndefined();
    expect((pub as unknown as Record<string, unknown>).path).toBeUndefined();
  });

  it('preserves id, label, scope, paginated, description', () => {
    const meta = findCafe24Operation('product', 'product_list')!;
    const pub = toPublicSupportedOperation(meta);
    expect(pub.status).toBe('supported');
    expect(pub.id).toBe('product_list');
    expect(pub.label).toBe(meta.label);
    expect(pub.scope).toBe(meta.scopeType);
    expect(pub.paginated).toBe(true);
    expect(pub.description).toBe(meta.description);
  });

  it('marks each field with the correct `required` flag', () => {
    const meta = findCafe24Operation('product', 'product_list')!;
    const pub = toPublicSupportedOperation(meta);
    const shopNo = pub.fields.find((f) => f.name === 'shop_no');
    const categoryNo = pub.fields.find((f) => f.name === 'category_no');
    expect(shopNo?.required).toBe(true); // requiredFields = ['shop_no']
    expect(categoryNo?.required).toBe(false);
  });

  it('forwards field.location so the UI can group path / query / body', () => {
    const meta = findCafe24Operation('product', 'product_get')!;
    const pub = toPublicSupportedOperation(meta);
    const productNo = pub.fields.find((f) => f.name === 'product_no');
    expect(productNo?.location).toBe('path');
  });

  it('preserves enum and default when present', () => {
    const meta = findCafe24Operation('product', 'product_list')!;
    const pub = toPublicSupportedOperation(meta);
    const display = pub.fields.find((f) => f.name === 'display');
    expect(display?.type).toBe('enum');
    expect(display?.enum).toEqual(['T', 'F']);
    const shopNo = pub.fields.find((f) => f.name === 'shop_no');
    expect(shopNo?.default).toBe(1);
  });

  it('paginated defaults to false when metadata omits the flag', () => {
    const meta = findCafe24Operation('product', 'product_get')!;
    const pub = toPublicSupportedOperation(meta);
    expect(pub.paginated).toBe(false);
  });
});

describe('buildCafe24Extras', () => {
  const extras = buildCafe24Extras();

  it('has a key for every Cafe24Resource on both maps', () => {
    for (const resource of CAFE24_RESOURCES) {
      expect(extras.operationsByResource[resource]).toBeDefined();
      expect(extras.plannedByResource[resource]).toBeDefined();
    }
  });

  it('supported counts match CAFE24_OPERATIONS_BY_RESOURCE', () => {
    for (const resource of CAFE24_RESOURCES) {
      expect(extras.operationsByResource[resource].length).toBe(
        CAFE24_OPERATIONS_BY_RESOURCE[resource].length,
      );
    }
  });

  it('planned counts match CAFE24_PLANNED_BY_RESOURCE', () => {
    for (const resource of CAFE24_RESOURCES) {
      expect(extras.plannedByResource[resource].length).toBe(
        CAFE24_PLANNED_BY_RESOURCE[resource].length,
      );
    }
  });

  it('every supported operation has status=supported', () => {
    for (const resource of CAFE24_RESOURCES) {
      for (const op of extras.operationsByResource[resource]) {
        expect(op.status).toBe('supported');
      }
    }
  });

  it('every planned operation has status=planned', () => {
    for (const resource of CAFE24_RESOURCES) {
      for (const op of extras.plannedByResource[resource]) {
        expect(op.status).toBe('planned');
      }
    }
  });

  it('no operation object exposes `method` or `path` keys', () => {
    // Walk the parsed payload and assert no operation-like object carries
    // the internal HTTP dispatch keys. Substring search would false-match
    // since the convention catalog uses "path" inside English descriptions
    // (e.g. "path template").
    const round = JSON.parse(JSON.stringify(extras)) as {
      operationsByResource: Record<string, Array<Record<string, unknown>>>;
      plannedByResource: Record<string, Array<Record<string, unknown>>>;
    };
    for (const ops of Object.values(round.operationsByResource)) {
      for (const op of ops) {
        expect(op).not.toHaveProperty('method');
        expect(op).not.toHaveProperty('path');
      }
    }
    for (const ops of Object.values(round.plannedByResource)) {
      for (const op of ops) {
        expect(op).not.toHaveProperty('method');
        expect(op).not.toHaveProperty('path');
      }
    }
  });

  it('result is JSON-serializable (no functions, no circular refs)', () => {
    expect(() => JSON.stringify(extras)).not.toThrow();
    const round = JSON.parse(JSON.stringify(extras));
    expect(round.operationsByResource.product.length).toBeGreaterThan(0);
  });
});
