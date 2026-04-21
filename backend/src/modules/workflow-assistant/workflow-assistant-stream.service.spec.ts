import { WorkflowAssistantStreamService } from './workflow-assistant-stream.service';
import type { ChatStreamEvent } from '../llm/interfaces/llm-client.interface';

/**
 * These tests drive the conversation loop end-to-end with mocked
 * dependencies, covering:
 *   - plain text turn (no tool calls)
 *   - `propose_plan` → SSE `plan` event, shadow unchanged, session persists
 *     the plan snapshot on the assistant turn
 *   - `add_node` edit turn → shadow validates, SSE `tool_call` kind=edit,
 *     assistant DB message captures the tool_calls array
 *   - missing LLM config → `error` event without touching history
 */

interface MockDeps {
  llmService: {
    resolveConfig: jest.Mock;
    chatStream: jest.Mock;
  };
  sessionService: {
    findOneForUser: jest.Mock;
    loadMessages: jest.Mock;
    appendMessage: jest.Mock;
    setTitleIfEmpty: jest.Mock;
  };
  exploreTools: Record<string, jest.Mock>;
  nodeRegistry: {
    listDefinitions: jest.Mock;
    getComponent: jest.Mock;
  };
}

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

function makeService(): {
  service: WorkflowAssistantStreamService;
  mocks: MockDeps;
} {
  const mocks: MockDeps = {
    llmService: {
      resolveConfig: jest.fn().mockResolvedValue({
        id: 'cfg-1',
        workspaceId: 'ws-1',
        provider: 'openai',
        defaultModel: 'gpt-4o',
      }),
      chatStream: jest.fn(),
    },
    sessionService: {
      findOneForUser: jest.fn().mockResolvedValue({
        id: 'sess-1',
        workspaceId: 'ws-1',
        userId: 'u-1',
        workflowId: 'wf-1',
        title: null,
        llmConfigId: null,
      }),
      loadMessages: jest.fn().mockResolvedValue([]),
      appendMessage: jest.fn().mockResolvedValue({}),
      setTitleIfEmpty: jest.fn().mockResolvedValue(undefined),
    },
    exploreTools: {
      getNodeSchema: jest.fn(),
      listIntegrations: jest.fn(),
      listWorkflows: jest.fn(),
      getWorkflow: jest.fn(),
      listKnowledgeBases: jest.fn(),
    },
    nodeRegistry: {
      listDefinitions: jest.fn().mockReturnValue([
        {
          metadata: {
            type: 'http_request',
            category: 'integration',
            description: 'HTTP request',
          },
          ports: { inputs: ['in'], outputs: ['out', 'error'] },
        },
        {
          metadata: {
            type: 'manual_trigger',
            category: 'trigger',
            description: 'Manual trigger',
          },
          ports: { inputs: [], outputs: ['out'] },
        },
      ]),
      getComponent: jest.fn(),
    },
  };

  const service = new WorkflowAssistantStreamService(
    mocks.llmService as never,
    mocks.sessionService as never,
    mocks.exploreTools as never,
    mocks.nodeRegistry as never,
  );
  return { service, mocks };
}

async function collect<T>(iter: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of iter) out.push(item);
  return out;
}

const baseDto = {
  content: 'Hello assistant',
  currentWorkflow: {
    nodes: [
      {
        id: 'trig-1',
        type: 'manual_trigger',
        category: 'trigger',
        label: 'Start',
        positionX: 250,
        positionY: 300,
        config: {},
      },
    ],
    edges: [],
  },
};

