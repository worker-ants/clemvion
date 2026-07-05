import { productOperations } from './product.js';
import type { Cafe24OperationMetadata } from './types.js';

/**
 * G-1-P (plan `cafe24-backlog-residual.md` §G-1-remaining) — `product` 리소스
 * field-set docs 전량 미러 회귀 가드.
 *
 * 상위 `catalog-docs-drift.spec.ts` 는 (method, path, scope) 만 검증하고 field 는
 * 어떤 가드도 보지 않는다. 본 스펙은 docs 미러의 핵심 사실(대량 필터 필드 존재,
 * 비동작 alias 제거, docs-명 채택, 조건부 제약)이 조용히 되돌아가지 않도록 고정한다.
 */

function op(id: string): Cafe24OperationMetadata {
  const found = productOperations.find((o) => o.id === id);
  if (!found) throw new Error(`operation ${id} not found`);
  return found;
}

describe('product field-set docs mirror (G-1-P)', () => {
  describe('product_list', () => {
    const list = op('product_list');

    it('mirrors the full docs filter set (>= 50 fields)', () => {
      expect(Object.keys(list.fields).length).toBeGreaterThanOrEqual(50);
    });

    it('includes representative docs filter fields', () => {
      for (const f of [
        'brand_code',
        'manufacturer_code',
        'price_min',
        'price_max',
        'stock_quantity_min',
        'approve_status',
        'created_start_date',
        'category',
        'sort',
        'order',
      ]) {
        expect(list.fields[f]).toBeDefined();
      }
    });

    it('drops the non-functional aliases (since/until/category_no)', () => {
      expect(list.fields.since).toBeUndefined();
      expect(list.fields.until).toBeUndefined();
      expect(list.fields.category_no).toBeUndefined();
    });

    it('keeps the docs date-pair as an allOrNone constraint', () => {
      expect(list.constraints).toEqual(
        expect.arrayContaining([
          {
            kind: 'allOrNone',
            fields: ['created_start_date', 'created_end_date'],
          },
        ]),
      );
    });
  });

  it('product_create carries the material + tax + monetary docs fields', () => {
    const create = op('product_create');
    expect(create.fields.product_material).toBeDefined();
    expect(create.fields.tax_type?.type).toBe('enum');
    // monetary fields stay decimal strings (Cafe24 convention).
    expect(create.fields.price?.type).toBe('string');
    expect(create.fields.supply_price?.type).toBe('string');
  });

  it('product_options_create uses the docs `options` array, not the old flat option_values', () => {
    const create = op('product_options_create');
    expect(create.fields.options?.type).toBe('array');
    expect(create.fields.option_values).toBeUndefined();
    // requiredFields must stay a subset of the new fields.
    for (const r of create.requiredFields) {
      expect(create.fields[r]).toBeDefined();
    }
  });

  it('bundleproducts_create/update encode the overseas-shipping impliesValue', () => {
    for (const id of ['bundleproducts_create', 'bundleproducts_update']) {
      const b = op(id);
      expect(b.constraints).toEqual(
        expect.arrayContaining([
          {
            kind: 'impliesValue',
            if: 'shipping_scope',
            value: 'C',
            then: ['hscode', 'clearance_category_code'],
          },
        ]),
      );
    }
  });

  it('never declares offset/limit as fields (pagination layer injects them)', () => {
    for (const o of productOperations) {
      expect(o.fields.offset).toBeUndefined();
      expect(o.fields.limit).toBeUndefined();
    }
  });
});
