import { ExecutionContextService } from './execution-context.service';
import { DEFAULT_THREAD_ID } from '../conversation-thread/conversation-thread.types';

describe('ExecutionContextService', () => {
  let service: ExecutionContextService;
  const executionId = 'exec-1';
  const workflowId = 'wf-1';
  const nodeId = 'node-1';

  beforeEach(() => {
    service = new ExecutionContextService();
    service.createContext(executionId, workflowId);
  });

  describe('createContext', () => {
    it('initializes an empty conversationThread', () => {
      const ctx = service.getContext(executionId)!;
      expect(ctx.conversationThread).toEqual({
        id: DEFAULT_THREAD_ID,
        nextSeq: 0,
        turns: [],
        totalChars: 0,
      });
    });
  });

  describe('setNodeOutput — production strict mode (NodeHandlerOutput contract)', () => {
    const prevEnv = process.env.NODE_ENV;
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });
    afterEach(() => {
      process.env.NODE_ENV = prevEnv;
    });

    // Regression for the "violates the NodeHandlerOutput contract" production
    // crash: setNodeOutput receives flattened post-port-routing output from
    // toEngineFlatShape (e.g. `{parameters: {}}`), which is intentionally
    // bare. Running the strict adaptHandlerReturn here used to throw even
    // though the handler boundary already validated the canonical shape.
    it('does not throw on a flat bare output (production)', () => {
      expect(() =>
        service.setNodeOutput(executionId, nodeId, { parameters: {} }),
      ).not.toThrow();

      const ctx = service.getContext(executionId)!;
      expect(ctx.structuredOutputCache?.[nodeId]).toEqual({
        config: {},
        output: { parameters: {} },
      });
      expect(ctx.nodeOutputCache[nodeId]).toEqual({ parameters: {} });
    });

    it('does not throw on null/undefined output (production)', () => {
      expect(() =>
        service.setNodeOutput(executionId, nodeId, null),
      ).not.toThrow();
      expect(() =>
        service.setNodeOutput(executionId, 'node-2', undefined),
      ).not.toThrow();
    });

    it('preserves canonical output shape end-to-end (production)', () => {
      service.setNodeOutput(executionId, nodeId, {
        config: { x: 1 },
        output: 42,
      });

      const ctx = service.getContext(executionId)!;
      expect(ctx.structuredOutputCache?.[nodeId]).toEqual({
        config: { x: 1 },
        output: 42,
      });
    });
  });

  // engine-config-bug — Loop/Parallel 컨테이너가 표현식으로 입력된 동작
  // 파라미터를 NaN/silent default 로 처리하던 회귀 차단. structured.config 는
  // raw echo 전용(Phase 3 Principle 7), 동작 파라미터용 평가된 config 는
  // 별도 슬롯에 저장한다.
  describe('setEngineResolvedConfig — evaluated config snapshot for engine reads', () => {
    it('initializes engineResolvedConfigCache as {} in createContext', () => {
      const ctx = service.getContext(executionId);
      expect(ctx?.engineResolvedConfigCache).toEqual({});
    });

    it('stores per-node resolved config and exposes it via getContext', () => {
      service.setEngineResolvedConfig(executionId, nodeId, {
        count: 3,
        maxIterations: 1000,
      });

      const ctx = service.getContext(executionId);
      expect(ctx?.engineResolvedConfigCache?.[nodeId]).toEqual({
        count: 3,
        maxIterations: 1000,
      });
    });

    it('overwrites prior entry for the same node (per-node fresh resolve)', () => {
      service.setEngineResolvedConfig(executionId, nodeId, { count: 2 });
      service.setEngineResolvedConfig(executionId, nodeId, { count: 5 });

      const ctx = service.getContext(executionId);
      expect(ctx?.engineResolvedConfigCache?.[nodeId]).toEqual({ count: 5 });
    });

    it('keeps independent entries for different nodes', () => {
      service.setEngineResolvedConfig(executionId, 'loop-1', { count: 3 });
      service.setEngineResolvedConfig(executionId, 'parallel-1', {
        branchCount: 4,
      });

      const cache = service.getContext(executionId)?.engineResolvedConfigCache;
      expect(cache?.['loop-1']).toEqual({ count: 3 });
      expect(cache?.['parallel-1']).toEqual({ branchCount: 4 });
    });

    it('is a no-op for unknown executionId (mirrors setStructuredOutput)', () => {
      expect(() =>
        service.setEngineResolvedConfig('nonexistent', nodeId, { count: 1 }),
      ).not.toThrow();
    });

    it('does not mutate structuredOutputCache (echo channel stays untouched)', () => {
      service.setStructuredOutput(executionId, nodeId, {
        config: { count: '{{3}}' },
        output: null,
      });
      service.setEngineResolvedConfig(executionId, nodeId, { count: 3 });

      const ctx = service.getContext(executionId);
      // Raw echo preserved
      expect(ctx?.structuredOutputCache?.[nodeId]?.config).toEqual({
        count: '{{3}}',
      });
      // Engine-side evaluated value separated
      expect(ctx?.engineResolvedConfigCache?.[nodeId]).toEqual({ count: 3 });
    });
  });

  describe('setNodeOutput — existing structured cache preservation', () => {
    it('keeps existing config when setStructuredOutput ran first', () => {
      service.setStructuredOutput(executionId, nodeId, {
        config: { echoed: true },
        output: { initial: 1 },
        port: 'success',
      });

      // Engine flow: setNodeOutput is called after setStructuredOutput with
      // the flat shape. The structured config should NOT be overwritten by
      // the bare flat payload.
      service.setNodeOutput(executionId, nodeId, { initial: 1 });

      const ctx = service.getContext(executionId)!;
      const structured = ctx.structuredOutputCache?.[nodeId];
      expect(structured?.config).toEqual({ echoed: true });
      expect(structured?.port).toBe('success');
    });

    it('lifts top-level status / port from a flat resume payload', () => {
      // Resume / form-submit paths feed setNodeOutput a flat object that may
      // carry status / port on the top level. The lenient wrapper hoists them.
      service.setNodeOutput(executionId, nodeId, {
        result: 'ok',
        status: 'resumed',
        port: 'out',
      });

      const ctx = service.getContext(executionId)!;
      const structured = ctx.structuredOutputCache?.[nodeId];
      expect(structured?.status).toBe('resumed');
      expect(structured?.port).toBe('out');
    });
  });
});
