/**
 * Unit tests for the node-agnostic ConversationThread injection helper.
 *
 * SoT: spec/conventions/conversation-thread.md §5 ·
 *      spec/4-nodes/3-ai/0-common.md §10.
 *
 * Covers: contextScope none/thread/lastN, messages/system_text modes, self
 * exclusion, and the no-op (missing reader / empty thread) paths. The helper
 * is the shared core extracted from AI Agent's `injectThreadContext` and reused
 * by text_classifier / information_extractor.
 */
import { injectConversationContext } from './conversation-context-injection';
import { ConversationThreadService } from '../../../modules/execution-engine/conversation-thread/conversation-thread.service';
import { createEmptyConversationThread } from '../../../shared/conversation-thread/conversation-thread.types';
import type { ChatMessage } from '../../../modules/llm/interfaces/llm-client.interface';

function makeTarget() {
  return { conversationThread: createEmptyConversationThread() };
}

function seedThread(
  service: ConversationThreadService,
  target: {
    conversationThread: ReturnType<typeof createEmptyConversationThread>;
  },
  turns: Array<{
    nodeId: string;
    type: string;
    user?: string;
    assistant?: string;
  }>,
) {
  for (const t of turns) {
    if (t.user !== undefined) {
      service.appendAiUserMessage(target, {
        node: { id: t.nodeId, label: t.nodeId, type: t.type },
        content: t.user,
      });
    }
    if (t.assistant !== undefined) {
      service.appendAiAssistantMessage(target, {
        node: { id: t.nodeId, label: t.nodeId, type: t.type },
        content: t.assistant,
      });
    }
  }
}

function baseMessages(systemPrompt: string, userPrompt: string): ChatMessage[] {
  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];
}

describe('injectConversationContext', () => {
  let service: ConversationThreadService;

  beforeEach(() => {
    service = new ConversationThreadService();
  });

  it('contextScope=none → no-op, messages untouched', () => {
    const target = makeTarget();
    seedThread(service, target, [
      { nodeId: 'other', type: 'ai_agent', assistant: 'hi' },
    ]);
    const messages = baseMessages('sys', 'q');
    const result = injectConversationContext({
      reader: service,
      target,
      selfNodeId: 'self',
      config: { contextScope: 'none' },
      messages,
      finalSystemPrompt: 'sys',
    });
    expect(result.messages).toHaveLength(2);
    expect(result.injection.appliedScope).toBe('none');
    expect(result.injection.injectedTurns).toBe(0);
  });

  it('missing reader → no-op', () => {
    const result = injectConversationContext({
      reader: undefined,
      target: makeTarget(),
      selfNodeId: 'self',
      config: { contextScope: 'thread' },
      messages: baseMessages('sys', 'q'),
      finalSystemPrompt: 'sys',
    });
    expect(result.injection.appliedScope).toBe('none');
    expect(result.messages).toHaveLength(2);
  });

  it('empty thread (only self turns) → no injection', () => {
    const target = makeTarget();
    seedThread(service, target, [
      { nodeId: 'self', type: 'text_classifier', assistant: 'mine' },
    ]);
    const result = injectConversationContext({
      reader: service,
      target,
      selfNodeId: 'self',
      config: { contextScope: 'thread' },
      messages: baseMessages('sys', 'q'),
      finalSystemPrompt: 'sys',
    });
    expect(result.injection.appliedScope).toBe('thread');
    expect(result.injection.injectedTurns).toBe(0);
    expect(result.messages).toHaveLength(2);
  });

  it('contextScope=thread, messages mode → prepends all other-node turns after system', () => {
    const target = makeTarget();
    seedThread(service, target, [
      { nodeId: 'a', type: 'ai_agent', user: 'hello', assistant: 'world' },
      { nodeId: 'self', type: 'text_classifier', assistant: 'mine' },
    ]);
    const result = injectConversationContext({
      reader: service,
      target,
      selfNodeId: 'self',
      config: { contextScope: 'thread', contextInjectionMode: 'messages' },
      messages: baseMessages('sys', 'q'),
      finalSystemPrompt: 'sys',
    });
    expect(result.injection.appliedScope).toBe('thread');
    expect(result.injection.appliedMode).toBe('messages');
    expect(result.injection.injectedTurns).toBe(2); // a's user + assistant
    // [system, injected(user), injected(assistant), original user]
    expect(result.messages.map((m) => m.role)).toEqual([
      'system',
      'user',
      'assistant',
      'user',
    ]);
    expect(result.messages[1]).toMatchObject({
      role: 'user',
      content: 'hello',
      source: 'injected',
    });
    expect(result.messages[2]).toMatchObject({
      role: 'assistant',
      content: 'world',
      source: 'injected',
    });
    // self turn excluded
    expect(result.messages.some((m) => m.content === 'mine')).toBe(false);
  });

  it('contextScope=lastN respects contextScopeN', () => {
    const target = makeTarget();
    seedThread(service, target, [
      { nodeId: 'a', type: 'ai_agent', assistant: 't1' },
      { nodeId: 'b', type: 'ai_agent', assistant: 't2' },
      { nodeId: 'c', type: 'ai_agent', assistant: 't3' },
    ]);
    const result = injectConversationContext({
      reader: service,
      target,
      selfNodeId: 'self',
      config: { contextScope: 'lastN', contextScopeN: 2 },
      messages: baseMessages('sys', 'q'),
      finalSystemPrompt: 'sys',
    });
    expect(result.injection.injectedTurns).toBe(2);
    const injectedContents = result.messages
      .filter((m) => m.source === 'injected')
      .map((m) => m.content);
    expect(injectedContents).toEqual(['t2', 't3']);
  });

  it('system_text mode appends rendered thread to systemPrompt + mirrors into system message', () => {
    const target = makeTarget();
    seedThread(service, target, [
      { nodeId: 'a', type: 'ai_agent', assistant: 'prior-answer' },
    ]);
    const result = injectConversationContext({
      reader: service,
      target,
      selfNodeId: 'self',
      config: { contextScope: 'thread', contextInjectionMode: 'system_text' },
      messages: baseMessages('sys', 'q'),
      finalSystemPrompt: 'sys',
    });
    expect(result.injection.appliedMode).toBe('system_text');
    expect(result.finalSystemPrompt).toContain('sys');
    expect(result.finalSystemPrompt).toContain('prior-answer');
    // no extra messages inserted in system_text mode
    expect(result.messages).toHaveLength(2);
    // system message mirrors the appended thread text
    const sys = result.messages.find((m) => m.role === 'system');
    expect(sys?.content).toContain('prior-answer');
  });
});
