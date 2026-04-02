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
  };

  describe('validate', () => {
    // Dynamic mode
    it('should pass with valid titleField in dynamic mode', () => {
      const result = handler.validate({ titleField: 'name' });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass with explicit mode=dynamic and titleField', () => {
      const result = handler.validate({
        mode: 'dynamic',
        titleField: 'name',
      });
      expect(result.valid).toBe(true);
    });

    it('should fail when titleField is missing in dynamic mode', () => {
      const result = handler.validate({});
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('titleField');
    });

    it('should fail when titleField is not a string in dynamic mode', () => {
      const result = handler.validate({ titleField: 123 });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('titleField');
    });

    it('should fail when mode=dynamic and titleField is missing', () => {
      const result = handler.validate({ mode: 'dynamic' });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('titleField');
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
      expect(result.errors[0]).toContain('items');
    });

    it('should fail when items is empty array in static mode', () => {
      const result = handler.validate({ mode: 'static', items: [] });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('items');
    });

    it('should fail when items is not an array in static mode', () => {
      const result = handler.validate({ mode: 'static', items: 'not-array' });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('items');
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
      expect(result.errors[0]).toContain('mode');
    });

    // Backward compatibility
    it('should default to dynamic mode when mode is not specified', () => {
      const result = handler.validate({ titleField: 'name' });
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
      )) as Record<string, unknown>;

      expect(result.type).toBe('carousel');
      expect(result.layout).toBe('card');

      const items = result.items as Array<Record<string, unknown>>;
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
      )) as Record<string, unknown>;

      const items = result.items as Array<Record<string, unknown>>;
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
      )) as Record<string, unknown>;

      const items = result.items as Array<Record<string, unknown>>;
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
      )) as Record<string, unknown>;

      const items = result.items as Array<Record<string, unknown>>;
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
      )) as Record<string, unknown>;

      expect(result.type).toBe('carousel');
      expect(result.layout).toBe('image');

      const items = result.items as Array<Record<string, unknown>>;
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
      )) as Record<string, unknown>;

      const items = result.items as Array<Record<string, unknown>>;
      expect(items).toHaveLength(2);
    });

    it('should wrap single input in array for dynamic mode', async () => {
      const result = (await handler.execute(
        { name: 'Single' },
        { titleField: 'name' },
        context,
      )) as Record<string, unknown>;

      const items = result.items as Array<Record<string, unknown>>;
      expect(items).toHaveLength(1);
      expect(items[0].title).toBe('Single');
    });

    it('should handle missing fields gracefully in dynamic mode', async () => {
      const result = (await handler.execute(
        [{ other: 'value' }],
        { titleField: 'name' },
        context,
      )) as Record<string, unknown>;

      const items = result.items as Array<Record<string, unknown>>;
      expect(items[0].title).toBe('');
    });

    it('should handle null input in dynamic mode', async () => {
      const result = (await handler.execute(
        null,
        { titleField: 'name' },
        context,
      )) as Record<string, unknown>;

      const items = result.items as Array<Record<string, unknown>>;
      expect(items).toHaveLength(0);
    });

    it('should convert non-string field values in dynamic mode', async () => {
      const result = (await handler.execute(
        [{ count: 42, active: true }],
        { titleField: 'count', descriptionField: 'active' },
        context,
      )) as Record<string, unknown>;

      const items = result.items as Array<Record<string, unknown>>;
      expect(items[0].title).toBe('42');
      expect(items[0].description).toBe('true');
    });

    // Backward compatibility
    it('should default to dynamic mode when mode is absent', async () => {
      const result = (await handler.execute(
        [{ name: 'Test' }],
        { titleField: 'name' },
        context,
      )) as Record<string, unknown>;

      expect(result.type).toBe('carousel');
      const items = result.items as Array<Record<string, unknown>>;
      expect(items[0].title).toBe('Test');
    });

    // Layout
    it('should default layout to card', async () => {
      const result = (await handler.execute(
        null,
        { mode: 'static', items: [{ title: 'X' }] },
        context,
      )) as Record<string, unknown>;

      expect(result.layout).toBe('card');
    });

    it('should use specified layout', async () => {
      const result = (await handler.execute(
        null,
        { mode: 'static', items: [{ title: 'X' }], layout: 'minimal' },
        context,
      )) as Record<string, unknown>;

      expect(result.layout).toBe('minimal');
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
      )) as Record<string, unknown>;

      expect(result.rendered).toBeDefined();
      expect(typeof result.rendered).toBe('string');
      expect(result.rendered as string).toContain('carousel');
      expect(result.rendered as string).toContain('Hello');
    });

    it('should escape HTML in rendered output', async () => {
      const result = (await handler.execute(
        null,
        {
          mode: 'static',
          items: [{ title: '<script>alert("xss")</script>' }],
        },
        context,
      )) as Record<string, unknown>;

      expect(result.rendered as string).not.toContain('<script>');
      expect(result.rendered as string).toContain('&lt;script&gt;');
    });

    it('should sanitize javascript: URLs in image fields', async () => {
      const result = (await handler.execute(
        null,
        {
          mode: 'static',
          items: [{ title: 'XSS', image: 'javascript:alert(1)' }],
        },
        context,
      )) as Record<string, unknown>;

      const items = result.items as Array<Record<string, unknown>>;
      expect(items[0].image).toBeUndefined();
      expect(result.rendered as string).not.toContain('javascript:');
    });

    it('should escape double quotes in image attributes', async () => {
      const result = (await handler.execute(
        null,
        {
          mode: 'static',
          items: [{ title: 'Test', image: 'http://img.png" onload="xss()' }],
        },
        context,
      )) as Record<string, unknown>;

      const rendered = result.rendered as string;
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
      )) as Record<string, unknown>;

      expect(result.rendered as string).toContain('&#39;');
    });
  });
});
