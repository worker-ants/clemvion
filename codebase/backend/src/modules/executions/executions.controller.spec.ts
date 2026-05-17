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
      // CRIT #1 — IDOR 차단을 위해 controller 가 verifyOwnership 호출.
      verifyOwnership: jest.fn().mockResolvedValue(undefined),
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
    it('should verify ownership and call executionEngineService', async () => {
      const result = await controller.continueExecution(
        'exec-1',
        'workspace-1',
        { formData: { field: 'value' } },
      );

      expect(mockExecutionsService.verifyOwnership).toHaveBeenCalledWith(
        'exec-1',
        'workspace-1',
      );
      expect(mockExecutionEngineService.continueExecution).toHaveBeenCalledWith(
        'exec-1',
        { field: 'value' },
      );
      expect(result).toEqual({ success: true });
    });

    it('should reject when ownership verification fails (IDOR guard)', async () => {
      mockExecutionsService.verifyOwnership.mockRejectedValueOnce(
        new Error('Execution not found'),
      );

      await expect(
        controller.continueExecution('exec-victim', 'workspace-attacker'),
      ).rejects.toThrow('Execution not found');
      expect(
        mockExecutionEngineService.continueExecution,
      ).not.toHaveBeenCalled();
    });

    it('should propagate errors from executionEngineService', async () => {
      mockExecutionEngineService.continueExecution.mockImplementation(() => {
        throw new Error('Execution not found');
      });

      await expect(
        controller.continueExecution('exec-1', 'workspace-1'),
      ).rejects.toThrow('Execution not found');
    });

    it('should handle missing body', async () => {
      const result = await controller.continueExecution(
        'exec-1',
        'workspace-1',
      );

      expect(mockExecutionEngineService.continueExecution).toHaveBeenCalledWith(
        'exec-1',
        undefined,
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('stop', () => {
    it('should verify ownership and call stop', async () => {
      const result = await controller.stop('exec-1', 'workspace-1');

      expect(mockExecutionsService.verifyOwnership).toHaveBeenCalledWith(
        'exec-1',
        'workspace-1',
      );
      expect(mockExecutionsService.stop).toHaveBeenCalledWith('exec-1');
      expect(result).toEqual({ id: 'exec-1', status: 'stopped' });
    });

    it('should reject when ownership verification fails', async () => {
      mockExecutionsService.verifyOwnership.mockRejectedValueOnce(
        new Error('Execution not found'),
      );

      await expect(
        controller.stop('exec-victim', 'workspace-attacker'),
      ).rejects.toThrow('Execution not found');
      expect(mockExecutionsService.stop).not.toHaveBeenCalled();
    });
  });
});
