import { z } from 'zod';
import { evaluateWarnings } from '@workflow/node-summary';
import {
  carouselNodeConfigSchema,
  carouselNodeMetadata,
  validateCarouselConfig,
} from './carousel.schema';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';

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
    const jsonSchema = z.toJSONSchema(carouselNodeConfigSchema) as unknown as {
      properties?: Record<string, { ui?: { clearFields?: string[] } }>;
    };
    const clearFields = jsonSchema.properties?.mode?.ui?.clearFields ?? [];
    expect(clearFields).not.toContain('items');
    expect(clearFields).not.toContain('itemButtons');
  });

  it('marks static-only fields with visibleWhen=static', () => {
    const jsonSchema = z.toJSONSchema(carouselNodeConfigSchema) as unknown as {
      properties?: Record<string, { ui?: { visibleWhen?: unknown } }>;
    };
    expect(jsonSchema.properties?.items?.ui?.visibleWhen).toEqual({
      field: 'mode',
      equals: 'static',
    });
  });

  it('marks dynamic-only fields with visibleWhen=dynamic', () => {
    const jsonSchema = z.toJSONSchema(carouselNodeConfigSchema) as unknown as {
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
    const jsonSchema = z.toJSONSchema(carouselNodeConfigSchema) as unknown as {
      properties?: Record<string, { ui?: { widget?: string } }>;
    };
    expect(jsonSchema.properties?.buttons?.ui?.widget).toBe('button-list');
    expect(jsonSchema.properties?.itemButtons?.ui?.widget).toBe('button-list');
  });

  it('marks titleField / items with mode-scoped requiredWhen', () => {
    const jsonSchema = z.toJSONSchema(carouselNodeConfigSchema) as unknown as {
      properties?: Record<string, { ui?: { requiredWhen?: unknown } }>;
    };
    expect(jsonSchema.properties?.titleField?.ui?.requiredWhen).toEqual({
      field: 'mode',
      equals: 'dynamic',
    });
    expect(jsonSchema.properties?.items?.ui?.requiredWhen).toEqual({
      field: 'mode',
      equals: 'static',
    });
  });

  it('marks each static item title as required for UI cues', () => {
    const jsonSchema = z.toJSONSchema(carouselNodeConfigSchema) as unknown as {
      properties?: {
        items?: {
          items?: {
            properties?: Record<string, { ui?: { required?: boolean } }>;
          };
        };
      };
    };
    const titleUi = jsonSchema.properties?.items?.items?.properties?.title?.ui;
    expect(titleUi?.required).toBe(true);
  });
});

describe('carouselNodeMetadata.warningRules', () => {
  // Helper: just the ids that fired, in declaration order.
  const firedIds = (config: unknown) =>
    evaluateWarnings(
      config as Record<string, unknown>,
      carouselNodeMetadata.warningRules,
    ).map((w) => w.id);

  describe('carousel:dynamic-mode-needs-title-field', () => {
    it('fires when dynamic mode and titleField missing', () => {
      expect(firedIds({ mode: 'dynamic' })).toContain(
        'carousel:dynamic-mode-needs-title-field',
      );
    });

    it('does NOT fire when dynamic mode and titleField set', () => {
      expect(firedIds({ mode: 'dynamic', titleField: 'name' })).not.toContain(
        'carousel:dynamic-mode-needs-title-field',
      );
    });

    it('does NOT fire in static mode even without titleField', () => {
      expect(
        firedIds({ mode: 'static', items: [{ title: 'x' }] }),
      ).not.toContain('carousel:dynamic-mode-needs-title-field');
    });
  });

  describe('carousel:static-mode-needs-items', () => {
    it('fires when static mode and items empty', () => {
      expect(firedIds({ mode: 'static', items: [] })).toContain(
        'carousel:static-mode-needs-items',
      );
    });

    it('fires when static mode and items missing entirely', () => {
      expect(firedIds({ mode: 'static' })).toContain(
        'carousel:static-mode-needs-items',
      );
    });

    it('does NOT fire when static mode has at least one item', () => {
      expect(
        firedIds({ mode: 'static', items: [{ title: 'a' }] }),
      ).not.toContain('carousel:static-mode-needs-items');
    });

    it('does NOT fire in dynamic mode even with items empty', () => {
      expect(
        firedIds({ mode: 'dynamic', titleField: 'name', items: [] }),
      ).not.toContain('carousel:static-mode-needs-items');
    });
  });

  describe('carousel:invalid-mode', () => {
    it('fires when mode is something other than static / dynamic', () => {
      expect(firedIds({ mode: 'unknown', titleField: 'x' })).toContain(
        'carousel:invalid-mode',
      );
    });

    it('does NOT fire for valid modes', () => {
      expect(
        firedIds({ mode: 'static', items: [{ title: 'a' }] }),
      ).not.toContain('carousel:invalid-mode');
      expect(firedIds({ mode: 'dynamic', titleField: 'name' })).not.toContain(
        'carousel:invalid-mode',
      );
    });
  });
});

