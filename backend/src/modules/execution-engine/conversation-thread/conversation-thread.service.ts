import { Injectable } from '@nestjs/common';
import { ExecutionContext } from '../../../nodes/core/node-handler.interface';
import {
  ConversationTurn,
  ConversationTurnSource,
  ConversationTurnToolCall,
} from './conversation-thread.types';
import { renderInteractionText } from './thread-renderer';

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
    context: ExecutionContext,
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
    context: ExecutionContext,
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
    context: ExecutionContext,
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
    context: ExecutionContext,
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
  getThread(
    context: ExecutionContext,
  ): Readonly<ExecutionContext['conversationThread']> {
    return context.conversationThread;
  }

  /**
   * 자기 노드가 발생시킨 turn 을 제외한 readonly snapshot. AI Agent 의
   * `messages` 모드 자동 주입에서 자체 messages 와 중복을 막기 위한 용도.
   */
  getThreadExcludingNode(
    context: ExecutionContext,
    nodeId: string,
  ): readonly ConversationTurn[] {
    return context.conversationThread.turns.filter((t) => t.nodeId !== nodeId);
  }

  /** 최근 N개 turn (시간순). N <= 0 또는 thread 비어있으면 빈 배열. */
  lastN(context: ExecutionContext, n: number): readonly ConversationTurn[] {
    if (n <= 0) return [];
    const turns = context.conversationThread.turns;
    return turns.length <= n ? [...turns] : turns.slice(turns.length - n);
  }

  /* ---------- internal ---------- */

  private appendInternal(
    context: ExecutionContext,
    args: AppendBaseArgs,
  ): void {
    if (this.isOptedOut(args.node)) return;

    const thread = context.conversationThread;
    const seq = thread.nextSeq;
    const turn: ConversationTurn = {
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
    };
    thread.turns.push(turn);
    thread.nextSeq = seq + 1;
    thread.totalChars += args.text.length;
  }

  private isOptedOut(node: NodeRef): boolean {
    return node.config?.excludeFromConversationThread === true;
  }
}
