import { WorkflowHandler, mapSubWorkflowError } from './workflow.handler.js';
import {
  WorkflowNotFoundError,
  SubWorkflowTimeoutError,
} from '../../../modules/execution-engine/workflow-errors.js';
import { ExecutionContext } from '../../core/node-handler.interface.js';
import { WorkflowExecutor } from '../../core/workflow-executor.interface.js';
import { ErrorCode } from '../../core/error-codes.js';
import { createEmptyConversationThread } from '../../../shared/conversation-thread/conversation-thread.types';
import { ParkReleaseSignal } from '../../../shared/execution-resume/park-release-signal.js';

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
      conversationThread: createEmptyConversationThread(),
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
      // Schema warningRule "Target workflow must be selected." fires.
      expect(result.errors.some((e) => e.includes('workflow'))).toBe(true);
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

    it('should call executeInline and wrap sub-workflow output under output.result', async () => {
      const subOutput = { result: 'success', data: [1, 2, 3] };
      mockExecutor.executeInline.mockResolvedValue(subOutput);

      const result = await handler.execute(
        { input: 'data' },
        syncConfig,
        context,
      );

      // Sync result is wrapped one level under output.result so the shape
      // stays uniform regardless of the sub-workflow's final output.
      expect((result as { output: unknown }).output).toEqual({
        result: subOutput,
      });
      // CONVENTIONS Principle 2 — sync inline execution emits durationMs
      // metric (handler-measured, since engine does not see sub-workflow
      // boundary). Value is non-negative; we don't assert exact ms.
      const meta = (result as { meta?: { durationMs?: number } }).meta;
      expect(meta).toBeDefined();
      expect(typeof meta?.durationMs).toBe('number');
      expect(meta?.durationMs).toBeGreaterThanOrEqual(0);
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

    it('should call executeAsync and return execution info', async () => {
      mockExecutor.executeAsync.mockResolvedValue('sub-exec-async-1');

      const result = await handler.execute(
        { data: 'test' },
        asyncConfig,
        context,
      );

      // Async output exposes the full envelope (executionId for the new
      // sub-execution, workflowId echo, status) and surfaces queue-progress
      // on the top-level `status` slot rather than under `meta`.
      expect(result).toMatchObject({
        config: { workflowId: 'sub-wf-1', mode: 'async' },
        output: {
          executionId: 'sub-exec-async-1',
          workflowId: 'sub-wf-1',
          status: 'started',
        },
        status: 'started',
      });
      // No `meta` is emitted — async progress lives on top-level `status`.
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

      // Sync wrap: output.result holds the sub-workflow output.
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

  describe('execute - error propagation (code mapping)', () => {
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

    it('maps "timed out" → SUB_WORKFLOW_TIMEOUT (async path symmetry)', async () => {
      // Async path also routes through buildSubWorkflowError, so a "timed
      // out" message there should produce the same code as in sync.
      mockExecutor.executeAsync.mockRejectedValue(
        new Error('Sub-workflow execution timed out after 300000ms'),
      );

      const result = (await handler.execute(
        {},
        { workflowId: 'sub-wf-1', mode: 'async' },
        context,
      )) as unknown as ErrorResult;
      expect(result.port).toBe('error');
      expect(result.output.error.code).toBe(ErrorCode.SUB_WORKFLOW_TIMEOUT);
      expect(result.output.error.details).toMatchObject({ mode: 'async' });
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

    it('maps queue enqueue failures → SUB_WORKFLOW_QUEUE_FAILED (sync path symmetry)', async () => {
      // QUEUE_FAILED is semantically tied to async dispatch but the sync
      // path's buildSubWorkflowError shares the same mapper, so symmetric
      // coverage protects against accidental code-path divergence.
      mockExecutor.executeInline.mockRejectedValue(
        new Error('Queue enqueue failed: redis offline'),
      );

      const result = (await handler.execute(
        {},
        { workflowId: 'sub-wf-1', mode: 'sync' },
        context,
      )) as unknown as ErrorResult;
      expect(result.port).toBe('error');
      expect(result.output.error.code).toBe(
        ErrorCode.SUB_WORKFLOW_QUEUE_FAILED,
      );
      expect(result.output.error.details).toMatchObject({ mode: 'sync' });
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

    it('handles non-Error rejections (string / object) without throwing', async () => {
      // Defensive: callers may `throw 'plain string'` or `throw { code: 'x' }`.
      // The handler should still emit a structured envelope.
      mockExecutor.executeInline.mockRejectedValue('plain string error');

      const result = (await handler.execute(
        {},
        { workflowId: 'sub-wf-1', mode: 'sync' },
        context,
      )) as unknown as ErrorResult;
      expect(result.port).toBe('error');
      expect(result.output.error.code).toBe(ErrorCode.SUB_WORKFLOW_FAILED);
      expect(result.output.error.message).toBe('plain string error');
    });

    it('truncates very long error messages before emitting them', async () => {
      const longMessage = `boom: ${'x'.repeat(2000)}`;
      mockExecutor.executeInline.mockRejectedValue(new Error(longMessage));

      const result = (await handler.execute(
        {},
        { workflowId: 'sub-wf-1', mode: 'sync' },
        context,
      )) as unknown as ErrorResult;
      // `truncateForErrorDetails` caps at 500 chars + suffix.
      expect(result.output.error.message.length).toBeLessThan(
        longMessage.length,
      );
      expect(result.output.error.message).toContain('chars truncated');
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

    it('matches the executor\'s "timed out" phrasing for SUB_WORKFLOW_TIMEOUT', () => {
      expect(mapSubWorkflowError('execution timed out after 300000ms')).toBe(
        ErrorCode.SUB_WORKFLOW_TIMEOUT,
      );
      expect(
        mapSubWorkflowError('Sub-workflow execution timed out after 5s'),
      ).toBe(ErrorCode.SUB_WORKFLOW_TIMEOUT);
    });

    it('does NOT promote inner-node "timeout" messages to SUB_WORKFLOW_TIMEOUT', () => {
      // Tighten match: avoid reclassifying unrelated inner-node errors that
      // happen to mention "timeout" (e.g. a DB driver error inside a
      // sub-workflow node).
      expect(
        mapSubWorkflowError('PostgreSQL connection timeout after 5s'),
      ).toBe(ErrorCode.SUB_WORKFLOW_FAILED);
      expect(mapSubWorkflowError('Sub-workflow timeout exceeded')).toBe(
        ErrorCode.SUB_WORKFLOW_FAILED,
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
      // Boundary: "queue error occurred" lacks the failure markers we look
      // for, so it stays as the generic fallback. Documented intentionally.
      expect(mapSubWorkflowError('queue error occurred')).toBe(
        ErrorCode.SUB_WORKFLOW_FAILED,
      );
    });

    it('returns SUB_WORKFLOW_FAILED for unknown messages', () => {
      expect(mapSubWorkflowError('something else broke')).toBe(
        ErrorCode.SUB_WORKFLOW_FAILED,
      );
      expect(mapSubWorkflowError('')).toBe(ErrorCode.SUB_WORKFLOW_FAILED);
    });

    // W-17 — typed error 우선 분기. executor 가 `WorkflowNotFoundError` /
    // `SubWorkflowTimeoutError` 를 throw 하면 message text 와 무관하게
    // 매핑되어, 누군가 executor 메시지를 손대도 silent regression 없이
    // 정확한 ErrorCode 가 유지된다.
    it('maps WorkflowNotFoundError instance → SUB_WORKFLOW_NOT_FOUND (typed branch)', () => {
      expect(mapSubWorkflowError(new WorkflowNotFoundError('wf-1'))).toBe(
        ErrorCode.SUB_WORKFLOW_NOT_FOUND,
      );
    });

    it('maps SubWorkflowTimeoutError instance → SUB_WORKFLOW_TIMEOUT (typed branch)', () => {
      expect(mapSubWorkflowError(new SubWorkflowTimeoutError(5000))).toBe(
        ErrorCode.SUB_WORKFLOW_TIMEOUT,
      );
    });

    it('typed branch wins over misleading message text', () => {
      // Construct a typed NotFound whose message would also match the "queue
      // failed" fallback substring. The instanceof branch must take priority.
      const trap = new WorkflowNotFoundError('wf-queue-failed');
      expect(mapSubWorkflowError(trap)).toBe(ErrorCode.SUB_WORKFLOW_NOT_FOUND);
    });
  });

  // WARNING #7 (ai-review) — WorkflowHandler 가 ParkReleaseSignal 을 re-throw 하는지
  // 검증. 분기 누락 시 buildSubWorkflowError 로 흡수되어 잘못된 error 포트 라우팅 발생.
  describe('execute - ParkReleaseSignal re-throw (exec-park D6)', () => {
    const syncConfig = {
      workflowId: 'sub-wf-park',
      mode: 'sync' as const,
    };

    it('ParkReleaseSignal 은 error 포트로 라우팅되지 않고 re-throw 된다', async () => {
      mockExecutor.executeInline.mockRejectedValue(new ParkReleaseSignal());

      // handler 는 ParkReleaseSignal 을 buildSubWorkflowError 로 변환하지 않고
      // 그대로 re-throw 해야 한다. executor(executeNode → runExecution)가
      // 이 신호를 받아 세그먼트를 종료한다.
      await expect(handler.execute({}, syncConfig, context)).rejects.toThrow(
        ParkReleaseSignal,
      );
    });

    it('ParkReleaseSignal 이 throw 되면 error 포트 결과가 반환되지 않는다', async () => {
      mockExecutor.executeInline.mockRejectedValue(new ParkReleaseSignal());

      let result: unknown;
      try {
        result = await handler.execute({}, syncConfig, context);
      } catch {
        // 정상 경로 — ParkReleaseSignal re-throw 로 인해 catch 에 도달한다.
        result = 'caught-park-signal';
      }
      // buildSubWorkflowError 에 의해 error 포트 객체가 반환되지 않았다.
      expect(result).toBe('caught-park-signal');
      expect((result as { port?: string } | undefined)?.port).toBeUndefined();
    });
  });
});
