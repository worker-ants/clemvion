import { Logger } from '@nestjs/common';
import OpenAI from 'openai';
import {
  HARMONY_OUTPUT_MALFORMED_MESSAGE,
  OpenAIClient,
} from './openai.client';
import { AzureOpenAIClient } from './azure-openai.client';
import { LocalClient } from './local.client';
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
  //     고정 영문 `message` 를 싣는다. SDK 원본 메세지는 클라이언트가 warn
  //     로그로만 남긴다.
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

    describe('when the SDK throws mid-stream', () => {
      let warn: jest.SpyInstance;
      beforeEach(() => {
        warn = jest
          .spyOn(Logger.prototype, 'warn')
          .mockImplementation(() => undefined);
      });
      afterEach(() => warn.mockRestore());

      /**
       * 반복 도중 `error` 를 던지는 SDK 스트림을 넣은 클라이언트를 만든다.
       * SDK 클라이언트 타입 전체를 흉내 내지 않고 `chat.completions.create` 만
       * 바꾸므로 private 필드 대입을 `unknown` 으로 넓혀서 한다.
       */
      const clientThrowingMidStream = (model: string, error: Error) => {
        const client = new OpenAIClient('sk-test', model);
        (client as unknown as { client: unknown }).client = {
          chat: {
            completions: {
              create: jest.fn().mockResolvedValue({
                [Symbol.asyncIterator]() {
                  return { next: () => Promise.reject(error) };
                },
              }),
            },
          },
        };
        return client;
      };

      it('classifies an SDK parse failure with harmony tokens as LLM_OUTPUT_MALFORMED with a fixed English message', async () => {
        const rawSdkMessage =
          'Failed to parse input at pos 0: <|channel|>final<|message|>설문 폼에 **오류 처리 템플릿** 추가';
        // OpenAI SDK 가 로컬 서버의 깨진 SSE 응답을 파싱하다 harmony 토큰이 섞인
        // 오류를 던지는 경우를 흉내 낸다.
        const client = clientThrowingMidStream(
          'gpt-oss-120b',
          new Error(rawSdkMessage),
        );

        const events = await collect(
          client.stream({
            model: 'gpt-oss-120b',
            messages: [{ role: 'user', content: 'x' }],
          }),
        );
        const err = events.find(
          (e): e is Extract<ChatStreamEvent, { type: 'error' }> =>
            e.type === 'error',
        );
        expect(err).toBeDefined();
        expect(err!.code).toBe('LLM_OUTPUT_MALFORMED');
        // `message` 는 코드별 고정 영문이다. SDK 원문(제어 토큰 · 모델 출력)도
        // 한국어 문장도 싣지 않는다 (CLE-UI-I18N 규칙 3).
        expect(err!.message).toBe(HARMONY_OUTPUT_MALFORMED_MESSAGE);
        expect(HARMONY_OUTPUT_MALFORMED_MESSAGE).not.toMatch(/[가-힣]/);
        expect(HARMONY_OUTPUT_MALFORMED_MESSAGE).not.toMatch(/<\|/);
        // SDK 원문은 서버 로그에만 남는다.
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0][0]).toContain(rawSdkMessage);
      });

      it('keeps the SDK message on LLM_CONNECTION_ERROR without a harmony warn log', async () => {
        const client = clientThrowingMidStream(
          'gpt-4o',
          new Error('socket hang up'),
        );

        const events = await collect(
          client.stream({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: 'x' }],
          }),
        );
        const err = events.find(
          (e): e is Extract<ChatStreamEvent, { type: 'error' }> =>
            e.type === 'error',
        );
        expect(err).toMatchObject({
          code: 'LLM_CONNECTION_ERROR',
          message: 'socket hang up',
        });
        expect(warn).not.toHaveBeenCalled();
      });
    });
  });
});

