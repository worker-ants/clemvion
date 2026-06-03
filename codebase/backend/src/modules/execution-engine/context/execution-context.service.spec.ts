import { Logger } from '@nestjs/common';
import {
  ExecutionContextService,
  CreateContextOptions,
} from './execution-context.service';
import { DEFAULT_THREAD_ID } from '../../../shared/conversation-thread/conversation-thread.types';

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

    // ai-review 2026-06-03: optional params are bundled in CreateContextOptions bag
    it('reads initialVariables and recursionDepth from the options bag', () => {
      const svc = new ExecutionContextService();
      const opts: CreateContextOptions = {
        initialVariables: { foo: 'bar' },
        recursionDepth: 2,
      };
      const ctx = svc.createContext('exec-opts', 'wf-1', opts);
      expect(ctx.variables).toEqual({ foo: 'bar' });
      expect(ctx.recursionDepth).toBe(2);
    });

    it('defaults variables to {} and recursionDepth to 0 when options omitted', () => {
      const svc = new ExecutionContextService();
      const ctx = svc.createContext('exec-empty', 'wf-1');
      expect(ctx.variables).toEqual({});
      expect(ctx.recursionDepth).toBe(0);
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

  // Best-effort setters (setStructuredOutput / setEngineResolvedConfig) silently
  // no-op when the context key is absent, emitting a [ctx-trace] warn so that
  // incorrect key routing surfaces in production logs without crashing the caller.
  // ai-review 2026-06-03
  describe('context-missing diagnostics — best-effort setters warn instead of throw', () => {
    let warnSpy: jest.SpyInstance;

    beforeEach(() => {
      warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    });
    afterEach(() => {
      warnSpy.mockRestore();
    });

    it('setStructuredOutput stays a no-op but warns on a missing key', () => {
      expect(() =>
        service.setStructuredOutput('nonexistent', nodeId, {
          config: {},
          output: 1,
        }),
      ).not.toThrow();
      // 미존재 키이므로 어떤 context 에도 쓰이지 않는다 (no-op 유지).
      expect(service.getContext('nonexistent')).toBeUndefined();
      // 진단 warn 1회 — `[ctx-trace]` prefix + 키/노드 식별자 포함.
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain(
        '[ctx-trace] setStructuredOutput MISSING',
      );
      expect(warnSpy.mock.calls[0][0]).toContain('key=nonexistent');
    });

    it('setEngineResolvedConfig stays a no-op but warns on a missing key', () => {
      expect(() =>
        service.setEngineResolvedConfig('nonexistent', nodeId, { count: 1 }),
      ).not.toThrow();
      expect(service.getContext('nonexistent')).toBeUndefined();
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain(
        '[ctx-trace] setEngineResolvedConfig MISSING',
      );
      expect(warnSpy.mock.calls[0][0]).toContain('key=nonexistent');
    });

    it('does not warn when the context exists for the key', () => {
      service.setStructuredOutput(executionId, nodeId, {
        config: {},
        output: 1,
      });
      service.setEngineResolvedConfig(executionId, nodeId, { count: 1 });
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  // setNodeOutput uses STRICT mode (throw + logger.error) on a missing key —
  // the opposite of the best-effort no-op policy in setStructuredOutput /
  // setEngineResolvedConfig. This policy difference is intentional: handler
  // output delivery must not be silently dropped; a missing context here
  // indicates a race or lifecycle bug that must surface immediately.
  // ai-review 2026-06-03
  describe('setNodeOutput — strict mode: throws and logs error on a missing key', () => {
    it('throws "Execution context not found" when the key does not exist', () => {
      expect(() =>
        service.setNodeOutput('nonexistent', nodeId, { result: 1 }),
      ).toThrow('Execution context not found: nonexistent');
    });

    it('logs logger.error with [ctx-trace] prefix on a missing key', () => {
      const errorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation();

      try {
        service.setNodeOutput('nonexistent', nodeId, { result: 1 });
      } catch {
        // expected
      }

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy.mock.calls[0][0]).toContain(
        '[ctx-trace] setNodeOutput MISSING',
      );
      expect(errorSpy.mock.calls[0][0]).toContain('key=nonexistent');
      errorSpy.mockRestore();
    });
  });

  // Background 본문 race 회귀 차단: 본문은 부모와 같은 executionId 를 NodeExecution
  // 그룹핑·WS 채널용으로 공유하되, in-memory context Map 키는 별도 bgKey 로 분리해야
  // 한다 (spec/conventions/execution-context.md 원칙 4). 키를 공유하면 먼저 끝난
  // 부모의 deleteContext(executionId) 가 본문 context 를 삭제해 "Execution context
  // not found" 가 발생했다.
  describe('contextKey separation (background isolation)', () => {
    it('defaults the Map key to executionId and stamps _contextKey', () => {
      const svc = new ExecutionContextService();
      const ctx = svc.createContext('exec-A', 'wf-1');
      expect(ctx._contextKey).toBe('exec-A');
      expect(svc.getContext('exec-A')).toBe(ctx);
    });

    it('registers under an explicit contextKey while keeping executionId field intact', () => {
      const svc = new ExecutionContextService();
      const bgKey = 'bg:exec-A:run-1';
      const ctx = svc.createContext('exec-A', 'wf-1', { contextKey: bgKey });

      // executionId 필드는 실제 메인 실행 ID 유지 (NodeExecution/WS/권한 1차 키).
      expect(ctx.executionId).toBe('exec-A');
      // Map 키만 분리.
      expect(ctx._contextKey).toBe(bgKey);
      expect(svc.getContext(bgKey)).toBe(ctx);
      // 부모 executionId 로는 조회되지 않는다 (키 충돌 없음).
      expect(svc.getContext('exec-A')).toBeUndefined();
    });

    it('survives the parent deleteContext(executionId) race', () => {
      const svc = new ExecutionContextService();
      // 부모(메인) context — 키 = executionId
      svc.createContext('exec-A', 'wf-1');
      // background 본문 context — 키 = bgKey (별도)
      const bgKey = 'bg:exec-A:run-1';
      const bg = svc.createContext('exec-A', 'wf-1', { contextKey: bgKey });

      // 부모가 먼저 종료하며 executionId 키로 삭제 (runExecution finally).
      svc.deleteContext('exec-A');

      // 본문 context 는 살아있고 모든 write 경로(setNodeOutput / setStructuredOutput /
      // setEngineResolvedConfig)가 bgKey 로 계속 라우팅돼야 한다.
      expect(svc.getContext(bgKey)).toBe(bg);
      expect(() => svc.setNodeOutput(bgKey, 'node-1', { x: 1 })).not.toThrow();
      expect(svc.getNodeOutput(bgKey, 'node-1')).toEqual({ x: 1 });

      svc.setStructuredOutput(bgKey, 'node-1', {
        config: { c: 1 },
        output: { y: 2 },
      });
      svc.setEngineResolvedConfig(bgKey, 'node-1', { count: 3 });
      const ctx = svc.getContext(bgKey)!;
      expect(ctx.structuredOutputCache['node-1']).toEqual({
        config: { c: 1 },
        output: { y: 2 },
      });
      expect(ctx.engineResolvedConfigCache['node-1']).toEqual({ count: 3 });
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
