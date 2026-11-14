import Anthropic from '@anthropic-ai/sdk';
import { AnthropicClient } from './anthropic.client';
import type { ChatStreamEvent } from '../interfaces/llm-client.interface';
import { LLM_SDK_MAX_RETRIES } from './sdk-options';

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

  // SUMMARY#7 — embed 는 미지원이라 throw 보증
  it('embed 는 지원하지 않아 throw 한다', async () => {
    const client = new AnthropicClient('sk-test', 'claude-haiku-4-5-20251001');
    await expect(client.embed(['hello'])).rejects.toThrow(
      'Anthropic does not support embedding',
    );
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

  // [LLM 클라이언트](CLE-AI-LLM) 「스트리밍 에러 매핑」: 스트림을 열기 전의 실패도 예외 대신
  // `error` 이벤트 하나로 보내고 끝낸다. OpenAI 계열과 같은 계약이다(`openai.client.spec.ts`,
  // CLE-T-0R5SYN). 앱은 다시 열지 않는다.
  it.each([
    [
      '429',
      () =>
        new Anthropic.RateLimitError(
          429,
          {
            type: 'error',
            error: { type: 'rate_limit_error', message: 'Rate limited' },
          },
          undefined,
          new Headers(),
        ),
      'LLM_RATE_LIMIT',
    ],
    [
      'SDK 요청 타임아웃',
      () => new Anthropic.APIConnectionTimeoutError(),
      'LLM_CONNECTION_ERROR',
    ],
    ['그 밖의 실패', () => new Error('socket hang up'), 'LLM_CONNECTION_ERROR'],
  ] as const)(
    '스트림을 열기 전 %s 이면 예외 대신 error 이벤트 하나로 끝낸다',
    async (_label, makeError, code) => {
      const failure = makeError();
      const create = jest.fn().mockRejectedValue(failure);
      const client = new AnthropicClient(
        'sk-test',
        'claude-haiku-4-5-20251001',
      );
      // @ts-expect-error — stub
      client.client = { messages: { create } };

      const events = await collect(
        client.stream({
          model: 'claude-haiku-4-5-20251001',
          messages: [{ role: 'user', content: 'x' }],
        }),
      );

      expect(events).toEqual([
        { type: 'error', code, message: failure.message },
      ]);
      expect(create).toHaveBeenCalledTimes(1);
    },
  );

  // 열기 중 취소는 연결 실패가 아니다. 스트림 도중 취소처럼 `done(aborted)` 로 끝낸다(CLE-T-0R5SYN).
  it('스트림을 열기 전에 취소되면 error 대신 done(aborted) 하나로 끝낸다', async () => {
    const controller = new AbortController();
    const create = jest.fn().mockImplementation(() => {
      controller.abort();
      return Promise.reject(new Anthropic.APIUserAbortError());
    });
    const client = new AnthropicClient('sk-test', 'claude-haiku-4-5-20251001');
    // @ts-expect-error — stub
    client.client = { messages: { create } };

    const events = await collect(
      client.stream(
        {
          model: 'claude-haiku-4-5-20251001',
          messages: [{ role: 'user', content: 'x' }],
        },
        controller.signal,
      ),
    );

    expect(events).toEqual([
      {
        type: 'done',
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        model: 'claude-haiku-4-5-20251001',
        finishReason: 'aborted',
      },
    ]);
  });

  // 어시스턴트 시스템 프롬프트는 LLM 에게 독립 edit 을 단일 메시지에 batch 로
  // 내도록 지시한다. Anthropic SDK 기본은 허용이지만, 명시적으로
  // `disable_parallel_tool_use: false` 를 보내 향후 기본값 flip 이나 무심한
  // 상위 변경에도 가이던스가 무력화되지 않게 잠근다. 이 어설션이 깨지면
  // 어시스턴트 round-trip 이 조용히 직렬로 퇴행하므로 회귀 방어.
  describe('tool_choice / disable_parallel_tool_use', () => {
    function captureRequestParams(
      client: AnthropicClient,
      forStream: boolean,
    ): jest.Mock {
      const createMock = jest.fn().mockResolvedValue(
        forStream
          ? asyncIter([])
          : {
              content: [],
              stop_reason: 'end_turn',
              model: 'claude-haiku-4-5-20251001',
              usage: { input_tokens: 1, output_tokens: 1 },
            },
      );
      // @ts-expect-error — stub
      client.client = { messages: { create: createMock } };
      return createMock;
    }

    const toolDef = [
      {
        name: 'noop',
        description: 'noop',
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {},
        },
      },
    ];

    it.each([
      { toolChoice: 'auto' as const, expectedType: 'auto' },
      { toolChoice: undefined, expectedType: 'auto' },
      { toolChoice: 'required' as const, expectedType: 'any' },
    ])(
      'streaming: sends tool_choice={type:$expectedType, disable_parallel_tool_use:false} when toolChoice=$toolChoice',
      async ({ toolChoice, expectedType }) => {
        const client = new AnthropicClient(
          'sk-test',
          'claude-haiku-4-5-20251001',
        );
        const createMock = captureRequestParams(client, true);
        await collect(
          client.stream({
            model: 'claude-haiku-4-5-20251001',
            messages: [{ role: 'user', content: 'hi' }],
            tools: toolDef,
            ...(toolChoice !== undefined ? { toolChoice } : {}),
          }),
        );
        expect(createMock).toHaveBeenCalledTimes(1);
        const req = createMock.mock.calls[0][0] as {
          tool_choice: Record<string, unknown>;
        };
        expect(req.tool_choice).toEqual({
          type: expectedType,
          disable_parallel_tool_use: false,
        });
      },
    );

    it("streaming: sends tool_choice={type:'none'} without disable_parallel_tool_use when toolChoice='none'", async () => {
      // 'none' 은 도구 사용 자체를 막으므로 parallel 여부는 의미 없음 —
      // 플래그를 붙이면 오히려 SDK 에서 타입 불일치로 거부될 수 있다.
      const client = new AnthropicClient(
        'sk-test',
        'claude-haiku-4-5-20251001',
      );
      const createMock = captureRequestParams(client, true);
      await collect(
        client.stream({
          model: 'claude-haiku-4-5-20251001',
          messages: [{ role: 'user', content: 'hi' }],
          tools: toolDef,
          toolChoice: 'none',
        }),
      );
      const req = createMock.mock.calls[0][0] as {
        tool_choice: Record<string, unknown>;
      };
      expect(req.tool_choice).toEqual({ type: 'none' });
      expect(req.tool_choice.disable_parallel_tool_use).toBeUndefined();
    });

    it('streaming: omits tool_choice entirely when no tools are provided', async () => {
      // tools 미제공 시 tool_choice 를 붙여 보내면 SDK 가 400 을 낸다.
      const client = new AnthropicClient(
        'sk-test',
        'claude-haiku-4-5-20251001',
      );
      const createMock = captureRequestParams(client, true);
      await collect(
        client.stream({
          model: 'claude-haiku-4-5-20251001',
          messages: [{ role: 'user', content: 'hi' }],
        }),
      );
      const req = createMock.mock.calls[0][0] as {
        tool_choice?: unknown;
        tools?: unknown;
      };
      expect(req.tool_choice).toBeUndefined();
      expect(req.tools).toBeUndefined();
    });

    it('non-streaming chat(): mirrors the streaming tool_choice shape (auto + parallel enabled)', async () => {
      // chat 경로와 stream 경로가 같은 헬퍼로 tool_choice 를 만들도록 보장 —
      // 한쪽만 바뀌면 배포 채널에 따라 LLM 이 병렬을 잃는 silent regression
      // 이 가능하므로 양쪽을 함께 고정한다.
      const client = new AnthropicClient(
        'sk-test',
        'claude-haiku-4-5-20251001',
      );
      const createMock = captureRequestParams(client, false);
      await client.chat({
        model: 'claude-haiku-4-5-20251001',
        messages: [{ role: 'user', content: 'hi' }],
        tools: toolDef,
      });
      const req = createMock.mock.calls[0][0] as {
        tool_choice: Record<string, unknown>;
      };
      expect(req.tool_choice).toEqual({
        type: 'auto',
        disable_parallel_tool_use: false,
      });
    });
  });

  // SUMMARY#15 — chat() 에 signal 전달 경로 테스트
  describe('AnthropicClient.chat — signal propagation', () => {
    function makeNonStreamingClient(): {
      client: AnthropicClient;
      createMock: jest.Mock;
    } {
      const client = new AnthropicClient(
        'sk-test',
        'claude-haiku-4-5-20251001',
      );
      const createMock = jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'ok' }],
        stop_reason: 'end_turn',
        model: 'claude-haiku-4-5-20251001',
        usage: { input_tokens: 5, output_tokens: 3 },
      });
      // @ts-expect-error — stub
      client.client = { messages: { create: createMock } };
      return { client, createMock };
    }

    it('passes { signal } to SDK create when signal is provided', async () => {
      const { client, createMock } = makeNonStreamingClient();
      const controller = new AbortController();
      await client.chat(
        {
          model: 'claude-haiku-4-5-20251001',
          messages: [{ role: 'user', content: 'hi' }],
        },
        controller.signal,
      );
      expect(createMock).toHaveBeenCalledWith(expect.anything(), {
        signal: controller.signal,
      });
    });

    it('passes undefined options to SDK create when no signal is provided', async () => {
      const { client, createMock } = makeNonStreamingClient();
      await client.chat({
        model: 'claude-haiku-4-5-20251001',
        messages: [{ role: 'user', content: 'hi' }],
      });
      expect(createMock).toHaveBeenCalledWith(expect.anything(), undefined);
    });
  });
});

