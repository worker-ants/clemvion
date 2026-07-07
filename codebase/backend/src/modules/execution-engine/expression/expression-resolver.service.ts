import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  evaluate,
  ExpressionContext as EngineContext,
  buildDisambiguatedKeys,
} from '@workflow/expression-engine';
import {
  ExecutionContext,
  TriggerExpressionData,
} from '../../../nodes/core/node-handler.interface';
import { Node } from '../../nodes/entities/node.entity';
import { EXPRESSION_EXCLUSIONS } from './expression-exclusions';
import { renderThreadAsSystemText } from '../../../shared/conversation-thread/thread-renderer';
import { sanitizeResponseHeaders } from '../../../nodes/integration/_base/sanitize-response-headers.util';

const FULL_EXPRESSION_PATTERN = /^\s*\{\{(.+)\}\}\s*$/s;
const MAX_DEPTH = 10;

@Injectable()
export class ExpressionResolverService {
  private readonly logger = new Logger(ExpressionResolverService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Build the expression context from execution state.
   */
  buildExpressionContext(
    nodeInput: unknown,
    executionContext: ExecutionContext,
    nodeMap: Map<string, Node>,
    executionMeta?: { startedAt?: string; mode?: string },
  ): EngineContext {
    // Build $node label-to-output map with disambiguation and UUID fallback.
    // Note: nodeMap must be ordered by topological sort (execution order) for
    // deterministic #N suffix assignment in buildDisambiguatedKeys. The
    // engine populates `structuredOutputCache` via the runtime path; test
    // fixtures that only pre-seed `nodeOutputCache` (no structured entry)
    // fall back to a `{ output: flat }` shim so expressions can still
    // resolve `$node["X"].output.field`.
    const $node: Record<string, Record<string, unknown>> = {};

    const nodesWithOutput: Array<{ id: string; label: string }> = [];
    for (const [nodeId, node] of nodeMap) {
      if (executionContext.nodeOutputCache[nodeId] !== undefined) {
        nodesWithOutput.push({ id: nodeId, label: node.label });
      }
    }

    const structured = executionContext.structuredOutputCache ?? {};
    const disambiguatedKeys = buildDisambiguatedKeys(nodesWithOutput);
    for (const [nodeId] of nodeMap) {
      const flat = executionContext.nodeOutputCache[nodeId];
      if (flat === undefined) continue;

      const adapted = structured[nodeId];
      const entry: Record<string, unknown> = adapted
        ? {
            config: adapted.config ?? {},
            output: adapted.output,
            ...(adapted.meta !== undefined ? { meta: adapted.meta } : {}),
            ...(adapted.port !== undefined ? { port: adapted.port } : {}),
            ...(adapted.status !== undefined ? { status: adapted.status } : {}),
          }
        : { output: flat };

      const resolvedKey = disambiguatedKeys.get(nodeId)!;
      $node[resolvedKey] = entry;
      // UUID fallback: always accessible by node ID
      $node[nodeId] = entry;
    }

    const now = new Date();

    const inputObject = (nodeInput ?? {}) as Record<string, unknown>;
    const paramsFromInput =
      inputObject &&
      typeof inputObject === 'object' &&
      inputObject.parameters &&
      typeof inputObject.parameters === 'object' &&
      !Array.isArray(inputObject.parameters)
        ? (inputObject.parameters as Record<string, unknown>)
        : {};

    return {
      $input: inputObject,
      $params: paramsFromInput,
      $node,
      $var: executionContext.variables ?? {},
      $execution: {
        id: executionContext.executionId,
        workflowId: executionContext.workflowId,
        startedAt: executionMeta?.startedAt ?? now.toISOString(),
        mode: executionMeta?.mode ?? 'manual',
      },
      $now: now.toISOString(),
      $loop: executionContext.loopContext
        ? {
            index: executionContext.loopContext.index,
            iteration: executionContext.loopContext.index + 1,
            isFirst: executionContext.loopContext.isFirst,
            isLast: executionContext.loopContext.isLast,
          }
        : undefined,
      $item: executionContext.itemContext?.item,
      $itemIndex: executionContext.itemContext?.index,
      $itemIsFirst: executionContext.itemContext?.isFirst,
      $itemIsLast: executionContext.itemContext?.isLast,
      // ConversationThread readonly view (spec/5-system/5-expression-language §4.4).
      // v1 only exposes simple indexing — turns / length / pre-rendered text.
      // `text` lazily renders via thread-renderer so consumers that don't
      // touch it pay no cost.
      $thread: this.buildThreadView(executionContext.conversationThread),
      // Trigger transport (webhook) + self-hosting env allowlist
      // (spec/5-system/5-expression-language §4.5). Empty objects (not undefined)
      // so `$trigger.body` / `$env.KEY` resolve to undefined instead of throwing
      // EXPR_REFERENCE_ERROR (§6.2).
      $trigger: this.buildTriggerView(executionContext.triggerData),
      $env: this.buildEnvView(),
    };
  }

  /**
   * `$trigger` — webhook transport flat view (spec §4.5). 민감 헤더 값은
   * `sanitizeResponseHeaders`(통합 노드 blacklist 재사용)로 마스킹한다. transport 가
   * 없는 실행(manual/schedule/background)은 빈 객체를 반환해 `$trigger.body` 가
   * `EXPR_REFERENCE_ERROR` 대신 `undefined` 로 graceful 하게 떨어지게 한다.
   */
  private buildTriggerView(
    trigger: TriggerExpressionData | undefined,
  ): Record<string, unknown> {
    if (!trigger) return {};
    const view: Record<string, unknown> = {};
    if ('body' in trigger) view.body = trigger.body;
    if (trigger.headers)
      view.headers = sanitizeResponseHeaders(trigger.headers);
    if (trigger.query) view.query = trigger.query;
    if (trigger.method !== undefined) view.method = trigger.method;
    return view;
  }

  /**
   * `$env` — 운영자 opt-in allowlist(`EXPRESSION_ENV_ALLOWLIST`, 콤마 구분)에 나열된
   * 키만 `process.env` 에서 노출한다 (spec §4.5/§8.5). 미설정/빈 값이면 빈 객체 —
   * secret 은 opt-in 이 아니면 절대 노출되지 않는다. 배포 운영자만 env 를 설정할 수
   * 있으므로 이 opt-in 이 곧 self-hosting 게이팅이다.
   */
  private buildEnvView(): Record<string, string> {
    const raw = this.configService.get<string>('app.expressionEnvAllowlist');
    if (!raw) return {};
    const env: Record<string, string> = {};
    for (const key of raw.split(',')) {
      const trimmed = key.trim();
      if (!trimmed) continue;
      const value = process.env[trimmed];
      if (value !== undefined) env[trimmed] = value;
    }
    return env;
  }

  private buildThreadView(thread: ExecutionContext['conversationThread']):
    | {
        turns: ExecutionContext['conversationThread']['turns'];
        length: number;
        text: string;
      }
    | undefined {
    if (!thread) return undefined;
    // Snapshot the turns array — expressions are read-only by spec, but
    // returning the live array would let later append() calls appear to
    // mutate already-evaluated context objects (e.g. per-iteration loop
    // bodies that hold a reference). The wrapper and contained turn
    // objects stay shared (turns are immutable post-push).
    const snapshot = [...thread.turns];
    const view: {
      turns: typeof snapshot;
      length: number;
      text?: string;
    } = {
      turns: snapshot,
      length: snapshot.length,
    };
    // Lazy `text` — only renders when the expression actually reads
    // `$thread.text`. Memoized on first access so repeated reads in the
    // same turn (e.g. inside a Loop) stay O(1). spec/conventions/
    // conversation-thread.md §7 (v2 lazy roadmap, option A).
    let cached: string | undefined;
    Object.defineProperty(view, 'text', {
      enumerable: true,
      configurable: false,
      get(): string {
        if (cached === undefined) {
          cached = renderThreadAsSystemText(snapshot);
        }
        return cached;
      },
    });
    return view as {
      turns: typeof snapshot;
      length: number;
      text: string;
    };
  }

  /**
   * Resolve expressions in a config object.
   * Recursively walks the config and evaluates {{ }} patterns in string values.
   */
  resolveConfig(
    config: Record<string, unknown>,
    exprContext: EngineContext,
    nodeType?: string,
  ): Record<string, unknown> {
    const excludeKeys = nodeType ? EXPRESSION_EXCLUSIONS[nodeType] : undefined;
    return this.resolveObject(config, exprContext, excludeKeys, '', 0);
  }

  private resolveObject(
    obj: Record<string, unknown>,
    ctx: EngineContext,
    excludeKeys: Set<string> | undefined,
    path: string,
    depth: number,
  ): Record<string, unknown> {
    if (depth > MAX_DEPTH) {
      this.logger.warn(
        `Expression resolver exceeded max depth (${MAX_DEPTH}) at path "${path}". Config values beyond this depth are not resolved.`,
      );
      return obj;
    }

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const fieldPath = path ? `${path}.${key}` : key;

      if (excludeKeys?.has(key)) {
        result[key] = value;
        continue;
      }

      result[key] = this.resolveValue(
        value,
        ctx,
        excludeKeys,
        fieldPath,
        depth,
      );
    }
    return result;
  }

