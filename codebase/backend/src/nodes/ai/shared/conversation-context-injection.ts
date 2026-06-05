/**
 * ConversationThread 자동 주입 (`contextScope`) — AI 카테고리 3 노드
 * (AI Agent / Text Classifier / Information Extractor) 공통 헬퍼.
 *
 * Spec: spec/conventions/conversation-thread.md §5 · spec/4-nodes/3-ai/0-common.md §10.
 *
 * `contextScope` (none/thread/lastN) · `contextInjectionMode` (messages/system_text)
 * 설정으로 현재 실행의 ConversationThread (자기 노드 turn 제외) 를 LLM 입력에
 * 주입한다. **노드 타입과 무관한 순수 변환** — thread 조회만 service 에 의존하므로
 * 세 핸들러가 동일하게 호출한다.
 *
 * 본 모듈은 AI Agent 의 `injectThreadContext` private 메서드에서 노드무관 로직을
 * 추출한 것이다 (manual `contextScope` 경로 한정). AI Agent 의 `memoryStrategy ∈
 * {summary_buffer, persistent}` 자동 메모리 경로는 별도 (`agent-memory-injection`)
 * 로 ai_agent 핸들러에 남는다.
 */

import type { ChatMessage } from '../../../modules/llm/interfaces/llm-client.interface';
import type { ConversationTurn } from '../../../shared/conversation-thread/conversation-thread.types';
import {
  applyCap,
  renderThreadAsSystemText,
} from '../../../shared/conversation-thread/thread-renderer';

/** `contextScopeN` default (ai-agent.schema.ts `DEFAULT_CONTEXT_SCOPE_N` 와 동치). */
export const DEFAULT_CONVERSATION_CONTEXT_SCOPE_N = 20;

export type ConversationContextScope = 'none' | 'thread' | 'lastN';
export type ConversationContextMode = 'messages' | 'system_text';

/**
 * 주입에 필요한 thread 조회 최소 인터페이스 — `ConversationThreadService` 의
 * `getThreadExcludingNode` 시그니처와 정합. service 전체를 의존하지 않고 본
 * 메서드만 받아 단위 테스트에서 fake 주입을 용이하게 한다.
 */
export interface ThreadReader<Target> {
  getThreadExcludingNode(
    target: Target,
    nodeId: string,
  ): readonly ConversationTurn[];
}

export interface ConversationContextInjectionResult {
  messages: ChatMessage[];
  finalSystemPrompt: string;
  injection: {
    appliedScope: 'none' | 'thread' | 'lastN';
    appliedMode: 'messages' | 'system_text';
    injectedTurns: number;
    droppedTurns: number;
    totalInjectedChars: number;
  };
}

/**
 * Map ConversationTurn → LLM ChatMessage (messages-mode injection,
 * spec/conventions/conversation-thread.md §5.1). Pure function.
 *
 * `presentation_user` turns are prefixed with `[from <nodeLabel>]` so the
 * LLM can attribute the input back to the originating node. Every returned
 * message carries `source: 'injected'` for the WebSocket emit layer
 * (spec/5-system/6-websocket-protocol.md §4.4.6) — set once at the bottom so
 * adding a new turn source can't accidentally drop the marker.
 */
export function mapTurnsToChatMessages(
  turns: readonly ConversationTurn[],
): ChatMessage[] {
  return turns
    .map((t): ChatMessage => {
      switch (t.source) {
        case 'presentation_user':
          return {
            role: 'user',
            content: `[from ${t.nodeLabel}] ${t.text}`,
          } as ChatMessage;
        case 'ai_user':
          return { role: 'user', content: t.text } as ChatMessage;
        case 'ai_assistant':
          return {
            role: 'assistant',
            content: t.text,
            ...(t.toolCalls ? { toolCalls: t.toolCalls } : {}),
          } as ChatMessage;
        case 'ai_tool':
          return {
            role: 'tool',
            content: t.text,
            ...(t.toolCallId ? { toolCallId: t.toolCallId } : {}),
          } as ChatMessage;
        case 'system':
          return { role: 'system', content: t.text } as ChatMessage;
        default:
          return { role: 'user', content: t.text } as ChatMessage;
      }
    })
    .map((m) => ({ ...m, source: 'injected' as const }));
}

