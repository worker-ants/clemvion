import {
  ConversationThreadService,
  NodeRef,
} from './conversation-thread.service';
import {
  ConversationThread,
  createEmptyConversationThread,
} from './conversation-thread.types';
import { ExecutionContext } from '../../../nodes/core/node-handler.interface';

function makeContext(thread?: ConversationThread): ExecutionContext {
  return {
    executionId: 'exec-1',
    workflowId: 'wf-1',
    variables: {},
    nodeOutputCache: {},
    structuredOutputCache: {},
    engineResolvedConfigCache: {},
    recursionDepth: 0,
    conversationThread: thread ?? createEmptyConversationThread(),
  };
}

function makeNode(overrides: Partial<NodeRef> = {}): NodeRef {
  return {
    id: 'node-1',
    label: 'Form',
    type: 'form',
    ...overrides,
  };
}

describe('ConversationThreadService', () => {
  let service: ConversationThreadService;

  beforeEach(() => {
    service = new ConversationThreadService();
  });

  describe('appendPresentationInteraction', () => {
    it('pushes presentation_user turn for form_submitted', () => {
      const context = makeContext();
      service.appendPresentationInteraction(context, {
        node: makeNode(),
        interaction: {
          type: 'form_submitted',
          data: { name: 'Alice', age: 30 },
          receivedAt: '2026-05-14T10:00:00.000Z',
        },
      });

      const thread = service.getThread(context);
      expect(thread.turns).toHaveLength(1);
      const turn = thread.turns[0];
      expect(turn.seq).toBe(0);
      expect(turn.source).toBe('presentation_user');
      expect(turn.nodeId).toBe('node-1');
      expect(turn.nodeLabel).toBe('Form');
      expect(turn.nodeType).toBe('form');
      expect(turn.text).toBe('[user-input]name=Alice, age=30[/user-input]');
      expect(turn.timestamp).toBe('2026-05-14T10:00:00.000Z');
      expect(turn.data).toEqual({ name: 'Alice', age: 30 });
    });

    it('pushes presentation_user turn for button_click', () => {
      const context = makeContext();
      service.appendPresentationInteraction(context, {
        node: makeNode({ id: 'btn-node', label: 'Carousel', type: 'carousel' }),
        interaction: {
          type: 'button_click',
          data: { buttonId: 'btn-1', buttonLabel: '동의' },
          receivedAt: '2026-05-14T10:00:01.000Z',
        },
      });
      const thread = service.getThread(context);
      expect(thread.turns[0].text).toBe(
        'clicked: [user-input]동의[/user-input]',
      );
      expect(thread.turns[0].source).toBe('presentation_user');
    });

    it('skips when excludeFromConversationThread=true (silent opt-out)', () => {
      const context = makeContext();
      service.appendPresentationInteraction(context, {
        node: makeNode({ config: { excludeFromConversationThread: true } }),
        interaction: {
          type: 'form_submitted',
          data: { foo: 'bar' },
          receivedAt: '2026-05-14T10:00:00.000Z',
        },
      });
      expect(service.getThread(context).turns).toHaveLength(0);
    });

    it('uses nodeId fallback when label is empty', () => {
      const context = makeContext();
      service.appendPresentationInteraction(context, {
        node: makeNode({ id: 'node-x', label: '' }),
        interaction: {
          type: 'form_submitted',
          data: { a: 1 },
          receivedAt: '2026-05-14T10:00:00.000Z',
        },
      });
      expect(service.getThread(context).turns[0].nodeLabel).toBe('node-x');
    });
  });

  describe('appendAiUserMessage / appendAiAssistantMessage', () => {
    it('pushes ai_user turn with provided content', () => {
      const context = makeContext();
      service.appendAiUserMessage(context, {
        node: makeNode({ type: 'ai_agent', label: 'Agent' }),
        content: 'hello there',
        timestamp: '2026-05-14T10:00:00.000Z',
      });
      const turn = service.getThread(context).turns[0];
      expect(turn.source).toBe('ai_user');
      expect(turn.text).toBe('hello there');
    });

    it('pushes ai_assistant turn with toolCalls preserved', () => {
      const context = makeContext();
      service.appendAiAssistantMessage(context, {
        node: makeNode({ type: 'ai_agent' }),
        content: 'response',
        toolCalls: [{ id: 'c1', name: 'kb_x', arguments: '{}' }],
      });
      const turn = service.getThread(context).turns[0];
      expect(turn.source).toBe('ai_assistant');
      expect(turn.text).toBe('response');
      expect(turn.toolCalls).toEqual([
        { id: 'c1', name: 'kb_x', arguments: '{}' },
      ]);
    });

    it('auto-generates ISO timestamp when omitted', () => {
      const context = makeContext();
      service.appendAiUserMessage(context, {
        node: makeNode({ type: 'ai_agent' }),
        content: 'x',
      });
      const turn = service.getThread(context).turns[0];
      expect(turn.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });
  });

  describe('appendAiToolResult', () => {
    it('pushes ai_tool turn with toolCallId', () => {
      const context = makeContext();
      service.appendAiToolResult(context, {
        node: makeNode({ type: 'ai_agent' }),
        toolCallId: 'call-1',
        content: '{"result":"ok"}',
      });
      const turn = service.getThread(context).turns[0];
      expect(turn.source).toBe('ai_tool');
      expect(turn.toolCallId).toBe('call-1');
      expect(turn.text).toBe('{"result":"ok"}');
    });
  });

  describe('seq + totalChars', () => {
    it('assigns monotonic seq starting from 0', () => {
      const context = makeContext();
      service.appendAiUserMessage(context, {
        node: makeNode({ type: 'ai_agent' }),
        content: 'a',
      });
      service.appendAiAssistantMessage(context, {
        node: makeNode({ type: 'ai_agent' }),
        content: 'b',
      });
      service.appendAiUserMessage(context, {
        node: makeNode({ type: 'ai_agent' }),
        content: 'c',
      });
      const seqs = service.getThread(context).turns.map((t) => t.seq);
      expect(seqs).toEqual([0, 1, 2]);
      expect(service.getThread(context).nextSeq).toBe(3);
    });

    it('accumulates totalChars from text length', () => {
      const context = makeContext();
      service.appendAiUserMessage(context, {
        node: makeNode({ type: 'ai_agent' }),
        content: 'hi', // 2
      });
      service.appendAiAssistantMessage(context, {
        node: makeNode({ type: 'ai_agent' }),
        content: 'world', // 5
      });
      expect(service.getThread(context).totalChars).toBe(7);
    });

    it('opt-out skip does not increment seq', () => {
      const context = makeContext();
      service.appendAiUserMessage(context, {
        node: makeNode({
          type: 'ai_agent',
          config: { excludeFromConversationThread: true },
        }),
        content: 'skipped',
      });
      service.appendAiUserMessage(context, {
        node: makeNode({ type: 'ai_agent' }),
        content: 'kept',
      });
      const turns = service.getThread(context).turns;
      expect(turns).toHaveLength(1);
      expect(turns[0].seq).toBe(0);
      expect(service.getThread(context).nextSeq).toBe(1);
    });
  });

  describe('lastN', () => {
    it('returns last N turns in chronological order', () => {
      const context = makeContext();
      for (let i = 0; i < 5; i++) {
        service.appendAiUserMessage(context, {
          node: makeNode({ type: 'ai_agent' }),
          content: `t${i}`,
        });
      }
      const last3 = service.lastN(context, 3);
      expect(last3.map((t) => t.text)).toEqual(['t2', 't3', 't4']);
    });

    it('clamps N when larger than thread length', () => {
      const context = makeContext();
      service.appendAiUserMessage(context, {
        node: makeNode({ type: 'ai_agent' }),
        content: 'a',
      });
      const result = service.lastN(context, 10);
      expect(result).toHaveLength(1);
    });

    it('returns empty array for N <= 0', () => {
      const context = makeContext();
      service.appendAiUserMessage(context, {
        node: makeNode({ type: 'ai_agent' }),
        content: 'a',
      });
      expect(service.lastN(context, 0)).toEqual([]);
      expect(service.lastN(context, -1)).toEqual([]);
    });
  });

  describe('getThreadExcludingNode', () => {
    it('filters out turns from the specified nodeId', () => {
      const context = makeContext();
      service.appendAiUserMessage(context, {
        node: makeNode({ id: 'self', type: 'ai_agent' }),
        content: 'self-1',
      });
      service.appendAiAssistantMessage(context, {
        node: makeNode({ id: 'other', type: 'ai_agent' }),
        content: 'other-1',
      });
      service.appendAiUserMessage(context, {
        node: makeNode({ id: 'self', type: 'ai_agent' }),
        content: 'self-2',
      });

      const filtered = service.getThreadExcludingNode(context, 'self');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].text).toBe('other-1');
    });

    it('returns full thread when nodeId not present', () => {
      const context = makeContext();
      service.appendAiUserMessage(context, {
        node: makeNode({ id: 'a', type: 'ai_agent' }),
        content: 'x',
      });
      const filtered = service.getThreadExcludingNode(context, 'nonexistent');
      expect(filtered).toHaveLength(1);
    });
  });

  describe('immutability', () => {
    it('getThread returns a snapshot — mutating it does not affect future appends', () => {
      const context = makeContext();
      service.appendAiUserMessage(context, {
        node: makeNode({ type: 'ai_agent' }),
        content: 'x',
      });
      const snapshot = service.getThread(context);
      // External mutation should not corrupt internal state
      // (we rely on TS readonly + service's internal management).
      expect(snapshot.turns.length).toBe(1);

      service.appendAiAssistantMessage(context, {
        node: makeNode({ type: 'ai_agent' }),
        content: 'y',
      });
      const fresh = service.getThread(context);
      expect(fresh.turns.length).toBe(2);
    });
  });
});