describe('WorkflowAssistantStreamService', () => {
  it('streams plain assistant text and persists user + assistant messages', async () => {
    const { service, mocks } = makeService();
    mocks.llmService.chatStream.mockImplementation(() =>
      asyncIter<ChatStreamEvent>([
        { type: 'text_delta', delta: 'Hello' },
        { type: 'text_delta', delta: ' there' },
        {
          type: 'done',
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          model: 'gpt-4o',
          finishReason: 'stop',
        },
      ]),
    );

    const events = await collect(
      service.streamMessage('sess-1', 'ws-1', 'u-1', baseDto as never),
    );

    const kinds = events.map((e) => e.event);
    expect(kinds).toContain('text');
    expect(kinds).toContain('usage');
    expect(kinds[kinds.length - 1]).toBe('done');

    // user + assistant persisted.
    expect(mocks.sessionService.appendMessage).toHaveBeenCalledTimes(2);
    expect(mocks.sessionService.appendMessage.mock.calls[0][1]).toMatchObject({
      role: 'user',
      content: 'Hello assistant',
    });
    expect(mocks.sessionService.appendMessage.mock.calls[1][1]).toMatchObject({
      role: 'assistant',
      content: 'Hello there',
      finishReason: 'stop',
    });
    // Title auto-set from first message.
    expect(mocks.sessionService.setTitleIfEmpty).toHaveBeenCalledWith(
      'sess-1',
      'Hello assistant',
    );
  });

  it('emits a `plan` SSE event for propose_plan tool calls and persists the plan snapshot', async () => {
    const { service, mocks } = makeService();
    const planArgs = JSON.stringify({
      title: 'Cancel flow',
      summary: 'Add cancellation steps',
      steps: [{ id: 's1', action: 'add_node', description: 'Add HTTP node' }],
    });
    mocks.llmService.chatStream.mockImplementation(() =>
      asyncIter<ChatStreamEvent>([
        {
          type: 'tool_call_end',
          id: 'call_plan',
          name: 'propose_plan',
          arguments: planArgs,
        },
        {
          type: 'done',
          usage: { inputTokens: 50, outputTokens: 20, totalTokens: 70 },
          model: 'gpt-4o',
          finishReason: 'stop',
        },
      ]),
    );

    const events = await collect(
      service.streamMessage('sess-1', 'ws-1', 'u-1', baseDto as never),
    );
    const plan = events.find((e) => e.event === 'plan');
    expect(plan).toBeDefined();
    expect(plan?.data).toMatchObject({ title: 'Cancel flow' });

    const assistantCall = mocks.sessionService.appendMessage.mock.calls[1][1];
    expect(assistantCall.plan).toMatchObject({ title: 'Cancel flow' });
    expect(assistantCall.toolCalls).toHaveLength(1);
    expect(assistantCall.toolCalls[0]).toMatchObject({
      name: 'propose_plan',
      kind: 'plan',
    });
  });

  it('validates edit tool calls against the shadow workflow and emits tool_call kind=edit', async () => {
    const { service, mocks } = makeService();
    const addNodeArgs = JSON.stringify({
      type: 'http_request',
      label: 'Fetch',
      position: { x: 500, y: 300 },
      config: { method: 'GET' },
    });
    mocks.llmService.chatStream.mockImplementation(() =>
      asyncIter<ChatStreamEvent>([
        {
          type: 'tool_call_end',
          id: 'call_add',
          name: 'add_node',
          arguments: addNodeArgs,
        },
        {
          type: 'done',
          usage: { inputTokens: 30, outputTokens: 10, totalTokens: 40 },
          model: 'gpt-4o',
          finishReason: 'stop',
        },
      ]),
    );

    const events = await collect(
      service.streamMessage('sess-1', 'ws-1', 'u-1', baseDto as never),
    );
    const toolCall = events.find((e) => e.event === 'tool_call');
    expect(toolCall?.data).toMatchObject({
      name: 'add_node',
      kind: 'edit',
    });
    const result = (toolCall?.data as { result: { ok: boolean; id?: string } })
      .result;
    expect(result.ok).toBe(true);
    expect(result.id).toMatch(/[0-9a-f-]{36}/);
  });

  it('rehydrates prior assistant toolCalls with their results as paired tool messages in history', async () => {
    // 저장된 assistant 메시지의 toolCalls[i].result를 다음 턴 LLM 호출에서
    // 반드시 role:'tool' 메시지로 복원해야 Gemini의 `function call missing`
    // 검증을 통과한다 (functionCall ↔ functionResponse 쌍 보존).
    const { service, mocks } = makeService();
    mocks.sessionService.loadMessages.mockResolvedValue([
      { role: 'user', content: '주문 취소 프로세스 추가해줘', toolCalls: null },
      {
        role: 'assistant',
        content: '먼저 integration 목록을 확인할게요',
        toolCalls: [
          {
            id: 'call_prev_1',
            name: 'list_integrations',
            arguments: { category: 'http' },
            kind: 'explore',
            result: [{ id: 'int-1', name: 'Shop API' }],
          },
        ],
      },
    ]);
    mocks.llmService.chatStream.mockImplementation(() =>
      asyncIter<ChatStreamEvent>([
        { type: 'text_delta', delta: 'ok' },
        {
          type: 'done',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          model: 'gpt-4o',
          finishReason: 'stop',
        },
      ]),
    );

    await collect(
      service.streamMessage('sess-1', 'ws-1', 'u-1', {
        ...baseDto,
        content: '좋아 계속 진행해',
      } as never),
    );

    expect(mocks.llmService.chatStream).toHaveBeenCalledTimes(1);
    const chatParams = mocks.llmService.chatStream.mock.calls[0][1];
    const messages = chatParams.messages as Array<{
      role: string;
      content?: string;
      toolCallId?: string;
      toolCalls?: Array<{ id: string; name: string; arguments: string }>;
    }>;

    // assistant row를 3 파트로 분해해야 Gemini의 functionResponse+text 혼합
    // 금지 규칙을 통과한다:
    //   system / prev user / assistant(toolCalls만) / tool(result) /
    //   assistant(text) / current user
    expect(messages.map((m) => m.role)).toEqual([
      'system',
      'user',
      'assistant',
      'tool',
      'assistant',
      'user',
    ]);
    const assistantToolTurn = messages[2];
    expect(assistantToolTurn.content).toBe('');
    expect(assistantToolTurn.toolCalls).toHaveLength(1);
    expect(assistantToolTurn.toolCalls![0]).toMatchObject({
      id: 'call_prev_1',
      name: 'list_integrations',
    });
    const tool = messages[3];
    expect(tool.toolCallId).toBe('call_prev_1');
    expect(JSON.parse(tool.content ?? 'null')).toEqual([
      { id: 'int-1', name: 'Shop API' },
    ]);
    // 원본 assistant 텍스트 응답은 terminal model turn으로 분리됨
    const assistantTextTurn = messages[4];
    expect(assistantTextTurn.content).toBe(
      '먼저 integration 목록을 확인할게요',
    );
    expect(assistantTextTurn.toolCalls).toBeUndefined();
  });

  it('returns ASSISTANT_NO_LLM_CONFIG error when config resolution fails', async () => {
    const { service, mocks } = makeService();
    mocks.llmService.resolveConfig.mockRejectedValue(new Error('no config'));

    const events = await collect(
      service.streamMessage('sess-1', 'ws-1', 'u-1', baseDto as never),
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      event: 'error',
      data: expect.objectContaining({ code: 'ASSISTANT_NO_LLM_CONFIG' }),
    });
    // No message persistence when config missing.
    expect(mocks.sessionService.appendMessage).not.toHaveBeenCalled();
  });
});
