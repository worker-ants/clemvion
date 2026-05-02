import { ExecutionContextService } from './execution-context.service';

describe('ExecutionContextService', () => {
  let service: ExecutionContextService;
  const executionId = 'exec-1';
  const workflowId = 'wf-1';
  const nodeId = 'node-1';

  beforeEach(() => {
    service = new ExecutionContextService();
    service.createContext(executionId, workflowId);
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
