import { CarouselHandler } from './carousel.handler.js';

describe('CarouselHandler', () => {
  let handler: CarouselHandler;

  beforeEach(() => {
    handler = new CarouselHandler();
  });

  const context = {
    executionId: 'exec-1',
    workflowId: 'wf-1',
    variables: {},
    nodeOutputCache: {},
    structuredOutputCache: {},
    engineResolvedConfigCache: {},
    recursionDepth: 0,
  };

  describe('validate', () => {
    // Dynamic mode
    it('should pass with valid source and titleField in dynamic mode', () => {
      const result = handler.validate({
        source: '{{ $input }}',
        titleField: 'name',
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass with explicit mode=dynamic, source and titleField', () => {
      const result = handler.validate({
        mode: 'dynamic',
        source: '{{ $input.items }}',
        titleField: 'name',
      });
      expect(result.valid).toBe(true);
    });

    it('should pass without source in dynamic mode (backward compatible)', () => {
      const result = handler.validate({ titleField: 'name' });
      expect(result.valid).toBe(true);
    });

    it('should fail when titleField is missing in dynamic mode', () => {
      const result = handler.validate({});
      expect(result.valid).toBe(false);
      // Schema warningRule "Dynamic 모드에서는 Title 필드를 입력해야 합니다." fires.
      expect(result.errors.some((e) => e.includes('Title'))).toBe(true);
    });

    it('should fail when titleField is not a string in dynamic mode', () => {
      const result = handler.validate({
        source: '{{ $input }}',
        titleField: 123,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'titleField is required and must be a string',
      );
    });

    it('should fail when mode=dynamic and titleField is missing', () => {
      const result = handler.validate({
        mode: 'dynamic',
        source: '{{ $input }}',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Title'))).toBe(true);
    });

    // Static mode
    it('should pass with valid items in static mode', () => {
      const result = handler.validate({
        mode: 'static',
        items: [{ title: 'Slide 1' }],
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass with multiple items in static mode', () => {
      const result = handler.validate({
        mode: 'static',
        items: [
          { title: 'A', description: 'Desc A' },
          { title: 'B', image: 'http://img.png' },
        ],
      });
      expect(result.valid).toBe(true);
    });

    it('should fail when items is missing in static mode', () => {
      const result = handler.validate({ mode: 'static' });
      expect(result.valid).toBe(false);
      // Schema warningRule "Static 모드에서는 최소 1개 이상의 슬라이드를 추가해야 합니다." fires.
      expect(result.errors.some((e) => e.includes('슬라이드'))).toBe(true);
    });

    it('should fail when items is empty array in static mode', () => {
      const result = handler.validate({ mode: 'static', items: [] });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('슬라이드'))).toBe(true);
    });

    it('should fail when items is not an array in static mode', () => {
      const result = handler.validate({ mode: 'static', items: 'not-array' });
      expect(result.valid).toBe(false);
      // Handler-only residual fires: schema's `length(items) == 0` returns
      // the string length (non-zero) so the warningRule misses this case.
      expect(result.errors).toContain('items must be an array in static mode');
    });

    it('should fail when an item has no title in static mode', () => {
      const result = handler.validate({
        mode: 'static',
        items: [{ description: 'no title' }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('items[0].title');
    });

    it('should fail when an item title is not a string in static mode', () => {
      const result = handler.validate({
        mode: 'static',
        items: [{ title: 42 }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('items[0].title');
    });

    it('should report errors for multiple invalid items', () => {
      const result = handler.validate({
        mode: 'static',
        items: [{ title: 'ok' }, { description: 'missing title' }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('items[1].title');
    });

    // Invalid mode
    it('should fail for invalid mode value', () => {
      const result = handler.validate({ mode: 'unknown' });
      expect(result.valid).toBe(false);
      // Schema warningRule "Mode 는 static 또는 dynamic 이어야 합니다." fires.
      expect(result.errors.some((e) => e.includes('Mode'))).toBe(true);
    });

    // Backward compatibility
    it('should default to dynamic mode when mode is not specified', () => {
      const result = handler.validate({
        source: '{{ $input }}',
        titleField: 'name',
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('execute', () => {
    // Static mode
    it('should use static items directly from config', async () => {
      const result = (await handler.execute(
        null,
        {
          mode: 'static',
          items: [
            {
              title: 'Slide 1',
              description: 'Desc 1',
              image: 'http://img1.png',
            },
            { title: 'Slide 2', description: 'Desc 2', image: '' },
          ],
          layout: 'card',
        },
        context,
      )) as unknown as Record<string, unknown>;

      expect(result.output.type).toBeUndefined();
      expect(result.config.layout).toBe('card');

      const items = result.output.items as Array<Record<string, unknown>>;
      expect(items).toHaveLength(2);
      expect(items[0]).toEqual({
        title: 'Slide 1',
        description: 'Desc 1',
        image: 'http://img1.png',
      });
      expect(items[1]).toEqual({
        title: 'Slide 2',
        description: 'Desc 2',
        image: undefined,
      });
    });

    it('should normalize empty image to undefined in static mode', async () => {
      const result = (await handler.execute(
        null,
        {
          mode: 'static',
          items: [{ title: 'A', description: '', image: '' }],
          layout: 'card',
        },
        context,
      )) as unknown as Record<string, unknown>;

      const items = result.output.items as Array<Record<string, unknown>>;
      expect(items[0].image).toBeUndefined();
    });

    it('should handle missing optional fields in static mode', async () => {
      const result = (await handler.execute(
        null,
        {
          mode: 'static',
          items: [{ title: 'Only Title' }],
        },
        context,
      )) as unknown as Record<string, unknown>;

      const items = result.output.items as Array<Record<string, unknown>>;
      expect(items[0]).toEqual({
        title: 'Only Title',
        description: '',
        image: undefined,
      });
    });

    it('should handle missing items gracefully in static mode', async () => {
      const result = (await handler.execute(
        null,
        { mode: 'static' },
        context,
      )) as unknown as Record<string, unknown>;

      const items = result.output.items as Array<Record<string, unknown>>;
      expect(items).toHaveLength(0);
    });

    // Dynamic mode
    it('should map fields from input array in dynamic mode', async () => {
      const input = [
        { name: 'Item A', summary: 'Sum A', thumb: 'http://a.png' },
        { name: 'Item B', summary: 'Sum B', thumb: 'http://b.png' },
      ];
      const result = (await handler.execute(
        input,
        {
          mode: 'dynamic',
          titleField: 'name',
          descriptionField: 'summary',
          imageField: 'thumb',
          layout: 'image',
        },
        context,
      )) as unknown as Record<string, unknown>;

      expect(result.output.type).toBeUndefined();
      expect(result.config.layout).toBe('image');

      const items = result.output.items as Array<Record<string, unknown>>;
      expect(items).toHaveLength(2);
      expect(items[0]).toEqual({
        title: 'Item A',
        description: 'Sum A',
        image: 'http://a.png',
      });
    });

    it('should limit items by maxItems in dynamic mode', async () => {
      const input = Array.from({ length: 5 }, (_, i) => ({
        t: `Title ${i}`,
      }));
      const result = (await handler.execute(
        input,
        { titleField: 't', maxItems: 2 },
        context,
      )) as unknown as Record<string, unknown>;

      const items = result.output.items as Array<Record<string, unknown>>;
      expect(items).toHaveLength(2);
    });

    it('should wrap single input in array for dynamic mode', async () => {
      const result = (await handler.execute(
        { name: 'Single' },
        { titleField: 'name' },
        context,
      )) as unknown as Record<string, unknown>;

      const items = result.output.items as Array<Record<string, unknown>>;
      expect(items).toHaveLength(1);
      expect(items[0].title).toBe('Single');
    });

    it('should handle missing fields gracefully in dynamic mode', async () => {
      const result = (await handler.execute(
        [{ other: 'value' }],
        { titleField: 'name' },
        context,
      )) as unknown as Record<string, unknown>;

      const items = result.output.items as Array<Record<string, unknown>>;
      expect(items[0].title).toBe('');
    });

    it('should handle null input in dynamic mode', async () => {
      const result = (await handler.execute(
        null,
        { titleField: 'name' },
        context,
      )) as unknown as Record<string, unknown>;

      const items = result.output.items as Array<Record<string, unknown>>;
      expect(items).toHaveLength(0);
    });

    it('should convert non-string field values in dynamic mode', async () => {
      const result = (await handler.execute(
        [{ count: 42, active: true }],
        { titleField: 'count', descriptionField: 'active' },
        context,
      )) as unknown as Record<string, unknown>;

      const items = result.output.items as Array<Record<string, unknown>>;
      expect(items[0].title).toBe('42');
      expect(items[0].description).toBe('true');
    });

    // Backward compatibility
    it('should default to dynamic mode when mode is absent', async () => {
      const result = (await handler.execute(
        [{ name: 'Test' }],
        { titleField: 'name' },
        context,
      )) as unknown as Record<string, unknown>;

      expect(result.output.type).toBeUndefined();
      const items = result.output.items as Array<Record<string, unknown>>;
      expect(items[0].title).toBe('Test');
    });

    // Layout (config only — Principle 1.1)
    it('should default layout to card in config', async () => {
      const result = (await handler.execute(
        null,
        { mode: 'static', items: [{ title: 'X' }] },
        context,
      )) as unknown as Record<string, unknown>;

      expect(result.config.layout).toBe('card');
      expect(result.output.layout).toBeUndefined();
    });

    it('should use specified layout (in config, not output)', async () => {
      const result = (await handler.execute(
        null,
        { mode: 'static', items: [{ title: 'X' }], layout: 'minimal' },
        context,
      )) as unknown as Record<string, unknown>;

      expect(result.config.layout).toBe('minimal');
      expect(result.output.layout).toBeUndefined();
    });

    // Rendered HTML
    it('should include rendered HTML in output', async () => {
      const result = (await handler.execute(
        null,
        {
          mode: 'static',
          items: [{ title: 'Hello', description: 'World' }],
          layout: 'card',
        },
        context,
      )) as unknown as Record<string, unknown>;

      expect(result.output.rendered).toBeDefined();
      expect(typeof result.output.rendered).toBe('string');
      expect(result.output.rendered as string).toContain('carousel');
      expect(result.output.rendered as string).toContain('Hello');
    });

    it('should escape HTML in rendered output', async () => {
      const result = (await handler.execute(
        null,
        {
          mode: 'static',
          items: [{ title: '<script>alert("xss")</script>' }],
        },
        context,
      )) as unknown as Record<string, unknown>;

      expect(result.output.rendered as string).not.toContain('<script>');
      expect(result.output.rendered as string).toContain('&lt;script&gt;');
    });

    it('should sanitize javascript: URLs in image fields', async () => {
      const result = (await handler.execute(
        null,
        {
          mode: 'static',
          items: [{ title: 'XSS', image: 'javascript:alert(1)' }],
        },
        context,
      )) as unknown as Record<string, unknown>;

      const items = result.output.items as Array<Record<string, unknown>>;
      expect(items[0].image).toBeUndefined();
      expect(result.output.rendered as string).not.toContain('javascript:');
    });

    it('should escape double quotes in image attributes', async () => {
      const result = (await handler.execute(
        null,
        {
          mode: 'static',
          items: [{ title: 'Test', image: 'http://img.png" onload="xss()' }],
        },
        context,
      )) as unknown as Record<string, unknown>;

      const rendered = result.output.rendered as string;
      expect(rendered).toContain('&quot;');
      // The " is escaped to &quot; preventing attribute breakout
      expect(rendered).not.toContain('src="http://img.png" onload');
    });

    it('should escape single quotes in rendered output', async () => {
      const result = (await handler.execute(
        null,
        {
          mode: 'static',
          items: [{ title: "it's a test" }],
        },
        context,
      )) as unknown as Record<string, unknown>;

      expect(result.output.rendered as string).toContain('&#39;');
    });
  });

  describe('output cap (PRESENTATION_MAX_BYTES = 1MB)', () => {
    it('passes through items unchanged when total payload is under 1MB', async () => {
      const result = (await handler.execute(
        null,
        {
          mode: 'static',
          items: [
            { title: 'A', description: 'short' },
            { title: 'B', description: 'short' },
          ],
        },
        context,
      )) as unknown as Record<string, unknown>;

      const items = result.output.items as Array<Record<string, unknown>>;
      expect(items).toHaveLength(2);
      expect(result.output.itemsTruncated).toBeUndefined();
      expect(result.output.itemsTotalCount).toBeUndefined();
    });

    it('truncates items array and surfaces itemsTruncated flag when payload exceeds 1MB', async () => {
      // Each item ~200KB → 6 items ≈ 1.2MB > 1MB cap; cap drops the tail
      // and itemsTruncated must surface so downstream observers detect
      // missing data without diff'ing array lengths.
      const heavy = 'x'.repeat(200 * 1024);
      const items = Array.from({ length: 6 }, (_, i) => ({
        title: `T${i}`,
        description: heavy,
      }));

      const result = (await handler.execute(
        null,
        { mode: 'static', items },
        context,
      )) as unknown as Record<string, unknown>;

      expect(result.output.itemsTruncated).toBe(true);
      expect(result.output.itemsTotalCount).toBe(6);
      const echoed = result.output.items as Array<Record<string, unknown>>;
      expect(Array.isArray(echoed)).toBe(true);
      expect(echoed.length).toBeLessThan(6);
      expect(echoed.length).toBeGreaterThan(0);
      expect(
        Buffer.byteLength(JSON.stringify(echoed), 'utf8'),
      ).toBeLessThanOrEqual(1024 * 1024);
    });

    it('truncates dynamic-mode items mapped from a runaway input source', async () => {
      // Dynamic mode pulls items from input/source then maps via titleField.
      // Verify that the cap fires on this path too (different code branch
      // from the static mode test above).
      const heavy = 'z'.repeat(200 * 1024);
      const sourceArray = Array.from({ length: 6 }, (_, i) => ({
        name: `Item-${i}`,
        body: heavy,
      }));

      const result = (await handler.execute(
        sourceArray,
        {
          mode: 'dynamic',
          titleField: 'name',
          descriptionField: 'body',
        },
        context,
      )) as unknown as Record<string, unknown>;

      expect(result.output.itemsTruncated).toBe(true);
      expect(result.output.itemsTotalCount).toBe(6);
      const echoed = result.output.items as Array<Record<string, unknown>>;
      expect(Array.isArray(echoed)).toBe(true);
      expect(echoed.length).toBeLessThan(6);
    });

    it('rendered HTML is computed from the capped items, not the full input', async () => {
      // Regression for ai-review CRIT #1: rendered must reflect what was
      // actually surfaced via output.items so downstream observers cannot
      // see HTML for items that were dropped from the array.
      const heavy = 'x'.repeat(200 * 1024);
      const items = Array.from({ length: 6 }, (_, i) => ({
        title: `Slide-${i}`,
        description: heavy,
      }));

      const result = (await handler.execute(
        null,
        { mode: 'static', items },
        context,
      )) as unknown as Record<string, unknown>;

      const echoed = result.output.items as Array<Record<string, unknown>>;
      const rendered = result.output.rendered as string;
      // Every echoed item's title shows up in rendered HTML…
      for (const item of echoed) {
        expect(rendered).toContain(item.title as string);
      }
      // …but dropped items (those past `echoed.length`) must NOT.
      for (let i = echoed.length; i < items.length; i++) {
        expect(rendered).not.toContain(`Slide-${i}`);
      }
    });
  });
});
