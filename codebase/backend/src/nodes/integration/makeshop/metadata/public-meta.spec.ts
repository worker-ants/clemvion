import {
  buildMakeshopExtras,
  toPublicMakeshopOperation,
} from './public-meta.js';
import {
  MAKESHOP_OPERATIONS_BY_RESOURCE,
  MAKESHOP_RESOURCES,
  findMakeshopOperation,
} from './index.js';

/**
 * Frontend payload shape tests — `extras` shipped through
 * `GET /nodes/definitions` must:
 *   1. include every supported operation (typed projection of metadata),
 *   2. drop `method` / `path` (no URL structure leak),
 *   3. mark each field's `required` based on `requiredFields`,
 *   4. emit `labelKey` in the `makeshop.<resource>.<id>` format,
 *   5. default `paginated` to false when not set,
 *   6. be fully JSON-serializable.
 */

describe('toPublicMakeshopOperation', () => {
  it('strips method and path from the public projection', () => {
    const meta = findMakeshopOperation('shop', 'get-authority')!;
    const pub = toPublicMakeshopOperation(meta, 'shop');
    expect((pub as unknown as Record<string, unknown>).method).toBeUndefined();
    expect((pub as unknown as Record<string, unknown>).path).toBeUndefined();
  });

  it('preserves id, scope, paginated, description, and emits labelKey', () => {
    const meta = findMakeshopOperation('product', 'get-brand')!;
    const pub = toPublicMakeshopOperation(meta, 'product');
    expect(pub.status).toBe('supported');
    expect(pub.id).toBe('get-brand');
    // spec/conventions/makeshop-api-metadata.md §2 — `labelKey` carries
    // `makeshop.<resource>.<id>` for frontend dict lookup.
    expect(pub.labelKey).toBe('makeshop.product.get-brand');
    expect((pub as unknown as Record<string, unknown>).label).toBeUndefined();
    expect(pub.scope).toBe(meta.scopeType);
    expect(pub.description).toBe(meta.description);
  });

  it('marks each field with the correct `required` flag', () => {
    // get-cart_free has requiredFields: ['InquiryTimeFrom']
    const meta = findMakeshopOperation('product', 'get-cart_free')!;
    const pub = toPublicMakeshopOperation(meta, 'product');
    const reqField = pub.fields.find((f) => f.name === 'InquiryTimeFrom');
    const optField = pub.fields.find((f) => f.name === 'limit');
    expect(reqField?.required).toBe(true);
    expect(optField?.required).toBe(false);
  });

  it('paginated defaults to false when metadata omits the flag', () => {
    // get-authority has no paginated field
    const meta = findMakeshopOperation('shop', 'get-authority')!;
    const pub = toPublicMakeshopOperation(meta, 'shop');
    expect(pub.paginated).toBe(false);
  });

  it('paginated is true when metadata sets paginated: true', () => {
    // get-cart_free has paginated: true
    const meta = findMakeshopOperation('product', 'get-cart_free')!;
    const pub = toPublicMakeshopOperation(meta, 'product');
    expect(pub.paginated).toBe(true);
  });
});

describe('buildMakeshopExtras', () => {
  const extras = buildMakeshopExtras();

  it('has a key for every MakeshopResource', () => {
    for (const resource of MAKESHOP_RESOURCES) {
      expect(extras.operationsByResource[resource]).toBeDefined();
    }
  });

  it('supported counts match MAKESHOP_OPERATIONS_BY_RESOURCE', () => {
    for (const resource of MAKESHOP_RESOURCES) {
      expect(extras.operationsByResource[resource].length).toBe(
        MAKESHOP_OPERATIONS_BY_RESOURCE[resource].length,
      );
    }
  });

  it('every supported operation has status=supported', () => {
    for (const resource of MAKESHOP_RESOURCES) {
      for (const op of extras.operationsByResource[resource]) {
        expect(op.status).toBe('supported');
      }
    }
  });

  it('no operation object exposes `method` or `path` keys', () => {
    const round = JSON.parse(JSON.stringify(extras)) as {
      operationsByResource: Record<string, Array<Record<string, unknown>>>;
    };
    for (const ops of Object.values(round.operationsByResource)) {
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

  it('every operation labelKey matches makeshop.<resource>.<id> format', () => {
    for (const resource of MAKESHOP_RESOURCES) {
      for (const op of extras.operationsByResource[resource]) {
        expect(op.labelKey).toBe(`makeshop.${resource}.${op.id}`);
      }
    }
  });
});
