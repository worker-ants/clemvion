import { ExecutionsController } from './executions.controller';

describe('ExecutionsController', () => {
  let controller: ExecutionsController;
  let mockExecutionsService: Record<string, jest.Mock>;
  let mockExecutionEngineService: Record<string, jest.Mock>;

  beforeEach(() => {
    mockExecutionsService = {
      findById: jest
        .fn()
        .mockResolvedValue({ id: 'exec-1', status: 'running' }),
      findByWorkflow: jest.fn().mockResolvedValue({ data: [], totalItems: 0 }),
      stop: jest.fn().mockResolvedValue({ id: 'exec-1', status: 'stopped' }),
    };

    mockExecutionEngineService = {
      continueExecution: jest.fn(),
    };

    controller = new ExecutionsController(
      mockExecutionsService as never,
      mockExecutionEngineService as never,
    );
  });

  describe('continueExecution', () => {
    it('should call executionEngineService and return success', () => {
      const result = controller.continueExecution('exec-1', {
        formData: { field: 'value' },
      });

      expect(mockExecutionEngineService.continueExecution).toHaveBeenCalledWith(
        'exec-1',
        { field: 'value' },
      );
      expect(result).toEqual({ success: true });
    });

    it('should propagate errors from executionEngineService', () => {
      mockExecutionEngineService.continueExecution.mockImplementation(() => {
        throw new Error('Execution not found');
      });

      expect(() => controller.continueExecution('exec-1')).toThrow(
        'Execution not found',
      );
    });

    it('should handle missing body', () => {
      const result = controller.continueExecution('exec-1');

      expect(mockExecutionEngineService.continueExecution).toHaveBeenCalledWith(
        'exec-1',
        undefined,
      );
      expect(result).toEqual({ success: true });
    });
  });
});