/**
 * Inject the ConversationThread (excluding the current node's own turns)
 * into the LLM chat. spec/conventions/conversation-thread.md §5.
 *
 * Returns the (possibly) mutated messages + system prompt so the caller can
 * hand them to `llmService.chat`, plus a debug snapshot.
 *
 * No-op (returns inputs untouched, `appliedScope: 'none'`) when the reader is
 * absent, the target is missing, scope is unset/`none`, or the thread has no
 * other-node turns.
 *
 * Single-turn: invoke once immediately before the first chat.
 * Multi-turn: invoke once during the first entry (the injected turns are then
 *   carried in `_resumeState.messages` for every subsequent chat).
 */
export function injectConversationContext<Target>(args: {
  reader: ThreadReader<Target> | undefined;
  target: Target | undefined;
  selfNodeId: string;
  config: Record<string, unknown>;
  messages: ChatMessage[];
  finalSystemPrompt: string;
}): ConversationContextInjectionResult {
  const noopMeta = {
    appliedScope: 'none' as const,
    appliedMode: 'messages' as const,
    injectedTurns: 0,
    droppedTurns: 0,
    totalInjectedChars: 0,
  };

  const scope = args.config.contextScope as
    | ConversationContextScope
    | undefined;
  if (!args.reader || !args.target || !scope || scope === 'none') {
    return {
      messages: args.messages,
      finalSystemPrompt: args.finalSystemPrompt,
      injection: noopMeta,
    };
  }

  const allTurns = args.reader.getThreadExcludingNode(
    args.target,
    args.selfNodeId,
  );
  if (allTurns.length === 0) {
    return {
      messages: args.messages,
      finalSystemPrompt: args.finalSystemPrompt,
      injection: { ...noopMeta, appliedScope: scope },
    };
  }

  const scoped =
    scope === 'lastN'
      ? allTurns.slice(
          -Math.max(
            1,
            (args.config.contextScopeN as number) ??
              DEFAULT_CONVERSATION_CONTEXT_SCOPE_N,
          ),
        )
      : allTurns;

  // Cap (per spec §5.3 — char-based, last-resort safety).
  const capped = applyCap(scoped);

  const mode =
    (args.config.contextInjectionMode as ConversationContextMode) ?? 'messages';

  if (mode === 'system_text') {
    const text = renderThreadAsSystemText(capped.turns);
    const newSystemPrompt = args.finalSystemPrompt
      ? `${args.finalSystemPrompt}\n\n${text}`
      : text;
    // Mirror the appended thread text into the messages array's system entry
    // so callers don't need to re-sync the two surfaces.
    const newMessages = args.messages.map((m) =>
      m.role === 'system' ? { ...m, content: newSystemPrompt } : m,
    );
    return {
      messages: newMessages,
      finalSystemPrompt: newSystemPrompt,
      injection: {
        appliedScope: scope,
        appliedMode: 'system_text',
        injectedTurns: capped.turns.length,
        droppedTurns: capped.droppedCount,
        totalInjectedChars: capped.totalChars,
      },
    };
  }

  // 'messages' mode — prepend (after system) per spec §5.1 mapping.
  const injected: ChatMessage[] = mapTurnsToChatMessages(capped.turns);

  // Insert injected turns after the leading system message (if any).
  const systemIdx = args.messages.findIndex((m) => m.role === 'system');
  const newMessages = [...args.messages];
  const insertAt = systemIdx >= 0 ? systemIdx + 1 : 0;
  newMessages.splice(insertAt, 0, ...injected);

  return {
    messages: newMessages,
    finalSystemPrompt: args.finalSystemPrompt,
    injection: {
      appliedScope: scope,
      appliedMode: 'messages',
      injectedTurns: capped.turns.length,
      droppedTurns: capped.droppedCount,
      totalInjectedChars: capped.totalChars,
    },
  };
}
