import { Injectable } from '@nestjs/common';
import {
  ConversationThread,
  ConversationTurn,
  ConversationTurnSource,
  ConversationTurnToolCall,
  MutableConversationThread,
} from '../../../shared/conversation-thread/conversation-thread.types';
import { renderInteractionText } from '../../../shared/conversation-thread/thread-renderer';

/**
 * ConversationThread mutation 의 호출 측은 보통 `ExecutionContext` 를 가지지만,
 * AI Agent multi-turn 의 후속 turn 처럼 ExecutionContext 가 직접 주입되지
 * 않고 `state` 만 받는 경로에서는 thread reference 만 별도로 보관해 전달한다.
 * 두 호출 형태를 같은 메서드로 처리하기 위한 structural type.
 */
export type ThreadHolder = { conversationThread: ConversationThread };

/**
 * 핸들러 / engine hook 가 ConversationThreadService 에 전달하는 노드 식별자.
 * Node entity 전체를 받지 않아 핸들러가 자체 lookup 해 줄여 만든 형태로도
 * 호출 가능 (예: AI Agent multi-turn 의 후속 turn 에서 state 에 보관해 둔
 * label/type).
 *
 * `label` 이 빈 문자열이면 `id` 가 fallback 으로 사용된다.
 */
export interface NodeRef {
  id: string;
  label: string;
  type: string;
  config?: Record<string, unknown>;
}

/**
 * presentation 노드 resume 시 engine 이 ConversationThreadService 에 전달하는
 * payload. `type` 은 spec 의 `form_submitted` / `button_click` / `button_continue`
 * 외에도 향후 신규 interaction type 이 추가될 수 있어 `string` 으로 둔다.
 */
export interface PresentationInteractionPayload {
  type: string;
  data?: Record<string, unknown>;
  receivedAt: string;
}

interface AppendBaseArgs {
  node: NodeRef;
  source: ConversationTurnSource;
  text: string;
  timestamp?: string;
  data?: Record<string, unknown>;
  toolCalls?: ConversationTurnToolCall[];
  toolCallId?: string;
}

/**
 * Storage-side cap distinct from the LLM-injection caps in `thread-renderer`.
 * Long-running executions or repeated user submissions could grow the thread
 * unboundedly otherwise (LLM caps only limit what reaches the model). When
 * exceeded the oldest turn is evicted and `nextSeq` keeps incrementing — turn
 * `seq` values may have gaps but stay monotonically increasing.
 */
export const STORAGE_MAX_TURNS = 500;

/**
 * ConversationThread mutation 단일 진입점. spec/conventions/conversation-thread.md.
 *
 * 핸들러는 thread.turns 를 직접 수정하지 않는다 — 모든 push 는 본 서비스의
 * `append*` 메서드를 통한다. opt-out (`node.config.excludeFromConversationThread
 * === true`) 검사는 호출 직전에 본 서비스가 수행하므로 호출 측은 무조건
 * 호출하면 된다 (silent skip).
 */
@Injectable()
export class ConversationThreadService {
  appendPresentationInteraction(
    context: ThreadHolder,
    args: { node: NodeRef; interaction: PresentationInteractionPayload },
  ): void {
    const { node, interaction } = args;
    const text = renderInteractionText(interaction);
    this.appendInternal(context, {
      node,
      source: 'presentation_user',
      text,
      timestamp: interaction.receivedAt,
      data: interaction.data,
    });
  }

  appendAiUserMessage(
    context: ThreadHolder,
    args: { node: NodeRef; content: string; timestamp?: string },
  ): void {
    this.appendInternal(context, {
      node: args.node,
      source: 'ai_user',
      text: args.content,
      timestamp: args.timestamp,
    });
  }

  appendAiAssistantMessage(
    context: ThreadHolder,
    args: {
      node: NodeRef;
      content: string;
      toolCalls?: ConversationTurnToolCall[];
      timestamp?: string;
    },
  ): void {
    this.appendInternal(context, {
      node: args.node,
      source: 'ai_assistant',
      text: args.content,
      timestamp: args.timestamp,
      toolCalls: args.toolCalls,
    });
  }

  /**
   * KB / MCP / condition tool 결과 push. **opt-in only** — AI Agent 의
   * `includeToolTurns: true` 설정 시에만 호출돼야 한다 (게이트는 호출 측 책임).
   */
  appendAiToolResult(
    context: ThreadHolder,
    args: {
      node: NodeRef;
      toolCallId: string;
      content: string;
      timestamp?: string;
    },
  ): void {
    this.appendInternal(context, {
      node: args.node,
      source: 'ai_tool',
      text: args.content,
      timestamp: args.timestamp,
      toolCallId: args.toolCallId,
    });
  }

  /** Read-only snapshot. 외부 mutation 은 service 동작에 영향 없음. */
  getThread(context: ThreadHolder): Readonly<ConversationThread> {
    return context.conversationThread;
  }

  /**
   * 자기 노드가 발생시킨 turn 을 제외한 readonly snapshot. AI Agent 의
   * `messages` 모드 자동 주입에서 자체 messages 와 중복을 막기 위한 용도.
   */
  getThreadExcludingNode(
    context: ThreadHolder,
    nodeId: string,
  ): readonly ConversationTurn[] {
    return context.conversationThread.turns.filter((t) => t.nodeId !== nodeId);
  }

  /** 최근 N개 turn (시간순). N <= 0 또는 thread 비어있으면 빈 배열. */
  lastN(context: ThreadHolder, n: number): readonly ConversationTurn[] {
    if (n <= 0) return [];
    const turns = context.conversationThread.turns;
    return turns.length <= n ? [...turns] : turns.slice(turns.length - n);
  }

  /* ---------- internal ---------- */

  private appendInternal(context: ThreadHolder, args: AppendBaseArgs): void {
    if (this.isOptedOut(args.node)) return;

    // External callers see ConversationThread (readonly turns); the service
    // is the sole writer so we cast to the mutable view to push/splice.
    // Spec/conventions/conversation-thread.md §2.4 — single mutation entry.
    const thread = context.conversationThread as MutableConversationThread;
    const seq = thread.nextSeq;
    // Object.freeze enforces the post-push immutability invariant that
    // background snapshot isolation (cloneThread §3.2) and tool-loop turn
    // injection both rely on. Any later mutation throws in strict mode.
    const turn: ConversationTurn = Object.freeze({
      seq,
      nodeId: args.node.id,
      nodeLabel: args.node.label || args.node.id,
      nodeType: args.node.type,
      timestamp: args.timestamp ?? new Date().toISOString(),
      source: args.source,
      text: args.text,
      ...(args.data !== undefined ? { data: args.data } : {}),
      ...(args.toolCalls !== undefined ? { toolCalls: args.toolCalls } : {}),
      ...(args.toolCallId !== undefined ? { toolCallId: args.toolCallId } : {}),
    }) as ConversationTurn;
    thread.turns.push(turn);
    thread.nextSeq = seq + 1;
    thread.totalChars += args.text.length;

    // Storage cap: drop oldest turns to bound thread memory regardless of
    // LLM-injection caps. We keep `nextSeq` monotonic (don't decrement) so
    // surviving turn sequences stay consistent across the thread lifetime.
    if (thread.turns.length > STORAGE_MAX_TURNS) {
      const drop = thread.turns.length - STORAGE_MAX_TURNS;
      const removed = thread.turns.splice(0, drop);
      let removedChars = 0;
      for (const r of removed) removedChars += r.text.length;
      thread.totalChars -= removedChars;
    }
  }

  private isOptedOut(node: NodeRef): boolean {
    return node.config?.excludeFromConversationThread === true;
  }
}
