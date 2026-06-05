/**
 * ConversationThread push contract for text_classifier.
 *
 * SoT: spec/conventions/conversation-thread.md §1.4 (text 변환) +
 *      §2.3 v2 (push extension to non-ai_agent AI nodes).
 */
import { TextClassifierHandler } from './text-classifier.handler';
import { ConversationThreadService } from '../../../modules/execution-engine/conversation-thread/conversation-thread.service';
import { makeExecutionContext } from '../../../modules/execution-engine/__test__/make-execution-context';

describe('TextClassifierHandler — ConversationThread push (v2)', () => {
  let mockLlmService: Record<string, jest.Mock>;
  let conversationThreadService: ConversationThreadService;
  let handler: TextClassifierHandler;

  beforeEach(() => {
    mockLlmService = {
      resolveConfig: jest.fn().mockResolvedValue({
        id: 'cfg',
        provider: 'openai',
        defaultModel: 'gpt-4o-mini',
      }),
      chat: jest.fn(),
      embed: jest.fn(),
    };
    conversationThreadService = new ConversationThreadService();
    handler = new TextClassifierHandler(
      mockLlmService as never,
      conversationThreadService,
    );
  });

  it('single-label: pushes ai_assistant turn with category name', async () => {
    mockLlmService.chat.mockResolvedValueOnce({
      content: JSON.stringify({ category: 'refund' }),
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      model: 'gpt-4o-mini',
    });
    const context = makeExecutionContext({ nodeId: 'classifier-1' });
    await handler.execute(
      { text: '환불해주세요' },
      {
        multiLabel: false,
        model: 'gpt-4o-mini',
        inputField: 'text',
        categories: [
          { id: 'refund', name: 'refund', description: '환불' },
          { id: 'shipping', name: 'shipping', description: '배송' },
        ],
      },
      context,
    );
    const turns = conversationThreadService.getThread(context).turns;
    expect(turns).toHaveLength(1);
    expect(turns[0]).toMatchObject({
      nodeId: 'classifier-1',
      nodeType: 'text_classifier',
      source: 'ai_assistant',
      text: 'refund',
    });
  });

  it('multi-label: pushes ai_assistant turn with comma-joined names', async () => {
    mockLlmService.chat.mockResolvedValueOnce({
      content: JSON.stringify({
        categories: [
          { name: 'refund', confidence: 0.9 },
          { name: 'shipping', confidence: 0.8 },
        ],
      }),
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      model: 'gpt-4o-mini',
    });
    const context = makeExecutionContext({ nodeId: 'classifier-1' });
    await handler.execute(
      { text: '환불도 되고 배송도 빨라요' },
      {
        multiLabel: true,
        model: 'gpt-4o-mini',
        inputField: 'text',
        categories: [
          { id: 'refund', name: 'refund', description: '환불' },
          { id: 'shipping', name: 'shipping', description: '배송' },
        ],
      },
      context,
    );
    const turns = conversationThreadService.getThread(context).turns;
    expect(turns).toHaveLength(1);
    expect(turns[0].text).toBe('refund, shipping');
  });

  it('opt-out via excludeFromConversationThread skips push', async () => {
    mockLlmService.chat.mockResolvedValueOnce({
      content: JSON.stringify({ category: 'refund' }),
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      model: 'gpt-4o-mini',
    });
    const context = makeExecutionContext({ nodeId: 'c' });
    await handler.execute(
      { text: 'x' },
      {
        multiLabel: false,
        model: 'gpt-4o-mini',
        inputField: 'text',
        categories: [{ id: 'refund', name: 'refund', description: 'r' }],
        excludeFromConversationThread: true,
      },
      context,
    );
    expect(conversationThreadService.getThread(context).turns).toHaveLength(0);
  });

  it('legacy fixture without service injected: handler runs unchanged', async () => {
    const legacyHandler = new TextClassifierHandler(mockLlmService as never);
    mockLlmService.chat.mockResolvedValueOnce({
      content: JSON.stringify({ category: 'refund' }),
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      model: 'gpt-4o-mini',
    });
    await expect(
      legacyHandler.execute(
        { text: 'x' },
        {
          multiLabel: false,
          model: 'gpt-4o-mini',
          inputField: 'text',
          categories: [{ id: 'refund', name: 'refund', description: 'r' }],
        },
        makeExecutionContext({ nodeId: 'c' }),
      ),
    ).resolves.toMatchObject({ port: 'refund' });
  });
});

