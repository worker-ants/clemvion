import { z } from 'zod';
import { carouselNodeConfigSchema } from './carousel.schema';

describe('carouselNodeConfigSchema', () => {
  it('applies defaults for empty input', () => {
    const result = carouselNodeConfigSchema.parse({});
    expect(result.mode).toBe('dynamic');
    expect(result.items).toEqual([]);
    expect(result.maxItems).toBe(10);
    expect(result.layout).toBe('card');
    expect(result.buttons).toEqual([]);
    expect(result.itemButtons).toEqual([]);
  });

  it('mode clearFields DOES NOT include user-authored content (`items`, `itemButtons`)', () => {
    // Regression: earlier iteration wiped `items` on mode switch, causing data
    // loss. This test guards against that behaviour re-appearing via schema
    // metadata.
    const jsonSchema = z.toJSONSchema(carouselNodeConfigSchema) as {
      properties?: Record<string, { ui?: { clearFields?: string[] } }>;
    };
    const clearFields = jsonSchema.properties?.mode?.ui?.clearFields ?? [];
    expect(clearFields).not.toContain('items');
    expect(clearFields).not.toContain('itemButtons');
  });

  it('marks static-only fields with visibleWhen=static', () => {
    const jsonSchema = z.toJSONSchema(carouselNodeConfigSchema) as {
      properties?: Record<string, { ui?: { visibleWhen?: unknown } }>;
    };
    expect(jsonSchema.properties?.items?.ui?.visibleWhen).toEqual({
      field: 'mode',
      equals: 'static',
    });
  });

  it('marks dynamic-only fields with visibleWhen=dynamic', () => {
    const jsonSchema = z.toJSONSchema(carouselNodeConfigSchema) as {
      properties?: Record<string, { ui?: { visibleWhen?: unknown } }>;
    };
    for (const key of [
      'source',
      'titleField',
      'descriptionField',
      'imageField',
      'maxItems',
      'itemButtons',
    ]) {
      expect(jsonSchema.properties?.[key]?.ui?.visibleWhen).toEqual({
        field: 'mode',
        equals: 'dynamic',
      });
    }
  });

  it('uses `button-list` widget for buttons', () => {
    const jsonSchema = z.toJSONSchema(carouselNodeConfigSchema) as {
      properties?: Record<string, { ui?: { widget?: string } }>;
    };
    expect(jsonSchema.properties?.buttons?.ui?.widget).toBe('button-list');
    expect(jsonSchema.properties?.itemButtons?.ui?.widget).toBe('button-list');
  });
});
