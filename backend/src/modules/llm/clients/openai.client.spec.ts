import { OpenAIClient } from './openai.client';
import type { ChatStreamEvent } from '../interfaces/llm-client.interface';

// Helper: build an async iterable from an array of SDK chunks so the
// production code can iterate it with `for await` exactly as it would the
// real OpenAI SDK response.
function asyncIter<T>(items: T[]): AsyncIterable<T> {
  return {
    [Symbol.asyncIterator]() {
      let i = 0;
      return {
        next: async () =>
          i < items.length
            ? { value: items[i++], done: false }
            : { value: undefined as unknown as T, done: true },
      };
    },
  };
}

function makeClientWithStream(chunks: unknown[]): OpenAIClient {
  const client = new OpenAIClient('sk-test', 'gpt-4o');
  // @ts-expect-error — overwrite the internal SDK client to return our fake
  // async iterable. Production code awaits `create()` then iterates the
  // result, which matches this shape.
  client.client = {
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue(asyncIter(chunks)),
      },
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

describe('OpenAIClient.stream', () => {
  it('emits text_delta for content chunks and a terminal done event', async () => {
    const client = makeClientWithStream([
      {
        model: 'gpt-4o',
        choices: [{ delta: { content: 'Hello' }, finish_reason: null }],
      },
      {
        model: 'gpt-4o',
        choices: [{ delta: { content: ' world' }, finish_reason: null }],
      },
      {
        model: 'gpt-4o',
        choices: [{ delta: {}, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      },
    ]);

    const events = await collect(
      client.stream({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'hi' }],
      }),
    );

    expect(events).toEqual([
      { type: 'text_delta', delta: 'Hello' },
      { type: 'text_delta', delta: ' world' },
      {
        type: 'done',
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        model: 'gpt-4o',
        finishReason: 'stop',
      },
    ]);
  });

  it('accumulates tool_call deltas across chunks and flushes tool_call_end', async () => {
    const client = makeClientWithStream([
      {
        model: 'gpt-4o',
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: 'call_1',
                  function: { name: 'add_node', arguments: '{"type":' },
                },
              ],
            },
            finish_reason: null,
          },
        ],
      },
      {
        model: 'gpt-4o',
        choices: [
          {
            delta: {
              tool_calls: [
                { index: 0, function: { arguments: '"http_request"}' } },
              ],
            },
            finish_reason: null,
          },
        ],
      },
      {
        model: 'gpt-4o',
        choices: [{ delta: {}, finish_reason: 'tool_calls' }],
        usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
      },
    ]);

    const events = await collect(
      client.stream({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'add http' }],
      }),
    );

    // Expect deltas interleaved, then the consolidated tool_call_end, then done.
    expect(events.map((e) => e.type)).toEqual([
      'tool_call_delta',
      'tool_call_delta',
      'tool_call_end',
      'done',
    ]);
    const end = events.find((e) => e.type === 'tool_call_end');
    expect(end).toMatchObject({
      type: 'tool_call_end',
      id: 'call_1',
      name: 'add_node',
      arguments: '{"type":"http_request"}',
    });
    const done = events.find((e) => e.type === 'done');
    expect(done).toMatchObject({ finishReason: 'tool_calls' });
  });

  it('emits an error event with LLM_RATE_LIMIT on 429 during iteration', async () => {
    const client = new OpenAIClient('sk-test', 'gpt-4o');
    // @ts-expect-error — stub
    client.client = {
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            [Symbol.asyncIterator]() {
              return {
                next: async () => {
                  throw new Error('429 rate limit exceeded');
                },
              };
            },
          }),
        },
      },
    };

    const events = await collect(
      client.stream({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'x' }],
      }),
    );
    const err = events.find((e) => e.type === 'error');
    expect(err).toMatchObject({
      type: 'error',
      code: 'LLM_RATE_LIMIT',
    });
  });

  it('yields done with finishReason="aborted" when AbortSignal triggers', async () => {
    const abort = new AbortController();
    const client = new OpenAIClient('sk-test', 'gpt-4o');
    // @ts-expect-error — stub
    client.client = {
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            [Symbol.asyncIterator]() {
              return {
                next: async () => {
                  abort.abort();
                  throw new Error('aborted');
                },
              };
            },
          }),
        },
      },
    };

    const events = await collect(
      client.stream(
        { model: 'gpt-4o', messages: [{ role: 'user', content: 'x' }] },
        abort.signal,
      ),
    );
    const done = events.find((e) => e.type === 'done');
    expect(done).toMatchObject({ type: 'done', finishReason: 'aborted' });
  });
});