describe('TextClassifierHandler — ConversationThread inject (contextScope, A2)', () => {
  let mockLlmService: Record<string, jest.Mock>;
  let conversationThreadService: ConversationThreadService;
  let handler: TextClassifierHandler;

  beforeEach(() => {
    mockLlmService = {
      resolveConfig: jest.fn().mockResolvedValue({
        id: 'cfg',
        provider: 'openai',
        defaultModel: 'gpt-4o-mini',
      }),
      chat: jest.fn().mockResolvedValue({
        content: JSON.stringify({ category: 'refund' }),
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        model: 'gpt-4o-mini',
      }),
      embed: jest.fn(),
    };
    conversationThreadService = new ConversationThreadService();
    handler = new TextClassifierHandler(
      mockLlmService as never,
      conversationThreadService,
    );
  });

  function seedPriorTurn(context: ReturnType<typeof makeExecutionContext>) {
    conversationThreadService.appendAiAssistantMessage(context, {
      node: { id: 'agent-up', label: 'agent-up', type: 'ai_agent' },
      content: 'prior agent answer',
    });
  }

  it('contextScope=thread injects prior thread turns into LLM messages + echoes meta.contextInjection', async () => {
    const context = makeExecutionContext({ nodeId: 'classifier-1' });
    seedPriorTurn(context);
    const result = (await handler.execute(
      { text: 'x' },
      {
        multiLabel: false,
        model: 'gpt-4o-mini',
        inputField: 'text',
        categories: [{ id: 'refund', name: 'refund', description: 'r' }],
        contextScope: 'thread',
        contextInjectionMode: 'messages',
      },
      context,
    )) as { meta?: Record<string, unknown> };
    const sentMessages = mockLlmService.chat.mock.calls[0][1].messages;
    // [system, injected(assistant), user]
    expect(
      sentMessages.some(
        (m: { content: string }) => m.content === 'prior agent answer',
      ),
    ).toBe(true);
    // conversation-thread.md §5.3 debug echo (세 노드 공통).
    expect(result.meta?.contextInjection).toMatchObject({
      appliedScope: 'thread',
      appliedMode: 'messages',
      injectedTurns: 1,
    });
  });

  it('contextScope default (none) leaves messages unchanged + no meta.contextInjection (regression)', async () => {
    const context = makeExecutionContext({ nodeId: 'classifier-1' });
    seedPriorTurn(context);
    const result = (await handler.execute(
      { text: 'x' },
      {
        multiLabel: false,
        model: 'gpt-4o-mini',
        inputField: 'text',
        categories: [{ id: 'refund', name: 'refund', description: 'r' }],
      },
      context,
    )) as { meta?: Record<string, unknown> };
    const sentMessages = mockLlmService.chat.mock.calls[0][1].messages;
    expect(sentMessages).toHaveLength(2); // system + user only
    expect(
      sentMessages.some(
        (m: { content: string }) => m.content === 'prior agent answer',
      ),
    ).toBe(false);
    // none → noop, meta stays lean (no echo).
    expect(result.meta).not.toHaveProperty('contextInjection');
  });

  it('self-node turns are excluded from injection', async () => {
    const context = makeExecutionContext({ nodeId: 'classifier-1' });
    // self prior turn
    conversationThreadService.appendAiAssistantMessage(context, {
      node: {
        id: 'classifier-1',
        label: 'classifier-1',
        type: 'text_classifier',
      },
      content: 'my own earlier label',
    });
    await handler.execute(
      { text: 'x' },
      {
        multiLabel: false,
        model: 'gpt-4o-mini',
        inputField: 'text',
        categories: [{ id: 'refund', name: 'refund', description: 'r' }],
        contextScope: 'thread',
      },
      context,
    );
    const sentMessages = mockLlmService.chat.mock.calls[0][1].messages;
    expect(
      sentMessages.some(
        (m: { content: string }) => m.content === 'my own earlier label',
      ),
    ).toBe(false);
  });
});
