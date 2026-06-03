import { Injectable, Logger } from '@nestjs/common';
import {
  ExecutionContext,
  NodeHandlerOutput,
} from '../../../nodes/core/node-handler.interface';
import { wrapBareAsNodeHandlerOutput } from '../handler-output.adapter';
import { createEmptyConversationThread } from '../../../shared/conversation-thread/conversation-thread.types';

/**
 * Options accepted by {@link ExecutionContextService.createContext}.
 *
 * Required identifiers (`executionId`, `workflowId`) are positional; everything
 * else is bundled here so that callers who only need `contextKey` (background
 * subgraph paths) do not have to supply placeholder values for the preceding
 * optional params.
 */
export interface CreateContextOptions {
  /** Initial variable values merged into `context.variables`. */
  initialVariables?: Record<string, unknown>;
  /** Sub-workflow recursion depth (0 = top-level). */
  recursionDepth?: number;
  /**
   * In-memory Map routing key (spec/conventions/execution-context.md 원칙 4).
   * Defaults to `executionId` when omitted — non-background calls are unaffected.
   * Background subgraph paths pass `bg:<executionId>:<backgroundRunId>` to
   * isolate their context from the parent execution's context.
   */
  contextKey?: string;
}

/**
 * Engine-internal alias that drops the public `Readonly` qualifier on
 * `engineResolvedConfigCache` so the cache can be populated through the
 * dedicated setter while handlers still see the read-only public shape.
 */
type MutableExecutionContext = Omit<
  ExecutionContext,
  'engineResolvedConfigCache'
> & {
  engineResolvedConfigCache: Record<string, Record<string, unknown>>;
};

/**
 * In-memory execution context management for Phase 1.
 * In production, this would be backed by Redis.
 *
 * **Tracking logs (회귀 ③ 진단, 2026-05-25)**: createContext / deleteContext /
 * setNodeOutput (context not found 분기) 시점에 진단 로그를 남긴다. 사용자 보고
 * "Execution context not found" race 의 root cause 식별이 목표 — 어떤 caller 가
 * context 를 삭제했는지 (또는 race window 가 있는지) production 로그로 추적.
 */
@Injectable()
export class ExecutionContextService {
  private readonly logger = new Logger(ExecutionContextService.name);
  private readonly contexts = new Map<string, ExecutionContext>();

  createContext(
    executionId: string,
    workflowId: string,
    // 필수 식별자(executionId/workflowId)만 위치 인자로 두고, optional 부가
    // 인자는 단일 options 객체로 묶는다 (2026-06-03 ai-review INFO#3). 후행
    // contextKey 만 넘기려고 중간 기본값(`{}`, `0`)을 억지로 명시하던 background
    // 호출의 불편(`createContext(id, wf, {}, 0, bgKey)`)을 없앤다. God Object 방지
    // 규약(execution-context.md §Rationale "기각된 ExecutionOptions 추출")은
    // 핸들러 소비 표면인 `ExecutionContext` 필드를 묶는 안의 기각이며, 본 메서드
    // 인자 ergonomics 와는 별개 사안이라 충돌하지 않는다.
    options: CreateContextOptions = {},
  ): ExecutionContext {
    const { initialVariables = {}, recursionDepth, contextKey } = options;
    const key = contextKey ?? executionId;
    const existing = this.contexts.get(key);
    if (existing) {
      // 회귀 ③ tracking: 동일 키의 context 가 이미 존재할 때 재생성 시도
      // — 누가 호출했는지 식별. multi-instance race 또는 sub-workflow re-entry 의심.
      this.logger.warn(
        `[ctx-trace] createContext OVERWRITE — key=${key} executionId=${executionId} ` +
          `workflowId=${workflowId} (existing workflowId=${existing.workflowId}, ` +
          `nodes=${Object.keys(existing.nodeOutputCache).length}). ` +
          `Caller stack:\n${new Error().stack?.split('\n').slice(1, 6).join('\n')}`,
      );
    }
    const context: ExecutionContext = {
      executionId,
      workflowId,
      _contextKey: key,
      variables: { ...initialVariables },
      nodeOutputCache: {},
      structuredOutputCache: {},
      engineResolvedConfigCache: {},
      recursionDepth: recursionDepth ?? 0,
      conversationThread: createEmptyConversationThread(),
    };
    this.contexts.set(key, context);
    return context;
  }

  /**
   * Best-effort no-op + `[ctx-trace]` warn contract: when the context for
   * `key` is absent (e.g. a race where the parent already called
   * `deleteContext` before this write arrived), the call is silently ignored
   * rather than thrown. A `[ctx-trace] <method> MISSING` warn is emitted so
   * that incorrect key routing (`contextKeyOf` / `bgKey` mismatches) surfaces
   * in production logs without crashing the caller.
   *
   * Contrast with {@link setNodeOutput}, which **throws** on a missing key
   * because the strict handler-output path must guarantee delivery.
   */
  setStructuredOutput(
    key: string,
    nodeId: string,
    adapted: NodeHandlerOutput,
  ): void {
    const context = this.contexts.get(key);
    if (!context) {
      this.warnContextMissing('setStructuredOutput', key, nodeId);
      return;
    }
    context.structuredOutputCache[nodeId] = adapted;
  }