// API 버전 2026-10-21(`@anthropic-ai/sdk` 1.0 부터 기본값)은 Messages 요청에
// `temperature` · `top_p` · `top_k` 가 있으면 값이 기본값이어도 모든 모델에서 400 을
// 낸다. 그래서 호출자가 `ChatParams.temperature` · `topP` 를 넘겨도 Anthropic
// 요청 본문에는 넣지 않는다. 테스트는 SDK 를 stub 하므로 400 자체는 재현하지 못한다.
// 대신 SDK 에 넘긴 요청 객체에 세 필드가 없음을 단언한다.
describe('AnthropicClient — sampling parameters are not sent', () => {
  const MODEL = 'claude-haiku-4-5-20251001';

  function stubCreate(client: AnthropicClient, forStream: boolean): jest.Mock {
    const createMock = jest.fn().mockResolvedValue(
      forStream
        ? asyncIter([])
        : {
            content: [{ type: 'text', text: 'ok' }],
            stop_reason: 'end_turn',
            model: MODEL,
            usage: { input_tokens: 1, output_tokens: 1 },
          },
    );
    // @ts-expect-error — stub
    client.client = { messages: { create: createMock } };
    return createMock;
  }

  const samplingCases = [
    { label: 'temperature 0', params: { temperature: 0 } },
    { label: 'temperature 1 (API default)', params: { temperature: 1 } },
    { label: 'topP 0.9', params: { topP: 0.9 } },
    {
      label: 'temperature 0.7 and topP 1',
      params: { temperature: 0.7, topP: 1 },
    },
    { label: 'neither', params: {} },
  ];

  it.each([
    ...samplingCases.map((c) => ({ ...c, path: 'chat' as const })),
    ...samplingCases.map((c) => ({ ...c, path: 'stream' as const })),
  ])(
    '$path(): omits temperature/top_p/top_k when given $label',
    async ({ path, params }) => {
      const client = new AnthropicClient('sk-test', MODEL);
      const createMock = stubCreate(client, path === 'stream');
      const chatParams = {
        model: MODEL,
        messages: [{ role: 'user' as const, content: 'hi' }],
        maxTokens: 256,
        ...params,
      };

      if (path === 'chat') {
        await client.chat(chatParams);
      } else {
        await collect(client.stream(chatParams));
      }

      expect(createMock).toHaveBeenCalledTimes(1);
      const req = createMock.mock.calls[0][0] as Record<string, unknown>;
      expect(req).not.toHaveProperty('temperature');
      expect(req).not.toHaveProperty('top_p');
      expect(req).not.toHaveProperty('top_k');
      // 빼는 것은 샘플링 필드뿐이다. 나머지 요청은 그대로 간다.
      expect(req).toMatchObject({
        model: MODEL,
        max_tokens: 256,
        messages: [{ role: 'user', content: 'hi' }],
      });
      if (path === 'stream') {
        expect(req).toMatchObject({ stream: true });
      }
    },
  );
});

// SDK 재전송 횟수를 생성자에 적는다. 기본값과 같은 2 다(CLE-T-0R5SYN, `openai.client.spec.ts`).
// 적지 않아도 `maxRetries` 필드는 2 라서 SDK 가 받은 옵션 `_options` 를 본다.
describe('AnthropicClient — SDK 재전송 횟수', () => {
  it('SDK 클라이언트 생성자에 maxRetries 를 적는다', () => {
    const sdk = (
      new AnthropicClient(
        'sk-test',
        'claude-haiku-4-5-20251001',
      ) as unknown as {
        client: { _options: { maxRetries?: number } };
      }
    ).client;
    expect(sdk._options.maxRetries).toBe(LLM_SDK_MAX_RETRIES);
  });
});
