import { CarouselHandler } from './carousel.handler.js';
import { createEmptyConversationThread } from '../../../modules/execution-engine/conversation-thread/conversation-thread.types';

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
    conversationThread: createEmptyConversationThread(),
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
    // ── Static mode (Principle 1.1 / 4.3 — items live in config.items only) ──
    it('static mode: items live in config.items, output stays empty', async () => {
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

      // Principle 1.1: literal slides are NOT echoed into output.
      expect(result.output.items).toBeUndefined();
      // Principle 1 (no presentation artefact in output):
      expect(result.output.rendered).toBeUndefined();
      // Layout literal is config-only (Principle 1.1):
      expect(result.config.layout).toBe('card');
      // Raw items round-trip through config echo:
      const cfgItems = result.config.items as Array<Record<string, unknown>>;
      expect(cfgItems).toHaveLength(2);
      expect(cfgItems[0].title).toBe('Slide 1');
    });

    it('static mode (non-blocking): output is `{}` when no buttons configured', async () => {
      const result = (await handler.execute(
        null,
        {
          mode: 'static',
          items: [{ title: 'Only Title' }],
        },
        context,
      )) as unknown as Record<string, unknown>;

      expect(result.output).toEqual({});
      expect(result.status).toBeUndefined();
    });

    it('static mode: handles missing items gracefully (output stays empty)', async () => {
      const result = (await handler.execute(
        null,
        { mode: 'static' },
        context,
      )) as unknown as Record<string, unknown>;

      expect(result.output).toEqual({});
    });

    // ── Dynamic mode (Principle 4.3 — runtime items surface via output.items) ──
    it('dynamic mode: maps fields from input array into output.items', async () => {
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

      expect(result.output.rendered).toBeUndefined();
      expect(result.config.layout).toBe('image');

      const items = result.output.items as Array<Record<string, unknown>>;
      expect(items).toHaveLength(2);
      expect(items[0]).toEqual({
        title: 'Item A',
        description: 'Sum A',
        image: 'http://a.png',
      });
    });

    it('dynamic mode: limits items by maxItems', async () => {
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

    it('dynamic mode: wraps single input in array', async () => {
      const result = (await handler.execute(
        { name: 'Single' },
        { titleField: 'name' },
        context,
      )) as unknown as Record<string, unknown>;

      const items = result.output.items as Array<Record<string, unknown>>;
      expect(items).toHaveLength(1);
      expect(items[0].title).toBe('Single');
    });

    it('dynamic mode: handles missing fields gracefully', async () => {
      const result = (await handler.execute(
        [{ other: 'value' }],
        { titleField: 'name' },
        context,
      )) as unknown as Record<string, unknown>;

      const items = result.output.items as Array<Record<string, unknown>>;
      expect(items[0].title).toBe('');
    });

    it('dynamic mode: handles null input', async () => {
      const result = (await handler.execute(
        null,
        { titleField: 'name' },
        context,
      )) as unknown as Record<string, unknown>;

      const items = result.output.items as Array<Record<string, unknown>>;
      expect(items).toHaveLength(0);
    });

    it('dynamic mode: converts non-string field values', async () => {
      const result = (await handler.execute(
        [{ count: 42, active: true }],
        { titleField: 'count', descriptionField: 'active' },
        context,
      )) as unknown as Record<string, unknown>;

      const items = result.output.items as Array<Record<string, unknown>>;
      expect(items[0].title).toBe('42');
      expect(items[0].description).toBe('true');
    });

    it('dynamic mode: sanitizes javascript: URLs in image fields', async () => {
      const result = (await handler.execute(
        [{ name: 'XSS', img: 'javascript:alert(1)' }],
        {
          mode: 'dynamic',
          titleField: 'name',
          imageField: 'img',
        },
        context,
      )) as unknown as Record<string, unknown>;

      const items = result.output.items as Array<Record<string, unknown>>;
      expect(items[0].image).toBeUndefined();
    });

    // Backward compatibility
    it('defaults to dynamic mode when mode is absent', async () => {
      const result = (await handler.execute(
        [{ name: 'Test' }],
        { titleField: 'name' },
        context,
      )) as unknown as Record<string, unknown>;

      const items = result.output.items as Array<Record<string, unknown>>;
      expect(items[0].title).toBe('Test');
    });

    // Layout (config only — Principle 1.1)
    it('defaults layout to card in config', async () => {
      const result = (await handler.execute(
        null,
        { mode: 'static', items: [{ title: 'X' }] },
        context,
      )) as unknown as Record<string, unknown>;

      expect(result.config.layout).toBe('card');
      expect(result.output.layout).toBeUndefined();
    });

    it('uses specified layout (in config, not output)', async () => {
      const result = (await handler.execute(
        null,
        { mode: 'static', items: [{ title: 'X' }], layout: 'minimal' },
        context,
      )) as unknown as Record<string, unknown>;

      expect(result.config.layout).toBe('minimal');
      expect(result.output.layout).toBeUndefined();
    });

    // ── output.rendered removal (Principle 1) ──
    it('does NOT include rendered HTML in output (static)', async () => {
      const result = (await handler.execute(
        null,
        {
          mode: 'static',
          items: [{ title: 'Hello', description: 'World' }],
          layout: 'card',
        },
        context,
      )) as unknown as Record<string, unknown>;

      expect(result.output.rendered).toBeUndefined();
    });

    it('does NOT include rendered HTML in output (dynamic)', async () => {
      const result = (await handler.execute(
        [{ name: 'Hello' }],
        { mode: 'dynamic', titleField: 'name' },
        context,
      )) as unknown as Record<string, unknown>;

      expect(result.output.rendered).toBeUndefined();
    });
  });

  describe('output cap (PRESENTATION_MAX_BYTES = 1MB)', () => {
    it("static mode: cap on items doesn't bleed into output (output stays `{}`)", async () => {
      // Static-mode items live in `config.items`, so the runtime cap on the
      // evaluated array does not surface in output. The cap still runs to
      // keep the buttonItemMap aligned to the surfaced item count, but the
      // static non-blocking output is empty.
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

      expect(result.output).toEqual({});
    });

    it('dynamic mode: passes through items unchanged when total payload is under 1MB', async () => {
      const result = (await handler.execute(
        [
          { n: 'A', d: 'short' },
          { n: 'B', d: 'short' },
        ],
        {
          mode: 'dynamic',
          titleField: 'n',
          descriptionField: 'd',
        },
        context,
      )) as unknown as Record<string, unknown>;

      const items = result.output.items as Array<Record<string, unknown>>;
      expect(items).toHaveLength(2);
      expect(result.output.itemsTruncated).toBeUndefined();
      expect(result.output.itemsTotalCount).toBeUndefined();
    });

    it('dynamic mode: truncates items array and surfaces itemsTruncated flag when payload exceeds 1MB', async () => {
      // Each item ~200KB → 6 items ≈ 1.2MB > 1MB cap; cap drops the tail
      // and itemsTruncated must surface so downstream observers detect
      // missing data without diff'ing array lengths.
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
      expect(echoed.length).toBeGreaterThan(0);
      expect(
        Buffer.byteLength(JSON.stringify(echoed), 'utf8'),
      ).toBeLessThanOrEqual(1024 * 1024);
    });
  });
});
