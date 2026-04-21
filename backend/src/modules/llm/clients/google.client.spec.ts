import { GoogleClient } from './google.client';
import type { ChatStreamEvent } from '../interfaces/llm-client.interface';

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

interface FakeChunk {
  candidates?: Array<{
    content?: { parts: Array<Record<string, unknown>> };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
    thoughtsTokenCount?: number;
  };
}

function makeClientWithStreamResult(
  chunks: FakeChunk[],
  aggregated?: FakeChunk,
): { client: GoogleClient; sendMessageStream: jest.Mock } {
  const client = new GoogleClient('test-key', 'gemini-2.5-flash');
  const sendMessageStream = jest.fn().mockResolvedValue({
    stream: asyncIter(chunks),
    response: Promise.resolve(aggregated ?? chunks[chunks.length - 1] ?? {}),
  });
  // @ts-expect-error — overwrite the internal SDK client
  client.genAI = {
    getGenerativeModel: jest.fn().mockReturnValue({
      startChat: jest.fn().mockReturnValue({ sendMessageStream }),
    }),
  };
  return { client, sendMessageStream };
}

async function collect(
  stream: AsyncIterable<ChatStreamEvent>,
): Promise<ChatStreamEvent[]> {
  const out: ChatStreamEvent[] = [];
  for await (const ev of stream) out.push(ev);
  return out;
}

