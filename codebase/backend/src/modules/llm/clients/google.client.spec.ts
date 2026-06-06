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
            : { value: undefined, done: true },
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

interface FakeModel {
  name?: string;
  displayName?: string;
  supportedActions?: string[];
}

interface Stubs {
  client: GoogleClient;
  generateContent: jest.Mock;
  generateContentStream: jest.Mock;
  embedContent: jest.Mock;
  list: jest.Mock;
}

function makeStubs(
  overrides: Partial<{
    streamChunks: FakeChunk[];
    streamRejects: unknown;
    generateContentResult: unknown;
    models: FakeModel[];
    embedResult: unknown;
    defaultModel: string;
  }> = {},
): Stubs {
  const client = new GoogleClient(
    'test-key',
    overrides.defaultModel ?? 'gemini-2.5-flash',
  );
  const generateContentStream = overrides.streamRejects
    ? jest.fn().mockRejectedValue(overrides.streamRejects)
    : jest.fn().mockResolvedValue(asyncIter(overrides.streamChunks ?? []));
  const generateContent = jest
    .fn()
    .mockResolvedValue(overrides.generateContentResult ?? {});
  const embedContent = jest
    .fn()
    .mockResolvedValue(overrides.embedResult ?? { embeddings: [] });
  const list = jest.fn().mockResolvedValue(asyncIter(overrides.models ?? []));
  // @ts-expect-error — overwrite internal SDK client with a minimal stub
  client.ai = {
    models: { generateContent, generateContentStream, embedContent, list },
  };
  return { client, generateContent, generateContentStream, embedContent, list };
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
    const { client } = makeStubs({
      streamChunks: [
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
      ],
    });

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
    const { client } = makeStubs({
      streamChunks: [
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
      ],
    });

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
    expect(delta?.type).toBe('tool_call_delta');
    expect(end?.type).toBe('tool_call_end');
    if (delta?.type !== 'tool_call_delta' || end?.type !== 'tool_call_end') {
      throw new Error('expected tool_call_delta and tool_call_end events');
    }
    expect(delta).toMatchObject({
      name: 'add_node',
      argumentsDelta: expectedArgs,
    });
    expect(end).toMatchObject({ name: 'add_node', arguments: expectedArgs });
    expect(delta.id).toBe(end.id);
    expect(events.find((e) => e.type === 'done')).toMatchObject({
      finishReason: 'tool_calls',
    });
  });

  it('emits delta+end pairs in order for multiple functionCall parts in one chunk', async () => {
    const { client } = makeStubs({
      streamChunks: [
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
      ],
    });

    const events = await collect(
      client.stream({
        model: 'gemini-2.5-flash',
        messages: [{ role: 'user', content: 'parallel' }],
      }),
    );

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
    expect(ends[0].id).not.toBe(ends[1].id);
    expect(events.find((e) => e.type === 'done')).toMatchObject({
      finishReason: 'tool_calls',
    });
  });

  it('maps Gemini MAX_TOKENS finishReason to "length"', async () => {
    const { client } = makeStubs({
      streamChunks: [
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
      ],
    });

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
    const { client } = makeStubs({
      streamChunks: [
        {
          candidates: [{ content: { parts: [] }, finishReason: 'SAFETY' }],
          usageMetadata: {
            promptTokenCount: 5,
            candidatesTokenCount: 0,
            totalTokenCount: 5,
          },
        },
      ],
    });

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

  it('picks up usageMetadata from a later chunk even when earlier chunks omit it', async () => {
    // 신 SDK 는 `{stream, response}` 분리를 제공하지 않으므로 aggregated response
    // 폴백이 사라졌다. Gemini 가 마지막 청크에 usage 를 내려보내는 동작은 그대로라
    // 스트림 순회 중 누적되는 값을 검증한다.
    const { client } = makeStubs({
      streamChunks: [
        { candidates: [{ content: { parts: [{ text: 'ok' }] } }] },
        {
          candidates: [{ content: { parts: [] }, finishReason: 'STOP' }],
          usageMetadata: {
            promptTokenCount: 7,
            candidatesTokenCount: 1,
            totalTokenCount: 8,
          },
        },
      ],
    });

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
    const { client } = makeStubs({
      streamChunks: [
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
      ],
    });

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
    const abortError = new DOMException(
      'The operation was aborted.',
      'AbortError',
    );
    const generateContentStream = jest.fn().mockResolvedValue({
      [Symbol.asyncIterator]() {
        return {
          next: async () => {
            abort.abort();
            throw abortError;
          },
        };
      },
    });
    // @ts-expect-error — stub
    client.ai = {
      models: {
        generateContent: jest.fn(),
        generateContentStream,
        embedContent: jest.fn(),
        list: jest.fn(),
      },
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
    expect(events.find((e) => e.type === 'error')).toBeUndefined();
    const done = events.find((e) => e.type === 'done');
    expect(done).toMatchObject({ type: 'done', finishReason: 'aborted' });
  });

  it('yields an error event when generateContentStream rejects', async () => {
    const { client } = makeStubs({
      streamRejects: new Error('401 Unauthorized'),
    });

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
    const { client } = makeStubs({
      streamRejects: new Error('429 Too Many Requests'),
    });

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

  it('forwards AbortSignal via config.abortSignal', async () => {
    const abort = new AbortController();
    const { client, generateContentStream } = makeStubs({
      streamChunks: [
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
      ],
    });

    await collect(
      client.stream(
        {
          model: 'gemini-2.5-flash',
          messages: [{ role: 'user', content: 'x' }],
        },
        abort.signal,
      ),
    );

    const callArgs = generateContentStream.mock.calls[0][0];
    expect(callArgs.config.abortSignal).toBe(abort.signal);
    expect(callArgs.contents).toEqual([
      { role: 'user', parts: [{ text: 'x' }] },
    ]);
  });

  describe('history serialization (tool call / tool result round-trip)', () => {
    it('flattens user/assistant/tool messages into a single contents array', async () => {
      const { client, generateContentStream } = makeStubs({
        streamChunks: [
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
        ],
      });
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

      const contents = generateContentStream.mock.calls[0][0].contents;
      expect(contents).toEqual([
        { role: 'user', parts: [{ text: 'add http' }] },
        {
          role: 'model',
          parts: [
            {
              functionCall: {
                name: 'add_node',
                args: { type: 'http_request', label: 'Get' },
                id: 'call_1',
              },
            },
          ],
        },
        {
          role: 'function',
          parts: [
            {
              functionResponse: {
                name: 'add_node',
                response: { ok: true, id: 'n1' },
                id: 'call_1',
              },
            },
          ],
        },
      ]);
    });

    it('wraps non-object tool results under `result` for Gemini functionResponse contract', async () => {
      const { client, generateContentStream } = makeStubs({
        streamChunks: [
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
        ],
      });
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
      const contents = generateContentStream.mock.calls[0][0].contents;
      expect(contents[contents.length - 1]).toEqual({
        role: 'function',
        parts: [
          {
            functionResponse: {
              name: 'echo',
              response: { result: 'just a string' },
              id: 'c1',
            },
          },
        ],
      });
    });

    it('never merges functionResponse parts with plain-text user parts into the same turn', async () => {
      const { client, generateContentStream } = makeStubs({
        streamChunks: [
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
        ],
      });
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
            { role: 'assistant', content: 'Done' },
            { role: 'user', content: '다음 단계 알려줘' },
          ],
        }),
      );

      const contents = generateContentStream.mock.calls[0][0].contents;
      const roles = contents.map((c: { role: string }) => c.role);
      expect(roles).toEqual(['model', 'function', 'model', 'user']);
      expect(contents[3].parts).toEqual([{ text: '다음 단계 알려줘' }]);
    });

    it('emits a placeholder text part for an empty assistant turn to preserve alternation', async () => {
      const { client, generateContentStream } = makeStubs({
        streamChunks: [
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
        ],
      });
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
            { role: 'assistant', content: '' },
            { role: 'user', content: 'next' },
          ],
        }),
      );
      const contents = generateContentStream.mock.calls[0][0].contents;
      expect(contents).toHaveLength(4);
      expect(contents[2]).toEqual({ role: 'model', parts: [{ text: '' }] });
    });

    it('captures thoughtSignature from functionCall parts and echoes it back', async () => {
      const { client } = makeStubs({
        defaultModel: 'gemini-3.1-flash-lite-preview',
        streamChunks: [
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
        ],
      });

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
      const { client, generateContentStream } = makeStubs({
        streamChunks: [
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
        ],
      });
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
      const contents = generateContentStream.mock.calls[0][0].contents;
      const modelTurn = contents.find(
        (c: { role: string }) => c.role === 'model',
      );
      expect(modelTurn).toBeDefined();
      expect(modelTurn.parts[0]).toMatchObject({
        functionCall: { name: 'list_integrations' },
        thoughtSignature: 'SIG-abc123',
      });
    });

    it('omits thoughtSignature when the tool call has no signature', async () => {
      const { client, generateContentStream } = makeStubs({
        streamChunks: [
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
        ],
      });
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
      const contents = generateContentStream.mock.calls[0][0].contents;
      const modelTurn = contents.find(
        (c: { role: string }) => c.role === 'model',
      );
      expect(modelTurn.parts[0]).toEqual({
        functionCall: { name: 'tool', args: {}, id: 'c' },
      });
      expect(modelTurn.parts[0]).not.toHaveProperty('thoughtSignature');
    });

    it('merges consecutive same-role messages into a single Gemini turn', async () => {
      const { client, generateContentStream } = makeStubs({
        streamChunks: [
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
        ],
      });
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

      const contents = generateContentStream.mock.calls[0][0].contents;
      expect(contents).toEqual([
        {
          role: 'model',
          parts: [
            { functionCall: { name: 'toolA', args: { x: 1 }, id: 'a' } },
            { functionCall: { name: 'toolB', args: { y: 2 }, id: 'b' } },
          ],
        },
        {
          role: 'function',
          parts: [
            {
              functionResponse: {
                name: 'toolA',
                response: { okA: true },
                id: 'a',
              },
            },
            {
              functionResponse: {
                name: 'toolB',
                response: { okB: true },
                id: 'b',
              },
            },
          ],
        },
      ]);
    });
  });

  describe('Gemini schema sanitization (tool parameters)', () => {
    it('strips additionalProperties, default, minimum/maximum, and unknown formats', async () => {
      const { client, generateContentStream } = makeStubs({
        streamChunks: [
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
        ],
      });
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

      const config = generateContentStream.mock.calls[0][0].config;
      const fn = config.tools[0].functionDeclarations[0];
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
      const { client, generateContentStream } = makeStubs({
        streamChunks: [
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
        ],
      });
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

      const fn =
        generateContentStream.mock.calls[0][0].config.tools[0]
          .functionDeclarations[0];
      expect(fn.parameters).toBeUndefined();
      expect(fn.name).toBe('list_knowledge_bases');
      expect(fn.description).toBe('d');
    });

    it('recursively sanitizes nested array items and object properties', async () => {
      const { client, generateContentStream } = makeStubs({
        streamChunks: [
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
        ],
      });
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
        generateContentStream.mock.calls[0][0].config.tools[0]
          .functionDeclarations[0];
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
      const { client, generateContentStream } = makeStubs({
        streamChunks: [
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
        ],
      });
      await collect(
        client.stream({
          model: 'gemini-2.5-flash',
          messages: [{ role: 'user', content: 'x' }],
          tools: [
            {
              name: 'weird',
              description: 'd',
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
        generateContentStream.mock.calls[0][0].config.tools[0]
          .functionDeclarations[0];
      expect(fn.parameters.properties).toEqual({ a: { type: 'string' } });
      expect(fn.parameters.required).toEqual(['a']);
    });

    it('skips responseMimeType=application/json when tools are present', async () => {
      const { client, generateContentStream } = makeStubs({
        streamChunks: [
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
        ],
      });
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
      const config = generateContentStream.mock.calls[0][0].config;
      expect(config.responseMimeType).toBeUndefined();
    });

    it('keeps responseMimeType=application/json when no tools are attached', async () => {
      const { client, generateContentStream } = makeStubs({
        streamChunks: [
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
        ],
      });
      await collect(
        client.stream({
          model: 'gemini-2.5-flash',
          messages: [{ role: 'user', content: 'x' }],
          responseFormat: 'json',
        }),
      );
      const config = generateContentStream.mock.calls[0][0].config;
      expect(config.responseMimeType).toBe('application/json');
    });
  });

  it('skips malformed stream chunks via type guard and continues processing', async () => {
    const { client } = makeStubs({
      // 두 번째 청크는 기대 형태와 다른 "형태불일치" — candidates 가 배열이 아닌 객체.
      // 타입 가드가 skip 해야 하며 뒤이은 정상 청크는 처리되어야 한다.
      streamChunks: [
        { candidates: [{ content: { parts: [{ text: 'ok ' }] } }] },
        // @ts-expect-error — intentionally malformed chunk for the type guard test
        { candidates: { notAnArray: true } },
        {
          candidates: [
            { content: { parts: [{ text: 'done' }] }, finishReason: 'STOP' },
          ],
          usageMetadata: {
            promptTokenCount: 2,
            candidatesTokenCount: 2,
            totalTokenCount: 4,
          },
        },
      ],
    });

    const events = await collect(
      client.stream({
        model: 'gemini-2.5-flash',
        messages: [{ role: 'user', content: 'x' }],
      }),
    );
    const textDeltas = events.filter((e) => e.type === 'text_delta');
    expect(textDeltas).toHaveLength(2);
    expect(events.find((e) => e.type === 'done')).toMatchObject({
      usage: { inputTokens: 2, outputTokens: 2, totalTokens: 4 },
    });
  });

  it('yields done immediately when there is no user message to send', async () => {
    const { client, generateContentStream } = makeStubs();

    const events = await collect(
      client.stream({ model: 'gemini-2.5-flash', messages: [] }),
    );

    expect(generateContentStream).not.toHaveBeenCalled();
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

describe('GoogleClient.listModels', () => {
  it('maps SDK models to ModelInfo, classifying by supportedActions', async () => {
    const { client } = makeStubs({
      models: [
        {
          name: 'models/gemini-2.5-flash',
          displayName: 'Gemini 2.5 Flash',
          supportedActions: ['generateContent'],
        },
        {
          name: 'models/gemini-3-flash-preview',
          displayName: 'Gemini 3 Flash (preview)',
          supportedActions: ['generateContent'],
        },
        {
          name: 'models/text-embedding-004',
          displayName: 'Text Embedding 004',
          supportedActions: ['embedContent'],
        },
      ],
    });
    const models = await client.listModels();
    expect(models).toEqual([
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', type: 'chat' },
      {
        id: 'gemini-3-flash-preview',
        name: 'Gemini 3 Flash (preview)',
        type: 'chat',
      },
      {
        id: 'text-embedding-004',
        name: 'Text Embedding 004',
        type: 'embedding',
      },
    ]);
  });

  it('skips models that support neither generateContent nor embedContent', async () => {
    const { client } = makeStubs({
      models: [
        {
          name: 'models/unknown',
          displayName: 'unknown',
          supportedActions: ['someOther'],
        },
        {
          name: 'models/gemini-2.5-flash',
          displayName: 'Gemini 2.5 Flash',
          supportedActions: ['generateContent'],
        },
      ],
    });
    const models = await client.listModels();
    expect(models).toHaveLength(1);
    expect(models[0].id).toBe('gemini-2.5-flash');
  });

  it('falls back to id when displayName is missing', async () => {
    const { client } = makeStubs({
      models: [
        {
          name: 'models/gemini-2.5-flash',
          supportedActions: ['generateContent'],
        },
      ],
    });
    const models = await client.listModels();
    expect(models[0]).toEqual({
      id: 'gemini-2.5-flash',
      name: 'gemini-2.5-flash',
      type: 'chat',
    });
  });

  it('caps the number of models returned at 100 to bound UI dropdown size', async () => {
    const many = Array.from({ length: 150 }, (_, i) => ({
      name: `models/gemini-test-${i}`,
      displayName: `Gemini Test ${i}`,
      supportedActions: ['generateContent'],
    }));
    const { client } = makeStubs({ models: many });
    const result = await client.listModels();
    expect(result).toHaveLength(100);
  });

  it('forwards AbortSignal via config.abortSignal to the SDK list call', async () => {
    const { client, list } = makeStubs();
    const controller = new AbortController();
    await client.listModels(controller.signal);
    expect(list).toHaveBeenCalledTimes(1);
    const callArg = list.mock.calls[0][0];
    // 내부 controller.signal 은 외부 signal 이 abort 될 때 함께 abort 되도록 연결됨
    expect(callArg.config.abortSignal).toBeInstanceOf(AbortSignal);
  });

  it('propagates errors from the SDK list call', async () => {
    const client = new GoogleClient('test-key', 'gemini-2.5-flash');
    // @ts-expect-error — stub
    client.ai = {
      models: {
        generateContent: jest.fn(),
        generateContentStream: jest.fn(),
        embedContent: jest.fn(),
        list: jest.fn().mockRejectedValue(new Error('429 Too Many Requests')),
      },
    };
    await expect(client.listModels()).rejects.toThrow('429 Too Many Requests');
  });

  it('skips entries with no name field', async () => {
    const { client } = makeStubs({
      models: [
        { supportedActions: ['generateContent'] },
        {
          name: 'models/gemini-2.5-pro',
          supportedActions: ['generateContent'],
        },
      ],
    });
    const models = await client.listModels();
    expect(models).toHaveLength(1);
    expect(models[0].id).toBe('gemini-2.5-pro');
  });
});

describe('GoogleClient.embed', () => {
  it('sends texts as a batch and extracts embedding values', async () => {
    const { client, embedContent } = makeStubs({
      embedResult: {
        embeddings: [{ values: [0.1, 0.2] }, { values: [0.3, 0.4] }],
      },
    });
    const result = await client.embed(['a', 'b']);
    expect(embedContent).toHaveBeenCalledWith({
      model: 'text-embedding-004',
      contents: ['a', 'b'],
      // inputType 생략 시 document 기본값 → RETRIEVAL_DOCUMENT.
      config: { taskType: 'RETRIEVAL_DOCUMENT' },
    });
    expect(result).toEqual([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);
  });

  // SUMMARY#6 — inputType 생략 시 기본값 RETRIEVAL_DOCUMENT 독립 검증
  it('inputType 생략 시 RETRIEVAL_DOCUMENT 가 config 에 포함된다', async () => {
    const { client, embedContent } = makeStubs({
      embedResult: { embeddings: [{ values: [0.5] }] },
    });
    await client.embed(['doc-text']);
    expect(embedContent).toHaveBeenCalledWith(
      expect.objectContaining({
        config: { taskType: 'RETRIEVAL_DOCUMENT' },
      }),
    );
  });

  it('uses the provided model id when given', async () => {
    const { client, embedContent } = makeStubs({
      embedResult: { embeddings: [{ values: [1] }] },
    });
    await client.embed(['x'], 'custom-embed-model');
    expect(embedContent).toHaveBeenCalledWith({
      model: 'custom-embed-model',
      contents: ['x'],
      config: { taskType: 'RETRIEVAL_DOCUMENT' },
    });
  });

  it('maps inputType=query → RETRIEVAL_QUERY taskType (비대칭 검색)', async () => {
    const { client, embedContent } = makeStubs({
      embedResult: { embeddings: [{ values: [1] }] },
    });
    await client.embed(['q'], 'text-embedding-004', 'query');
    expect(embedContent).toHaveBeenCalledWith({
      model: 'text-embedding-004',
      contents: ['q'],
      config: { taskType: 'RETRIEVAL_QUERY' },
    });
  });

  it('throws when the SDK returns fewer vectors than inputs (no silent failure)', async () => {
    const { client } = makeStubs({ embedResult: {} });
    await expect(client.embed(['x'])).rejects.toThrow(/0 vectors for 1 inputs/);
  });

  it('throws when the SDK returns an empty values array for any input', async () => {
    const { client } = makeStubs({
      embedResult: {
        embeddings: [{ values: [0.1] }, { values: [] }],
      },
    });
    await expect(client.embed(['a', 'b'])).rejects.toThrow(
      /empty vector at index 1/,
    );
  });
});

describe('GoogleClient.chat', () => {
  it('returns content, usage, and stop finishReason', async () => {
    const { client, generateContent } = makeStubs({
      generateContentResult: {
        candidates: [{ content: { parts: [{ text: 'hi there' }] } }],
        usageMetadata: {
          promptTokenCount: 3,
          candidatesTokenCount: 2,
          totalTokenCount: 5,
        },
      },
    });
    const result = await client.chat({
      model: 'gemini-2.5-flash',
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(result).toEqual({
      content: 'hi there',
      usage: { inputTokens: 3, outputTokens: 2, totalTokens: 5 },
      model: 'gemini-2.5-flash',
      finishReason: 'stop',
    });
    const args = generateContent.mock.calls[0][0];
    expect(args.model).toBe('gemini-2.5-flash');
    expect(args.contents).toEqual([{ role: 'user', parts: [{ text: 'hi' }] }]);
  });

  it('returns tool_calls finishReason when the model emits functionCall parts', async () => {
    const { client } = makeStubs({
      generateContentResult: {
        candidates: [
          {
            content: {
              parts: [
                {
                  functionCall: {
                    name: 'do_it',
                    args: { x: 1 },
                  },
                },
              ],
            },
          },
        ],
        usageMetadata: {
          promptTokenCount: 1,
          candidatesTokenCount: 1,
          totalTokenCount: 2,
        },
      },
    });
    const result = await client.chat({
      model: 'gemini-2.5-flash',
      messages: [{ role: 'user', content: 'run' }],
    });
    expect(result.finishReason).toBe('tool_calls');
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls?.[0]).toMatchObject({
      name: 'do_it',
      arguments: '{"x":1}',
    });
  });

  it('captures part.thoughtSignature into ToolCall.signature on chat (non-streaming) path', async () => {
    // Regression: Gemini 2.5+/3.x rejects multi-turn tool loops with
    // INVALID_ARGUMENT "Function call is missing a thought_signature" when
    // the assistant turn is echoed back without the original signature.
    // The streaming path already lifts part.thoughtSignature into ToolCall.signature
    // (L455-469); this test pins the same behavior on the non-streaming chat path.
    const { client } = makeStubs({
      generateContentResult: {
        candidates: [
          {
            content: {
              parts: [
                {
                  functionCall: {
                    name: 'kb_lookup',
                    args: { query: 'refund' },
                    id: 'fc-1',
                  },
                  thoughtSignature: 'SIG-xyz',
                },
              ],
            },
          },
        ],
        usageMetadata: {
          promptTokenCount: 1,
          candidatesTokenCount: 1,
          totalTokenCount: 2,
        },
      },
    });
    const result = await client.chat({
      model: 'gemini-2.5-flash',
      messages: [{ role: 'user', content: 'find refund policy' }],
    });
    expect(result.toolCalls?.[0]).toMatchObject({
      name: 'kb_lookup',
      arguments: '{"query":"refund"}',
      signature: 'SIG-xyz',
    });
  });
});