  /**
   * Store the expression-resolved (evaluated) config for a node so engine
   * paths (runContainerInner / runParallel) can read iteration parameters
   * without re-evaluating expressions. Separated from `structuredOutputCache`
   * which carries the handler's raw echo per CONVENTIONS Principle 7.
   *
   * Shallow-copies the input so callers can keep mutating their local
   * `resolvedConfig` reference without leaking changes into the cache.
   *
   * Applies the same best-effort no-op + `[ctx-trace]` warn policy as
   * {@link setStructuredOutput} on a missing key.
   */
  setEngineResolvedConfig(
    key: string,
    nodeId: string,
    resolvedConfig: Record<string, unknown>,
  ): void {
    const context = this.contexts.get(key) as
      | MutableExecutionContext
      | undefined;
    if (!context) {
      this.warnContextMissing('setEngineResolvedConfig', key, nodeId);
      return;
    }
    context.engineResolvedConfigCache[nodeId] = { ...resolvedConfig };
  }

  /**
   * Emit a standardised `[ctx-trace] <method> MISSING` warn log.
   *
   * Centralises the message format so that grep patterns stay stable even if
   * additional context is added later. The `[ctx-trace]` prefix is the
   * project-wide sentinel for execution-context diagnostic logs.
   */
  private warnContextMissing(
    method: string,
    key: string,
    nodeId: string,
  ): void {
    this.logger.warn(
      `[ctx-trace] ${method} MISSING — key=${key} nodeId=${nodeId} ` +
        `(no-op: context absent for this key).`,
    );
  }

  getContext(key: string): ExecutionContext | undefined {
    return this.contexts.get(key);
  }

  updateVariables(key: string, variables: Record<string, unknown>): void {
    const context = this.contexts.get(key);
    if (!context) {
      throw new Error(`Execution context not found: ${key}`);
    }
    Object.assign(context.variables, variables);
  }

  setNodeOutput(key: string, nodeId: string, output: unknown): void {
    const context = this.contexts.get(key);
    if (!context) {
      // 회귀 ③ tracking (2026-05-25): caller stack 을 함께 남겨 어떤 경로가
      // 사라진 context 에 write 시도했는지 식별. 발생 후 진단용 — production
      // 로그에서 setNodeOutput throw 패턴을 검색해 race window 추적.
      this.logger.error(
        `[ctx-trace] setNodeOutput MISSING — key=${key} ` +
          `nodeId=${nodeId} (race: deleteContext fired earlier). Caller:\n` +
          `${new Error().stack?.split('\n').slice(1, 10).join('\n')}`,
      );
      throw new Error(`Execution context not found: ${key}`);
    }
    context.nodeOutputCache[nodeId] = output;

    // Keep the structured view in sync so that expression resolution picks up
    // post-resume mutations (form submittedData, button click metadata,
    // multi-turn AI output, etc.). Engine paths that already call
    // `setStructuredOutput` with a richer NodeHandlerOutput will overwrite
    // this derivation afterwards.
    //
    // Use the lenient wrapper here — `setNodeOutput` receives already-flattened
    // engine output (post `toEngineFlatShape` / `applyPortSelection`), which is
    // intentionally bare (e.g. `{parameters: {}}`). Running the strict
    // `adaptHandlerReturn` on a bare object would throw in production, even
    // though the handler boundary at the call site already validated the
    // canonical shape moments earlier. Strict contract enforcement belongs at
    // the single handler-return boundary in execution-engine.service.ts, not
    // here.
    const existing = context.structuredOutputCache[nodeId];
    const isCanonical =
      typeof output === 'object' &&
      output !== null &&
      !Array.isArray(output) &&
      'config' in (output as Record<string, unknown>) &&
      'output' in (output as Record<string, unknown>);
    const derived = isCanonical
      ? (output as NodeHandlerOutput)
      : wrapBareAsNodeHandlerOutput(output);
    context.structuredOutputCache[nodeId] = existing
      ? {
          // Preserve the echoed config from the handler's original return —
          // resume flows receive a flat merged object that doesn't include it.
          config: existing.config,
          output: derived.output,
          ...(derived.meta !== undefined || existing.meta !== undefined
            ? { meta: derived.meta ?? existing.meta }
            : {}),
          ...(derived.port !== undefined || existing.port !== undefined
            ? { port: derived.port ?? existing.port }
            : {}),
          ...(derived.status !== undefined || existing.status !== undefined
            ? { status: derived.status ?? existing.status }
            : {}),
        }
      : derived;
  }

  getNodeOutput(key: string, nodeId: string): unknown {
    const context = this.contexts.get(key);
    if (!context) {
      throw new Error(`Execution context not found: ${key}`);
    }
    return context.nodeOutputCache[nodeId];
  }

  deleteContext(key: string): void {
    const existed = this.contexts.has(key);
    // 회귀 ③ tracking (2026-05-25): context 삭제 caller 식별. 의심 race —
    // runExecution finally / resumeFromCheckpoint finally 중 어느 path 가
    // 동시 진행 중인 다른 await 를 무효화하는지 production 로그로 추적.
    // log 라인 prefix `[ctx-trace] deleteContext` 로 grep 가능.
    this.logger.log(
      `[ctx-trace] deleteContext — key=${key} existed=${existed}. ` +
        `Caller:\n${new Error().stack?.split('\n').slice(1, 6).join('\n')}`,
    );
    this.contexts.delete(key);
  }
}
