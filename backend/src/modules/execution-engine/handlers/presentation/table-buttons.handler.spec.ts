import { TableHandler } from './table.handler.js';

describe('TableHandler - Buttons', () => {
  let handler: TableHandler;

  beforeEach(() => {
    handler = new TableHandler();
  });

  const context = {
    executionId: 'exec-1',
    workflowId: 'wf-1',
    variables: {},
    nodeOutputCache: {},
  };

  describe('validate with buttons', () => {
    it('should pass with valid buttons', () => {
      const result = handler.validate({
        columns: [{ field: 'name', label: 'Name' }],
        buttons: [{ id: 'btn-1', label: 'Approve', type: 'port' }],
      });
      expect(result.valid).toBe(true);
    });

    it('should fail with invalid buttons', () => {
      const result = handler.validate({
        columns: [{ field: 'name', label: 'Name' }],
        buttons: [{ id: 'btn-1', label: '', type: 'port' }],
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('execute with buttons', () => {
    it('should return waiting_for_input when buttons configured', async () => {
      const buttons = [{ id: 'btn-1', label: 'OK', type: 'port' }];
      const result = (await handler.execute(
        [{ name: 'Row 1' }],
        {
          columns: [{ field: 'name', label: 'Name' }],
          buttons,
        },
        context,
      )) as Record<string, unknown>;

      expect(result.type).toBe('table');
      expect(result.status).toBe('waiting_for_input');
      expect(result.interactionType).toBe('buttons');
      expect(result.rows).toBeDefined();
      expect(result.rendered).toBeDefined();
    });

    it('should return normal output without buttons', async () => {
      const result = (await handler.execute(
        [{ name: 'Row 1' }],
        { columns: [{ field: 'name', label: 'Name' }] },
        context,
      )) as Record<string, unknown>;

      expect(result.type).toBe('table');
      expect(result.status).toBeUndefined();
    });
  });
});