  private resolveValue(
    value: unknown,
    ctx: EngineContext,
    excludeKeys: Set<string> | undefined,
    path: string,
    depth: number,
  ): unknown {
    if (value === null || value === undefined) return value;

    if (typeof value === 'string') {
      return this.resolveString(value, ctx, path);
    }

    if (Array.isArray(value)) {
      return value.map((item, i) =>
        this.resolveValue(item, ctx, excludeKeys, `${path}[${i}]`, depth),
      );
    }

    if (typeof value === 'object') {
      return this.resolveObject(
        value as Record<string, unknown>,
        ctx,
        excludeKeys,
        path,
        depth + 1,
      );
    }

    // number, boolean — pass through
    return value;
  }

  private resolveString(
    value: string,
    ctx: EngineContext,
    path: string,
  ): unknown {
    // Fast-path 1: 표현식 토큰 자체가 없으면 즉시 통과. indexOf 는 regex 보다 cheap.
    if (value.indexOf('{{') === -1) return value;
    // Fast-path 2: FULL_EXPRESSION_PATTERN 한 번만 매칭해 두 분기 (단독 표현식
    // vs 혼합 텍스트) 를 판별. 옛 코드는 EXPRESSION_PATTERN.test 와 FULL_*.test 를
    // 분리 호출해 동일 정규식 엔진 startup 을 두 번 지불했다 (W-26).
    const isFull = FULL_EXPRESSION_PATTERN.test(value);

    try {
      const result = evaluate(value, ctx);

      // If the entire value is a single expression, preserve the evaluated type
      if (isFull) {
        return result;
      }

      // Mixed text + expression: always coerce to string
      if (typeof result === 'string') return result;
      if (result === null || result === undefined) return '';
      if (typeof result === 'object') return JSON.stringify(result);
      if (typeof result === 'number' || typeof result === 'boolean') {
        return result.toString();
      }
      return `${result as string}`;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Expression error in config.${path}: ${message}`);
    }
  }
}