describe('validateCarouselConfig (imperative)', () => {
  it('returns [] for a fully-configured static carousel', () => {
    expect(
      validateCarouselConfig({
        mode: 'static',
        items: [{ title: 'Slide 1', buttons: [] }],
      }),
    ).toEqual([]);
  });

  it('flags missing item.title in static mode for each row', () => {
    const errors = validateCarouselConfig({
      mode: 'static',
      items: [{ title: '' }, { title: 'ok' }, { title: 42 }],
    });
    expect(errors).toEqual(
      expect.arrayContaining([
        'items[0].title is required and must be a string',
        'items[2].title is required and must be a string',
      ]),
    );
    expect(errors).not.toContain(
      'items[1].title is required and must be a string',
    );
  });

  // cap 5 — 2026-05-19 정준화 (spec/4-nodes/6-presentation/0-common.md §Rationale).
  it('allows exactly 5 per-item buttons in static mode', () => {
    const fiveButtons = Array.from({ length: 5 }, (_, i) => ({
      id: `b${i}`,
      label: `B${i}`,
      type: 'port',
    }));
    const errors = validateCarouselConfig({
      mode: 'static',
      items: [{ title: 'Slide', buttons: fiveButtons }],
    });
    expect(
      errors.some((e) => e.includes('maximum') && e.includes('per item')),
    ).toBe(false);
  });

  it('caps per-item buttons at 5 in static mode', () => {
    const tooMany = Array.from({ length: 6 }, (_, i) => ({
      id: `b${i}`,
      label: `B${i}`,
      type: 'port',
    }));
    const errors = validateCarouselConfig({
      mode: 'static',
      items: [{ title: 'Slide', buttons: tooMany }],
    });
    expect(errors).toContain('items[0]: maximum 5 buttons per item');
  });

  it('rejects reserved separator "__item_" in per-item button id', () => {
    const errors = validateCarouselConfig({
      mode: 'static',
      items: [
        {
          title: 'Slide',
          buttons: [{ id: 'b__item_0', label: 'X', type: 'port' }],
        },
      ],
    });
    expect(errors).toContain(
      'items[0].buttons[0].id must not contain reserved separator "__item_"',
    );
  });

  it('rejects duplicate per-item button ids', () => {
    const errors = validateCarouselConfig({
      mode: 'static',
      items: [
        {
          title: 'Slide',
          buttons: [
            { id: 'go', label: 'Go', type: 'port' },
            { id: 'go', label: 'Again', type: 'port' },
          ],
        },
      ],
    });
    expect(errors).toContain(
      'items[0].buttons[1].id must be unique (duplicate: go)',
    );
  });

  it('flags itemButtons rules in dynamic mode', () => {
    const errors = validateCarouselConfig({
      mode: 'dynamic',
      titleField: 'name',
      itemButtons: [{ id: 'a', type: 'link' }], // missing label, missing url
    });
    expect(errors).toEqual(
      expect.arrayContaining([
        'itemButtons.buttons[0].label is required',
        'itemButtons.buttons[0].url is required for link type buttons',
      ]),
    );
  });

  it('blocks disallowed URL schemes on link buttons', () => {
    const errors = validateCarouselConfig({
      mode: 'dynamic',
      titleField: 'name',
      itemButtons: [
        {
          id: 'evil',
          label: 'X',
          type: 'link',
          url: 'javascript:alert(1)',
        },
      ],
    });
    expect(errors).toContain(
      'itemButtons.buttons[0].url contains a disallowed URL scheme',
    );
  });

  it('forwards global buttons errors via shared validateButtons', () => {
    const errors = validateCarouselConfig({
      mode: 'dynamic',
      titleField: 'name',
      buttons: [{ id: '', type: 'port', label: '' }],
    });
    expect(errors).toEqual(
      expect.arrayContaining([
        'buttons[0].id is required',
        'buttons[0].label is required and must be a string',
      ]),
    );
  });
});

