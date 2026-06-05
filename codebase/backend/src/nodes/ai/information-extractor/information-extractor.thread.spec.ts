/**
 * ConversationThread push contract for information_extractor (single-turn).
 *
 * SoT: spec/conventions/conversation-thread.md §1.4 (text 변환:
 *      JSON.stringify(extracted)) + §2.3 v2.
 *
 * Multi-turn push is tracked as a follow-up — needs the same state-carried
 * thread reference pattern as ai-agent multi-turn (see Phase 21 plan note).
 */
import { InformationExtractorHandler } from './information-extractor.handler';
import { ConversationThreadService } from '../../../modules/execution-engine/conversation-thread/conversation-thread.service';
import { makeExecutionContext } from '../../../modules/execution-engine/__test__/make-execution-context';

describe('InformationExtractorHandler — ConversationThread push (v2 single-turn)', () => {
  let mockLlmService: Record<string, jest.Mock>;
  let conversationThreadService: ConversationThreadService;
  let handler: InformationExtractorHandler;

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
    handler = new InformationExtractorHandler(
      mockLlmService as never,
      conversationThreadService,
    );
  });

  it('pushes ai_assistant turn with JSON.stringify(extracted)', async () => {
    const extracted = { name: 'Alice', email: 'alice@example.com' };
    mockLlmService.chat.mockResolvedValueOnce({
      content: JSON.stringify(extracted),
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      model: 'gpt-4o-mini',
    });
    const context = makeExecutionContext({ nodeId: 'extractor-1' });
    await handler.execute(
      { text: 'Alice alice@example.com' },
      {
        mode: 'single_turn',
        model: 'gpt-4o-mini',
        inputField: 'text',
        outputSchema: [
          { name: 'name', type: 'string', required: true },
          { name: 'email', type: 'string' },
        ],
      },
      context,
    );
    const turns = conversationThreadService.getThread(context).turns;
    expect(turns).toHaveLength(1);
    expect(turns[0]).toMatchObject({
      nodeId: 'extractor-1',
      nodeType: 'information_extractor',
      source: 'ai_assistant',
      text: JSON.stringify(extracted),
    });
  });

  it('opt-out via excludeFromConversationThread skips push', async () => {
    mockLlmService.chat.mockResolvedValueOnce({
      content: JSON.stringify({ name: 'X' }),
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      model: 'gpt-4o-mini',
    });
    const context = makeExecutionContext({ nodeId: 'e' });
    await handler.execute(
      { text: 'x' },
      {
        mode: 'single_turn',
        model: 'gpt-4o-mini',
        inputField: 'text',
        outputSchema: [{ name: 'name', type: 'string', required: true }],
        excludeFromConversationThread: true,
      },
      context,
    );
    expect(conversationThreadService.getThread(context).turns).toHaveLength(0);
  });

  it('legacy fixture without service injected: handler runs unchanged', async () => {
    const legacy = new InformationExtractorHandler(mockLlmService as never);
    mockLlmService.chat.mockResolvedValueOnce({
      content: JSON.stringify({ name: 'X' }),
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      model: 'gpt-4o-mini',
    });
    await expect(
      legacy.execute(
        { text: 'x' },
        {
          mode: 'single_turn',
          model: 'gpt-4o-mini',
          inputField: 'text',
          outputSchema: [{ name: 'name', type: 'string', required: true }],
        },
        makeExecutionContext({ nodeId: 'e' }),
      ),
    ).resolves.toMatchObject({ port: 'out' });
  });
});

describe('InformationExtractorHandler — ConversationThread inject (contextScope, A2)', () => {
  let mockLlmService: Record<string, jest.Mock>;
  let conversationThreadService: ConversationThreadService;
  let handler: InformationExtractorHandler;

  beforeEach(() => {
    mockLlmService = {
      resolveConfig: jest.fn().mockResolvedValue({
        id: 'cfg',
        provider: 'openai',
        defaultModel: 'gpt-4o-mini',
      }),
      chat: jest.fn().mockResolvedValue({
        content: JSON.stringify({ name: 'Alice' }),
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        model: 'gpt-4o-mini',
      }),
      embed: jest.fn(),
    };
    conversationThreadService = new ConversationThreadService();
    handler = new InformationExtractorHandler(
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

  it('single-turn contextScope=thread injects prior thread turns into LLM messages', async () => {
    const context = makeExecutionContext({ nodeId: 'extractor-1' });
    seedPriorTurn(context);
    await handler.execute(
      { text: 'x' },
      {
        mode: 'single_turn',
        model: 'gpt-4o-mini',
        inputField: 'text',
        outputSchema: [{ name: 'name', type: 'string', required: true }],
        contextScope: 'thread',
        contextInjectionMode: 'messages',
      },
      context,
    );
    const sentMessages = mockLlmService.chat.mock.calls[0][1].messages;
    expect(
      sentMessages.some(
        (m: { content: string }) => m.content === 'prior agent answer',
      ),
    ).toBe(true);
  });

  it('single-turn contextScope default (none) leaves messages unchanged (regression)', async () => {
    const context = makeExecutionContext({ nodeId: 'extractor-1' });
    seedPriorTurn(context);
    await handler.execute(
      { text: 'x' },
      {
        mode: 'single_turn',
        model: 'gpt-4o-mini',
        inputField: 'text',
        outputSchema: [{ name: 'name', type: 'string', required: true }],
      },
      context,
    );
    const sentMessages = mockLlmService.chat.mock.calls[0][1].messages;
    expect(sentMessages).toHaveLength(2);
    expect(
      sentMessages.some(
        (m: { content: string }) => m.content === 'prior agent answer',
      ),
    ).toBe(false);
  });

  it('multi-turn first entry contextScope=thread injects into initial messages', async () => {
    // finalize on first turn so the run completes deterministically.
    mockLlmService.chat.mockReset();
    mockLlmService.chat.mockResolvedValue({
      content: '',
      toolCalls: [
        {
          id: 'tc1',
          name: 'finalize_extraction',
          arguments: JSON.stringify({ name: 'Bob' }),
        },
      ],
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      model: 'gpt-4o-mini',
    });
    const context = makeExecutionContext({ nodeId: 'extractor-1' });
    seedPriorTurn(context);
    await handler.execute(
      { text: 'x' },
      {
        mode: 'multi_turn',
        model: 'gpt-4o-mini',
        inputField: 'Bob',
        outputSchema: [{ name: 'name', type: 'string', required: true }],
        contextScope: 'thread',
        contextInjectionMode: 'messages',
      },
      context,
    );
    const sentMessages = mockLlmService.chat.mock.calls[0][1].messages;
    expect(
      sentMessages.some(
        (m: { content: string }) => m.content === 'prior agent answer',
      ),
    ).toBe(true);
  });
});
