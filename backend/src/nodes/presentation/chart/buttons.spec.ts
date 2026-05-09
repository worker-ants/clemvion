import { ChartHandler } from './chart.handler.js';

describe('ChartHandler - Buttons', () => {
  let handler: ChartHandler;

  beforeEach(() => {
    handler = new ChartHandler();
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
    it('should pass with valid buttons', () => {
      const result = handler.validate({
        chartType: 'bar',
        xAxis: { field: 'month' },
        yAxis: { field: 'revenue' },
        buttons: [{ id: 'btn-1', label: 'Approve', type: 'port' }],
      });
      expect(result.valid).toBe(true);
    });

    it('should fail with invalid buttons', () => {
      const result = handler.validate({
        chartType: 'bar',
        xAxis: { field: 'month' },
        yAxis: { field: 'revenue' },
        buttons: [{ id: 'btn-1', label: '', type: 'port' }],
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('execute with buttons', () => {
    it('should return waiting_for_input when buttons configured', async () => {
      const buttons = [{ id: 'btn-1', label: 'OK', type: 'port' }];
      const result = (await handler.execute(
        [{ month: 'Jan', revenue: 100 }],
        {
          chartType: 'bar',
          xAxis: { field: 'month' },
          yAxis: { field: 'revenue' },
          buttons,
        },
        context,
      )) as unknown as Record<string, unknown>;

      expect(result.output.type).toBeUndefined();
      expect(result.status).toBe('waiting_for_input');
      expect(result.meta?.interactionType).toBe('buttons');
      expect(result.output.data).toBeDefined();
    });

    it('should return normal output without buttons', async () => {
      const result = (await handler.execute(
        [{ month: 'Jan', revenue: 100 }],
        {
          chartType: 'bar',
          xAxis: { field: 'month' },
          yAxis: { field: 'revenue' },
        },
        context,
      )) as unknown as Record<string, unknown>;

      expect(result.output.type).toBeUndefined();
      expect(result.status).toBeUndefined();
    });
  });
});