describe('buttonDefSchema — userMessage (spec/4-nodes/6-presentation/0-common.md §1, §10.8)', () => {
  it('preserves userMessage on global buttons', () => {
    const result = carouselNodeConfigSchema.parse({
      mode: 'static',
      items: [{ title: 'Slide' }],
      buttons: [
        {
          id: 'a',
          label: 'Approve',
          type: 'port',
          userMessage: 'I approve',
        },
      ],
    });
    expect(result.buttons[0].userMessage).toBe('I approve');
  });

  it('preserves userMessage on itemButtons (dynamic mode)', () => {
    const result = carouselNodeConfigSchema.parse({
      mode: 'dynamic',
      titleField: 'name',
      itemButtons: [
        {
          id: 'inquire',
          label: '문의하기',
          type: 'port',
          userMessage: '{{ title }} 문의',
        },
      ],
    });
    expect(result.itemButtons[0].userMessage).toBe('{{ title }} 문의');
  });

  it('preserves userMessage on per-item buttons (static items[].buttons)', () => {
    const result = carouselNodeConfigSchema.parse({
      mode: 'static',
      items: [
        {
          title: 'Sample Product 1',
          buttons: [
            {
              id: 'inq',
              label: '문의',
              type: 'port',
              userMessage: 'Sample Product 1 문의',
            },
          ],
        },
      ],
    });
    expect(result.items[0].buttons?.[0].userMessage).toBe(
      'Sample Product 1 문의',
    );
  });

  it('allows missing userMessage (optional)', () => {
    const result = carouselNodeConfigSchema.parse({
      mode: 'static',
      items: [{ title: 'Slide' }],
      buttons: [{ id: 'a', label: 'A', type: 'port' }],
    });
    expect(result.buttons[0].userMessage).toBeUndefined();
  });

  it('exposes userMessage in JSON Schema for LLM tool param discovery (§10.8)', () => {
    const jsonSchema = z.toJSONSchema(carouselNodeConfigSchema) as unknown as {
      properties?: Record<
        string,
        {
          items?: { properties?: Record<string, { type?: string }> };
          type?: string;
        }
      >;
    };
    const buttonItemSchema = jsonSchema.properties?.buttons?.items?.properties;
    expect(buttonItemSchema?.userMessage).toBeDefined();
    expect(buttonItemSchema?.userMessage?.type).toBe('string');

    const itemButtonsItemSchema =
      jsonSchema.properties?.itemButtons?.items?.properties;
    expect(itemButtonsItemSchema?.userMessage).toBeDefined();
  });

  it('preserves userMessage on link-typed buttons at parse-time (spec §1.1 — ignored at click-time, not at validate)', () => {
    // Spec §1.1: link 타입에 userMessage 설정 시 무시 (warning 아님). 즉
    // parse 는 통과하며, 무시는 클릭 시점의 frontend 책임. 본 테스트는 zod
    // 가 link+userMessage 페이로드를 reject 하지 않음을 보장한다.
    const result = carouselNodeConfigSchema.parse({
      mode: 'static',
      items: [{ title: 'Slide' }],
      buttons: [
        {
          id: 'a',
          label: 'Open',
          type: 'link',
          url: 'https://example.com',
          userMessage: 'ignored at click-time',
        },
      ],
    });
    expect(result.buttons[0].userMessage).toBe('ignored at click-time');
  });
});

describe('evaluateMetadataBlockingErrors integration (carousel)', () => {
  it('merges declarative + imperative errors as a single flat blocking list', () => {
    // Empty config → dynamic-mode rule fires (declarative) AND
    // validateButtons returns nothing (no buttons configured). Adding a
    // bad button forces an imperative entry too.
    const errors = evaluateMetadataBlockingErrors(carouselNodeMetadata, {
      mode: 'dynamic',
      buttons: [{ type: 'port', label: '' }],
    });
    // Declarative fires:
    expect(errors).toContain('In Dynamic mode, a Title field must be entered.');
    // Imperative (validateButtons) fires:
    expect(errors).toEqual(
      expect.arrayContaining([
        'buttons[0].id is required',
        'buttons[0].label is required and must be a string',
      ]),
    );
  });
});