describe('GoogleClient.stream', () => {
  it('emits text_delta for text parts and a terminal done with usage', async () => {
    const { client } = makeClientWithStreamResult([
      { candidates: [{ content: { parts: [{ text: 'Hello ' }] } }] },
      { candidates: [{ content: { parts: [{ text: 'world' }] } }] },
      {
        candidates: [{ content: { parts: [] }, finishReason: 'STOP' }],
        usageMetadata: {
          promptTokenCount: 12,
          candidatesTokenCount: 4,
          totalTokenCount: 16,
        },
      },
    ]);

    const events = await collect(
      client.stream({
        model: 'gemini-2.5-flash',
        messages: [{ role: 'user', content: 'hi' }],
      }),
    );

    expect(events).toEqual([
      { type: 'text_delta', delta: 'Hello ' },
      { type: 'text_delta', delta: 'world' },
      {
        type: 'done',
        usage: { inputTokens: 12, outputTokens: 4, totalTokens: 16 },
        model: 'gemini-2.5-flash',
        finishReason: 'stop',
      },
    ]);
  });

  it('emits tool_call_delta+tool_call_end for functionCall parts and reports tool_calls finishReason', async () => {
    const { client } = makeClientWithStreamResult([
      {
        candidates: [
          {
            content: {
              parts: [
                {
                  functionCall: {
                    name: 'add_node',
                    args: { type: 'http_request', label: 'Get Order' },
                  },
                },
              ],
            },
            finishReason: 'STOP',
          },
        ],
        usageMetadata: {
          promptTokenCount: 20,
          candidatesTokenCount: 10,
          totalTokenCount: 30,
        },
      },
    ]);

    const events = await collect(
      client.stream({
        model: 'gemini-2.5-flash',
        messages: [{ role: 'user', content: 'add http' }],
      }),
    );

    expect(events.map((e) => e.type)).toEqual([
      'tool_call_delta',
      'tool_call_end',
      'done',
    ]);
    const expectedArgs = '{"type":"http_request","label":"Get Order"}';
    const delta = events.find((e) => e.type === 'tool_call_delta');
    const end = events.find((e) => e.type === 'tool_call_end');
    // type narrow는 expect에 넣어 mismatch 시 silent pass 되지 않도록 한다.
    expect(delta?.type).toBe('tool_call_delta');
    expect(end?.type).toBe('tool_call_end');
    if (delta?.type !== 'tool_call_delta' || end?.type !== 'tool_call_end') {
      throw new Error('expected tool_call_delta and tool_call_end events');
    }
    expect(delta).toMatchObject({
      name: 'add_node',
      argumentsDelta: expectedArgs,
    });
    expect(end).toMatchObject({
      name: 'add_node',
      arguments: expectedArgs,
    });
    expect(delta.id).toBe(end.id);
    expect(events.find((e) => e.type === 'done')).toMatchObject({
      finishReason: 'tool_calls',
    });
  });

  it('emits delta+end pairs in order for multiple functionCall parts in one chunk', async () => {
    const { client } = makeClientWithStreamResult([
      {
        candidates: [
          {
            content: {
              parts: [
                {
                  functionCall: { name: 'add_node', args: { type: 'http' } },
                },
                {
                  functionCall: {
                    name: 'add_edge',
                    args: { from: 'a', to: 'b' },
                  },
                },
              ],
            },
            finishReason: 'STOP',
          },
        ],
        usageMetadata: {
          promptTokenCount: 5,
          candidatesTokenCount: 3,
          totalTokenCount: 8,
        },
      },
    ]);

    const events = await collect(
      client.stream({
        model: 'gemini-2.5-flash',
        messages: [{ role: 'user', content: 'parallel' }],
      }),
    );

    // delta+end 페어가 두 개씩 순서대로, 마지막에 done 한 번
    expect(events.map((e) => e.type)).toEqual([
      'tool_call_delta',
      'tool_call_end',
      'tool_call_delta',
      'tool_call_end',
      'done',
    ]);
    const ends = events.filter((e) => e.type === 'tool_call_end');
    expect(ends).toHaveLength(2);
    if (ends[0].type !== 'tool_call_end' || ends[1].type !== 'tool_call_end') {
      throw new Error('expected tool_call_end events');
    }
    expect(ends[0].name).toBe('add_node');
    expect(ends[1].name).toBe('add_edge');
    // 두 tool_call의 id는 서로 다른 UUID여야 한다.
    expect(ends[0].id).not.toBe(ends[1].id);
    expect(events.find((e) => e.type === 'done')).toMatchObject({
      finishReason: 'tool_calls',
    });
  });

  it('maps Gemini MAX_TOKENS finishReason to "length"', async () => {
    const { client } = makeClientWithStreamResult([
      {
        candidates: [
          {
            content: { parts: [{ text: 'partial' }] },
            finishReason: 'MAX_TOKENS',
          },
        ],
        usageMetadata: {
          promptTokenCount: 5,
          candidatesTokenCount: 3,
          totalTokenCount: 8,
        },
      },
    ]);

    const events = await collect(
      client.stream({
        model: 'gemini-2.5-flash',
        messages: [{ role: 'user', content: 'long' }],
      }),
    );

    expect(events.find((e) => e.type === 'done')).toMatchObject({
      finishReason: 'length',
    });
  });

  it('maps Gemini SAFETY finishReason to "content_filter"', async () => {
    const { client } = makeClientWithStreamResult([
      {
        candidates: [{ content: { parts: [] }, finishReason: 'SAFETY' }],
        usageMetadata: {
          promptTokenCount: 5,
          candidatesTokenCount: 0,
          totalTokenCount: 5,
        },
      },
    ]);

    const events = await collect(
      client.stream({
        model: 'gemini-2.5-flash',
        messages: [{ role: 'user', content: 'unsafe' }],
      }),
    );

    expect(events.find((e) => e.type === 'done')).toMatchObject({
      finishReason: 'content_filter',
    });
  });

  it('falls back to aggregated response.usageMetadata when chunks omit usage', async () => {
    const { client } = makeClientWithStreamResult(
      [{ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }],
      {
        usageMetadata: {
          promptTokenCount: 7,
          candidatesTokenCount: 1,
          totalTokenCount: 8,
        },
      },
    );

    const events = await collect(
      client.stream({
        model: 'gemini-2.5-flash',
        messages: [{ role: 'user', content: 'q' }],
      }),
    );

    expect(events.find((e) => e.type === 'done')).toMatchObject({
      usage: { inputTokens: 7, outputTokens: 1, totalTokens: 8 },
    });
  });

  it('reports thoughtsTokenCount as thinkingTokens in the done event', async () => {
    const { client } = makeClientWithStreamResult([
      {
        candidates: [
          { content: { parts: [{ text: 'ans' }] }, finishReason: 'STOP' },
        ],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 2,
          totalTokenCount: 12,
          thoughtsTokenCount: 5,
        },
      },
    ]);

    const events = await collect(
      client.stream({
        model: 'gemini-2.5-flash',
        messages: [{ role: 'user', content: 'reason' }],
      }),
    );

    expect(events.find((e) => e.type === 'done')).toMatchObject({
      usage: {
        inputTokens: 10,
        outputTokens: 2,
        totalTokens: 12,
        thinkingTokens: 5,
      },
    });
  });

  it('yields done with finishReason="aborted" when AbortSignal triggers mid-stream', async () => {
    const abort = new AbortController();
    const client = new GoogleClient('test-key', 'gemini-2.5-flash');
    // 실제 SDK는 abort 시 DOMException(name='AbortError')를 throw하므로
    // 동일 형태로 시뮬레이션해 구현이 `signal.aborted` 플래그(메시지 텍스트가
    // 아닌)로 분기하는지 정확히 검증한다.
    const abortError = new DOMException(
      'The operation was aborted.',
      'AbortError',
    );
    const sendMessageStream = jest.fn().mockResolvedValue({
      stream: {
        [Symbol.asyncIterator]() {
          return {
            next: async () => {
              abort.abort();
              throw abortError;
            },
          };
        },
      },
      response: Promise.resolve({}),
    });
    // @ts-expect-error — stub
    client.genAI = {
      getGenerativeModel: jest.fn().mockReturnValue({
        startChat: jest.fn().mockReturnValue({ sendMessageStream }),
      }),
    };

    const events = await collect(
      client.stream(
        {
          model: 'gemini-2.5-flash',
          messages: [{ role: 'user', content: 'x' }],
        },
        abort.signal,
      ),
    );
    // abort 시 error 이벤트는 emit 되지 않고 done(aborted)만 emit 되어야 한다.
    expect(events.find((e) => e.type === 'error')).toBeUndefined();
    const done = events.find((e) => e.type === 'done');
    expect(done).toMatchObject({ type: 'done', finishReason: 'aborted' });
  });

  it('yields an error event when sendMessageStream rejects', async () => {
    const client = new GoogleClient('test-key', 'gemini-2.5-flash');
    const sendMessageStream = jest
      .fn()
      .mockRejectedValue(new Error('401 Unauthorized'));
    // @ts-expect-error — stub
    client.genAI = {
      getGenerativeModel: jest.fn().mockReturnValue({
        startChat: jest.fn().mockReturnValue({ sendMessageStream }),
      }),
    };

    const events = await collect(
      client.stream({
        model: 'gemini-2.5-flash',
        messages: [{ role: 'user', content: 'x' }],
      }),
    );
    expect(events[0]).toMatchObject({
      type: 'error',
      code: 'LLM_CONNECTION_ERROR',
    });
  });

  it('classifies 429 errors as LLM_RATE_LIMIT', async () => {
    const client = new GoogleClient('test-key', 'gemini-2.5-flash');
    const sendMessageStream = jest
      .fn()
      .mockRejectedValue(new Error('429 Too Many Requests'));
    // @ts-expect-error — stub
    client.genAI = {
      getGenerativeModel: jest.fn().mockReturnValue({
        startChat: jest.fn().mockReturnValue({ sendMessageStream }),
      }),
    };

    const events = await collect(
      client.stream({
        model: 'gemini-2.5-flash',
        messages: [{ role: 'user', content: 'x' }],
      }),
    );
    expect(events[0]).toMatchObject({
      type: 'error',
      code: 'LLM_RATE_LIMIT',
    });
  });

  it('forwards AbortSignal to sendMessageStream requestOptions', async () => {
    const abort = new AbortController();
    const { client, sendMessageStream } = makeClientWithStreamResult([
      {
        candidates: [
          { content: { parts: [{ text: 'ok' }] }, finishReason: 'STOP' },
        ],
        usageMetadata: {
          promptTokenCount: 1,
          candidatesTokenCount: 1,
          totalTokenCount: 2,
        },
      },
    ]);

    await collect(
      client.stream(
        {
          model: 'gemini-2.5-flash',
          messages: [{ role: 'user', content: 'x' }],
        },
        abort.signal,
      ),
    );

    expect(sendMessageStream).toHaveBeenCalledWith(
      [{ text: 'x' }],
      expect.objectContaining({ signal: abort.signal }),
    );
  });

  describe('history serialization (tool call / tool result round-trip)', () => {
    function stubClient(): {
      client: GoogleClient;
      startChat: jest.Mock;
      sendMessageStream: jest.Mock;
    } {
      const client = new GoogleClient('test-key', 'gemini-2.5-flash');
      const sendMessageStream = jest.fn().mockResolvedValue({
        stream: asyncIter([
          {
            candidates: [
              { content: { parts: [{ text: 'ok' }] }, finishReason: 'STOP' },
            ],
            usageMetadata: {
              promptTokenCount: 1,
              candidatesTokenCount: 1,
              totalTokenCount: 2,
            },
          },
        ]),
        response: Promise.resolve({}),
      });
      const startChat = jest.fn().mockReturnValue({ sendMessageStream });
      // @ts-expect-error — stub
      client.genAI = {
        getGenerativeModel: jest.fn().mockReturnValue({ startChat }),
      };
      return { client, startChat, sendMessageStream };
    }

    it('converts assistant.toolCalls to functionCall parts in history', async () => {
      const { client, startChat, sendMessageStream } = stubClient();
      await collect(
        client.stream({
          model: 'gemini-2.5-flash',
          messages: [
            { role: 'user', content: 'add http' },
            {
              role: 'assistant',
              content: '',
              toolCalls: [
                {
                  id: 'call_1',
                  name: 'add_node',
                  arguments: '{"type":"http_request","label":"Get"}',
                },
              ],
            },
            {
              role: 'tool',
              content: '{"ok":true,"id":"n1"}',
              toolCallId: 'call_1',
            },
          ],
        }),
      );

      const startChatArgs = startChat.mock.calls[0][0];
      expect(startChatArgs.history).toEqual([
        { role: 'user', parts: [{ text: 'add http' }] },
        {
          role: 'model',
          parts: [
            {
              functionCall: {
                name: 'add_node',
                args: { type: 'http_request', label: 'Get' },
              },
            },
          ],
        },
      ]);
      // 마지막 tool 결과는 sendMessageStream의 Part[] 인자로 전달되고
      // SDK가 내부에서 role='function' Content로 래핑한다.
      expect(sendMessageStream).toHaveBeenCalledWith(
        [
          {
            functionResponse: {
              name: 'add_node',
              response: { ok: true, id: 'n1' },
            },
          },
        ],
        undefined,
      );
    });

    it('wraps non-object tool results under `result` for Gemini functionResponse contract', async () => {
      const { client, sendMessageStream } = stubClient();
      await collect(
        client.stream({
          model: 'gemini-2.5-flash',
          messages: [
            { role: 'user', content: 'hi' },
            {
              role: 'assistant',
              content: '',
              toolCalls: [{ id: 'c1', name: 'echo', arguments: '{}' }],
            },
            { role: 'tool', content: 'just a string', toolCallId: 'c1' },
          ],
        }),
      );
      const call = sendMessageStream.mock.calls[0][0];
      expect(call).toEqual([
        {
          functionResponse: {
            name: 'echo',
            response: { result: 'just a string' },
          },
        },
      ]);
    });

    it('never merges functionResponse parts with plain-text user parts into the same turn', async () => {
      // Regression: Gemini rejects messages that mix functionResponse with
      // other part types. 이전엔 재수화된 tool 결과(user) + 새 user 메시지를
      // 같은 turn으로 합쳐 "FunctionResponse cannot be mixed with other type
      // of part" 400 이 발생했다.
      const { client, startChat, sendMessageStream } = stubClient();
      await collect(
        client.stream({
          model: 'gemini-2.5-flash',
          messages: [
            {
              role: 'assistant',
              content: '',
              toolCalls: [{ id: 'c1', name: 'tool_a', arguments: '{}' }],
            },
            { role: 'tool', content: '{"ok":true}', toolCallId: 'c1' },
            // terminal model turn(저장된 assistant 텍스트 응답)
            { role: 'assistant', content: 'Done' },
            // 새 유저 메시지 — tool 결과와 같은 turn으로 merge되면 안 된다
            { role: 'user', content: '다음 단계 알려줘' },
          ],
        }),
      );

      const history = startChat.mock.calls[0][0].history;
      // model(functionCall) → function(functionResponse) → model(text 'Done')
      // SDK/Gemini 3.x는 functionResponse turn에 role='function'을 요구한다.
      expect(history).toEqual([
        {
          role: 'model',
          parts: [{ functionCall: { name: 'tool_a', args: {} } }],
        },
        {
          role: 'function',
          parts: [
            { functionResponse: { name: 'tool_a', response: { ok: true } } },
          ],
        },
        { role: 'model', parts: [{ text: 'Done' }] },
      ]);
      // 새 user 메시지는 lastParts로 전달되며 functionResponse와 섞이지 않음
      expect(sendMessageStream.mock.calls[0][0]).toEqual([
        { text: '다음 단계 알려줘' },
      ]);
    });

    it('emits a placeholder text part for an empty assistant turn to preserve alternation', async () => {
      // 저장된 assistant content가 비어 있어도 terminal model turn을 유지해야
      // 새 user 메시지가 앞 user(functionResponse) turn과 직접 인접하지 않는다.
      const { client, startChat } = stubClient();
      await collect(
        client.stream({
          model: 'gemini-2.5-flash',
          messages: [
            {
              role: 'assistant',
              content: '',
              toolCalls: [{ id: 'c1', name: 't', arguments: '{}' }],
            },
            { role: 'tool', content: '{"ok":true}', toolCallId: 'c1' },
            // 비어있는 terminal model turn (rehydrated)
            { role: 'assistant', content: '' },
            { role: 'user', content: 'next' },
          ],
        }),
      );
      const history = startChat.mock.calls[0][0].history;
      // 세 번째 turn은 빈 텍스트 part라도 model turn으로 포함되어야 한다
      expect(history).toHaveLength(3);
      expect(history[2]).toEqual({ role: 'model', parts: [{ text: '' }] });
    });

    it('captures thoughtSignature from functionCall parts and echoes it back in history', async () => {
      // Gemini 2.5+/3.x는 functionCall part에 thoughtSignature를 부여하고,
      // 다음 턴 history의 동일 functionCall part에 이를 echo할 것을 요구한다.
      // 없으면 `Function call is missing a thought_signature` 400.
      const client = new GoogleClient(
        'test-key',
        'gemini-3.1-flash-lite-preview',
      );
      const sendMessageStream = jest.fn().mockResolvedValue({
        stream: asyncIter([
          {
            candidates: [
              {
                content: {
                  parts: [
                    {
                      functionCall: { name: 'list_integrations', args: {} },
                      thoughtSignature: 'SIG-abc123',
                    },
                  ],
                },
                finishReason: 'STOP',
              },
            ],
            usageMetadata: {
              promptTokenCount: 1,
              candidatesTokenCount: 1,
              totalTokenCount: 2,
            },
          },
        ]),
        response: Promise.resolve({}),
      });
      // @ts-expect-error — stub
      client.genAI = {
        getGenerativeModel: jest.fn().mockReturnValue({
          startChat: jest.fn().mockReturnValue({ sendMessageStream }),
        }),
      };

      const events = await collect(
        client.stream({
          model: 'gemini-3.1-flash-lite-preview',
          messages: [{ role: 'user', content: 'list them' }],
        }),
      );
      const end = events.find((e) => e.type === 'tool_call_end');
      expect(end).toBeDefined();
      if (end?.type !== 'tool_call_end')
        throw new Error('expected tool_call_end');
      expect(end.signature).toBe('SIG-abc123');
    });

    it('injects thoughtSignature back into rehydrated functionCall parts', async () => {
      const { client, startChat } = stubClient();
      await collect(
        client.stream({
          model: 'gemini-3.1-flash-lite-preview',
          messages: [
            { role: 'user', content: 'earlier' },
            {
              role: 'assistant',
              content: '',
              toolCalls: [
                {
                  id: 'c1',
                  name: 'list_integrations',
                  arguments: '{}',
                  signature: 'SIG-abc123',
                },
              ],
            },
            { role: 'tool', content: '[]', toolCallId: 'c1' },
            { role: 'assistant', content: 'done' },
            { role: 'user', content: 'next' },
          ],
        }),
      );
      const history = startChat.mock.calls[0][0].history;
      const modelTurn = history.find(
        (t: { role: string }) => t.role === 'model',
      );
      expect(modelTurn).toBeDefined();
      // thoughtSignature가 functionCall part에 포함되어야 한다
      expect(modelTurn.parts[0]).toMatchObject({
        functionCall: { name: 'list_integrations' },
        thoughtSignature: 'SIG-abc123',
      });
    });

    it('omits thoughtSignature when the tool call has no signature', async () => {
      const { client, startChat } = stubClient();
      await collect(
        client.stream({
          model: 'gemini-2.0-flash',
          messages: [
            {
              role: 'assistant',
              content: '',
              toolCalls: [{ id: 'c', name: 'tool', arguments: '{}' }],
            },
            { role: 'tool', content: '{}', toolCallId: 'c' },
            { role: 'assistant', content: 'ok' },
            { role: 'user', content: 'next' },
          ],
        }),
      );
      const modelTurn = startChat.mock.calls[0][0].history.find(
        (t: { role: string }) => t.role === 'model',
      );
      expect(modelTurn.parts[0]).toEqual({
        functionCall: { name: 'tool', args: {} },
      });
      expect(modelTurn.parts[0]).not.toHaveProperty('thoughtSignature');
    });

    it('merges consecutive same-role messages into a single Gemini turn', async () => {
      const { client, startChat, sendMessageStream } = stubClient();
      await collect(
        client.stream({
          model: 'gemini-2.5-flash',
          messages: [
            {
              role: 'assistant',
              content: '',
              toolCalls: [
                { id: 'a', name: 'toolA', arguments: '{"x":1}' },
                { id: 'b', name: 'toolB', arguments: '{"y":2}' },
              ],
            },
            { role: 'tool', content: '{"okA":true}', toolCallId: 'a' },
            { role: 'tool', content: '{"okB":true}', toolCallId: 'b' },
          ],
        }),
      );

      // assistant 1턴 + tool 2건(같은 function-role 턴으로 합쳐짐).
      // tool 결과 turn은 history의 마지막이므로 sendMessageStream으로 전송되며
      // history에는 앞선 model turn만 남는다.
      expect(startChat.mock.calls[0][0].history).toEqual([
        {
          role: 'model',
          parts: [
            { functionCall: { name: 'toolA', args: { x: 1 } } },
            { functionCall: { name: 'toolB', args: { y: 2 } } },
          ],
        },
      ]);
      expect(sendMessageStream.mock.calls[0][0]).toEqual([
        {
          functionResponse: { name: 'toolA', response: { okA: true } },
        },
        {
          functionResponse: { name: 'toolB', response: { okB: true } },
        },
      ]);
    });
  });

  describe('Gemini schema sanitization (tool parameters)', () => {
    function stubClient(): {
      client: GoogleClient;
      getGenerativeModel: jest.Mock;
    } {
      const client = new GoogleClient('test-key', 'gemini-2.5-flash');
      const sendMessageStream = jest.fn().mockResolvedValue({
        stream: asyncIter([
          {
            candidates: [
              { content: { parts: [{ text: 'ok' }] }, finishReason: 'STOP' },
            ],
            usageMetadata: {
              promptTokenCount: 1,
              candidatesTokenCount: 1,
              totalTokenCount: 2,
            },
          },
        ]),
        response: Promise.resolve({}),
      });
      const getGenerativeModel = jest.fn().mockReturnValue({
        startChat: jest.fn().mockReturnValue({ sendMessageStream }),
      });
      // @ts-expect-error — stub
      client.genAI = { getGenerativeModel };
      return { client, getGenerativeModel };
    }

    it('strips additionalProperties, default, minimum/maximum, and unknown formats', async () => {
      const { client, getGenerativeModel } = stubClient();
      await collect(
        client.stream({
          model: 'gemini-2.5-flash',
          messages: [{ role: 'user', content: 'x' }],
          tools: [
            {
              name: 'get_workflow',
              description: 'd',
              parameters: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  limit: { type: 'number', minimum: 1, maximum: 50 },
                  port: { type: 'string', default: 'out' },
                },
                required: ['id'],
              },
            },
          ],
        }),
      );

      expect(getGenerativeModel).toHaveBeenCalled();
      const modelParams = getGenerativeModel.mock.calls[0][0];
      const fn = modelParams.tools[0].functionDeclarations[0];
      expect(fn.parameters).toEqual({
        type: 'object',
        properties: {
          id: { type: 'string' },
          limit: { type: 'number' },
          port: { type: 'string' },
        },
        required: ['id'],
      });
      expect(fn.parameters.additionalProperties).toBeUndefined();
    });

    it('omits parameters entirely when the tool has no properties', async () => {
      const { client, getGenerativeModel } = stubClient();
      await collect(
        client.stream({
          model: 'gemini-2.5-flash',
          messages: [{ role: 'user', content: 'x' }],
          tools: [
            {
              name: 'list_knowledge_bases',
              description: 'd',
              parameters: {
                type: 'object',
                additionalProperties: false,
                properties: {},
              },
            },
          ],
        }),
      );

      const modelParams = getGenerativeModel.mock.calls[0][0];
      const fn = modelParams.tools[0].functionDeclarations[0];
      expect(fn.parameters).toBeUndefined();
      expect(fn.name).toBe('list_knowledge_bases');
      expect(fn.description).toBe('d');
    });

    it('recursively sanitizes nested array items and object properties', async () => {
      const { client, getGenerativeModel } = stubClient();
      await collect(
        client.stream({
          model: 'gemini-2.5-flash',
          messages: [{ role: 'user', content: 'x' }],
          tools: [
            {
              name: 'propose_plan',
              description: 'd',
              parameters: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  steps: {
                    type: 'array',
                    items: {
                      type: 'object',
                      additionalProperties: false,
                      properties: {
                        id: { type: 'string' },
                        action: {
                          type: 'string',
                          enum: ['add_node', 'note'],
                        },
                      },
                      required: ['id', 'action'],
                    },
                  },
                },
                required: ['steps'],
              },
            },
          ],
        }),
      );

      const fn =
        getGenerativeModel.mock.calls[0][0].tools[0].functionDeclarations[0];
      expect(fn.parameters).toEqual({
        type: 'object',
        properties: {
          steps: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                action: { type: 'string', enum: ['add_node', 'note'] },
              },
              required: ['id', 'action'],
            },
          },
        },
        required: ['steps'],
      });
    });

    it('drops required entries whose underlying properties were removed', async () => {
      const { client, getGenerativeModel } = stubClient();
      await collect(
        client.stream({
          model: 'gemini-2.5-flash',
          messages: [{ role: 'user', content: 'x' }],
          tools: [
            {
              name: 'weird',
              description: 'd',
              // required에 나열되었지만 해당 property가 sanitize 되어 사라진 경우
              // required 리스트에서도 함께 제거되어야 Gemini의 참조 무결성 검증을
              // 통과한다.
              parameters: {
                type: 'object',
                properties: {
                  a: { type: 'string' },
                  b: { notReal: 'dropped' },
                },
                required: ['a', 'b'],
              },
            },
          ],
        }),
      );

      const fn =
        getGenerativeModel.mock.calls[0][0].tools[0].functionDeclarations[0];
      expect(fn.parameters.properties).toEqual({ a: { type: 'string' } });
      expect(fn.parameters.required).toEqual(['a']);
    });

    it('skips responseMimeType=application/json when tools are present', async () => {
      const { client, getGenerativeModel } = stubClient();
      await collect(
        client.stream({
          model: 'gemini-2.5-flash',
          messages: [{ role: 'user', content: 'x' }],
          responseFormat: 'json',
          tools: [
            {
              name: 'any_tool',
              description: 'd',
              parameters: {
                type: 'object',
                properties: { id: { type: 'string' } },
                required: ['id'],
              },
            },
          ],
        }),
      );
      const modelParams = getGenerativeModel.mock.calls[0][0];
      expect(modelParams.generationConfig.responseMimeType).toBeUndefined();
    });

    it('keeps responseMimeType=application/json when no tools are attached', async () => {
      const { client, getGenerativeModel } = stubClient();
      await collect(
        client.stream({
          model: 'gemini-2.5-flash',
          messages: [{ role: 'user', content: 'x' }],
          responseFormat: 'json',
        }),
      );
      const modelParams = getGenerativeModel.mock.calls[0][0];
      expect(modelParams.generationConfig.responseMimeType).toBe(
        'application/json',
      );
    });
  });

  it('yields done immediately when there is no user message to send', async () => {
    const { client, sendMessageStream } = makeClientWithStreamResult([]);

    const events = await collect(
      client.stream({ model: 'gemini-2.5-flash', messages: [] }),
    );

    expect(sendMessageStream).not.toHaveBeenCalled();
    expect(events).toEqual([
      {
        type: 'done',
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        model: 'gemini-2.5-flash',
        finishReason: 'stop',
      },
    ]);
  });
});
