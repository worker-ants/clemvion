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
