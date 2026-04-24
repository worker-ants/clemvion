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
            : { value: undefined, done: true },
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

  // gpt-oss 계열 오픈소스 서빙이 harmony 제어 토큰을 응답에 노출할 때 우리
  // 스트림 파이프라인이 어떻게 방어하는지 고정한다. 목적:
  //  1) 텍스트/도구 인자 조각에서 토큰이 **그대로 통과하지 않도록** stripping.
  //  2) SDK 파싱 단계에서 실패(throw) 하면 `LLM_OUTPUT_MALFORMED` 로 분류하고
  //     사용자 친화적 메세지를 싣는다 (원본 메세지는 로그로만).
  describe('harmony control token defenses', () => {
    it('strips `<|channel|>final<|message|>` style tokens from text_delta content', async () => {
      const client = makeClientWithStream([
        {
          model: 'gpt-oss-120b',
          choices: [
            {
              delta: { content: '<|channel|>final<|message|>Hello ' },
              finish_reason: null,
            },
          ],
        },
        {
          model: 'gpt-oss-120b',
          choices: [
            { delta: { content: 'world<|end|>' }, finish_reason: null },
          ],
        },
        {
          model: 'gpt-oss-120b',
          choices: [{ delta: {}, finish_reason: 'stop' }],
          usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 },
        },
      ]);
      const events = await collect(
        client.stream({
          model: 'gpt-oss-120b',
          messages: [{ role: 'user', content: 'hi' }],
        }),
      );
      const deltas = events
        .filter(
          (e): e is { type: 'text_delta'; delta: string } =>
            e.type === 'text_delta',
        )
        .map((e) => e.delta);
      expect(deltas.join('')).toBe('Hello world');
      // 어떤 delta 도 harmony 토큰 문자열을 포함하지 않아야 한다
      for (const d of deltas) {
        expect(d).not.toMatch(/<\|(channel|message|end|start|return)\|>/);
      }
    });

    it('strips harmony tokens out of tool_call argument fragments', async () => {
      const client = makeClientWithStream([
        {
          model: 'gpt-oss-120b',
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: 'call_1',
                    function: {
                      name: 'add_node',
                      arguments:
                        '<|channel|>commentary<|message|>{"type":"form",',
                    },
                  },
                ],
              },
              finish_reason: null,
            },
          ],
        },
        {
          model: 'gpt-oss-120b',
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    function: {
                      arguments: '"label":"F"}<|end|>',
                    },
                  },
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
          usage: { prompt_tokens: 5, completion_tokens: 10, total_tokens: 15 },
        },
      ]);
      const events = await collect(
        client.stream({
          model: 'gpt-oss-120b',
          messages: [{ role: 'user', content: 'hi' }],
        }),
      );
      const end = events.find(
        (
          e,
        ): e is {
          type: 'tool_call_end';
          id: string;
          name: string;
          arguments: string;
        } => e.type === 'tool_call_end',
      );
      expect(end).toBeDefined();
      expect(end!.arguments).toBe('{"type":"form","label":"F"}');
      expect(end!.arguments).not.toMatch(/<\|/);
    });

    it('classifies an SDK parse failure with harmony tokens as LLM_OUTPUT_MALFORMED with a user-facing message', async () => {
      const client = new OpenAIClient('sk-test', 'gpt-oss-120b');
      // @ts-expect-error — inject a stream that throws a harmony-tagged parse
      // error during iteration, mimicking the OpenAI SDK behavior on a
      // malformed local-server SSE response.
      client.client = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              [Symbol.asyncIterator]() {
                return {
                  next: () =>
                    Promise.reject(
                      new Error(
                        'Failed to parse input at pos 0: <|channel|>final<|message|>설문 폼에 **오류 처리 템플릿** 추가',
                      ),
                    ),
                };
              },
            }),
          },
        },
      };

      const events = await collect(
        client.stream({
          model: 'gpt-oss-120b',
          messages: [{ role: 'user', content: 'x' }],
        }),
      );
      const err = events.find(
        (e): e is { type: 'error'; code: string; message: string } =>
          e.type === 'error',
      );
      expect(err).toBeDefined();
      expect(err!.code).toBe('LLM_OUTPUT_MALFORMED');
      // 원본 raw 메세지가 그대로 노출되지 않고 친화적 안내문으로 치환되어야 한다
      expect(err!.message).not.toMatch(/<\|channel\|>/);
      expect(err!.message).toMatch(/harmony|gpt-oss|제어 토큰/);
    });
  });
});

describe('OpenAIClient.listModels', () => {
  it('passes AbortSignal to the SDK models.list call', async () => {
    const client = new OpenAIClient('sk-test', 'gpt-4o');
    const list = jest.fn().mockResolvedValue(asyncIter([]));
    // @ts-expect-error — stub
    client.client = { models: { list } };
    const controller = new AbortController();
    await client.listModels(controller.signal);
    expect(list).toHaveBeenCalledWith({ signal: controller.signal });
  });

  it('omits options when no signal is provided', async () => {
    const client = new OpenAIClient('sk-test', 'gpt-4o');
    const list = jest.fn().mockResolvedValue(asyncIter([]));
    // @ts-expect-error — stub
    client.client = { models: { list } };
    await client.listModels();
    expect(list).toHaveBeenCalledWith(undefined);
  });

  it('caps the number of models returned at 100 to bound UI dropdown size', async () => {
    const many = Array.from({ length: 150 }, (_, i) => ({
      id: `gpt-test-${String(i).padStart(3, '0')}`,
    }));
    const client = new OpenAIClient('sk-test', 'gpt-4o');
    // @ts-expect-error — stub
    client.client = {
      models: { list: jest.fn().mockResolvedValue(asyncIter(many)) },
    };
    const models = await client.listModels();
    expect(models).toHaveLength(100);
  });
});
