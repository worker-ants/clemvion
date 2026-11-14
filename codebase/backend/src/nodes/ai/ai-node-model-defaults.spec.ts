import { TextClassifierHandler } from './text-classifier/text-classifier.handler';
import { InformationExtractorHandler } from './information-extractor/information-extractor.handler';
import { ExecutionContext } from '../core/node-handler.interface';
import { createEmptyConversationThread } from '../../shared/conversation-thread/conversation-thread.types';

/**
 * CLE-T-GG3WPZ — 텍스트 분류 · 정보 추출 노드는 모델 설정 기본 파라미터를 켜고
 * `LlmService.chat` 을 부른다(`applyModelDefaults: true`). 값을 채우는 일은
 * `LlmService` 가 하고 노드는 옵션만 넘긴다. AI 에이전트 노드는
 * `ai-agent/ai-turn-executor.spec.ts` 가 같은 옵션을 고정한다.
 */
function createContext(): ExecutionContext {
  return {
    executionId: 'exec-1',
    workflowId: 'wf-1',
    variables: { __workspaceId: 'ws-1' },
    nodeOutputCache: {},
    structuredOutputCache: {},
    engineResolvedConfigCache: {},
    conversationThread: createEmptyConversationThread(),
    recursionDepth: 0,
  };
}

function mockLlmService(content: string): Record<string, jest.Mock> {
  return {
    resolveConfig: jest.fn().mockResolvedValue({
      id: 'config-1',
      defaultModel: 'gpt-4o-mini',
    }),
    chat: jest.fn().mockResolvedValue({
      content,
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      model: 'gpt-4o-mini',
      finishReason: 'stop',
    }),
  };
}

const OPTED_IN = expect.objectContaining({ applyModelDefaults: true });

describe('AI nodes opt in to model config default params (CLE-T-GG3WPZ)', () => {
  it('text classifier passes applyModelDefaults to LlmService.chat', async () => {
    const llm = mockLlmService('{"category": "Billing", "confidence": 0.9}');
    const handler = new TextClassifierHandler(llm as never);

    await handler.execute(
      {},
      {
        inputField: 'I need a refund',
        categories: [{ name: 'Billing' }, { name: 'Tech' }],
      },
      createContext(),
    );

    expect(llm.chat).toHaveBeenCalledTimes(1);
    expect(llm.chat).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      OPTED_IN,
    );
  });

  it('information extractor passes applyModelDefaults on the single-turn call', async () => {
    const llm = mockLlmService('{"senderName": "John"}');
    const handler = new InformationExtractorHandler(llm as never);

    await handler.execute(
      {},
      {
        inputField: 'Email from John',
        outputSchema: [
          {
            name: 'senderName',
            type: 'string',
            description: 'Sender name',
            required: true,
          },
        ],
      },
      createContext(),
    );

    expect(llm.chat).toHaveBeenCalled();
    for (const call of llm.chat.mock.calls) {
      expect(call[3]).toEqual(OPTED_IN);
    }
  });

  it('information extractor passes applyModelDefaults on the multi-turn call', async () => {
    const llm = mockLlmService('');
    llm.chat.mockResolvedValue({
      content: '',
      toolCalls: [
        {
          id: 'call-1',
          name: 'finalize_extraction',
          arguments: JSON.stringify({ senderName: 'John' }),
        },
      ],
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      model: 'gpt-4o-mini',
      finishReason: 'tool_calls',
    });
    const handler = new InformationExtractorHandler(llm as never);

    await handler.execute(
      {},
      {
        mode: 'multi_turn',
        inputField: 'John',
        outputSchema: [
          {
            name: 'senderName',
            type: 'string',
            description: 'Sender name',
            required: true,
          },
        ],
      },
      createContext(),
    );

    expect(llm.chat).toHaveBeenCalled();
    for (const call of llm.chat.mock.calls) {
      expect(call[3]).toEqual(OPTED_IN);
    }
  });
});
