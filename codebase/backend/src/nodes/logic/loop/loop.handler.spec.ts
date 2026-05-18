import { LoopHandler } from './loop.handler';
import { ExecutionContext } from '../../core/node-handler.interface';
import { createEmptyConversationThread } from '../../../shared/conversation-thread/conversation-thread.types';

describe('LoopHandler', () => {
  let handler: LoopHandler;

  beforeEach(() => {
    handler = new LoopHandler();
  });

  const context: ExecutionContext = {
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
    it('accepts numeric count', () => {
      expect(handler.validate({ count: 10 })).toEqual({
        valid: true,
        errors: [],
      });
    });

    it('accepts numeric string count (UI form input)', () => {
      expect(handler.validate({ count: '10' })).toEqual({
        valid: true,
        errors: [],
      });
    });

    it('accepts unresolved expression as count', () => {
      expect(handler.validate({ count: '{{ $input.count }}' })).toEqual({
        valid: true,
        errors: [],
      });
    });

    it('accepts missing count — zod default fills it (min-1-iteration policy, spec §8)', () => {
      // handler.validate 는 raw config 만 본다. 빈 config 가 들어와도
      // storage layer 에서 zod default('1') 이 적용되므로 차단할 필요 없음.
      expect(handler.validate({})).toEqual({ valid: true, errors: [] });
    });

    it('accepts explicit count: undefined (same path — storage layer fills default)', () => {
      // I-7/I-8 후속: zod default 가 bypass 되는 직접 호출 경로에서도
      // 빈 count 는 valid: true. runtime 무효 case 는 engine 의
      // INVALID_CONTAINER_PARAM 가 잡는다 (spec §8 Rationale layer 표).
      expect(handler.validate({ count: undefined })).toEqual({
        valid: true,
        errors: [],
      });
    });

    it('rejects non-numeric string', () => {
      const result = handler.validate({ count: 'abc' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('count must be a number or expression');
    });

    it('rejects zero or negative count', () => {
      expect(handler.validate({ count: 0 }).valid).toBe(false);
      expect(handler.validate({ count: -1 }).valid).toBe(false);
    });

    it('rejects numeric count > maxIterations', () => {
      const result = handler.validate({ count: 2000, maxIterations: 100 });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/must be less than or equal/);
    });

    it('accepts numeric string maxIterations', () => {
      expect(handler.validate({ count: '5', maxIterations: '100' }).valid).toBe(
        true,
      );
    });
  });

  describe('execute', () => {
    it('echoes raw count under config (Principle 7 — raw template preserved)', async () => {
      const result = (await handler.execute(
        {},
        { count: '10' },
        context,
      )) as unknown as Record<string, unknown>;
      // Principle 7 — config echoes the raw value the workflow author typed,
      // not the parsed number. Engine's iteration bound logic reads
      // `node.config` directly (not `outputData.config`), so the echo is
      // free to keep the raw form.
      expect(result.config).toEqual({ count: '10', maxIterations: 1000 });
      expect(result.output).toBeNull();
    });

    it('falls back to default maxIterations when omitted', async () => {
      const result = (await handler.execute(
        {},
        { count: 3 },
        context,
      )) as unknown as Record<string, unknown>;
      const config = result.config as Record<string, unknown>;
      expect(config.maxIterations).toBe(1000);
    });

    it('preserves `{{ ... }}` count template on config', async () => {
      const result = (await handler.execute(
        {},
        { count: 5 },
        {
          ...context,
          rawConfig: Object.freeze({ count: '{{ $input.count }}' }),
        },
      )) as unknown as Record<string, unknown>;
      const cfg = result.config as Record<string, unknown>;
      expect(cfg.count).toBe('{{ $input.count }}');
      expect(result.output).toBeNull();
    });
  });
});
