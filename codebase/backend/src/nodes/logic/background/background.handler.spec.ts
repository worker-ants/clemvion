import { BackgroundHandler } from './background.handler.js';
import { ExecutionContext } from '../../core/node-handler.interface.js';
import { createEmptyConversationThread } from '../../../shared/conversation-thread/conversation-thread.types';

describe('BackgroundHandler', () => {
  let handler: BackgroundHandler;
  let context: ExecutionContext;

  beforeEach(() => {
    handler = new BackgroundHandler();
    context = {
      executionId: 'test-exec-1',
      workflowId: 'test-wf-1',
      variables: {},
      nodeOutputCache: {},
      structuredOutputCache: {},
      engineResolvedConfigCache: {},
      conversationThread: createEmptyConversationThread(),
      recursionDepth: 0,
    };
  });

  describe('validate', () => {
    it('returns valid for default config', () => {
      const result = handler.validate({});
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns valid for fully-populated config', () => {
      const result = handler.validate({
        notes: 'fan out analytics',
        notifyOnFailure: true,
        maxDurationMs: 60000,
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns valid when maxDurationMs is 0 (unlimited per spec §1)', () => {
      const result = handler.validate({ maxDurationMs: 0 });
      expect(result.valid).toBe(true);
    });
  });

  describe('execute — main pass-through (spec §5.1)', () => {
    it('passes input through unchanged on port `main`', async () => {
      const input = { event: 'user_signup', userId: 'u_1' };
      const result = await handler.execute(
        input,
        { notes: '', notifyOnFailure: false, maxDurationMs: 300000 },
        context,
      );
      expect(result).toMatchObject({
        port: 'main',
        output: input,
        config: {
          notes: '',
          notifyOnFailure: false,
          maxDurationMs: 300000,
        },
      });
    });

    it('echoes raw config templates (CONVENTIONS Principle 7)', async () => {
      const rawConfig = Object.freeze({
        notes: '{{ $vars.notes }}',
        notifyOnFailure: true,
        maxDurationMs: 60000,
      });
      const result = await handler.execute(
        { x: 1 },
        // engine-evaluated config — handler must prefer rawConfig over this.
        { notes: 'evaluated', notifyOnFailure: true, maxDurationMs: 60000 },
        { ...context, rawConfig },
      );
      expect(result.config).toEqual({
        notes: '{{ $vars.notes }}',
        notifyOnFailure: true,
        maxDurationMs: 60000,
      });
    });

    it('does NOT spread unknown rawConfig keys (Principle 7 — credential leak guard)', async () => {
      const rawConfig = Object.freeze({
        notes: 'safe',
        notifyOnFailure: false,
        maxDurationMs: 300000,
        // Hypothetical passthrough — must not surface in echo.
        apiKey: 'sk-leaked',
      });
      const result = await handler.execute(
        { x: 1 },
        { notes: 'safe', notifyOnFailure: false, maxDurationMs: 300000 },
        { ...context, rawConfig },
      );
      expect(result.config).not.toHaveProperty('apiKey');
      expect(Object.keys(result.config).sort()).toEqual([
        'maxDurationMs',
        'notes',
        'notifyOnFailure',
      ]);
    });
  });

  describe('execute — Phase 2 (C) meta metrics (spec §5.1)', () => {
    it('returns meta with durationMs / backgroundRunId / forkedAt', async () => {
      const result = await handler.execute(
        { event: 'x' },
        { notes: '', notifyOnFailure: false, maxDurationMs: 300000 },
        context,
      );
      expect(result.meta).toBeDefined();
      const meta = result.meta as {
        durationMs: number;
        backgroundRunId: string;
        forkedAt: string;
      };
      expect(typeof meta.durationMs).toBe('number');
      expect(meta.durationMs).toBeGreaterThanOrEqual(0);
      expect(typeof meta.backgroundRunId).toBe('string');
      expect(meta.backgroundRunId.length).toBeGreaterThan(0);
      expect(typeof meta.forkedAt).toBe('string');
      // ISO8601 sanity check (Z suffix from toISOString()).
      expect(meta.forkedAt).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });

    it('emits a unique backgroundRunId per execution (no static caching)', async () => {
      const a = await handler.execute(
        { x: 1 },
        { notes: '', notifyOnFailure: false, maxDurationMs: 300000 },
        context,
      );
      const b = await handler.execute(
        { x: 2 },
        { notes: '', notifyOnFailure: false, maxDurationMs: 300000 },
        context,
      );
      const aMeta = a.meta as { backgroundRunId: string };
      const bMeta = b.meta as { backgroundRunId: string };
      expect(aMeta.backgroundRunId).not.toBe(bMeta.backgroundRunId);
    });

    it('does not return jobId — handler has no queue knowledge (spec §5.1)', async () => {
      // jobId is engine-stamped (ExecutionEngineService.scheduleBackgroundBody)
      // and may surface later via NodeExecution.outputData; the handler itself
      // must remain queue-agnostic.
      const result = await handler.execute(
        { event: 'x' },
        { notes: '', notifyOnFailure: false, maxDurationMs: 300000 },
        context,
      );
      expect(result.meta).not.toHaveProperty('jobId');
    });

    it('keeps the 5-field invariant (config/output/meta/port/status only)', async () => {
      const result = await handler.execute(
        { x: 1 },
        { notes: '', notifyOnFailure: false, maxDurationMs: 300000 },
        context,
      );
      const allowed = new Set([
        'config',
        'output',
        'meta',
        'port',
        'status',
        '_resumeState',
      ]);
      for (const key of Object.keys(result)) {
        expect(allowed.has(key)).toBe(true);
      }
      // status / _resumeState specifically must be absent here.
      expect(result).not.toHaveProperty('status');
      expect(result).not.toHaveProperty('_resumeState');
    });
  });
});
