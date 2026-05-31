import { Injectable, Logger } from '@nestjs/common';
import {
  ExecutionContext,
  NodeHandlerOutput,
} from '../../../nodes/core/node-handler.interface';
import { wrapBareAsNodeHandlerOutput } from '../handler-output.adapter';
import { createEmptyConversationThread } from '../../../shared/conversation-thread/conversation-thread.types';

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
    initialVariables: Record<string, unknown> = {},
    recursionDepth?: number,
    // in-memory Map 라우팅 키 (spec/conventions/execution-context.md 원칙 4).
    // 생략 시 executionId 와 동일 → 비-background 호출은 동작 불변. background
    // 본문만 `bg:<executionId>:<backgroundRunId>` 를 전달해 부모와 키 격리한다.
    contextKey?: string,
  ): ExecutionContext {
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

  setStructuredOutput(
    executionId: string,
    nodeId: string,
    adapted: NodeHandlerOutput,
  ): void {
    const context = this.contexts.get(executionId);
    if (!context) return;
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
   */
  setEngineResolvedConfig(
    executionId: string,
    nodeId: string,
    resolvedConfig: Record<string, unknown>,
  ): void {
    const context = this.contexts.get(executionId) as
      | MutableExecutionContext
      | undefined;
    if (!context) return;
    context.engineResolvedConfigCache[nodeId] = { ...resolvedConfig };
  }

  getContext(executionId: string): ExecutionContext | undefined {
    return this.contexts.get(executionId);
  }

  updateVariables(
    executionId: string,
    variables: Record<string, unknown>,
  ): void {
    const context = this.contexts.get(executionId);
    if (!context) {
      throw new Error(`Execution context not found: ${executionId}`);
    }
    Object.assign(context.variables, variables);
  }

  setNodeOutput(executionId: string, nodeId: string, output: unknown): void {
    const context = this.contexts.get(executionId);
    if (!context) {
      // 회귀 ③ tracking (2026-05-25): caller stack 을 함께 남겨 어떤 경로가
      // 사라진 context 에 write 시도했는지 식별. 발생 후 진단용 — production
      // 로그에서 setNodeOutput throw 패턴을 검색해 race window 추적.
      this.logger.error(
        `[ctx-trace] setNodeOutput MISSING — executionId=${executionId} ` +
          `nodeId=${nodeId} (race: deleteContext fired earlier). Caller:\n` +
          `${new Error().stack?.split('\n').slice(1, 10).join('\n')}`,
      );
      throw new Error(`Execution context not found: ${executionId}`);
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

  getNodeOutput(executionId: string, nodeId: string): unknown {
    const context = this.contexts.get(executionId);
    if (!context) {
      throw new Error(`Execution context not found: ${executionId}`);
    }
    return context.nodeOutputCache[nodeId];
  }

  deleteContext(executionId: string): void {
    const existed = this.contexts.has(executionId);
    // 회귀 ③ tracking (2026-05-25): context 삭제 caller 식별. 의심 race —
    // runExecution finally / resumeFromCheckpoint finally 중 어느 path 가
    // 동시 진행 중인 다른 await 를 무효화하는지 production 로그로 추적.
    // log 라인 prefix `[ctx-trace] deleteContext` 로 grep 가능.
    this.logger.log(
      `[ctx-trace] deleteContext — executionId=${executionId} existed=${existed}. ` +
        `Caller:\n${new Error().stack?.split('\n').slice(1, 6).join('\n')}`,
    );
    this.contexts.delete(executionId);
  }
}