// 특성화 테스트다. 지금 동작을 그대로 고정한다.
// [LLM 클라이언트](CLE-AI-LLM) 「스트리밍 에러 매핑」: OpenAI 계열(OpenAI · Azure · Local)의
// `stream()` 은 스트림을 열 때의 실패(429, SDK 요청 타임아웃, 그 밖의 실패)를 `error` 이벤트
// 없이 예외로 던진다. Anthropic · Google 은 같은 실패를 `error` 이벤트로 보낸다(각 spec).
// 두 갈래를 하나로 맞추기로 하면 NERV Task `CLE-T-0R5SYN` 이 이 테스트도 함께 고친다.
// Azure · Local 은 `stream()` 을 OpenAIClient 에서 물려받으므로 세 클래스를 함께 돌린다.
describe.each([
  ['OpenAIClient', () => new OpenAIClient('sk-test', 'gpt-4o')],
  [
    'AzureOpenAIClient',
    () =>
      new AzureOpenAIClient(
        'azure-key',
        'gpt-4o',
        'https://example.openai.azure.com/',
      ),
  ],
  ['LocalClient', () => new LocalClient('llama3', 'http://localhost:1234/v1')],
] as const)('%s.stream — 스트림을 열 때 실패하면', (_name, makeClient) => {
  it.each([
    [
      '429',
      () =>
        new OpenAI.RateLimitError(
          429,
          { message: 'Rate limit reached' },
          undefined,
          new Headers(),
        ),
    ],
    ['SDK 요청 타임아웃', () => new OpenAI.APIConnectionTimeoutError()],
    ['그 밖의 실패', () => new Error('socket hang up')],
  ] as const)(
    '%s: error 이벤트 없이 같은 예외를 던진다',
    async (_label, makeError) => {
      const failure = makeError();
      const create = jest.fn().mockRejectedValue(failure);
      const client = makeClient();
      // @ts-expect-error — 내부 SDK client 를 stub 으로 바꾼다.
      client.client = { chat: { completions: { create } } };

      const seen: ChatStreamEvent[] = [];
      const drain = async (): Promise<void> => {
        for await (const ev of client.stream({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: 'x' }],
        })) {
          seen.push(ev);
        }
      };

      await expect(drain()).rejects.toBe(failure);
      expect(seen).toEqual([]);
      expect(create).toHaveBeenCalledTimes(1);
    },
  );
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

  // SUMMARY#15 — chat() 에 signal 전달 경로 테스트
  describe('OpenAIClient.chat — signal propagation', () => {
    function makeNonStreamingClient(): {
      client: OpenAIClient;
      createMock: jest.Mock;
    } {
      const client = new OpenAIClient('sk-test', 'gpt-4o');
      const createMock = jest.fn().mockResolvedValue({
        choices: [
          {
            message: { content: 'ok', role: 'assistant' },
            finish_reason: 'stop',
          },
        ],
        model: 'gpt-4o',
        usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
      });
      // @ts-expect-error — stub
      client.client = { chat: { completions: { create: createMock } } };
      return { client, createMock };
    }

    it('passes { signal } to SDK create when signal is provided', async () => {
      const { client, createMock } = makeNonStreamingClient();
      const controller = new AbortController();
      await client.chat(
        { model: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }] },
        controller.signal,
      );
      expect(createMock).toHaveBeenCalledWith(expect.anything(), {
        signal: controller.signal,
      });
    });

    it('passes undefined options to SDK create when no signal is provided', async () => {
      const { client, createMock } = makeNonStreamingClient();
      await client.chat({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'hi' }],
      });
      expect(createMock).toHaveBeenCalledWith(expect.anything(), undefined);
    });
  });
});

describe('OpenAIClient.embed (input_type prefix)', () => {
  function makeEmbedClient(): {
    client: OpenAIClient;
    createMock: jest.Mock;
  } {
    const createMock = jest
      .fn()
      .mockResolvedValue({ data: [{ embedding: [0.1, 0.2] }] });
    const client = new OpenAIClient('sk-test', 'text-embedding-3-small');
    // @ts-expect-error — overwrite the internal SDK client with an embeddings stub.
    client.client = { embeddings: { create: createMock } };
    return { client, createMock };
  }

  it('OpenAI native 모델은 prefix 없이 원문 그대로 전달(대칭)', async () => {
    const { client, createMock } = makeEmbedClient();
    await client.embed(['hello'], 'text-embedding-3-small', 'query');
    expect(createMock).toHaveBeenCalledWith({
      model: 'text-embedding-3-small',
      input: ['hello'],
    });
  });

  it('e5 계열 + query → "query: " prefix 적용', async () => {
    const { client, createMock } = makeEmbedClient();
    await client.embed(['고객 환불'], 'multilingual-e5-large', 'query');
    expect(createMock).toHaveBeenCalledWith({
      model: 'multilingual-e5-large',
      input: ['query: 고객 환불'],
    });
  });

  it('e5 계열 + document → "passage: " prefix 적용', async () => {
    const { client, createMock } = makeEmbedClient();
    await client.embed(
      ['환불은 7일 이내'],
      'multilingual-e5-large',
      'document',
    );
    expect(createMock).toHaveBeenCalledWith({
      model: 'multilingual-e5-large',
      input: ['passage: 환불은 7일 이내'],
    });
  });

  it('inputType 생략 시 document 기본값(passage)', async () => {
    const { client, createMock } = makeEmbedClient();
    await client.embed(['doc'], 'e5-base');
    expect(createMock).toHaveBeenCalledWith({
      model: 'e5-base',
      input: ['passage: doc'],
    });
  });
});
