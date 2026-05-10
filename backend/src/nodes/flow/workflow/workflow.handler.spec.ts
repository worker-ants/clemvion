import { WorkflowHandler, mapSubWorkflowError } from './workflow.handler.js';
import { ExecutionContext } from '../../core/node-handler.interface.js';
import { WorkflowExecutor } from '../../core/workflow-executor.interface.js';
import { ErrorCode } from '../../core/error-codes.js';

describe('WorkflowHandler', () => {
  let handler: WorkflowHandler;
  let mockExecutor: jest.Mocked<WorkflowExecutor>;
  let context: ExecutionContext;

  beforeEach(() => {
    mockExecutor = {
      executeInline: jest.fn(),
      executeAsync: jest.fn(),
    };
    handler = new WorkflowHandler(mockExecutor);
    context = {
      executionId: 'parent-exec-1',
      workflowId: 'parent-wf-1',
      variables: {},
      nodeOutputCache: {},
      structuredOutputCache: {},
      engineResolvedConfigCache: {},
      recursionDepth: 0,
      _executedNodes: new Set<string>(),
    };
  });

  describe('validate', () => {
    it('should return valid for minimal sync config', () => {
      const result = handler.validate({
        workflowId: 'wf-123',
        mode: 'sync',
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return valid for async config with all fields', () => {
      const result = handler.validate({
        workflowId: 'wf-123',
        mode: 'async',
        timeout: 60,
        inputMapping: [{ paramName: 'data', expression: '{{ $input.data }}' }],
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when workflowId is missing', () => {
      const result = handler.validate({ mode: 'sync' });
      expect(result.valid).toBe(false);
      // Schema warningRule "실행할 워크플로우를 선택해야 합니다." fires.
      expect(result.errors.some((e) => e.includes('워크플로우'))).toBe(true);
    });

    it('should fail when workflowId is not a string', () => {
      const result = handler.validate({ workflowId: 123, mode: 'sync' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'workflowId is required and must be a string',
      );
    });

    it('should fail when mode is invalid', () => {
      const result = handler.validate({
        workflowId: 'wf-123',
        mode: 'invalid',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('mode must be "sync" or "async"');
    });

    it('should allow timeout = 0 (no timeout)', () => {
      const result = handler.validate({
        workflowId: 'wf-123',
        mode: 'sync',
        timeout: 0,
      });
      expect(result.valid).toBe(true);
    });

    it('should fail when timeout is negative', () => {
      const result = handler.validate({
        workflowId: 'wf-123',
        mode: 'sync',
        timeout: -10,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'timeout must be a non-negative number (0 = no timeout)',
      );
    });

    it('should fail when inputMapping is not an array', () => {
      const result = handler.validate({
        workflowId: 'wf-123',
        mode: 'sync',
        inputMapping: 'bad',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('inputMapping must be an array');
    });

    it('should fail when inputMapping entry has no paramName', () => {
      const result = handler.validate({
        workflowId: 'wf-123',
        mode: 'sync',
        inputMapping: [{ expression: 'value' }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('paramName is required');
    });
  });

  describe('execute - sync mode (inline)', () => {
    const syncConfig = {
      workflowId: 'sub-wf-1',
      mode: 'sync' as const,
    };

    it('should call executeInline and wrap sub-workflow output under output.result (D-1)', async () => {
      const subOutput = { result: 'success', data: [1, 2, 3] };
      mockExecutor.executeInline.mockResolvedValue(subOutput);

      const result = await handler.execute(
        { input: 'data' },
        syncConfig,
        context,
      );

      // D-1: sync result is wrapped one level under output.result so the
      // shape stays uniform regardless of the sub-workflow's final output.
      expect((result as { output: unknown }).output).toEqual({
        result: subOutput,
      });
      expect(mockExecutor.executeInline).toHaveBeenCalledWith(
        'sub-wf-1',
        { input: 'data' },
        {
          executionId: 'parent-exec-1',
          context,
          executedNodes: context._executedNodes,
          recursionDepth: 1,
          parentNodeExecutionId: context.nodeExecutionId,
        },
      );
    });

    it('wraps even primitive / null sub-workflow outputs under output.result', async () => {
      mockExecutor.executeInline.mockResolvedValue(null);

      const result = await handler.execute({}, syncConfig, context);

      expect((result as { output: unknown }).output).toEqual({ result: null });
    });

    it("should pass the workflow node's own nodeExecutionId as parentNodeExecutionId for children", async () => {
      context.nodeExecutionId = 'workflow-node-exec-42';
      mockExecutor.executeInline.mockResolvedValue({});

      await handler.execute({}, syncConfig, context);

      expect(mockExecutor.executeInline).toHaveBeenCalledWith(
        'sub-wf-1',
        {},
        expect.objectContaining({
          parentNodeExecutionId: 'workflow-node-exec-42',
        }),
      );
    });

    it('routes to error port when executeInline throws (CONVENTIONS §3.2)', async () => {
      mockExecutor.executeInline.mockRejectedValue(
        new Error('Expression error in config'),
      );

      const result = (await handler.execute(
        {},
        syncConfig,
        context,
      )) as unknown as {
        port: string;
        output: { error: { code: string; message: string } };
      };
      expect(result.port).toBe('error');
      // Generic runtime failure → default code.
      expect(result.output.error.code).toBe(ErrorCode.SUB_WORKFLOW_FAILED);
      expect(result.output.error.message).toContain('Expression error');
    });

    it('should pass recursionDepth + 1 to inline execution', async () => {
      context.recursionDepth = 5;
      mockExecutor.executeInline.mockResolvedValue({});

      await handler.execute({}, syncConfig, context);

      expect(mockExecutor.executeInline).toHaveBeenCalledWith(
        'sub-wf-1',
        {},
        expect.objectContaining({ recursionDepth: 6 }),
      );
    });

    it('should throw if _executedNodes is missing from context', async () => {
      context._executedNodes = undefined;

      await expect(handler.execute({}, syncConfig, context)).rejects.toThrow(
        '_executedNodes in context',
      );
    });
  });

  describe('execute - async mode', () => {
    const asyncConfig = {
      workflowId: 'sub-wf-1',
      mode: 'async' as const,
    };

    it('should call executeAsync and return execution info (A-2)', async () => {
      mockExecutor.executeAsync.mockResolvedValue('sub-exec-async-1');

      const result = await handler.execute(
        { data: 'test' },
        asyncConfig,
        context,
      );

      // A-2: async output is enriched with workflowId + status, and the
      // top-level `status` field is set (replacing the old `meta.status`).
      expect(result).toMatchObject({
        config: { workflowId: 'sub-wf-1', mode: 'async' },
        output: {
          executionId: 'sub-exec-async-1',
          workflowId: 'sub-wf-1',
          status: 'started',
        },
        status: 'started',
      });
      // The previous `meta.status: 'started'` is no longer emitted.
      expect((result as { meta?: unknown }).meta).toBeUndefined();
      expect(mockExecutor.executeAsync).toHaveBeenCalledWith(
        'sub-wf-1',
        { data: 'test' },
        {
          parentExecutionId: 'parent-exec-1',
          recursionDepth: 1,
        },
      );
    });

    it('should not call executeInline for async mode', async () => {
      mockExecutor.executeAsync.mockResolvedValue('sub-exec-async-1');

      const result = await handler.execute({}, asyncConfig, context);

      expect(result).toBeDefined();
      expect(mockExecutor.executeInline).not.toHaveBeenCalled();
    });
  });

  describe('execute - recursion depth', () => {
    it('should throw when recursion depth >= 10', async () => {
      context.recursionDepth = 10;

      await expect(
        handler.execute({}, { workflowId: 'sub-wf-1', mode: 'sync' }, context),
      ).rejects.toThrow('Maximum recursion depth exceeded (limit: 10)');

      expect(mockExecutor.executeInline).not.toHaveBeenCalled();
      expect(mockExecutor.executeAsync).not.toHaveBeenCalled();
    });

    it('should throw at depth 15', async () => {
      context.recursionDepth = 15;

      await expect(
        handler.execute({}, { workflowId: 'sub-wf-1', mode: 'async' }, context),
      ).rejects.toThrow('Maximum recursion depth exceeded');
    });

    it('should allow execution at depth 9', async () => {
      context.recursionDepth = 9;
      mockExecutor.executeInline.mockResolvedValue({ ok: true });

      const result = await handler.execute(
        {},
        { workflowId: 'sub-wf-1', mode: 'sync' },
        context,
      );

      // D-1 wrap: output.result holds the sub-workflow output.
      expect((result as { output: unknown }).output).toEqual({
        result: { ok: true },
      });
      expect(mockExecutor.executeInline).toHaveBeenCalledWith(
        'sub-wf-1',
        {},
        expect.objectContaining({ recursionDepth: 10 }),
      );
    });

    it('should default recursionDepth to 0 when undefined', async () => {
      context.recursionDepth = undefined;
      mockExecutor.executeInline.mockResolvedValue({});

      await handler.execute(
        {},
        { workflowId: 'sub-wf-1', mode: 'sync' },
        context,
      );

      expect(mockExecutor.executeInline).toHaveBeenCalledWith(
        'sub-wf-1',
        {},
        expect.objectContaining({ recursionDepth: 1 }),
      );
    });
  });

  describe('execute - input mapping', () => {
    it('should build subInput from inputMapping', async () => {
      mockExecutor.executeInline.mockResolvedValue({});

      const config = {
        workflowId: 'sub-wf-1',
        mode: 'sync',
        inputMapping: [
          { paramName: 'name', expression: 'resolved-name' },
          { paramName: 'count', expression: 42 },
        ],
      };

      await handler.execute({ original: 'data' }, config, context);

      expect(mockExecutor.executeInline).toHaveBeenCalledWith(
        'sub-wf-1',
        { name: 'resolved-name', count: 42 },
        expect.any(Object),
      );
    });

    it('should pass parent input when inputMapping is empty', async () => {
      mockExecutor.executeInline.mockResolvedValue({});

      const parentInput = { foo: 'bar', nested: { a: 1 } };
      await handler.execute(
        parentInput,
        { workflowId: 'sub-wf-1', mode: 'sync' },
        context,
      );

      expect(mockExecutor.executeInline).toHaveBeenCalledWith(
        'sub-wf-1',
        parentInput,
        expect.any(Object),
      );
    });

    it('should pass parent input when inputMapping is not provided', async () => {
      mockExecutor.executeAsync.mockResolvedValue('sub-exec-1');

      const parentInput = { data: 'pass-through' };
      await handler.execute(
        parentInput,
        { workflowId: 'sub-wf-1', mode: 'async' },
        context,
      );

      expect(mockExecutor.executeAsync).toHaveBeenCalledWith(
        'sub-wf-1',
        parentInput,
        expect.any(Object),
      );
    });

    it('should handle null input with empty inputMapping', async () => {
      mockExecutor.executeInline.mockResolvedValue({});

      await handler.execute(
        null,
        { workflowId: 'sub-wf-1', mode: 'sync' },
        context,
      );

      expect(mockExecutor.executeInline).toHaveBeenCalledWith(
        'sub-wf-1',
        null,
        expect.any(Object),
      );
    });
  });

  describe('execute - error propagation (A-3 code mapping)', () => {
    type ErrorResult = {
      port: string;
      output: {
        error: {
          code: string;
          message: string;
          details?: Record<string, unknown>;
        };
      };
    };

    // Post Stage 4 follow-up: sub-workflow runtime failures route to the
    // `error` port with CONVENTIONS §3.2 `output.error` envelope instead
    // of throwing.
    it('maps "Workflow not found" → SUB_WORKFLOW_NOT_FOUND (async path)', async () => {
      mockExecutor.executeAsync.mockRejectedValue(
        new Error('Workflow not found: sub-wf-1'),
      );

      const result = (await handler.execute(
        {},
        { workflowId: 'sub-wf-1', mode: 'async' },
        context,
      )) as unknown as ErrorResult;
      expect(result.port).toBe('error');
      expect(result.output.error.code).toBe(ErrorCode.SUB_WORKFLOW_NOT_FOUND);
      expect(result.output.error.message).toContain('Workflow not found');
      expect(result.output.error.details).toMatchObject({
        workflowId: 'sub-wf-1',
        mode: 'async',
      });
    });

    it('maps "Workflow not found" → SUB_WORKFLOW_NOT_FOUND (sync path)', async () => {
      mockExecutor.executeInline.mockRejectedValue(
        new Error('Workflow not found: sub-wf-9999'),
      );

      const result = (await handler.execute(
        {},
        { workflowId: 'sub-wf-9999', mode: 'sync' },
        context,
      )) as unknown as ErrorResult;
      expect(result.port).toBe('error');
      expect(result.output.error.code).toBe(ErrorCode.SUB_WORKFLOW_NOT_FOUND);
      expect(result.output.error.details).toMatchObject({
        workflowId: 'sub-wf-9999',
        mode: 'sync',
      });
    });

    it('maps "timed out" → SUB_WORKFLOW_TIMEOUT (sync path)', async () => {
      mockExecutor.executeInline.mockRejectedValue(
        new Error('Sub-workflow execution timed out after 300000ms'),
      );

      const result = (await handler.execute(
        {},
        { workflowId: 'sub-wf-1', mode: 'sync' },
        context,
      )) as unknown as ErrorResult;
      expect(result.port).toBe('error');
      expect(result.output.error.code).toBe(ErrorCode.SUB_WORKFLOW_TIMEOUT);
      expect(result.output.error.message).toContain('timed out');
    });

    it('maps queue enqueue failures → SUB_WORKFLOW_QUEUE_FAILED (async path)', async () => {
      mockExecutor.executeAsync.mockRejectedValue(
        new Error('Queue enqueue failed: connection refused'),
      );

      const result = (await handler.execute(
        {},
        { workflowId: 'sub-wf-1', mode: 'async' },
        context,
      )) as unknown as ErrorResult;
      expect(result.port).toBe('error');
      expect(result.output.error.code).toBe(
        ErrorCode.SUB_WORKFLOW_QUEUE_FAILED,
      );
    });

    it('falls back to SUB_WORKFLOW_FAILED for generic runtime errors', async () => {
      mockExecutor.executeInline.mockRejectedValue(
        new Error('Node "Transform" exceeded maximum iteration count'),
      );

      const result = (await handler.execute(
        {},
        { workflowId: 'sub-wf-1', mode: 'sync' },
        context,
      )) as unknown as ErrorResult;
      expect(result.port).toBe('error');
      expect(result.output.error.code).toBe(ErrorCode.SUB_WORKFLOW_FAILED);
      expect(result.output.error.message).toContain(
        'exceeded maximum iteration count',
      );
      expect(result.output.error.details).toMatchObject({
        workflowId: 'sub-wf-1',
        mode: 'sync',
      });
    });
  });

  describe('mapSubWorkflowError (unit)', () => {
    it('matches case-insensitively for "Workflow not found"', () => {
      expect(mapSubWorkflowError('WORKFLOW NOT FOUND: x')).toBe(
        ErrorCode.SUB_WORKFLOW_NOT_FOUND,
      );
      expect(mapSubWorkflowError('workflow not found: x')).toBe(
        ErrorCode.SUB_WORKFLOW_NOT_FOUND,
      );
    });

    it('detects timeout messages by either "timed out" or "timeout"', () => {
      expect(mapSubWorkflowError('execution timed out after 300000ms')).toBe(
        ErrorCode.SUB_WORKFLOW_TIMEOUT,
      );
      expect(mapSubWorkflowError('Sub-workflow timeout exceeded')).toBe(
        ErrorCode.SUB_WORKFLOW_TIMEOUT,
      );
    });

    it('detects queue failures only when both "queue" and a failure marker are present', () => {
      expect(
        mapSubWorkflowError('Queue enqueue failed: connection refused'),
      ).toBe(ErrorCode.SUB_WORKFLOW_QUEUE_FAILED);
      expect(mapSubWorkflowError('queue rejected the job')).toBe(
        ErrorCode.SUB_WORKFLOW_QUEUE_FAILED,
      );
      // "queue" alone (without a failure marker) does not promote to QUEUE_FAILED.
      expect(mapSubWorkflowError('queue is full and idle')).toBe(
        ErrorCode.SUB_WORKFLOW_FAILED,
      );
    });

    it('returns SUB_WORKFLOW_FAILED for unknown messages', () => {
      expect(mapSubWorkflowError('something else broke')).toBe(
        ErrorCode.SUB_WORKFLOW_FAILED,
      );
      expect(mapSubWorkflowError('')).toBe(ErrorCode.SUB_WORKFLOW_FAILED);
    });
  });
});
