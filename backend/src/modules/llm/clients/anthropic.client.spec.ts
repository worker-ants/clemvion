import { AnthropicClient } from './anthropic.client';
import type { ChatStreamEvent } from '../interfaces/llm-client.interface';

function asyncIter<T>(items: T[]): AsyncIterable<T> {
  return {
    [Symbol.asyncIterator]() {
      let i = 0;
      return {
        next: async () =>
          i < items.length
            ? { value: items[i++], done: false }
            : { value: undefined, done: true },
      };
    },
  };
}

function makeClientWithStream(events: unknown[]): AnthropicClient {
  const client = new AnthropicClient('sk-test', 'claude-haiku-4-5-20251001');
  // @ts-expect-error — overwrite the internal SDK client
  client.client = {
    messages: {
      create: jest.fn().mockResolvedValue(asyncIter(events)),
    },
  };
  return client;
}

async function collect(
  stream: AsyncIterable<ChatStreamEvent>,
): Promise<ChatStreamEvent[]> {
  const out: ChatStreamEvent[] = [];
  for await (const ev of stream) out.push(ev);
  return out;
}

describe('AnthropicClient.stream', () => {
  it('emits text_delta for text blocks and a terminal done event', async () => {
    const client = makeClientWithStream([
      {
        type: 'message_start',
        message: {
          model: 'claude-haiku-4-5-20251001',
          usage: { input_tokens: 12 },
        },
      },
      {
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'text' },
      },
      {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: 'Hello ' },
      },
      {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: 'world' },
      },
      { type: 'content_block_stop', index: 0 },
      {
        type: 'message_delta',
        delta: { stop_reason: 'end_turn' },
        usage: { output_tokens: 4 },
      },
    ]);

    const events = await collect(
      client.stream({
        model: 'claude-haiku-4-5-20251001',
        messages: [{ role: 'user', content: 'hi' }],
      }),
    );

    expect(events).toEqual([
      { type: 'text_delta', delta: 'Hello ' },
      { type: 'text_delta', delta: 'world' },
      {
        type: 'done',
        usage: { inputTokens: 12, outputTokens: 4, totalTokens: 16 },
        model: 'claude-haiku-4-5-20251001',
        finishReason: 'stop',
      },
    ]);
  });

  it('accumulates tool_use input_json_delta and flushes on content_block_stop', async () => {
    const client = makeClientWithStream([
      {
        type: 'message_start',
        message: {
          model: 'claude-haiku-4-5-20251001',
          usage: { input_tokens: 20 },
        },
      },
      {
        type: 'content_block_start',
        index: 0,
        content_block: {
          type: 'tool_use',
          id: 'toolu_1',
          name: 'add_node',
          input: {},
        },
      },
      {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'input_json_delta', partial_json: '{"type":' },
      },
      {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'input_json_delta', partial_json: '"http_request"}' },
      },
      { type: 'content_block_stop', index: 0 },
      {
        type: 'message_delta',
        delta: { stop_reason: 'tool_use' },
        usage: { output_tokens: 10 },
      },
    ]);

    const events = await collect(
      client.stream({
        model: 'claude-haiku-4-5-20251001',
        messages: [{ role: 'user', content: 'add http' }],
      }),
    );

    expect(events.map((e) => e.type)).toEqual([
      'tool_call_delta',
      'tool_call_delta',
      'tool_call_end',
      'done',
    ]);
    const end = events.find((e) => e.type === 'tool_call_end');
    expect(end).toMatchObject({
      id: 'toolu_1',
      name: 'add_node',
      arguments: '{"type":"http_request"}',
    });
    expect(events.find((e) => e.type === 'done')).toMatchObject({
      finishReason: 'tool_calls',
    });
  });

  it('lists models via SDK pagination and maps all as chat type', async () => {
    const client = new AnthropicClient('sk-test', 'claude-haiku-4-5-20251001');
    const sdkPage = asyncIter([
      {
        id: 'claude-sonnet-4-5-20250929',
        display_name: 'Claude Sonnet 4.5',
        type: 'model',
      },
      {
        id: 'claude-opus-4-5-preview',
        display_name: 'Claude Opus 4.5 (preview)',
        type: 'model',
      },
    ]);
    // @ts-expect-error — stub SDK client
    client.client = {
      models: { list: jest.fn().mockReturnValue(sdkPage) },
    };

    const models = await client.listModels();
    expect(models).toEqual([
      {
        id: 'claude-sonnet-4-5-20250929',
        name: 'Claude Sonnet 4.5',
        type: 'chat',
      },
      {
        id: 'claude-opus-4-5-preview',
        name: 'Claude Opus 4.5 (preview)',
        type: 'chat',
      },
    ]);
  });

  it('passes AbortSignal to the SDK models.list call', async () => {
    const client = new AnthropicClient('sk-test', 'claude-haiku-4-5-20251001');
    const list = jest.fn().mockReturnValue(asyncIter([]));
    // @ts-expect-error — stub
    client.client = { models: { list } };
    const controller = new AbortController();
    await client.listModels(controller.signal);
    expect(list).toHaveBeenCalledWith(undefined, { signal: controller.signal });
  });

  it('caps the number of models returned at 100 to bound UI dropdown size', async () => {
    const many = Array.from({ length: 150 }, (_, i) => ({
      id: `claude-test-${i}`,
      display_name: `Claude Test ${i}`,
      type: 'model',
    }));
    const client = new AnthropicClient('sk-test', 'claude-haiku-4-5-20251001');
    // @ts-expect-error — stub
    client.client = {
      models: { list: jest.fn().mockReturnValue(asyncIter(many)) },
    };
    const models = await client.listModels();
    expect(models).toHaveLength(100);
  });

  it('propagates errors from the SDK models.list call', async () => {
    const client = new AnthropicClient('sk-test', 'claude-haiku-4-5-20251001');
    // @ts-expect-error — stub SDK client
    client.client = {
      models: {
        list: jest.fn().mockImplementation(() => {
          throw new Error('401 Unauthorized');
        }),
      },
    };
    await expect(client.listModels()).rejects.toThrow('401 Unauthorized');
  });

  it('falls back to id when display_name is missing', async () => {
    const client = new AnthropicClient('sk-test', 'claude-haiku-4-5-20251001');
    // @ts-expect-error — stub SDK client
    client.client = {
      models: {
        list: jest
          .fn()
          .mockReturnValue(
            asyncIter([{ id: 'claude-unknown', type: 'model' }]),
          ),
      },
    };
    const models = await client.listModels();
    expect(models[0]).toEqual({
      id: 'claude-unknown',
      name: 'claude-unknown',
      type: 'chat',
    });
  });

  it('yields an error event on unauthorized request failure', async () => {
    const client = new AnthropicClient('sk-test', 'claude-haiku-4-5-20251001');
    // @ts-expect-error — stub
    client.client = {
      messages: {
        create: jest.fn().mockRejectedValue(new Error('401 Unauthorized')),
      },
    };

    const events = await collect(
      client.stream({
        model: 'claude-haiku-4-5-20251001',
        messages: [{ role: 'user', content: 'x' }],
      }),
    );
    expect(events[0]).toMatchObject({
      type: 'error',
      code: 'LLM_CONNECTION_ERROR',
    });
  });
});
