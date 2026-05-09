import { CarouselHandler } from './carousel.handler.js';

describe('CarouselHandler - Buttons', () => {
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

  describe('validate with buttons', () => {
    it('should pass with valid buttons config', () => {
      const result = handler.validate({
        source: '{{ $input }}',
        titleField: 'name',
        buttons: [{ id: 'btn-1', label: 'Approve', type: 'port' }],
      });
      expect(result.valid).toBe(true);
    });

    it('should fail with invalid button config', () => {
      const result = handler.validate({
        source: '{{ $input }}',
        titleField: 'name',
        buttons: [{ id: 'btn-1', label: '', type: 'port' }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('label'))).toBe(true);
    });

    it('should fail with link button missing URL', () => {
      const result = handler.validate({
        source: '{{ $input }}',
        titleField: 'name',
        buttons: [{ id: 'btn-1', label: 'Link', type: 'link' }],
      });
      expect(result.valid).toBe(false);
    });

    it('should fail with port button having URL', () => {
      const result = handler.validate({
        titleField: 'name',
        buttons: [
          {
            id: 'btn-1',
            label: 'Port',
            type: 'port',
            url: 'http://x.com',
          },
        ],
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('execute with buttons (blocking mode)', () => {
    it('should return waiting_for_input when buttons are configured', async () => {
      const buttons = [
        { id: 'btn-1', label: 'Approve', type: 'port', style: 'primary' },
        { id: 'btn-2', label: 'Reject', type: 'port', style: 'danger' },
      ];
      const result = (await handler.execute(
        [{ name: 'Item 1' }],
        {
          titleField: 'name',
          buttons,
        },
        context,
      )) as unknown as Record<string, unknown>;

      expect(result.output.type).toBeUndefined();
      expect(result.status).toBe('waiting_for_input');
      expect(result.meta?.interactionType).toBe('buttons');
      expect(result.config.buttonConfig).toEqual({ buttons });
      // Layout literal is in config only (Principle 1.1); runtime items/rendered stay in output.
      expect(result.output.items).toBeDefined();
      expect(result.output.layout).toBeUndefined();
      expect(result.config.layout).toBeDefined();
      expect(result.output.rendered).toBeDefined();
    });

    it('should return normal output when buttons array is empty', async () => {
      const result = (await handler.execute(
        [{ name: 'Item 1' }],
        { titleField: 'name', buttons: [] },
        context,
      )) as unknown as Record<string, unknown>;

      expect(result.output.type).toBeUndefined();
      expect(result.status).toBeUndefined();
      expect(result.meta?.interactionType).toBeUndefined();
    });

    it('should return normal output when no buttons configured', async () => {
      const result = (await handler.execute(
        [{ name: 'Item 1' }],
        { titleField: 'name' },
        context,
      )) as unknown as Record<string, unknown>;

      expect(result.output.type).toBeUndefined();
      expect(result.status).toBeUndefined();
    });
  });
});
