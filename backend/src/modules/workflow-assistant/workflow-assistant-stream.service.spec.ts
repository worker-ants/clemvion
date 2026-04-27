import {
  WorkflowAssistantStreamService,
  toRuntimePortDescriptor,
} from './workflow-assistant-stream.service';
import type { ChatStreamEvent } from '../llm/interfaces/llm-client.interface';
import { z } from 'zod';

/**
 * These tests drive the conversation loop end-to-end with mocked
 * dependencies, covering:
 *   - plain text turn (no tool calls)
 *   - `propose_plan` → SSE `plan` event, shadow unchanged, session persists
 *     the plan snapshot on the assistant turn
 *   - `add_node` edit turn → shadow validates, SSE `tool_call` kind=edit,
 *     assistant DB message captures the tool_calls array
 *   - rehydration of prior assistant tool calls as tool-result pairs
 *   - `get_current_workflow` → returns the shadow snapshot with redacted
 *     config; must NOT delegate to ExploreToolsService
 *   - in-turn edit then `get_current_workflow` reflects the latest shadow
 *     (empty-canvas edge case included)
 *   - `finish` guard paths:
 *       • pending plan steps → PLAN_NOT_COMPLETE → loop continues
 *       • plan-propose-only turn → allowed to finish without block
 *       • second finish in the same turn exits safely (no infinite loop)
 *       • unanswered openQuestions alone → PLAN_NOT_COMPLETE
 *       • `note` action steps are excluded from the pending check
 *       • history plan with an unrelated turn edit → guard stays silent
 *       • history plan with a matching planStepId → guard activates
 *   - successful finish is persisted (tool_calls row includes the finish call)
 *   - usage event from round 1 survives finish handling (drained, not dropped)
 *   - **propose_plan JSON leak recovery** (server-side): text-channel leaks
 *     are converted to a synthetic plan SSE event + scrubbed persisted
 *     content; real tool calls are not duplicated; non-plan JSON prose is
 *     not recovered; multi-delta split streaming is handled
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
  handlerRegistry: {
    has: jest.Mock;
    get: jest.Mock;
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
            : { value: undefined, done: true },
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
      getWorkflowExecutions: jest.fn(),
      getExecutionDetails: jest.fn(),
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
    // handler.validate 는 shadow add/update 시점의 domain-rule 검사를
    // 주입하는 브리지. 기본값은 permissive (has()=false 라 validator
    // skip). 실패 경로를 테스트하려는 개별 케이스는 has/get 을 override.
    handlerRegistry: {
      has: jest.fn().mockReturnValue(false),
      get: jest.fn(),
    },
  };

  // ED-AI-39: CandidateLookupService 는 워크스페이스에서 후보를 조회해
  // pending 항목에 candidates 를 채운다. 테스트 기본값은 "그대로 pass-through"
  // (candidates=[]) 로, 개별 케이스가 필요하면 mockImplementation 으로 override.
  const candidateLookup = {
    fillCandidates: jest.fn(
      async (_ws: string, _wf: string, pending: unknown[]) => pending,
    ),
  };

  const service = new WorkflowAssistantStreamService(
    mocks.llmService as never,
    mocks.sessionService as never,
    mocks.exploreTools as never,
    mocks.nodeRegistry as never,
    mocks.handlerRegistry as never,
    candidateLookup as never,
  );
  return { service, mocks: { ...mocks, candidateLookup } };
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

  it('attaches pendingUserConfig to add_node result when integration-selector field is empty', async () => {
    // 사용자 보고: 어시스턴트가 이메일/HTTP 노드를 추가해 놓고 Integration
    // 선택 필요를 말해주지 않았다. 서버가 비어있는 selector 를 감지해
    // tool_result 에 pendingUserConfig 로 실어주면 LLM 이 마무리 메세지에
    // 자연스럽게 포함할 수 있다.
    const { service, mocks } = makeService();
    // getComponent 가 돌려주는 configSchema 는 zod 객체여야 하지만, 서비스는
    // z.toJSONSchema() 로 JSON 스키마를 얻은 뒤 detectPendingUserConfig 에
    // 넘기므로 여기서는 실제 zod 를 준비한다.
    const httpRequestConfigSchema = z.object({
      integrationId: z
        .string()
        .optional()
        .meta({
          ui: { label: 'Integration', widget: 'integration-selector' },
        }),
      method: z.string().default('GET'),
    });
    mocks.nodeRegistry.getComponent.mockImplementation((type: string) => {
      if (type === 'http_request') {
        return { configSchema: httpRequestConfigSchema };
      }
      return undefined;
    });

    const addNodeArgs = JSON.stringify({
      type: 'http_request',
      label: 'Fetch',
      position: { x: 500, y: 300 },
      config: { method: 'GET' }, // integrationId 는 비워둠
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
    const result = (
      toolCall?.data as {
        result: {
          ok: boolean;
          pendingUserConfig?: Array<{ field: string; widget: string }>;
        };
      }
    ).result;
    expect(result.ok).toBe(true);
    expect(result.pendingUserConfig).toEqual([
      expect.objectContaining({
        field: 'integrationId',
        widget: 'integration-selector',
      }),
    ]);
  });

  it('fills pendingUserConfig[].candidates from CandidateLookupService (ED-AI-39)', async () => {
    // Spec §4.3.1 — add_node 성공 직후 서버가 워크스페이스에서 후보를 조회해
    // pendingUserConfig[i].candidates 에 실어야 한다. 프런트는 이 값으로
    // 메시지 버블 내 picker 를 렌더한다.
    const { service, mocks } = makeService();
    const schema = z.object({
      integrationId: z
        .string()
        .optional()
        .meta({
          ui: { label: 'Integration', widget: 'integration-selector' },
          integrationServiceType: 'email',
        }),
    });
    mocks.nodeRegistry.getComponent.mockImplementation((type: string) =>
      type === 'http_request' ? { configSchema: schema } : undefined,
    );
    // CandidateLookupService 가 Integration 2개를 채워 돌려주도록 모킹.
    mocks.candidateLookup.fillCandidates.mockImplementation(
      async (_ws: string, _wf: string, pending: unknown[]) =>
        (pending as Array<Record<string, unknown>>).map((p) => ({
          ...p,
          candidates: [
            { id: 'int-1', label: 'Gmail SMTP', sublabel: 'email' },
            { id: 'int-2', label: 'Mailgun', sublabel: 'email' },
          ],
        })),
    );

    mocks.llmService.chatStream.mockImplementation(() =>
      asyncIter<ChatStreamEvent>([
        {
          type: 'tool_call_end',
          id: 'call_add',
          name: 'add_node',
          arguments: JSON.stringify({
            type: 'http_request',
            label: 'Notify',
            position: { x: 500, y: 300 },
            config: {},
          }),
        },
        {
          type: 'done',
          usage: { inputTokens: 5, outputTokens: 2, totalTokens: 7 },
          model: 'gpt-4o',
          finishReason: 'stop',
        },
      ]),
    );

    const events = await collect(
      service.streamMessage('sess-1', 'ws-1', 'u-1', baseDto as never),
    );
    const toolCall = events.find((e) => e.event === 'tool_call');
    const result = (
      toolCall?.data as {
        result: {
          pendingUserConfig?: Array<{
            field: string;
            candidates: Array<{ id: string; label: string; sublabel?: string }>;
          }>;
        };
      }
    ).result;
    expect(result.pendingUserConfig).toHaveLength(1);
    expect(result.pendingUserConfig![0].field).toBe('integrationId');
    expect(result.pendingUserConfig![0].candidates).toEqual([
      { id: 'int-1', label: 'Gmail SMTP', sublabel: 'email' },
      { id: 'int-2', label: 'Mailgun', sublabel: 'email' },
    ]);
    // CandidateLookupService 가 현재 세션의 workspaceId / workflowId 로
    // 호출되었는지 — 경계 누수 방지.
    expect(mocks.candidateLookup.fillCandidates).toHaveBeenCalledWith(
      'ws-1',
      'wf-1',
      expect.arrayContaining([
        expect.objectContaining({ widget: 'integration-selector' }),
      ]),
    );
  });

  it('omits pendingUserConfig when the integration-selector field is filled', async () => {
    const { service, mocks } = makeService();
    const schema = z.object({
      integrationId: z
        .string()
        .optional()
        .meta({
          ui: { label: 'Integration', widget: 'integration-selector' },
        }),
    });
    mocks.nodeRegistry.getComponent.mockImplementation((type: string) =>
      type === 'http_request' ? { configSchema: schema } : undefined,
    );

    const addNodeArgs = JSON.stringify({
      type: 'http_request',
      label: 'Fetch',
      position: { x: 0, y: 0 },
      config: { integrationId: 'int-42' },
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
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          model: 'gpt-4o',
          finishReason: 'stop',
        },
      ]),
    );

    const events = await collect(
      service.streamMessage('sess-1', 'ws-1', 'u-1', baseDto as never),
    );
    const toolCall = events.find((e) => e.event === 'tool_call');
    const result = (
      toolCall?.data as {
        result: { pendingUserConfig?: unknown };
      }
    ).result;
    expect(result.pendingUserConfig).toBeUndefined();
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
      }),
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

  it('returns the current shadow snapshot (with config redacted) for get_current_workflow', async () => {
    const { service, mocks } = makeService();
    mocks.llmService.chatStream.mockImplementation(() =>
      asyncIter<ChatStreamEvent>([
        {
          type: 'tool_call_end',
          id: 'call_inspect',
          name: 'get_current_workflow',
          arguments: '{}',
        },
        {
          type: 'done',
          usage: { inputTokens: 5, outputTokens: 0, totalTokens: 5 },
          model: 'gpt-4o',
          finishReason: 'stop',
        },
      ]),
    );

    const events = await collect(
      service.streamMessage('sess-1', 'ws-1', 'u-1', {
        content: '지금 뭐 있어?',
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
            {
              id: 'http-1',
              type: 'http_request',
              category: 'integration',
              label: 'Fetch',
              positionX: 500,
              positionY: 300,
              config: { apiKey: 'sk-super-secret', method: 'GET' },
            },
          ],
          edges: [
            {
              id: 'e-1',
              sourceNodeId: 'trig-1',
              sourcePort: 'out',
              targetNodeId: 'http-1',
              targetPort: 'in',
              type: 'data',
            },
          ],
        },
      } as never),
    );

    const toolCall = events.find(
      (e) =>
        e.event === 'tool_call' &&
        (e.data as { name: string }).name === 'get_current_workflow',
    );
    expect(toolCall).toBeDefined();
    const result = (
      toolCall?.data as {
        kind: string;
        result: {
          ok: boolean;
          nodes: Array<{
            id: string;
            type: string;
            label: string;
            category: string;
            position: { x: number; y: number };
            containerId: string | null;
            config: Record<string, unknown>;
          }>;
          edges: Array<{
            id: string;
            source: string;
            sourcePort: string;
            target: string;
            targetPort: string;
            type: 'data' | 'error';
          }>;
        };
      }
    ).result;
    expect((toolCall?.data as { kind: string }).kind).toBe('explore');
    expect(result.ok).toBe(true);
    expect(result.nodes).toHaveLength(2);
    const httpNode = result.nodes.find((n) => n.id === 'http-1');
    expect(httpNode).toMatchObject({
      id: 'http-1',
      type: 'http_request',
      label: 'Fetch',
      category: 'integration',
      position: { x: 500, y: 300 },
      containerId: null,
    });
    // redactConfig가 apiKey를 가려야 한다 — 이 도구는 프롬프트 스냅샷과
    // 동일한 보안 정책을 따른다.
    expect(httpNode?.config.apiKey).toBe('[REDACTED]');
    expect(httpNode?.config.method).toBe('GET');
    // 엣지 전체 필드가 빠짐없이 반환되어 LLM 이 remove_edge(id=...) 로
    // 바로 호출할 수 있어야 한다.
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]).toMatchObject({
      id: 'e-1',
      source: 'trig-1',
      sourcePort: 'out',
      target: 'http-1',
      targetPort: 'in',
      type: 'data',
    });

    // Explore 도구이나 shadow 기반이므로 ExploreToolsService 로 위임되면 안 된다.
    expect(mocks.exploreTools.getWorkflow).not.toHaveBeenCalled();
    expect(mocks.exploreTools.listWorkflows).not.toHaveBeenCalled();

    // kind 도 explore 로 persist 되어야 함 (UI 배지 아이콘 구분 등).
    const assistantCall = mocks.sessionService.appendMessage.mock.calls.find(
      (c) => c[1].role === 'assistant',
    );
    expect(assistantCall).toBeDefined();
    expect(assistantCall![1].toolCalls[0]).toMatchObject({
      name: 'get_current_workflow',
      kind: 'explore',
    });
  });

  it('returns an empty nodes/edges view for get_current_workflow on an empty canvas', async () => {
    const { service, mocks } = makeService();
    mocks.llmService.chatStream.mockImplementation(() =>
      asyncIter<ChatStreamEvent>([
        {
          type: 'tool_call_end',
          id: 'call_inspect',
          name: 'get_current_workflow',
          arguments: '{}',
        },
        {
          type: 'done',
          usage: { inputTokens: 5, outputTokens: 0, totalTokens: 5 },
          model: 'gpt-4o',
          finishReason: 'stop',
        },
      ]),
    );

    const events = await collect(
      service.streamMessage('sess-1', 'ws-1', 'u-1', {
        content: '지금 뭐 있어?',
        currentWorkflow: { nodes: [], edges: [] },
      }),
    );

    const toolCall = events.find(
      (e) =>
        e.event === 'tool_call' &&
        (e.data as { name: string }).name === 'get_current_workflow',
    );
    const result = (
      toolCall?.data as {
        result: { ok: boolean; nodes: unknown[]; edges: unknown[] };
      }
    ).result;
    expect(result).toEqual({ ok: true, nodes: [], edges: [] });
  });

  it('reflects in-turn edits when get_current_workflow is called after add_node', async () => {
    // add_node 로 편집한 결과가 다음 round 의 get_current_workflow 반환에
    // 포함되어야 함 — 같은 ShadowWorkflow 인스턴스를 사용하기 때문.
    const { service, mocks } = makeService();
    const addArgs = JSON.stringify({
      type: 'http_request',
      label: 'NewNode',
      position: { x: 500, y: 300 },
      config: { method: 'GET' },
    });
    // round 1: add_node → tool_calls finish
    mocks.llmService.chatStream.mockImplementationOnce(() =>
      asyncIter<ChatStreamEvent>([
        {
          type: 'tool_call_end',
          id: 'call_add',
          name: 'add_node',
          arguments: addArgs,
        },
        {
          type: 'done',
          usage: { inputTokens: 20, outputTokens: 5, totalTokens: 25 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        },
      ]),
    );
    // round 2: get_current_workflow → stop
    mocks.llmService.chatStream.mockImplementationOnce(() =>
      asyncIter<ChatStreamEvent>([
        {
          type: 'tool_call_end',
          id: 'call_inspect',
          name: 'get_current_workflow',
          arguments: '{}',
        },
        {
          type: 'done',
          usage: { inputTokens: 25, outputTokens: 5, totalTokens: 30 },
          model: 'gpt-4o',
          finishReason: 'stop',
        },
      ]),
    );

    const events = await collect(
      service.streamMessage('sess-1', 'ws-1', 'u-1', baseDto as never),
    );

    const toolCalls = events.filter((e) => e.event === 'tool_call');
    const inspectCall = toolCalls.find(
      (e) => (e.data as { name: string }).name === 'get_current_workflow',
    );
    expect(inspectCall).toBeDefined();
    const nodes = (
      inspectCall?.data as {
        result: { nodes: Array<{ label: string; type: string }> };
      }
    ).result.nodes;
    // 초기 snapshot 의 manual_trigger + 이 turn 에서 add_node 한 NewNode.
    expect(nodes.map((n) => n.label).sort()).toEqual(['NewNode', 'Start']);
    const newNode = nodes.find((n) => n.label === 'NewNode');
    expect(newNode?.type).toBe('http_request');
  });

  it('blocks `finish` when an active plan still has pending steps and continues the loop (PLAN_NOT_COMPLETE)', async () => {
    // 목적: LLM 이 plan 의 일부만 실행하고 `finish` 를 호출해 턴을 조기
    // 종료하면 사용자는 "다 됐다" 고 오판한다. 서버는 이 경우 finish 의
    // tool_result 를 에러로 반환해 루프를 한 번 더 돌려, LLM 이 나머지
    // step 을 채우도록 유도해야 한다.
    const { service, mocks } = makeService();
    // history 에 이미 propose_plan 된 plan 이 approve 된 상태. 이번 턴은
    // execute turn 이라 plan-only guard 가 발동하지 않는다.
    mocks.sessionService.loadMessages.mockResolvedValue([
      { role: 'user', content: '요청', toolCalls: null },
      {
        role: 'assistant',
        content: '',
        toolCalls: [
          {
            id: 'p0',
            name: 'propose_plan',
            arguments: {},
            kind: 'plan',
            result: { ok: true },
          },
        ],
        plan: {
          title: 'Two-step build',
          summary: 'Two edits needed',
          steps: [
            { id: 's1', action: 'add_node', description: 'Add first node' },
            { id: 's2', action: 'add_node', description: 'Add second node' },
          ],
        },
      },
    ]);
    const addA = JSON.stringify({
      type: 'http_request',
      label: 'First',
      position: { x: 500, y: 300 },
      config: {},
      planStepId: 's1',
    });
    const addB = JSON.stringify({
      type: 'http_request',
      label: 'Second',
      position: { x: 750, y: 300 },
      config: {},
      planStepId: 's2',
    });

    // Round 1: 첫 노드만 추가한 뒤 조기 finish 시도 → 서버가 block
    mocks.llmService.chatStream.mockImplementationOnce(() =>
      asyncIter<ChatStreamEvent>([
        {
          type: 'tool_call_end',
          id: 'call_a',
          name: 'add_node',
          arguments: addA,
        },
        {
          type: 'tool_call_end',
          id: 'call_fin_1',
          name: 'finish',
          arguments: '{}',
        },
        {
          type: 'done',
          usage: { inputTokens: 20, outputTokens: 5, totalTokens: 25 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        },
      ]),
    );
    // Round 2: 서버 피드백을 받고 남은 step 수행 → finish 시도 (review guard 가
    // 이어서 발동해 WORKFLOW_REVIEW_REQUIRED 로 재차 block).
    mocks.llmService.chatStream.mockImplementationOnce(() =>
      asyncIter<ChatStreamEvent>([
        {
          type: 'tool_call_end',
          id: 'call_b',
          name: 'add_node',
          arguments: addB,
        },
        {
          type: 'tool_call_end',
          id: 'call_fin_2',
          name: 'finish',
          arguments: '{}',
        },
        {
          type: 'done',
          usage: { inputTokens: 30, outputTokens: 5, totalTokens: 35 },
          model: 'gpt-4o',
          finishReason: 'stop',
        },
      ]),
    );
    // Round 3: review 가 "orphan 노드 있음" 등으로 block 한 뒤, LLM 이
    // 검토 완료 한국어 코멘트와 함께 두 번째 finish 를 호출 → Phase 6 에서는
    // fix 안 했으니 review 다시 fire (round 4 필요).
    mocks.llmService.chatStream.mockImplementationOnce(() =>
      asyncIter<ChatStreamEvent>([
        { type: 'text_delta', delta: '검토 완료.' },
        {
          type: 'tool_call_end',
          id: 'call_fin_3',
          name: 'finish',
          arguments: '{}',
        },
        {
          type: 'done',
          usage: { inputTokens: 10, outputTokens: 3, totalTokens: 13 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        },
      ]),
    );
    // Round 4: reviewRoundCount = 2 도달로 finish 통과.
    mocks.llmService.chatStream.mockImplementationOnce(() =>
      asyncIter<ChatStreamEvent>([
        { type: 'text_delta', delta: '검토 한계.' },
        {
          type: 'tool_call_end',
          id: 'call_fin_4',
          name: 'finish',
          arguments: '{}',
        },
        {
          type: 'done',
          usage: { inputTokens: 8, outputTokens: 3, totalTokens: 11 },
          model: 'gpt-4o',
          finishReason: 'stop',
        },
      ]),
    );

    const events = await collect(
      service.streamMessage('sess-1', 'ws-1', 'u-1', baseDto as never),
    );

    // PLAN_NOT_COMPLETE + WORKFLOW_REVIEW_REQUIRED ×2 (Phase 6 stuck 제거) → 4 라운드.
    expect(mocks.llmService.chatStream).toHaveBeenCalledTimes(4);

    // 두 번째 라운드 messages 에 첫 finish 의 PLAN_NOT_COMPLETE tool_result 가
    // 포함되어 있어야 한다.
    const secondRoundMessages = mocks.llmService.chatStream.mock.calls[1][1]
      .messages as Array<{
      role: string;
      content?: string;
      toolCallId?: string;
    }>;
    const finishResult = secondRoundMessages.find(
      (m) => m.role === 'tool' && m.toolCallId === 'call_fin_1',
    );
    expect(finishResult).toBeDefined();
    const parsed = JSON.parse(finishResult!.content ?? 'null');
    expect(parsed).toMatchObject({
      ok: false,
      error: 'PLAN_NOT_COMPLETE',
    });
    expect(parsed.pendingSteps).toEqual([
      expect.objectContaining({ id: 's2' }),
    ]);

    // 세 번째 라운드에는 call_fin_2 의 WORKFLOW_REVIEW_REQUIRED tool_result 가
    // 실려 있어야 한다 — plan 가드와 review 가드가 독립 계층임을 고정.
    const thirdRoundMessages = mocks.llmService.chatStream.mock.calls[2][1]
      .messages as Array<{
      role: string;
      content?: string;
      toolCallId?: string;
    }>;
    const reviewResult = thirdRoundMessages.find(
      (m) => m.role === 'tool' && m.toolCallId === 'call_fin_2',
    );
    expect(reviewResult).toBeDefined();
    expect(JSON.parse(reviewResult!.content ?? 'null')).toMatchObject({
      ok: false,
      error: 'WORKFLOW_REVIEW_REQUIRED',
    });

    // 최종적으로 정상 종료되어야 한다.
    const done = events[events.length - 1];
    expect(done).toMatchObject({
      event: 'done',
      data: { finishReason: 'stop' },
    });
  });

  it('allows `finish` without plan block when no edits happened in the turn (plan-propose-only turn)', async () => {
    // plan 만 발행하고 edit 없이 finish 하는 턴 (사용자 승인 대기 직전)은
    // 정상 종료되어야 한다 — 그래야 approve 를 기다리는 자연스러운 UX 가
    // 깨지지 않는다.
    const { service, mocks } = makeService();
    const planArgs = JSON.stringify({
      title: 'Plan only',
      summary: '',
      steps: [{ id: 's1', action: 'add_node', description: '…' }],
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
          type: 'tool_call_end',
          id: 'call_fin',
          name: 'finish',
          arguments: '{}',
        },
        {
          type: 'done',
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        },
      ]),
    );

    const events = await collect(
      service.streamMessage('sess-1', 'ws-1', 'u-1', baseDto as never),
    );

    // 단일 라운드로 깔끔히 종료 (block 없음)
    expect(mocks.llmService.chatStream).toHaveBeenCalledTimes(1);
    const done = events[events.length - 1];
    expect(done).toMatchObject({
      event: 'done',
      data: { finishReason: 'stop' },
    });
  });

  it('does not block `finish` twice in a row when no progress is made between attempts (stuck-LLM escape)', async () => {
    // 안전 장치: 같은 턴 안에서 finish 가 block 된 뒤에도 LLM 이 어떤 진척도
    // 만들지 않고 다시 finish 만 호출하면 stuck 으로 간주해 탈출시킨다.
    // 이 제한이 없으면 plan 해석이 어긋날 때 무한 루프 위험. 단, block 후
    // 한 step 이라도 진행했다면 guard 가 다시 발동한다 (별도 테스트 참고).
    // 시나리오: history 의 approved 2-step plan 에서 round 1 에 s1 만 처리한
    // 채 finish → block. round 2 에 LLM 이 아무 진척도 없이 finish → 탈출.
    const { service, mocks } = makeService();
    mocks.sessionService.loadMessages.mockResolvedValue([
      { role: 'user', content: '시작', toolCalls: null },
      {
        role: 'assistant',
        content: '',
        toolCalls: [
          {
            id: 'p0',
            name: 'propose_plan',
            arguments: {},
            kind: 'plan',
            result: { ok: true },
          },
        ],
        plan: {
          title: 'Two steps',
          summary: '',
          steps: [
            { id: 's1', action: 'add_node', description: 'first' },
            { id: 's2', action: 'add_node', description: 'second' },
          ],
          approvedAt: '2026-04-22T00:00:00Z',
        },
      },
    ]);
    const addS1 = JSON.stringify({
      type: 'http_request',
      label: 'First',
      position: { x: 500, y: 300 },
      config: {},
      planStepId: 's1',
    });

    // Round 1: s1 만 + 조기 finish → block (s2 미완)
    mocks.llmService.chatStream.mockImplementationOnce(() =>
      asyncIter<ChatStreamEvent>([
        {
          type: 'tool_call_end',
          id: 'call_a',
          name: 'add_node',
          arguments: addS1,
        },
        {
          type: 'tool_call_end',
          id: 'call_fin_1',
          name: 'finish',
          arguments: '{}',
        },
        {
          type: 'done',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        },
      ]),
    );
    // Round 2: LLM 이 아무것도 안 하고 바로 finish 재호출 → stuck 탈출
    mocks.llmService.chatStream.mockImplementationOnce(() =>
      asyncIter<ChatStreamEvent>([
        {
          type: 'tool_call_end',
          id: 'call_fin_2',
          name: 'finish',
          arguments: '{}',
        },
        {
          type: 'done',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          model: 'gpt-4o',
          finishReason: 'stop',
        },
      ]),
    );

    const events = await collect(
      service.streamMessage('sess-1', 'ws-1', 'u-1', baseDto as never),
    );
    expect(mocks.llmService.chatStream).toHaveBeenCalledTimes(2);
    const done = events[events.length - 1];
    expect(done).toMatchObject({
      event: 'done',
      data: { finishReason: 'stop' },
    });
  });

  it('plan-only turn: finish always succeeds even when LLM mistakenly tries edits that get PLAN_AWAITING_APPROVAL (no auto-retry loop before user approval)', async () => {
    // 사용자 보고: 계획 수립 직후 LLM 이 유저 컨펌 없이 edit 을 시도해 자동
    // 진행하려는 듯 보였다. 같은 턴에 propose_plan 이 발행됐다면 plan 은
    // 미승인 상태이므로 PLAN_AWAITING_APPROVAL 로 edit 들이 거부되는데, 가드가
    // PLAN_NOT_COMPLETE 로 finish 까지 막으면 LLM 이 "남은 step 실행하라" 고
    // 잘못 해석해 edit 재시도 → 또 거부되는 핑퐁이 발생한다. 새 가드는
    // plan-only 턴(planForTurn 미승인) 에서 finish 를 즉시 통과시켜 1라운드
    // 안에 사용자 approve 대기 상태로 진입하게 한다.
    const { service, mocks } = makeService();
    const planArgs = JSON.stringify({
      title: 'Cancel flow',
      summary: '',
      steps: [{ id: 's1', action: 'add_node', description: 'add HTTP' }],
    });
    const earlyAdd = JSON.stringify({
      type: 'http_request',
      label: 'HTTP',
      position: { x: 500, y: 300 },
      config: {},
      planStepId: 's1',
    });
    mocks.llmService.chatStream.mockImplementation(() =>
      asyncIter<ChatStreamEvent>([
        {
          type: 'tool_call_end',
          id: 'call_plan',
          name: 'propose_plan',
          arguments: planArgs,
        },
        // LLM 이 같은 턴에 잘못 add_node 시도 — 서버가 PLAN_AWAITING_APPROVAL
        // 로 거부 후, finish 호출이 즉시 통과해야 한다 (재시도 루프 금지).
        {
          type: 'tool_call_end',
          id: 'call_early_add',
          name: 'add_node',
          arguments: earlyAdd,
        },
        {
          type: 'tool_call_end',
          id: 'call_fin',
          name: 'finish',
          arguments: '{}',
        },
        {
          type: 'done',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        },
      ]),
    );

    const events = await collect(
      service.streamMessage('sess-1', 'ws-1', 'u-1', baseDto as never),
    );

    // 단일 라운드로 종료 — 가드가 plan-only 턴을 인식해 finish 를 통과시킴.
    expect(mocks.llmService.chatStream).toHaveBeenCalledTimes(1);
    const done = events[events.length - 1];
    expect(done).toMatchObject({
      event: 'done',
      data: { finishReason: 'stop' },
    });

    // 부수 검증: 잘못된 add_node 가 PLAN_AWAITING_APPROVAL 로 거부됐어야 함.
    const editToolEvent = events.find(
      (e) => e.event === 'tool_call' && e.data.name === 'add_node',
    );
    expect(editToolEvent).toBeDefined();
    expect(
      (editToolEvent?.data.result as { ok?: boolean; error?: string }).error,
    ).toBe('PLAN_AWAITING_APPROVAL');
  });

  it('keeps blocking `finish` across multiple rounds while LLM is still making progress (3-step plan, partial each round)', async () => {
    // "진행이 중단됐어요…" 자주 노출되던 원인: LLM 이 step 일부만 끝내고
    // finish 를 부르면 서버가 1회 block 후 두 번째 finish 는 그대로 통과시켜
    // 사용자가 직접 "이어서 진행해줘" 를 입력해야 했다. 새 가드는 block 후에도
    // **진척이 있었다면** 재차 block 해 plan 끝까지 끌고 간다.
    // 시나리오: history 에 s1/s2/s3 plan 이 approved 된 상태. 라운드마다 한
    // 노드씩만 추가하면서 finish — 두 번 더 block, 세 라운드째에 stop.
    const { service, mocks } = makeService();
    mocks.sessionService.loadMessages.mockResolvedValue([
      { role: 'user', content: '요청', toolCalls: null },
      {
        role: 'assistant',
        content: '',
        toolCalls: [
          {
            id: 'p0',
            name: 'propose_plan',
            arguments: {},
            kind: 'plan',
            result: { ok: true },
          },
        ],
        plan: {
          title: 'Three-step build',
          summary: '',
          steps: [
            { id: 's1', action: 'add_node', description: 'first' },
            { id: 's2', action: 'add_node', description: 'second' },
            { id: 's3', action: 'add_node', description: 'third' },
          ],
          approvedAt: '2026-04-22T00:00:00Z',
        },
      },
    ]);
    const addStep = (label: string, x: number, planStepId: string) =>
      JSON.stringify({
        type: 'http_request',
        label,
        position: { x, y: 300 },
        config: {},
        planStepId,
      });
    // Round 1: s1 만 + 조기 finish → block (s2, s3 pending)
    mocks.llmService.chatStream.mockImplementationOnce(() =>
      asyncIter<ChatStreamEvent>([
        {
          type: 'tool_call_end',
          id: 'add_s1',
          name: 'add_node',
          arguments: addStep('First', 500, 's1'),
        },
        {
          type: 'tool_call_end',
          id: 'fin_1',
          name: 'finish',
          arguments: '{}',
        },
        {
          type: 'done',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        },
      ]),
    );
    // Round 2: 진척 (s2 추가) + 또 조기 finish → 새 가드는 다시 block
    // (옛 가드라면 그냥 통과해 사용자 hint 노출되던 케이스)
    mocks.llmService.chatStream.mockImplementationOnce(() =>
      asyncIter<ChatStreamEvent>([
        {
          type: 'tool_call_end',
          id: 'add_s2',
          name: 'add_node',
          arguments: addStep('Second', 750, 's2'),
        },
        {
          type: 'tool_call_end',
          id: 'fin_2',
          name: 'finish',
          arguments: '{}',
        },
        {
          type: 'done',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        },
      ]),
    );
    // Round 3: s3 추가 후 finish → plan 완료. review 가드가 orphan 등 감지해 재차 block.
    mocks.llmService.chatStream.mockImplementationOnce(() =>
      asyncIter<ChatStreamEvent>([
        {
          type: 'tool_call_end',
          id: 'add_s3',
          name: 'add_node',
          arguments: addStep('Third', 1000, 's3'),
        },
        {
          type: 'tool_call_end',
          id: 'fin_3',
          name: 'finish',
          arguments: '{}',
        },
        {
          type: 'done',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          model: 'gpt-4o',
          finishReason: 'stop',
        },
      ]),
    );
    // Round 4: 검토 완료 멘트 후 네 번째 finish → Phase 6 stuck 제거로 review
    // 가 다시 fire (round 5 필요).
    mocks.llmService.chatStream.mockImplementationOnce(() =>
      asyncIter<ChatStreamEvent>([
        { type: 'text_delta', delta: '검토 완료.' },
        {
          type: 'tool_call_end',
          id: 'fin_4',
          name: 'finish',
          arguments: '{}',
        },
        {
          type: 'done',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        },
      ]),
    );
    // Round 5: reviewRoundCount = 2 도달로 finish 통과.
    mocks.llmService.chatStream.mockImplementationOnce(() =>
      asyncIter<ChatStreamEvent>([
        { type: 'text_delta', delta: '검토 한계.' },
        {
          type: 'tool_call_end',
          id: 'fin_5',
          name: 'finish',
          arguments: '{}',
        },
        {
          type: 'done',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          model: 'gpt-4o',
          finishReason: 'stop',
        },
      ]),
    );

    const events = await collect(
      service.streamMessage('sess-1', 'ws-1', 'u-1', baseDto as never),
    );

    // 5 라운드 — PLAN_NOT_COMPLETE × 2 (fin_1, fin_2) + WORKFLOW_REVIEW_REQUIRED × 2 (fin_3, fin_4) + 정상 finish (fin_5).
    expect(mocks.llmService.chatStream).toHaveBeenCalledTimes(5);

    // Round 2 messages: round 1 의 fin_1 이 PLAN_NOT_COMPLETE 로 결과 통보됨
    const round2Messages = mocks.llmService.chatStream.mock.calls[1][1]
      .messages as Array<{
      role: string;
      toolCallId?: string;
      content?: string;
    }>;
    const fin1Result = round2Messages.find(
      (m) => m.role === 'tool' && m.toolCallId === 'fin_1',
    );
    expect(fin1Result).toBeDefined();
    expect(JSON.parse(fin1Result!.content ?? 'null')).toMatchObject({
      ok: false,
      error: 'PLAN_NOT_COMPLETE',
    });

    // Round 3 messages: round 2 의 fin_2 도 똑같이 block 되었어야 한다.
    const round3Messages = mocks.llmService.chatStream.mock.calls[2][1]
      .messages as Array<{
      role: string;
      toolCallId?: string;
      content?: string;
    }>;
    const fin2Result = round3Messages.find(
      (m) => m.role === 'tool' && m.toolCallId === 'fin_2',
    );
    expect(fin2Result).toBeDefined();
    expect(JSON.parse(fin2Result!.content ?? 'null')).toMatchObject({
      ok: false,
      error: 'PLAN_NOT_COMPLETE',
    });

    const done = events[events.length - 1];
    expect(done).toMatchObject({
      event: 'done',
      data: { finishReason: 'stop' },
    });
  });

  it('does NOT treat a turn whose edits all failed (ok:false) as an "execution turn" — finish goes through immediately without a block', async () => {
    // 회귀 가드: ok:false 인 edit (e.g. LABEL_CONFLICT) 은 canvas 를 바꾸지
    // 못하므로 가드 입장에서는 "이번 턴에 실행 발생" 으로 간주하면 안 된다.
    // 잘못 카운트하면 finish 가 막혀 LLM 이 같은 실패를 반복하는 핑퐁 발생.
    // 가드는 실패 edit 만 있는 턴은 활성화 자체를 건너뛰고 finish 를 즉시
    // 통과시켜야 한다.
    const { service, mocks } = makeService();
    mocks.sessionService.loadMessages.mockResolvedValue([
      { role: 'user', content: '요청', toolCalls: null },
      {
        role: 'assistant',
        content: '',
        toolCalls: [
          {
            id: 'p0',
            name: 'propose_plan',
            arguments: {},
            kind: 'plan',
            result: { ok: true },
          },
        ],
        plan: {
          title: 'Conflict plan',
          summary: '',
          steps: [{ id: 's1', action: 'add_node', description: 'add Start' }],
          approvedAt: '2026-04-22T00:00:00Z',
        },
      },
    ]);
    // 의도적으로 Start (이미 존재하는 manual_trigger 의 label) 와 충돌 →
    // shadow 가 LABEL_CONFLICT 를 반환하도록.
    const conflictingAdd = JSON.stringify({
      type: 'http_request',
      label: 'Start',
      position: { x: 500, y: 300 },
      config: {},
      planStepId: 's1',
    });

    mocks.llmService.chatStream.mockImplementation(() =>
      asyncIter<ChatStreamEvent>([
        {
          type: 'tool_call_end',
          id: 'add_1',
          name: 'add_node',
          arguments: conflictingAdd,
        },
        {
          type: 'tool_call_end',
          id: 'fin_1',
          name: 'finish',
          arguments: '{}',
        },
        {
          type: 'done',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        },
      ]),
    );

    const events = await collect(
      service.streamMessage('sess-1', 'ws-1', 'u-1', baseDto as never),
    );

    // 단일 라운드 — 가드가 "실행 발생 없음" 으로 인식해 finish 즉시 통과.
    expect(mocks.llmService.chatStream).toHaveBeenCalledTimes(1);
    const done = events[events.length - 1];
    expect(done).toMatchObject({
      event: 'done',
      data: { finishReason: 'stop' },
    });

    // 부수 검증: add_node 가 LABEL_CONFLICT 로 거부됐어야 한다.
    const addEvent = events.find(
      (e) => e.event === 'tool_call' && e.data.name === 'add_node',
    );
    expect(addEvent).toBeDefined();
    expect(
      (addEvent?.data.result as { ok?: boolean; error?: string }).error,
    ).toBe('LABEL_CONFLICT');
  });

  it('counts a successful `propose_plan` as progress, re-arming the finish guard for another block round', async () => {
    // Plan tool 도 미완 step 을 줄일 수 있는 진척이다 (예: 불필요해진 step 을
    // note 로 표시한 새 plan). guard 가 propose_plan 성공을 진척으로 인식하지
    // 못하면 LLM 이 plan 을 다듬은 뒤에도 stuck 으로 즉시 탈출되어 plan
    // 갱신 의도가 깨진다.
    const { service, mocks } = makeService();
    mocks.sessionService.loadMessages.mockResolvedValue([
      { role: 'user', content: '시작', toolCalls: null },
      {
        role: 'assistant',
        content: '',
        toolCalls: [
          {
            id: 'p0',
            name: 'propose_plan',
            arguments: {},
            kind: 'plan',
            result: { ok: true },
          },
        ],
        plan: {
          title: 'Pre-revision plan',
          summary: '',
          steps: [
            { id: 's1', action: 'add_node', description: 'first' },
            { id: 's2', action: 'add_node', description: 'second' },
          ],
          approvedAt: '2026-04-22T00:00:00Z',
        },
      },
    ]);
    const addS1 = JSON.stringify({
      type: 'http_request',
      label: 'First',
      position: { x: 500, y: 300 },
      config: {},
      planStepId: 's1',
    });
    // Round 1: s1 만 + finish → block (s2 pending)
    mocks.llmService.chatStream.mockImplementationOnce(() =>
      asyncIter<ChatStreamEvent>([
        {
          type: 'tool_call_end',
          id: 'add_s1',
          name: 'add_node',
          arguments: addS1,
        },
        {
          type: 'tool_call_end',
          id: 'fin_1',
          name: 'finish',
          arguments: '{}',
        },
        {
          type: 'done',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        },
      ]),
    );
    // Round 2: s2 를 note 로 바꾼 새 propose_plan + finish — propose_plan 이
    // 진척으로 카운트되면 가드가 재발동, 그러나 새 plan 의 actionable step
    // 은 모두 done(s1) 이므로 finish 가 정상 통과해야 한다.
    const revisedPlan = JSON.stringify({
      title: 'Revised',
      summary: 's2 was unnecessary',
      steps: [
        { id: 's1', action: 'add_node', description: 'first' },
        { id: 's2', action: 'note', description: 'no longer needed' },
      ],
    });
    mocks.llmService.chatStream.mockImplementationOnce(() =>
      asyncIter<ChatStreamEvent>([
        {
          type: 'tool_call_end',
          id: 'replan',
          name: 'propose_plan',
          arguments: revisedPlan,
        },
        {
          type: 'tool_call_end',
          id: 'fin_2',
          name: 'finish',
          arguments: '{}',
        },
        {
          type: 'done',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          model: 'gpt-4o',
          finishReason: 'stop',
        },
      ]),
    );

    const events = await collect(
      service.streamMessage('sess-1', 'ws-1', 'u-1', baseDto as never),
    );
    expect(mocks.llmService.chatStream).toHaveBeenCalledTimes(2);
    // 새 plan 이 SSE plan 이벤트로 발행되었어야 — propose_plan 이 round 2 에서
    // 정상 처리됐음을 확인 (단순 stuck 탈출이 아님).
    const round2PlanEvent = events.find(
      (e) => e.event === 'plan' && e.data.title === 'Revised',
    );
    expect(round2PlanEvent).toBeDefined();
    const done = events[events.length - 1];
    expect(done).toMatchObject({
      event: 'done',
      data: { finishReason: 'stop' },
    });
  });

  it('blocks `finish` when openQuestions remain even after all edit steps are done', async () => {
    // pending step 이 0 이어도 openQuestions 가 남아있으면 사용자에게 답을
    // 받아야 하므로 finish 를 block 해야 한다. (spec §4.3)
    const { service, mocks } = makeService();
    // Plan 은 history 에 이미 approved 된 상태로 준비 — 이번 턴은 execute turn.
    mocks.sessionService.loadMessages.mockResolvedValue([
      { role: 'user', content: '시작', toolCalls: null },
      {
        role: 'assistant',
        content: '',
        toolCalls: [
          {
            id: 'p0',
            name: 'propose_plan',
            arguments: {},
            kind: 'plan',
            result: { ok: true },
          },
        ],
        plan: {
          title: 'Ask first',
          summary: '',
          steps: [
            { id: 's1', action: 'add_node', description: 'the only step' },
          ],
          openQuestions: ['Which provider should we integrate with?'],
        },
      },
    ]);
    const addA = JSON.stringify({
      type: 'http_request',
      label: 'Only',
      position: { x: 500, y: 300 },
      config: {},
      planStepId: 's1',
    });
    mocks.llmService.chatStream.mockImplementationOnce(() =>
      asyncIter<ChatStreamEvent>([
        {
          type: 'tool_call_end',
          id: 'call_a',
          name: 'add_node',
          arguments: addA,
        },
        {
          type: 'tool_call_end',
          id: 'call_fin_1',
          name: 'finish',
          arguments: '{}',
        },
        {
          type: 'done',
          usage: { inputTokens: 20, outputTokens: 5, totalTokens: 25 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        },
      ]),
    );
    mocks.llmService.chatStream.mockImplementationOnce(() =>
      asyncIter<ChatStreamEvent>([
        { type: 'text_delta', delta: '어떤 Provider 로 연결할까요?' },
        {
          type: 'tool_call_end',
          id: 'call_fin_2',
          name: 'finish',
          arguments: '{}',
        },
        {
          type: 'done',
          usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
          model: 'gpt-4o',
          finishReason: 'stop',
        },
      ]),
    );

    await collect(
      service.streamMessage('sess-1', 'ws-1', 'u-1', baseDto as never),
    );

    expect(mocks.llmService.chatStream).toHaveBeenCalledTimes(2);
    const secondRoundMessages = mocks.llmService.chatStream.mock.calls[1][1]
      .messages as Array<{
      role: string;
      toolCallId?: string;
      content?: string;
    }>;
    const finishResult = secondRoundMessages.find(
      (m) => m.role === 'tool' && m.toolCallId === 'call_fin_1',
    );
    const parsed = JSON.parse(finishResult!.content ?? 'null');
    expect(parsed).toMatchObject({
      ok: false,
      error: 'PLAN_NOT_COMPLETE',
    });
    expect(parsed.pendingSteps).toEqual([]);
    expect(parsed.openQuestions).toEqual([
      'Which provider should we integrate with?',
    ]);
  });

  it('does not count `note`-action plan steps as pending', async () => {
    // note 는 설명 항목이라 대응 edit tool 호출이 없다. pending 으로 남기면
    // 영원히 block → LLM 이 불필요한 도구 호출을 시도한다.
    const { service, mocks } = makeService();
    mocks.sessionService.loadMessages.mockResolvedValue([
      { role: 'user', content: '시작', toolCalls: null },
      {
        role: 'assistant',
        content: '',
        toolCalls: [
          {
            id: 'p0',
            name: 'propose_plan',
            arguments: {},
            kind: 'plan',
            result: { ok: true },
          },
        ],
        plan: {
          title: 'Note + do',
          summary: '',
          steps: [
            { id: 's_note', action: 'note', description: 'reminder only' },
            { id: 's_do', action: 'add_node', description: 'real edit' },
          ],
        },
      },
    ]);
    const addDo = JSON.stringify({
      type: 'http_request',
      label: 'Doer',
      position: { x: 500, y: 300 },
      config: {},
      planStepId: 's_do',
    });
    mocks.llmService.chatStream.mockImplementation(() =>
      asyncIter<ChatStreamEvent>([
        {
          type: 'tool_call_end',
          id: 'call_do',
          name: 'add_node',
          arguments: addDo,
        },
        {
          type: 'tool_call_end',
          id: 'call_fin',
          name: 'finish',
          arguments: '{}',
        },
        {
          type: 'done',
          usage: { inputTokens: 20, outputTokens: 5, totalTokens: 25 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        },
      ]),
    );

    const events = await collect(
      service.streamMessage('sess-1', 'ws-1', 'u-1', baseDto as never),
    );

    // 단일 round 로 종료되어야 한다 (note 는 pending 이 아니므로 block 없음).
    expect(mocks.llmService.chatStream).toHaveBeenCalledTimes(1);
    const done = events[events.length - 1];
    expect(done).toMatchObject({
      event: 'done',
      data: { finishReason: 'stop' },
    });
  });

  it('ignores an unrelated history plan — single-edit turn with no matching planStepId passes finish', async () => {
    // 과거 미완성 plan 이 history 에 남아있더라도, 이번 turn 의 edit 이
    // 그 plan 과 무관하다면 (planStepId 매칭 없음) guard 는 발동하지 않아야
    // 한다. 그렇지 않으면 단발성 사용자 요청이 영원히 막힌다.
    const { service, mocks } = makeService();
    mocks.sessionService.loadMessages.mockResolvedValue([
      { role: 'user', content: '전에 시작한 플랜', toolCalls: null },
      {
        role: 'assistant',
        content: '플랜 제시',
        toolCalls: [
          {
            id: 'prev_plan',
            name: 'propose_plan',
            arguments: {},
            kind: 'plan',
            result: { ok: true, planId: 'p1' },
          },
        ],
        plan: {
          title: 'old plan',
          summary: '',
          steps: [
            { id: 'old_s1', action: 'add_node', description: 'never done' },
          ],
        },
      },
    ]);

    const addUnrelated = JSON.stringify({
      type: 'http_request',
      label: 'Unrelated',
      position: { x: 500, y: 300 },
      config: {},
      // planStepId 를 의도적으로 생략 — plan 과 무관한 단발 편집
    });
    mocks.llmService.chatStream.mockImplementation(() =>
      asyncIter<ChatStreamEvent>([
        {
          type: 'tool_call_end',
          id: 'call_a',
          name: 'add_node',
          arguments: addUnrelated,
        },
        {
          type: 'tool_call_end',
          id: 'call_fin',
          name: 'finish',
          arguments: '{}',
        },
        {
          type: 'done',
          usage: { inputTokens: 20, outputTokens: 5, totalTokens: 25 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        },
      ]),
    );

    await collect(
      service.streamMessage('sess-1', 'ws-1', 'u-1', baseDto as never),
    );
    // block 없이 단일 round 에 끝난다.
    expect(mocks.llmService.chatStream).toHaveBeenCalledTimes(1);
  });

  it('applies guard when current turn edit is linked to a history plan (planStepId matches)', async () => {
    // 승인 턴에서는 propose_plan 이 없어도 이전 turn 의 plan step 을 채우는
    // edit 이 들어오므로, 그 경우 guard 가 활성화되어 pending step 을 감지해야 한다.
    const { service, mocks } = makeService();
    mocks.sessionService.loadMessages.mockResolvedValue([
      { role: 'user', content: '시작해줘', toolCalls: null },
      {
        role: 'assistant',
        content: '',
        toolCalls: [
          {
            id: 'prev_plan',
            name: 'propose_plan',
            arguments: {},
            kind: 'plan',
            result: { ok: true, planId: 'p1' },
          },
        ],
        plan: {
          title: 'two-step',
          summary: '',
          steps: [
            { id: 'ps1', action: 'add_node', description: 'node A' },
            { id: 'ps2', action: 'add_node', description: 'node B' },
          ],
        },
      },
    ]);

    const addA = JSON.stringify({
      type: 'http_request',
      label: 'A',
      position: { x: 500, y: 300 },
      config: {},
      planStepId: 'ps1',
    });
    const addB = JSON.stringify({
      type: 'http_request',
      label: 'B',
      position: { x: 700, y: 300 },
      config: {},
      planStepId: 'ps2',
    });
    // Round 1: step ps1 만 하고 finish — block 되어야
    mocks.llmService.chatStream.mockImplementationOnce(() =>
      asyncIter<ChatStreamEvent>([
        {
          type: 'tool_call_end',
          id: 'call_a',
          name: 'add_node',
          arguments: addA,
        },
        {
          type: 'tool_call_end',
          id: 'call_fin_1',
          name: 'finish',
          arguments: '{}',
        },
        {
          type: 'done',
          usage: { inputTokens: 20, outputTokens: 5, totalTokens: 25 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        },
      ]),
    );
    // Round 2: ps2 수행 후 finish — review 가드가 orphan 등으로 재차 block.
    mocks.llmService.chatStream.mockImplementationOnce(() =>
      asyncIter<ChatStreamEvent>([
        {
          type: 'tool_call_end',
          id: 'call_b',
          name: 'add_node',
          arguments: addB,
        },
        {
          type: 'tool_call_end',
          id: 'call_fin_2',
          name: 'finish',
          arguments: '{}',
        },
        {
          type: 'done',
          usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
          model: 'gpt-4o',
          finishReason: 'stop',
        },
      ]),
    );
    // Round 3: 검토 완료 멘트 후 세 번째 finish — Phase 6 stuck 제거로 review
    // 가 다시 fire (round 4 필요).
    mocks.llmService.chatStream.mockImplementationOnce(() =>
      asyncIter<ChatStreamEvent>([
        { type: 'text_delta', delta: '검토 완료.' },
        {
          type: 'tool_call_end',
          id: 'call_fin_3',
          name: 'finish',
          arguments: '{}',
        },
        {
          type: 'done',
          usage: { inputTokens: 5, outputTokens: 3, totalTokens: 8 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        },
      ]),
    );
    // Round 4: 상한 도달로 통과.
    mocks.llmService.chatStream.mockImplementationOnce(() =>
      asyncIter<ChatStreamEvent>([
        { type: 'text_delta', delta: '검토 한계.' },
        {
          type: 'tool_call_end',
          id: 'call_fin_4',
          name: 'finish',
          arguments: '{}',
        },
        {
          type: 'done',
          usage: { inputTokens: 5, outputTokens: 3, totalTokens: 8 },
          model: 'gpt-4o',
          finishReason: 'stop',
        },
      ]),
    );

    await collect(
      service.streamMessage('sess-1', 'ws-1', 'u-1', baseDto as never),
    );
    expect(mocks.llmService.chatStream).toHaveBeenCalledTimes(4);
    // Round 2 에 전달된 finish 의 첫번째 결과가 PLAN_NOT_COMPLETE 여야 한다.
    const secondRoundMessages = mocks.llmService.chatStream.mock.calls[1][1]
      .messages as Array<{
      role: string;
      toolCallId?: string;
      content?: string;
    }>;
    const finishBlockedResult = secondRoundMessages.find(
      (m) => m.role === 'tool' && m.toolCallId === 'call_fin_1',
    );
    const parsed = JSON.parse(finishBlockedResult!.content ?? 'null');
    expect(parsed.error).toBe('PLAN_NOT_COMPLETE');
    expect(parsed.pendingSteps).toEqual([
      expect.objectContaining({ id: 'ps2' }),
    ]);
  });

  it('persists the successful finish tool_call in history and keeps round-1 usage', async () => {
    // 성공 finish 가 assistant row 의 toolCalls 에 기록되어야 다음 세션이
    // rehydrate 될 때 plan 이 이미 완료된 상태임을 인식한다. 또한 finish
    // 처리 후에도 같은 라운드의 done/usage 이벤트를 drain 해야 한다.
    const { service, mocks } = makeService();
    mocks.llmService.chatStream.mockImplementation(() =>
      asyncIter<ChatStreamEvent>([
        { type: 'text_delta', delta: 'done' },
        {
          type: 'tool_call_end',
          id: 'call_fin',
          name: 'finish',
          arguments: '{"summary":"all good"}',
        },
        {
          type: 'done',
          usage: { inputTokens: 11, outputTokens: 7, totalTokens: 18 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        },
      ]),
    );

    const events = await collect(
      service.streamMessage('sess-1', 'ws-1', 'u-1', baseDto as never),
    );

    // finish 이후에도 usage 이벤트가 SSE 로 전달되어야 한다.
    const usage = events.find((e) => e.event === 'usage');
    expect(usage).toBeDefined();
    expect((usage!.data as { inputTokens: number }).inputTokens).toBe(11);

    const assistantCall = mocks.sessionService.appendMessage.mock.calls.find(
      (c) => c[1].role === 'assistant',
    );
    const toolCalls = assistantCall![1].toolCalls as Array<{
      name: string;
      kind: string;
    }>;
    expect(
      toolCalls.some((tc) => tc.name === 'finish' && tc.kind === 'finish'),
    ).toBe(true);
  });

  it('allows `finish` after `clear_plan` even when the active plan has pending steps', async () => {
    // 사용자가 화제를 바꿔 clear_plan 을 부른 뒤의 finish 는 pending step 과
    // 무관하게 정상 종료되어야 한다.
    const { service, mocks } = makeService();
    // history 에 미완 plan 남아있음
    mocks.sessionService.loadMessages.mockResolvedValue([
      { role: 'user', content: '이전 요청', toolCalls: null },
      {
        role: 'assistant',
        content: '',
        toolCalls: [
          {
            id: 'p1',
            name: 'propose_plan',
            arguments: {},
            kind: 'plan',
            result: { ok: true },
          },
        ],
        plan: {
          title: 'old',
          summary: '',
          steps: [
            { id: 'old_s1', action: 'add_node', description: 'never done' },
            { id: 'old_s2', action: 'add_node', description: 'never done' },
          ],
        },
      },
    ]);
    mocks.llmService.chatStream.mockImplementation(() =>
      asyncIter<ChatStreamEvent>([
        {
          type: 'tool_call_end',
          id: 'call_clear',
          name: 'clear_plan',
          arguments: '{"reason":"user changed topic"}',
        },
        {
          type: 'tool_call_end',
          id: 'call_add',
          name: 'add_node',
          arguments: JSON.stringify({
            type: 'http_request',
            label: 'Unrelated',
            position: { x: 500, y: 300 },
            config: {},
          }),
        },
        {
          type: 'tool_call_end',
          id: 'call_fin',
          name: 'finish',
          arguments: '{}',
        },
        {
          type: 'done',
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        },
      ]),
    );

    const events = await collect(
      service.streamMessage('sess-1', 'ws-1', 'u-1', {
        ...baseDto,
        content: '이제 다른 작업 하자',
      }),
    );
    // clear_plan 을 거쳤으므로 PLAN_NOT_COMPLETE block 없이 단일 round 종료.
    expect(mocks.llmService.chatStream).toHaveBeenCalledTimes(1);
    const done = events[events.length - 1];
    expect(done).toMatchObject({
      event: 'done',
      data: { finishReason: 'stop' },
    });
  });

  it('injects the Active plan context section into the system prompt when a prior plan is still active', async () => {
    // 프롬프트에 사용자의 원 요청과 step 체크박스가 들어가는지 검증.
    const { service, mocks } = makeService();
    mocks.sessionService.loadMessages.mockResolvedValue([
      { role: 'user', content: '주문 취소 프로세스 추가해줘', toolCalls: null },
      {
        role: 'assistant',
        content: '',
        toolCalls: [
          {
            id: 'p1',
            name: 'propose_plan',
            arguments: {},
            kind: 'plan',
            result: { ok: true },
          },
        ],
        plan: {
          title: '주문 취소 플로우',
          summary: 'HTTP → If/Else',
          steps: [
            { id: 's1', action: 'add_node', description: 'HTTP 노드 추가' },
            { id: 's2', action: 'add_node', description: 'If/Else 노드 추가' },
          ],
        },
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
        content: '계속',
      }),
    );

    const systemMsg = mocks.llmService.chatStream.mock.calls[0][1].messages[0];
    expect(systemMsg.role).toBe('system');
    expect(systemMsg.content).toMatch(/## Active plan context/);
    expect(systemMsg.content).toMatch(
      /<user-request>주문 취소 프로세스 추가해줘<\/user-request>/,
    );
    expect(systemMsg.content).toMatch(/\[ \] s1 · add_node/);
    expect(systemMsg.content).toMatch(/\[ \] s2 · add_node/);
  });

  it('clear_plan does not emit a tool_call SSE event (UI badges stay silent)', async () => {
    // clear_plan 은 채팅 UI 에 배지로 노출되지 않는다. plan 카드는 다음 턴의
    // 부재로 자연스럽게 해제된 것으로 인지된다.
    const { service, mocks } = makeService();
    mocks.llmService.chatStream.mockImplementation(() =>
      asyncIter<ChatStreamEvent>([
        {
          type: 'tool_call_end',
          id: 'call_clear',
          name: 'clear_plan',
          arguments: '{"reason":"done with this topic"}',
        },
        {
          type: 'done',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        },
      ]),
    );
    const events = await collect(
      service.streamMessage('sess-1', 'ws-1', 'u-1', {
        ...baseDto,
        content: '이제 다른 거 하자',
      }),
    );
    const toolCallEvents = events.filter((e) => e.event === 'tool_call');
    expect(
      toolCallEvents.find(
        (e) => (e.data as { name: string }).name === 'clear_plan',
      ),
    ).toBeUndefined();
  });

  it('forwards planStepIds (array) alongside the single planStepId on edit tool_call events', async () => {
    const { service, mocks } = makeService();
    const addArgs = JSON.stringify({
      type: 'http_request',
      label: 'Merged',
      position: { x: 500, y: 300 },
      config: {},
      planStepIds: ['s1', 's3'],
    });
    mocks.llmService.chatStream.mockImplementation(() =>
      asyncIter<ChatStreamEvent>([
        {
          type: 'tool_call_end',
          id: 'call_add',
          name: 'add_node',
          arguments: addArgs,
        },
        {
          type: 'done',
          usage: { inputTokens: 5, outputTokens: 2, totalTokens: 7 },
          model: 'gpt-4o',
          finishReason: 'stop',
        },
      ]),
    );
    const events = await collect(
      service.streamMessage('sess-1', 'ws-1', 'u-1', baseDto as never),
    );
    const toolCall = events.find(
      (e) =>
        e.event === 'tool_call' &&
        (e.data as { name: string }).name === 'add_node',
    );
    expect(toolCall).toBeDefined();
    const data = toolCall!.data as {
      planStepId?: string;
      planStepIds?: string[];
    };
    expect(data.planStepIds).toEqual(['s1', 's3']);

    // Persist 된 assistant row 의 toolCalls 에도 배열이 포함되어야 한다
    // (다음 세션 rehydrate 시 step 체크에 사용).
    const assistantCall = mocks.sessionService.appendMessage.mock.calls.find(
      (c) => c[1].role === 'assistant',
    );
    const toolCalls = assistantCall![1].toolCalls as Array<{
      name: string;
      planStepId?: string;
      planStepIds?: string[];
    }>;
    const persistedAdd = toolCalls.find((tc) => tc.name === 'add_node');
    expect(persistedAdd?.planStepIds).toEqual(['s1', 's3']);
  });

  it('expands the per-turn tool-call budget when a large plan is proposed in the same turn', async () => {
    // 15-step plan 은 computeToolCallsBudget → 15*3+8 = 53 로 확장된다.
    // 이전 고정값(32) 기준이었다면 propose + 15 add_node + 15 add_edge ≈ 31
    // 에서 아슬아슬하지만, 중간에 get_node_schema 같은 탐색이 섞이면 32 를
    // 쉽게 넘는다. 이 테스트는 50-회 tool_call 을 순차 실행한 뒤에도 error
    // 이벤트가 발행되지 않아야 함을 보장한다.
    const { service, mocks } = makeService();
    const bigPlanSteps = Array.from({ length: 15 }, (_, i) => ({
      id: `s${i}`,
      action: 'add_node' as const,
      description: `step ${i}`,
    }));
    const events: ChatStreamEvent[] = [
      {
        type: 'tool_call_end',
        id: 'call_plan',
        name: 'propose_plan',
        arguments: JSON.stringify({
          title: 'Big',
          summary: '',
          steps: bigPlanSteps,
        }),
      },
    ];
    // 이후 40 건의 add_node 호출 (15 step 을 초과해 pending 이 남아도 budget
    // 초과 에러는 나지 않아야 함 — 완료 guard 는 별도).
    for (let i = 0; i < 40; i++) {
      events.push({
        type: 'tool_call_end',
        id: `call_${i}`,
        name: 'add_node',
        arguments: JSON.stringify({
          type: 'http_request',
          label: `N${i}`,
          position: { x: 500 + i * 10, y: 300 },
          config: {},
          planStepId: i < 15 ? `s${i}` : undefined,
        }),
      });
    }
    events.push({
      type: 'done',
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      model: 'gpt-4o',
      finishReason: 'stop',
    });

    mocks.llmService.chatStream.mockImplementation(() => asyncIter(events));

    const out = await collect(
      service.streamMessage('sess-1', 'ws-1', 'u-1', baseDto as never),
    );
    const errEvent = out.find((e) => e.event === 'error');
    expect(errEvent).toBeUndefined();
  });

  it('still blocks runaway loops when the total tool-call count exceeds the hard cap', async () => {
    // plan 이 없는 턴이라 budget=DEFAULT(48). 50 회 호출하면 상한을 넘어
    // ASSISTANT_TOO_MANY_TOOL_CALLS 로 탈출되어야 한다.
    const { service, mocks } = makeService();
    const runaway: ChatStreamEvent[] = Array.from({ length: 50 }, (_, i) => ({
      type: 'tool_call_end' as const,
      id: `call_${i}`,
      name: 'get_current_workflow',
      arguments: '{}',
    }));
    runaway.push({
      type: 'done',
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      model: 'gpt-4o',
      finishReason: 'stop',
    });
    mocks.llmService.chatStream.mockImplementation(() => asyncIter(runaway));

    const out = await collect(
      service.streamMessage('sess-1', 'ws-1', 'u-1', baseDto as never),
    );
    const errEvent = out.find((e) => e.event === 'error');
    expect(errEvent).toBeDefined();
    expect((errEvent!.data as { code: string }).code).toBe(
      'ASSISTANT_TOO_MANY_TOOL_CALLS',
    );
    // 재시도 안내 문구가 포함되어야 함 (UX 친절화).
    expect((errEvent!.data as { message: string }).message).toMatch(
      /follow-up message|budget/i,
    );
  });

  it('forwards optional width/height from the request snapshot into the system prompt JSON', async () => {
    // React Flow 측정값이 DTO 로 전달되면 시스템 프롬프트의 Current workflow
    // snapshot JSON 에도 그대로 포함되어 LLM 이 실제 노드 폭을 기준으로
    // 레이아웃할 수 있다.
    const { service, mocks } = makeService();
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
        content: '측정된 노드',
        currentWorkflow: {
          nodes: [
            {
              id: 'trig-1',
              type: 'manual_trigger',
              category: 'trigger',
              label: 'Start',
              positionX: 100,
              positionY: 200,
              width: 240,
              height: 60,
              config: {},
            },
          ],
          edges: [],
        },
      }),
    );
    const systemPrompt = (
      mocks.llmService.chatStream.mock.calls[0][1].messages[0] as {
        content: string;
      }
    ).content;
    // JSON 블록 안에 width/height 가 들어 있어야 함.
    expect(systemPrompt).toMatch(/"width":\s*240/);
    expect(systemPrompt).toMatch(/"height":\s*60/);
  });

  it('omits width/height from the system prompt when the snapshot does not measure them', async () => {
    // measured 가 아직 붙지 않은 노드(초기 렌더) 는 프롬프트 JSON 에도
    // 필드가 아예 나타나지 않아 "null" 로 자리를 차지하지 않는다.
    const { service, mocks } = makeService();
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
      service.streamMessage('sess-1', 'ws-1', 'u-1', baseDto as never),
    );
    const systemPrompt = (
      mocks.llmService.chatStream.mock.calls[0][1].messages[0] as {
        content: string;
      }
    ).content;
    // baseDto 는 width/height 를 주지 않음 → 어디에도 등장하지 않아야.
    expect(systemPrompt).not.toMatch(/"width":/);
    expect(systemPrompt).not.toMatch(/"height":/);
  });

  it('rejects edit tools with PLAN_AWAITING_APPROVAL when called in the same turn as propose_plan', async () => {
    // LLM 이 propose_plan 직후 같은 턴에 add_node 를 호출하면 서버가
    // 거부한다. UX 의 "계획 제시 → 사용자 승인 → 실행" 3단계 강제.
    const { service, mocks } = makeService();
    const planArgs = JSON.stringify({
      title: 'Build',
      summary: '',
      steps: [{ id: 's1', action: 'add_node', description: 'step 1' }],
    });
    const addArgs = JSON.stringify({
      type: 'http_request',
      label: 'Premature',
      position: { x: 500, y: 300 },
      config: {},
      planStepId: 's1',
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
          type: 'tool_call_end',
          id: 'call_add',
          name: 'add_node',
          arguments: addArgs,
        },
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
    const editEvent = events.find(
      (e) =>
        e.event === 'tool_call' &&
        (e.data as { name: string }).name === 'add_node',
    );
    const result = (
      editEvent!.data as { result: { ok: boolean; error?: string } }
    ).result;
    expect(result.ok).toBe(false);
    expect(result.error).toBe('PLAN_AWAITING_APPROVAL');
  });

  it('does NOT round-trip when a plan was proposed and is pending approval, even if the provider reports finishReason=tool_calls (gemini-3-flash-preview pattern)', async () => {
    // 사용자 보고 (2026-04-23): gemini-3-flash-preview 가 propose_plan 직후
    // 같은 턴에 다수의 edit 을 발사하고 `finish` 는 호출하지 않은 채 stream 이
    // 끝난다. 프로바이더가 finishReason='tool_calls' 로 종료하면 서버는
    // round-trip 해 Round 2 에서 LLM 에 PAA feedback 을 주는데, LLM 은 이걸
    // 무시하고 또 edit 을 시도 → 핑퐁 루프 → MAX_TOOL_LOOP_ROUNDS 도달 후
    // "진행이 중단됐어요" 에러. UI 에는 빨간 배지가 수십 개 뜬다.
    //
    // 새 규칙: propose_plan 이 발행됐고 아직 미승인이면, 같은 턴 내 round-trip
    // 을 강제로 중단한다. 사용자가 approve 하기 전에는 edit 진행이 의미 없다.
    const { service, mocks } = makeService();
    const planArgs = JSON.stringify({
      title: 'Survey',
      summary: '',
      steps: [
        { id: 's1', action: 'add_node', description: 'type carousel' },
        { id: 's2', action: 'add_edge', description: 'connect trigger' },
      ],
    });
    const addArgs = (label: string) =>
      JSON.stringify({
        type: 'carousel',
        label,
        position: { x: 500, y: 300 },
        config: {},
        planStepId: 's1',
      });
    mocks.llmService.chatStream.mockImplementation(() =>
      asyncIter<ChatStreamEvent>([
        {
          type: 'tool_call_end',
          id: 'call_plan',
          name: 'propose_plan',
          arguments: planArgs,
        },
        // LLM 이 finish 없이 바로 여러 edit 을 발사 (gemini-3-flash 관찰 패턴).
        {
          type: 'tool_call_end',
          id: 'call_add_1',
          name: 'add_node',
          arguments: addArgs('음식 종류 선택'),
        },
        {
          type: 'tool_call_end',
          id: 'call_add_2',
          name: 'add_node',
          arguments: addArgs('종류별 분기'),
        },
        {
          type: 'tool_call_end',
          id: 'call_add_3',
          name: 'add_node',
          arguments: addArgs('한식 메뉴 선택'),
        },
        {
          type: 'done',
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          model: 'gemini-3-flash-preview',
          // 프로바이더가 tool_calls 로 종료 — 이 값이 루프 재진입의 트리거.
          finishReason: 'tool_calls',
        },
      ]),
    );

    const events = await collect(
      service.streamMessage('sess-1', 'ws-1', 'u-1', baseDto as never),
    );

    // 1 라운드 내에 턴 종료해야 한다 (핑퐁 루프 차단).
    expect(mocks.llmService.chatStream).toHaveBeenCalledTimes(1);
    const done = events[events.length - 1];
    expect(done).toMatchObject({
      event: 'done',
      data: { finishReason: 'stop' },
    });
    // "진행이 중단됐어요" (ASSISTANT_TOO_MANY_TOOL_CALLS) 는 노출되면 안 됨.
    const errorEvent = events.find((e) => e.event === 'error');
    expect(errorEvent).toBeUndefined();
    // 가드가 "올바른 이유" 로 동작했는지 확인 — 3개 edit 모두 PAA 로 거부되어야.
    const editEvents = events.filter(
      (e) =>
        e.event === 'tool_call' &&
        (e.data as { name: string }).name === 'add_node',
    );
    expect(editEvents).toHaveLength(3);
    for (const editEvent of editEvents) {
      const result = (
        editEvent.data as { result: { ok?: boolean; error?: string } }
      ).result;
      expect(result.ok).toBe(false);
      expect(result.error).toBe('PLAN_AWAITING_APPROVAL');
    }
    // assistant 턴 persist 시 finishReason='stop' 이 기록되어야 다음 턴
    // rehydration 에서 "승인 대기" 상태로 복원된다.
    const assistantPersist = mocks.sessionService.appendMessage.mock.calls.find(
      (c) => c[1].role === 'assistant',
    );
    expect(assistantPersist?.[1]).toMatchObject({
      role: 'assistant',
      finishReason: 'stop',
    });
  });

  it('attaches MISSING_PLAN_STEP_ID warning when active plan is present but edit has no step id', async () => {
    // 활성 plan 이 있는데 edit 에 planStepId 가 없으면 shadow 는 성공시키되
    // 결과에 warning 을 붙여 LLM 이 이후 호출부터 tag 를 붙이도록 유도.
    const { service, mocks } = makeService();
    mocks.sessionService.loadMessages.mockResolvedValue([
      { role: 'user', content: '시작', toolCalls: null },
      {
        role: 'assistant',
        content: '',
        toolCalls: [
          {
            id: 'p1',
            name: 'propose_plan',
            arguments: {},
            kind: 'plan',
            result: { ok: true },
          },
        ],
        plan: {
          title: 'existing',
          summary: '',
          steps: [{ id: 's1', action: 'add_node', description: 'node' }],
        },
      },
    ]);
    mocks.llmService.chatStream.mockImplementation(() =>
      asyncIter<ChatStreamEvent>([
        {
          type: 'tool_call_end',
          id: 'call_add',
          name: 'add_node',
          // planStepId 를 의도적으로 누락
          arguments: JSON.stringify({
            type: 'http_request',
            label: 'NoTag',
            position: { x: 500, y: 300 },
            config: {},
          }),
        },
        {
          type: 'done',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          model: 'gpt-4o',
          finishReason: 'stop',
        },
      ]),
    );
    const events = await collect(
      service.streamMessage('sess-1', 'ws-1', 'u-1', {
        ...baseDto,
        content: '진행',
      }),
    );
    const editEvent = events.find(
      (e) =>
        e.event === 'tool_call' &&
        (e.data as { name: string }).name === 'add_node',
    );
    const result = (
      editEvent!.data as {
        result: { ok: boolean; warning?: string; warningMessage?: string };
      }
    ).result;
    expect(result.ok).toBe(true); // edit 은 성공
    expect(result.warning).toBe('MISSING_PLAN_STEP_ID');
    expect(result.warningMessage).toMatch(/planStepId/);
  });

  describe('server-side plan leak recovery', () => {
    // 실사례: GPT-4o 가 propose_plan 툴을 호출하지 않고 plan JSON 을 text 채널
    // 로 뱉어 사용자가 raw JSON 을 보게 되던 사고. 서버가 종료 직전에 시그니처
    // 를 감지해 합성 plan 이벤트로 전환한다.

    const leakedPlan = JSON.stringify({
      title: '설문조사 플로우 구성',
      summary: '1depth 선택 → 2depth 음식 제시 → 결과',
      steps: [
        { id: 's1', action: 'add_node', description: 'form 노드' },
        { id: 's2', action: 'add_edge', description: 'manual_trigger → form' },
      ],
      openQuestions: ['이메일 Integration ID 를 선택해 주세요.'],
    });

    // 서비스 내부 호출 순서에 의존하지 않도록 role 기반으로 assistant persist
    // payload 를 찾는다.
    function findAssistantPersist(
      mocks: MockDeps,
    ): { content: string; plan?: unknown; toolCalls?: unknown[] } | undefined {
      const call = mocks.sessionService.appendMessage.mock.calls.find(
        (args: unknown[]) => {
          const msg = args[1] as { role?: string } | undefined;
          return msg?.role === 'assistant';
        },
      );
      return call
        ? (call[1] as {
            content: string;
            plan?: unknown;
            toolCalls?: unknown[];
          })
        : undefined;
    }

    it('emits a synthetic plan SSE event (with openQuestions + leak_ id prefix) when the LLM leaks propose_plan JSON as text', async () => {
      const { service, mocks } = makeService();
      mocks.llmService.chatStream.mockImplementation(() =>
        asyncIter<ChatStreamEvent>([
          { type: 'text_delta', delta: leakedPlan },
          {
            type: 'done',
            usage: { inputTokens: 40, outputTokens: 30, totalTokens: 70 },
            model: 'gpt-4o',
            finishReason: 'stop',
          },
        ]),
      );

      const events = await collect(
        service.streamMessage('sess-1', 'ws-1', 'u-1', baseDto as never),
      );
      const planEvent = events.find((e) => e.event === 'plan');
      expect(planEvent).toBeDefined();
      expect(planEvent!.data).toMatchObject({
        title: '설문조사 플로우 구성',
        summary: '1depth 선택 → 2depth 음식 제시 → 결과',
        steps: [
          expect.objectContaining({ id: 's1', action: 'add_node' }),
          expect.objectContaining({ id: 's2', action: 'add_edge' }),
        ],
        // SSE 계약: openQuestions 도 이벤트에 함께 전달.
        openQuestions: ['이메일 Integration ID 를 선택해 주세요.'],
      });
      // id 는 복구 경로임을 식별하는 `leak_` 접두사
      expect((planEvent!.data as { id: string }).id).toMatch(/^leak_/);
      expect(events[events.length - 1]).toMatchObject({ event: 'done' });
    });

    it('scrubs the leaked JSON from the persisted assistant text', async () => {
      const { service, mocks } = makeService();
      mocks.llmService.chatStream.mockImplementation(() =>
        asyncIter<ChatStreamEvent>([
          { type: 'text_delta', delta: '네 이렇게 진행하겠습니다.\n\n' },
          { type: 'text_delta', delta: leakedPlan },
          {
            type: 'done',
            usage: { inputTokens: 40, outputTokens: 30, totalTokens: 70 },
            model: 'gpt-4o',
            finishReason: 'stop',
          },
        ]),
      );

      await collect(
        service.streamMessage('sess-1', 'ws-1', 'u-1', baseDto as never),
      );
      const persisted = findAssistantPersist(mocks);
      expect(persisted).toBeDefined();
      expect(persisted!.content).not.toMatch(/"title"\s*:\s*"설문조사/);
      expect(persisted!.content).toMatch(/네 이렇게 진행하겠습니다/);
      expect(persisted!.plan).toMatchObject({
        title: '설문조사 플로우 구성',
      });
      const toolCalls = persisted!.toolCalls as Array<{
        name: string;
        kind: string;
      }>;
      expect(toolCalls.some((c) => c.name === 'propose_plan')).toBe(true);
    });

    it('handles JSON split across multiple text_delta chunks (real streaming pattern)', async () => {
      // 실제 스트리밍은 JSON 을 한 번에 주지 않고 조각내어 보낸다. round 누적
      // 텍스트에서 복원이 되는지 고정.
      const { service, mocks } = makeService();
      const chunks = [
        '{ "title": "분할 ',
        '플로우", "summary": "s", "steps": [',
        '{"id":"s1","action":"add_node","description":"n1"}',
        ',{"id":"s2","action":"add_edge","description":"e1"}] }',
      ];
      mocks.llmService.chatStream.mockImplementation(() =>
        asyncIter<ChatStreamEvent>([
          ...chunks.map(
            (c) => ({ type: 'text_delta', delta: c }) as ChatStreamEvent,
          ),
          {
            type: 'done',
            usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
            model: 'gpt-4o',
            finishReason: 'stop',
          },
        ]),
      );

      const events = await collect(
        service.streamMessage('sess-1', 'ws-1', 'u-1', baseDto as never),
      );
      const planEvent = events.find((e) => e.event === 'plan');
      expect(planEvent).toBeDefined();
      expect((planEvent!.data as { title: string }).title).toBe('분할 플로우');
    });

    it('does NOT trigger recovery when a real propose_plan tool call already fired', async () => {
      const { service, mocks } = makeService();
      const realPlanArgs = JSON.stringify({
        title: 'Real plan via tool',
        summary: '',
        steps: [{ id: 's1', action: 'add_node', description: 'real step' }],
      });
      mocks.llmService.chatStream.mockImplementation(() =>
        asyncIter<ChatStreamEvent>([
          {
            type: 'tool_call_end',
            id: 'call_plan',
            name: 'propose_plan',
            arguments: realPlanArgs,
          },
          {
            type: 'done',
            usage: { inputTokens: 40, outputTokens: 20, totalTokens: 60 },
            model: 'gpt-4o',
            finishReason: 'stop',
          },
        ]),
      );

      const events = await collect(
        service.streamMessage('sess-1', 'ws-1', 'u-1', baseDto as never),
      );
      const planEvents = events.filter((e) => e.event === 'plan');
      expect(planEvents).toHaveLength(1);
      expect((planEvents[0].data as { title: string }).title).toBe(
        'Real plan via tool',
      );
      // 합성 id 접두사는 붙지 않아야 한다 (진짜 tool 호출 경로)
      expect((planEvents[0].data as { id: string }).id).not.toMatch(/^leak_/);
    });

    it('ignores non-plan JSON-like prose (e.g. a user example inside an answer)', async () => {
      const { service, mocks } = makeService();
      const notAPlan =
        '예를 들어 `{ "type": "http_request", "label": "API" }` 같은 인자로 호출해요.';
      mocks.llmService.chatStream.mockImplementation(() =>
        asyncIter<ChatStreamEvent>([
          { type: 'text_delta', delta: notAPlan },
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
      expect(events.filter((e) => e.event === 'plan')).toHaveLength(0);
      const persisted = findAssistantPersist(mocks);
      expect(persisted!.content).toBe(notAPlan);
    });

    it('ignores a plan-shaped JSON with an empty steps array (shape strictly requires non-empty)', async () => {
      const { service, mocks } = makeService();
      const empty =
        '설명 예시: `{ "title": "예시", "summary": "s", "steps": [] }` 같이 사용하세요.';
      mocks.llmService.chatStream.mockImplementation(() =>
        asyncIter<ChatStreamEvent>([
          { type: 'text_delta', delta: empty },
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
      expect(events.filter((e) => e.event === 'plan')).toHaveLength(0);
      const persisted = findAssistantPersist(mocks);
      expect(persisted!.content).toBe(empty);
    });
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

  // gpt-oss-120b 같은 일부 프로바이더는 tool_call 을 emit 하면서도 round 를
  // `stop` 으로 마감하고 `finish` tool 은 부르지 않는 프로토콜 이상 동작을 보인다.
  // 이 경우 tool_result 를 LLM 에 돌려주지 않으면 사용자는 "진행 중" narrative
  // 만 본 채 턴이 끊긴다. 이 describe 는 서버가 해당 케이스에서 loop 를 한 번 더
  // 돌려 LLM 이 `finish` 를 명시 호출할 기회를 주는지를 고정한다.
  describe('protocol-anomaly: tool_call without explicit finish (finishReason=stop)', () => {
    it('round-trips tool results back to the LLM when the round ends with stop + tool_calls but no finish', async () => {
      const { service, mocks } = makeService();
      const addArgs = JSON.stringify({
        type: 'http_request',
        label: 'Orphan',
        position: { x: 0, y: 0 },
        config: {},
      });
      // Round 1: LLM 이 add_node 만 emit 하고 finish 없이 finishReason=stop 종료.
      // 기존 구현이라면 여기서 턴이 끝났지만 새 로직에서는 round 2 가 이어짐.
      mocks.llmService.chatStream.mockImplementationOnce(() =>
        asyncIter<ChatStreamEvent>([
          {
            type: 'text_delta',
            delta: '설문 폼 추가 완료. (다음 단계 진행 중)',
          },
          {
            type: 'tool_call_end',
            id: 'call_add',
            name: 'add_node',
            arguments: addArgs,
          },
          {
            type: 'done',
            usage: { inputTokens: 30, outputTokens: 5, totalTokens: 35 },
            model: 'gpt-oss-120b',
            finishReason: 'stop', // <- 프로토콜 이상: stop 인데 finish 안 부름
          },
        ]),
      );
      // Round 2: LLM 이 tool_result 를 보고 이번엔 finish 를 명시 호출.
      mocks.llmService.chatStream.mockImplementationOnce(() =>
        asyncIter<ChatStreamEvent>([
          { type: 'text_delta', delta: '완료했어요.' },
          {
            type: 'tool_call_end',
            id: 'call_fin',
            name: 'finish',
            arguments: '{}',
          },
          {
            type: 'done',
            usage: { inputTokens: 10, outputTokens: 3, totalTokens: 13 },
            model: 'gpt-oss-120b',
            finishReason: 'stop',
          },
        ]),
      );

      const events = await collect(
        service.streamMessage('sess-1', 'ws-1', 'u-1', baseDto as never),
      );

      // Loop 가 2 라운드 돌아야 한다 — round 2 가 없으면 "진행 중" 후 턴이
      // 끊기는 사용자 보고 케이스.
      expect(mocks.llmService.chatStream).toHaveBeenCalledTimes(2);

      // Round 2 메시지에 round 1 의 add_node tool_result 가 실려 LLM 에게
      // feedback 되었는지 확인.
      const round2Messages = mocks.llmService.chatStream.mock.calls[1][1]
        .messages as Array<{
        role: string;
        toolCallId?: string;
        content?: string;
      }>;
      const addToolResult = round2Messages.find(
        (m) => m.role === 'tool' && m.toolCallId === 'call_add',
      );
      expect(addToolResult).toBeDefined();
      expect(JSON.parse(addToolResult!.content ?? 'null')).toMatchObject({
        ok: true,
      });

      const done = events[events.length - 1];
      expect(done).toMatchObject({
        event: 'done',
        data: { finishReason: 'stop' },
      });
    });

    it('does NOT round-trip when the round ended with stop but NO tool calls were made (pure chat)', async () => {
      const { service, mocks } = makeService();
      mocks.llmService.chatStream.mockImplementation(() =>
        asyncIter<ChatStreamEvent>([
          { type: 'text_delta', delta: '네, 확인했습니다.' },
          {
            type: 'done',
            usage: { inputTokens: 10, outputTokens: 3, totalTokens: 13 },
            model: 'gpt-oss-120b',
            finishReason: 'stop',
          },
        ]),
      );
      await collect(
        service.streamMessage('sess-1', 'ws-1', 'u-1', baseDto as never),
      );
      expect(mocks.llmService.chatStream).toHaveBeenCalledTimes(1);
    });
  });

  // 2-stage finish: plan 완결성 가드 이후 서버가 한 번 더 workflow self-review
  // 체크리스트를 돌려, orphan 노드·미해결 실패·pendingUserConfig 누락을 LLM 에게
  // 되돌려준다. LLM 이 이슈를 고치고 `finish` 를 다시 부르면 두 번째 호출은
  // review 를 건너뛰고 통과한다.
  describe('workflow self-review before finish (2-stage)', () => {
    it('blocks the first `finish` with WORKFLOW_REVIEW_REQUIRED when the turn leaves orphan nodes, then passes on the second', async () => {
      const { service, mocks } = makeService();
      const addOrphanA = JSON.stringify({
        type: 'http_request',
        label: 'OrphanA',
        position: { x: 400, y: 200 },
        config: {},
      });
      const addOrphanB = JSON.stringify({
        type: 'http_request',
        label: 'OrphanB',
        position: { x: 700, y: 200 },
        config: {},
      });
      // Round 1: 두 노드를 edge 없이 추가하고 finish. Review 가 ORPHAN_NODES
      // 로 block 하고 round 2 로 넘어간다.
      mocks.llmService.chatStream.mockImplementationOnce(() =>
        asyncIter<ChatStreamEvent>([
          {
            type: 'tool_call_end',
            id: 'call_a',
            name: 'add_node',
            arguments: addOrphanA,
          },
          {
            type: 'tool_call_end',
            id: 'call_b',
            name: 'add_node',
            arguments: addOrphanB,
          },
          {
            type: 'tool_call_end',
            id: 'call_fin_1',
            name: 'finish',
            arguments: '{}',
          },
          {
            type: 'done',
            usage: { inputTokens: 40, outputTokens: 5, totalTokens: 45 },
            model: 'gpt-4o',
            finishReason: 'tool_calls',
          },
        ]),
      );
      // Round 2: LLM 이 fix 안 하고 finish 만 — Phase 6 정책으로 review 다시 fire.
      mocks.llmService.chatStream.mockImplementationOnce(() =>
        asyncIter<ChatStreamEvent>([
          { type: 'text_delta', delta: '검토 완료' },
          {
            type: 'tool_call_end',
            id: 'call_fin_2',
            name: 'finish',
            arguments: '{}',
          },
          {
            type: 'done',
            usage: { inputTokens: 10, outputTokens: 3, totalTokens: 13 },
            model: 'gpt-4o',
            finishReason: 'tool_calls',
          },
        ]),
      );
      // Round 3: 또 finish — reviewRoundCount = 2 도달로 통과.
      mocks.llmService.chatStream.mockImplementationOnce(() =>
        asyncIter<ChatStreamEvent>([
          { type: 'text_delta', delta: '검토 한계.' },
          {
            type: 'tool_call_end',
            id: 'call_fin_3',
            name: 'finish',
            arguments: '{}',
          },
          {
            type: 'done',
            usage: { inputTokens: 8, outputTokens: 3, totalTokens: 11 },
            model: 'gpt-4o',
            finishReason: 'stop',
          },
        ]),
      );

      const events = await collect(
        service.streamMessage('sess-1', 'ws-1', 'u-1', baseDto as never),
      );

      expect(mocks.llmService.chatStream).toHaveBeenCalledTimes(3);

      // Round 2 messages 에 첫 finish 의 WORKFLOW_REVIEW_REQUIRED tool_result
      // 가 실려 있어야 한다.
      const secondRoundMessages = mocks.llmService.chatStream.mock.calls[1][1]
        .messages as Array<{
        role: string;
        content?: string;
        toolCallId?: string;
      }>;
      const finishTool = secondRoundMessages.find(
        (m) => m.role === 'tool' && m.toolCallId === 'call_fin_1',
      );
      expect(finishTool).toBeDefined();
      const parsed = JSON.parse(finishTool!.content ?? 'null');
      expect(parsed).toMatchObject({
        ok: false,
        error: 'WORKFLOW_REVIEW_REQUIRED',
      });
      const codes = (parsed.checklist as Array<{ code: string }>).map(
        (c) => c.code,
      );
      expect(codes).toContain('ORPHAN_NODES');

      // Phase 1: review_required 응답에 turn-end 권위 snapshot 이 동봉되어
      // LLM 이 자기 누적 tool_result 기억에 의존하지 않고 곧바로 fix 가능.
      // get_current_workflow 와 동일한 toWorkflowView shape 인지 확인.
      expect(parsed.currentWorkflow).toBeDefined();
      expect(Array.isArray(parsed.currentWorkflow.nodes)).toBe(true);
      expect(Array.isArray(parsed.currentWorkflow.edges)).toBe(true);
      const reviewLabels = (
        parsed.currentWorkflow.nodes as Array<{ label: string }>
      ).map((n) => n.label);
      expect(reviewLabels).toEqual(
        expect.arrayContaining(['OrphanA', 'OrphanB']),
      );

      const done = events[events.length - 1];
      expect(done).toMatchObject({
        event: 'done',
        data: { finishReason: 'stop' },
      });
    });

    it('redacts secrets in the WORKFLOW_REVIEW_REQUIRED `currentWorkflow` payload (same policy as get_current_workflow)', async () => {
      const { service, mocks } = makeService();
      // Orphan 노드 두 개를 만들고 그 중 하나의 config 에 apiKey 평문을 박아둔다.
      // review 가 ORPHAN_NODES 로 fire 한 응답의 currentWorkflow 에서 그 평문이
      // [REDACTED] 로 치환되어 LLM 컨텍스트로 흘러나가지 않아야 한다.
      const addSecret = JSON.stringify({
        type: 'http_request',
        label: 'SecretCaller',
        position: { x: 400, y: 200 },
        config: { apiKey: 'plaintext-secret-12345' },
      });
      const addOther = JSON.stringify({
        type: 'http_request',
        label: 'AnotherOrphan',
        position: { x: 700, y: 200 },
        config: {},
      });
      mocks.llmService.chatStream.mockImplementationOnce(() =>
        asyncIter<ChatStreamEvent>([
          {
            type: 'tool_call_end',
            id: 'call_a',
            name: 'add_node',
            arguments: addSecret,
          },
          {
            type: 'tool_call_end',
            id: 'call_b',
            name: 'add_node',
            arguments: addOther,
          },
          {
            type: 'tool_call_end',
            id: 'call_fin_1',
            name: 'finish',
            arguments: '{}',
          },
          {
            type: 'done',
            usage: { inputTokens: 40, outputTokens: 5, totalTokens: 45 },
            model: 'gpt-4o',
            finishReason: 'tool_calls',
          },
        ]),
      );
      mocks.llmService.chatStream.mockImplementationOnce(() =>
        asyncIter<ChatStreamEvent>([
          { type: 'text_delta', delta: '검토 완료' },
          {
            type: 'tool_call_end',
            id: 'call_fin_2',
            name: 'finish',
            arguments: '{}',
          },
          {
            type: 'done',
            usage: { inputTokens: 10, outputTokens: 3, totalTokens: 13 },
            model: 'gpt-4o',
            finishReason: 'stop',
          },
        ]),
      );

      await collect(
        service.streamMessage('sess-1', 'ws-1', 'u-1', baseDto as never),
      );

      const round2Messages = mocks.llmService.chatStream.mock.calls[1][1]
        .messages as Array<{
        role: string;
        content?: string;
        toolCallId?: string;
      }>;
      const finishTool = round2Messages.find(
        (m) => m.role === 'tool' && m.toolCallId === 'call_fin_1',
      );
      expect(finishTool).toBeDefined();
      const parsed = JSON.parse(finishTool!.content ?? 'null');
      expect(parsed.error).toBe('WORKFLOW_REVIEW_REQUIRED');
      const secretNode = (
        parsed.currentWorkflow.nodes as Array<{
          label: string;
          config: Record<string, unknown>;
        }>
      ).find((n) => n.label === 'SecretCaller');
      expect(secretNode).toBeDefined();
      expect(secretNode!.config.apiKey).toBe('[REDACTED]');
      // 평문이 응답 어느 곳에도 흘러나가지 않도록 stringify 한 전체에서도 미검출.
      expect(JSON.stringify(parsed)).not.toContain('plaintext-secret-12345');
    });

    it('Phase 6: LLM이 fix 안 하고 finish 만 반복해도 review가 한 번 더 fire (stuck escape 제거), 그 다음 finish는 상한으로 통과', async () => {
      // Phase 5 의 stuck escape 가 사용자 의도("검증 자체가 일어나야 함")와
      // 충돌해 Phase 6 에서 제거. LLM 이 review block 후 어떤 진척도 없이 그냥
      // finish 만 호출해도 reviewRoundCount < MAX_REVIEW_ROUNDS 이면 다시 막아
      // 검증 흔적이라도 남게 한다. 두 번째 block 후 (reviewRoundCount = 2)
      // 에는 무한 루프 방지로 통과.
      const { service, mocks } = makeService();
      const addOrphan = JSON.stringify({
        type: 'http_request',
        label: 'Alpha',
        position: { x: 400, y: 200 },
        config: {},
      });
      const addAnotherOrphan = JSON.stringify({
        type: 'http_request',
        label: 'Beta',
        position: { x: 700, y: 200 },
        config: {},
      });
      mocks.llmService.chatStream.mockImplementationOnce(() =>
        asyncIter<ChatStreamEvent>([
          {
            type: 'tool_call_end',
            id: 'c1',
            name: 'add_node',
            arguments: addOrphan,
          },
          {
            type: 'tool_call_end',
            id: 'c2',
            name: 'add_node',
            arguments: addAnotherOrphan,
          },
          {
            type: 'tool_call_end',
            id: 'fin_1',
            name: 'finish',
            arguments: '{}',
          },
          {
            type: 'done',
            usage: { inputTokens: 40, outputTokens: 5, totalTokens: 45 },
            model: 'gpt-4o',
            finishReason: 'tool_calls',
          },
        ]),
      );
      // Round 2: LLM 이 fix 안 하고 finish 만 — review 다시 fire 되어야.
      mocks.llmService.chatStream.mockImplementationOnce(() =>
        asyncIter<ChatStreamEvent>([
          {
            type: 'tool_call_end',
            id: 'fin_2',
            name: 'finish',
            arguments: '{}',
          },
          {
            type: 'done',
            usage: { inputTokens: 10, outputTokens: 3, totalTokens: 13 },
            model: 'gpt-4o',
            finishReason: 'tool_calls',
          },
        ]),
      );
      // Round 3: 또 finish — 상한 도달로 통과.
      mocks.llmService.chatStream.mockImplementationOnce(() =>
        asyncIter<ChatStreamEvent>([
          { type: 'text_delta', delta: '검토 한계.' },
          {
            type: 'tool_call_end',
            id: 'fin_3',
            name: 'finish',
            arguments: '{}',
          },
          {
            type: 'done',
            usage: { inputTokens: 8, outputTokens: 3, totalTokens: 11 },
            model: 'gpt-4o',
            finishReason: 'stop',
          },
        ]),
      );

      const events = await collect(
        service.streamMessage('sess-1', 'ws-1', 'u-1', baseDto as never),
      );
      // 3 라운드: round 1 review_required, round 2 review_required (재발동),
      // round 3 통과.
      expect(mocks.llmService.chatStream).toHaveBeenCalledTimes(3);
      // Round 3 messages 의 fin_2 결과가 review_required 임을 검증.
      const round3Msgs = mocks.llmService.chatStream.mock.calls[2][1]
        .messages as Array<{
        role: string;
        content?: string;
        toolCallId?: string;
      }>;
      const fin2 = round3Msgs.find(
        (m) => m.role === 'tool' && m.toolCallId === 'fin_2',
      );
      expect(fin2).toBeDefined();
      const parsed = JSON.parse(fin2!.content ?? 'null');
      expect(parsed.error).toBe('WORKFLOW_REVIEW_REQUIRED');
      const done = events[events.length - 1];
      expect(done).toMatchObject({
        event: 'done',
        data: { finishReason: 'stop' },
      });
    });

    it('Phase 5: re-fires WORKFLOW_REVIEW_REQUIRED on a second round when the LLM made progress but blocking issues remain', async () => {
      // 사용자가 보고한 케이스의 회귀 보호. Round 1 에서 review_required 받고,
      // round 2 에 LLM 이 일부 edit (예: orphan 한 개만 트리거에 잇고 다른
      // orphan 은 그대로) 으로 진척했지만 blocking 이 여전히 남으면, stuck
      // escape 가 발동하지 않고 review 가 한 번 더 fire 한다 (Phase 5
      // MAX_REVIEW_ROUNDS = 2). 그 이후 round 3 finish 는 상한 도달로 통과.
      const { service, mocks } = makeService();
      // dto 에 trigger + 두 개의 orphan node 박기 → round 1 finish 가 ORPHAN
      // 으로 막힘.
      const dtoWithOrphans = {
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
            {
              id: 'orphan-x',
              type: 'http_request',
              category: 'integration',
              label: 'OrphanX',
              positionX: 400,
              positionY: 200,
              config: {},
            },
            {
              id: 'orphan-y',
              type: 'http_request',
              category: 'integration',
              label: 'OrphanY',
              positionX: 700,
              positionY: 200,
              config: {},
            },
          ],
          edges: [],
        },
      };
      // Round 1: 진척 신호로 update_node 한 번 (성공한 edit) + finish.
      // 두 orphan 이 그대로 남아 ORPHAN_NODES blocking → review_required 발동.
      mocks.llmService.chatStream.mockImplementationOnce(() =>
        asyncIter<ChatStreamEvent>([
          {
            type: 'tool_call_end',
            id: 'u1',
            name: 'update_node',
            arguments: JSON.stringify({
              id: 'orphan-x',
              patch: { label: 'OrphanX-renamed' },
            }),
          },
          {
            type: 'tool_call_end',
            id: 'fin_1',
            name: 'finish',
            arguments: '{}',
          },
          {
            type: 'done',
            usage: { inputTokens: 30, outputTokens: 5, totalTokens: 35 },
            model: 'gpt-4o',
            finishReason: 'tool_calls',
          },
        ]),
      );
      // Round 2: LLM 이 fix 시도하는 척 — 새 노드를 하나 더 추가 (성공한 edit
      // 으로 진척 신호) 하지만 orphan 두 개는 여전히 그대로 → ORPHAN_NODES 가
      // 다시 fire → review_required 재발동. (mock 환경의 add_edge 는
      // PORT_NOT_FOUND 로 실패해 진척 신호로 안 잡히는 사정이 있어, 진척 신호로
      // add_node 를 사용한다.)
      mocks.llmService.chatStream.mockImplementationOnce(() =>
        asyncIter<ChatStreamEvent>([
          {
            type: 'tool_call_end',
            id: 'add_attempt',
            name: 'add_node',
            arguments: JSON.stringify({
              type: 'http_request',
              label: 'NoiseNode',
              position: { x: 1100, y: 200 },
              config: {},
            }),
          },
          {
            type: 'tool_call_end',
            id: 'fin_2',
            name: 'finish',
            arguments: '{}',
          },
          {
            type: 'done',
            usage: { inputTokens: 30, outputTokens: 5, totalTokens: 35 },
            model: 'gpt-4o',
            finishReason: 'tool_calls',
          },
        ]),
      );
      // Round 3: LLM 이 fix 포기, finish 만 호출 → 상한 도달로 통과.
      mocks.llmService.chatStream.mockImplementationOnce(() =>
        asyncIter<ChatStreamEvent>([
          { type: 'text_delta', delta: '검토 한계 도달.' },
          {
            type: 'tool_call_end',
            id: 'fin_3',
            name: 'finish',
            arguments: '{}',
          },
          {
            type: 'done',
            usage: { inputTokens: 10, outputTokens: 3, totalTokens: 13 },
            model: 'gpt-4o',
            finishReason: 'stop',
          },
        ]),
      );

      const events = await collect(
        service.streamMessage('sess-1', 'ws-1', 'u-1', dtoWithOrphans as never),
      );
      // 3 라운드 — round 1 review_required, round 2 review_required (재발동),
      // round 3 통과.
      expect(mocks.llmService.chatStream).toHaveBeenCalledTimes(3);

      // Round 2 messages 에 round 1 의 fin_1 tool_result 가 review_required.
      const round2Msgs = mocks.llmService.chatStream.mock.calls[1][1]
        .messages as Array<{
        role: string;
        content?: string;
        toolCallId?: string;
      }>;
      const fin1Result = round2Msgs.find(
        (m) => m.role === 'tool' && m.toolCallId === 'fin_1',
      );
      expect(fin1Result).toBeDefined();
      const parsed1 = JSON.parse(fin1Result!.content ?? 'null');
      expect(parsed1.error).toBe('WORKFLOW_REVIEW_REQUIRED');

      // Round 3 messages 에 round 2 의 fin_2 tool_result 가 review_required (재발동).
      const round3Msgs = mocks.llmService.chatStream.mock.calls[2][1]
        .messages as Array<{
        role: string;
        content?: string;
        toolCallId?: string;
      }>;
      const fin2Result = round3Msgs.find(
        (m) => m.role === 'tool' && m.toolCallId === 'fin_2',
      );
      expect(fin2Result).toBeDefined();
      const parsed2 = JSON.parse(fin2Result!.content ?? 'null');
      expect(parsed2.error).toBe('WORKFLOW_REVIEW_REQUIRED');
      // round 2 의 review 는 진척 신호(NoiseNode 추가)가 있었음에도 원래의
      // orphan-x / orphan-y 가 여전히 trigger 와 끊겨있어 ORPHAN_NODES 가 다시
      // 잡혔음을 확인 (NoiseNode 도 orphan 으로 추가됨 → 3 노드 모두 orphan).
      const orphanLabels = (
        parsed2.checklist as Array<{ code: string; data?: unknown }>
      )
        .filter((c) => c.code === 'ORPHAN_NODES')
        .flatMap(
          (c) =>
            (c.data as Array<{ label: string }> | undefined)?.map(
              (d) => d.label,
            ) ?? [],
        );
      expect(orphanLabels).toEqual(
        expect.arrayContaining(['OrphanX-renamed', 'OrphanY', 'NoiseNode']),
      );

      const done = events[events.length - 1];
      expect(done).toMatchObject({
        event: 'done',
        data: { finishReason: 'stop' },
      });
    });

    it('Phase 2: blocks the first finish with WORKFLOW_VERIFY_REQUIRED when checklist passes but the workflow is non-trivial (≥3 non-trigger nodes)', async () => {
      // dto 에 trigger + 3 노드 + 3 edges (모든 노드가 trigger 에서 도달 가능)
      // 를 박은 상태로 시작 → ORPHAN/DANGLING 등 어떤 blocking 항목도 fire 안 함.
      // round 1 에 update_node 로 단순 patch 만 성공시킨 뒤 finish 호출하면
      // verify 가 한 라운드 막는다. 두 번째 finish 는 같은 reviewCompleted
      // 플래그로 통과.
      const { service, mocks } = makeService();
      const dtoWithThreeNodes = {
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
            {
              id: 'node-a',
              type: 'http_request',
              category: 'integration',
              label: 'StepA',
              positionX: 400,
              positionY: 200,
              config: {},
            },
            {
              id: 'node-b',
              type: 'http_request',
              category: 'integration',
              label: 'StepB',
              positionX: 700,
              positionY: 200,
              config: {},
            },
            {
              id: 'node-c',
              type: 'http_request',
              category: 'integration',
              label: 'StepC',
              positionX: 1000,
              positionY: 200,
              config: {},
            },
          ],
          edges: [
            {
              id: 'edge-1',
              sourceNodeId: 'trig-1',
              sourcePort: 'out',
              targetNodeId: 'node-a',
              targetPort: 'in',
              type: 'data',
            },
            {
              id: 'edge-2',
              sourceNodeId: 'node-a',
              sourcePort: 'out',
              targetNodeId: 'node-b',
              targetPort: 'in',
              type: 'data',
            },
            {
              id: 'edge-3',
              sourceNodeId: 'node-b',
              sourcePort: 'out',
              targetNodeId: 'node-c',
              targetPort: 'in',
              type: 'data',
            },
          ],
        },
      };
      // Round 1: update_node 로 작은 patch 한 번 + finish.
      mocks.llmService.chatStream.mockImplementationOnce(() =>
        asyncIter<ChatStreamEvent>([
          {
            type: 'tool_call_end',
            id: 'u1',
            name: 'update_node',
            arguments: JSON.stringify({
              id: 'node-a',
              patch: { label: 'StepA-renamed' },
            }),
          },
          {
            type: 'tool_call_end',
            id: 'fin_1',
            name: 'finish',
            arguments: '{}',
          },
          {
            type: 'done',
            usage: { inputTokens: 30, outputTokens: 5, totalTokens: 35 },
            model: 'gpt-4o',
            finishReason: 'tool_calls',
          },
        ]),
      );
      // Round 2: verify_required 후 두 번째 finish 는 통과.
      mocks.llmService.chatStream.mockImplementationOnce(() =>
        asyncIter<ChatStreamEvent>([
          { type: 'text_delta', delta: '검토 완료' },
          {
            type: 'tool_call_end',
            id: 'fin_2',
            name: 'finish',
            arguments: '{}',
          },
          {
            type: 'done',
            usage: { inputTokens: 10, outputTokens: 3, totalTokens: 13 },
            model: 'gpt-4o',
            finishReason: 'stop',
          },
        ]),
      );

      const events = await collect(
        service.streamMessage(
          'sess-1',
          'ws-1',
          'u-1',
          dtoWithThreeNodes as never,
        ),
      );
      expect(mocks.llmService.chatStream).toHaveBeenCalledTimes(2);

      // Round 2 messages: fin_1 의 tool_result 는 WORKFLOW_VERIFY_REQUIRED.
      const round2Msgs = mocks.llmService.chatStream.mock.calls[1][1]
        .messages as Array<{
        role: string;
        content?: string;
        toolCallId?: string;
      }>;
      const finishToolResult = round2Msgs.find(
        (m) => m.role === 'tool' && m.toolCallId === 'fin_1',
      );
      expect(finishToolResult).toBeDefined();
      const parsed = JSON.parse(finishToolResult!.content ?? 'null');
      expect(parsed.error).toBe('WORKFLOW_VERIFY_REQUIRED');
      // verify 응답에도 권위 snapshot 동봉 (Phase 1 정책과 동일).
      expect(parsed.currentWorkflow).toBeDefined();
      expect(Array.isArray(parsed.currentWorkflow.nodes)).toBe(true);
      const labels = (
        parsed.currentWorkflow.nodes as Array<{ label: string }>
      ).map((n) => n.label);
      expect(labels).toEqual(
        expect.arrayContaining(['StepA-renamed', 'StepB', 'StepC']),
      );
      // blocking 은 비어있어야 — 만약 ORPHAN/DANGLING 이 잡혔다면 review 분기로
      // 들어갔을 것.
      const blockingCodes = (
        parsed.checklist as Array<{ code: string; blocking: boolean }>
      )
        .filter((c) => c.blocking)
        .map((c) => c.code);
      expect(blockingCodes).toEqual([]);

      const done = events[events.length - 1];
      expect(done).toMatchObject({
        event: 'done',
        data: { finishReason: 'stop' },
      });
    });

    it('Phase 2: skips verify when non-trigger node count is below threshold (≤2 nodes)', async () => {
      // dto 에 trigger + 2 노드 (모두 trigger 에서 도달) 만 박기 → non-trigger 수
      // = 2 < 3 → review/verify 둘 다 발동 안 하고 첫 finish 가 통과한다.
      // 단순 편집(노드 1~2개)에 추가 라운드 비용을 부과하지 않는 정책 회귀 보호.
      const { service, mocks } = makeService();
      const dtoWithTwoNodes = {
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
            {
              id: 'node-x',
              type: 'http_request',
              category: 'integration',
              label: 'OnlyX',
              positionX: 400,
              positionY: 200,
              config: {},
            },
            {
              id: 'node-y',
              type: 'http_request',
              category: 'integration',
              label: 'OnlyY',
              positionX: 700,
              positionY: 200,
              config: {},
            },
          ],
          edges: [
            {
              id: 'e1',
              sourceNodeId: 'trig-1',
              sourcePort: 'out',
              targetNodeId: 'node-x',
              targetPort: 'in',
              type: 'data',
            },
            {
              id: 'e2',
              sourceNodeId: 'node-x',
              sourcePort: 'out',
              targetNodeId: 'node-y',
              targetPort: 'in',
              type: 'data',
            },
          ],
        },
      };
      mocks.llmService.chatStream.mockImplementationOnce(() =>
        asyncIter<ChatStreamEvent>([
          {
            type: 'tool_call_end',
            id: 'u1',
            name: 'update_node',
            arguments: JSON.stringify({
              id: 'node-x',
              patch: { label: 'OnlyX-renamed' },
            }),
          },
          {
            type: 'tool_call_end',
            id: 'fin',
            name: 'finish',
            arguments: '{}',
          },
          {
            type: 'done',
            usage: { inputTokens: 30, outputTokens: 5, totalTokens: 35 },
            model: 'gpt-4o',
            finishReason: 'stop',
          },
        ]),
      );

      const events = await collect(
        service.streamMessage(
          'sess-1',
          'ws-1',
          'u-1',
          dtoWithTwoNodes as never,
        ),
      );
      // 단일 라운드만 — review/verify 둘 다 추가 round 없이 finish 통과.
      expect(mocks.llmService.chatStream).toHaveBeenCalledTimes(1);
      const done = events[events.length - 1];
      expect(done).toMatchObject({
        event: 'done',
        data: { finishReason: 'stop' },
      });
    });

    it('skips review entirely for trivial single-node turns', async () => {
      // non-trigger 노드가 ≤ 1 개인 상태의 finish 는 review 를 건너뛰고 바로
      // 통과. 사용자의 "HTTP 노드 하나만 추가" 같은 단발성 요청에서 불필요한
      // 라운드를 돌지 않게 한다.
      const { service, mocks } = makeService();
      const addOne = JSON.stringify({
        type: 'http_request',
        label: 'Only',
        position: { x: 400, y: 200 },
        config: {},
      });
      mocks.llmService.chatStream.mockImplementation(() =>
        asyncIter<ChatStreamEvent>([
          {
            type: 'tool_call_end',
            id: 'c1',
            name: 'add_node',
            arguments: addOne,
          },
          {
            type: 'tool_call_end',
            id: 'fin',
            name: 'finish',
            arguments: '{}',
          },
          {
            type: 'done',
            usage: { inputTokens: 20, outputTokens: 5, totalTokens: 25 },
            model: 'gpt-4o',
            finishReason: 'stop',
          },
        ]),
      );

      await collect(
        service.streamMessage('sess-1', 'ws-1', 'u-1', baseDto as never),
      );
      // 단일 round 로 종료 — review 발동 없음.
      expect(mocks.llmService.chatStream).toHaveBeenCalledTimes(1);
    });

    it('ALSO fires review after PLAN_NOT_COMPLETE completes the plan (two guards are orthogonal — plan completeness ≠ workflow quality)', async () => {
      // plan 가드와 review 가드는 서로 다른 계층의 검증이다. plan 체크박스
      // 완료는 "LLM 이 계획한 step 들을 tool 호출에 대응시켰다" 를 뜻할 뿐
      // 완성된 워크플로우가 품질 관점에서 문제 없다는 보장이 아니다. 따라서
      // PLAN_NOT_COMPLETE 이후에도 review 는 독립적으로 발동한다.
      const { service, mocks } = makeService();
      mocks.sessionService.loadMessages.mockResolvedValue([
        { role: 'user', content: '주문 취소 플로우', toolCalls: null },
        {
          role: 'assistant',
          content: '',
          toolCalls: [
            {
              id: 'p0',
              name: 'propose_plan',
              arguments: {},
              kind: 'plan',
              result: { ok: true },
            },
          ],
          plan: {
            title: 'Order cancel',
            summary: '',
            steps: [
              {
                id: 's1',
                action: 'add_node',
                description: 'first',
              },
              {
                id: 's2',
                action: 'add_node',
                description: 'second',
              },
            ],
          },
        },
      ]);
      // Round 1: 첫 노드만 추가하고 조기 finish → PLAN_NOT_COMPLETE block.
      mocks.llmService.chatStream.mockImplementationOnce(() =>
        asyncIter<ChatStreamEvent>([
          {
            type: 'tool_call_end',
            id: 'a',
            name: 'add_node',
            arguments: JSON.stringify({
              type: 'http_request',
              label: 'First',
              position: { x: 0, y: 0 },
              config: {},
              planStepId: 's1',
            }),
          },
          {
            type: 'tool_call_end',
            id: 'fin_1',
            name: 'finish',
            arguments: '{}',
          },
          {
            type: 'done',
            usage: { inputTokens: 20, outputTokens: 5, totalTokens: 25 },
            model: 'gpt-4o',
            finishReason: 'tool_calls',
          },
        ]),
      );
      // Round 2: 남은 step 을 채우고 finish → review 가드가 orphan 등 감지해 재차 block.
      mocks.llmService.chatStream.mockImplementationOnce(() =>
        asyncIter<ChatStreamEvent>([
          {
            type: 'tool_call_end',
            id: 'b',
            name: 'add_node',
            arguments: JSON.stringify({
              type: 'http_request',
              label: 'Second',
              position: { x: 0, y: 0 },
              config: {},
              planStepId: 's2',
            }),
          },
          {
            type: 'tool_call_end',
            id: 'fin_2',
            name: 'finish',
            arguments: '{}',
          },
          {
            type: 'done',
            usage: { inputTokens: 30, outputTokens: 5, totalTokens: 35 },
            model: 'gpt-4o',
            finishReason: 'stop',
          },
        ]),
      );
      // Round 3: review 결과 확인 후 두 번째 finish — Phase 6 stuck 제거로
      // 다시 fire (round 4 필요).
      mocks.llmService.chatStream.mockImplementationOnce(() =>
        asyncIter<ChatStreamEvent>([
          { type: 'text_delta', delta: '검토 완료.' },
          {
            type: 'tool_call_end',
            id: 'fin_3',
            name: 'finish',
            arguments: '{}',
          },
          {
            type: 'done',
            usage: { inputTokens: 10, outputTokens: 3, totalTokens: 13 },
            model: 'gpt-4o',
            finishReason: 'tool_calls',
          },
        ]),
      );
      // Round 4: 상한 도달로 통과.
      mocks.llmService.chatStream.mockImplementationOnce(() =>
        asyncIter<ChatStreamEvent>([
          { type: 'text_delta', delta: '검토 한계.' },
          {
            type: 'tool_call_end',
            id: 'fin_4',
            name: 'finish',
            arguments: '{}',
          },
          {
            type: 'done',
            usage: { inputTokens: 8, outputTokens: 3, totalTokens: 11 },
            model: 'gpt-4o',
            finishReason: 'stop',
          },
        ]),
      );

      await collect(
        service.streamMessage('sess-1', 'ws-1', 'u-1', baseDto as never),
      );
      // PLAN_NOT_COMPLETE + WORKFLOW_REVIEW_REQUIRED × 2 (Phase 6) → 4 라운드.
      expect(mocks.llmService.chatStream).toHaveBeenCalledTimes(4);
      // Round 2 messages: 첫 finish 가 PLAN_NOT_COMPLETE 로 막힌 흔적.
      const secondRoundMessages = mocks.llmService.chatStream.mock.calls[1][1]
        .messages as Array<{
        role: string;
        content?: string;
        toolCallId?: string;
      }>;
      const firstFinishResult = secondRoundMessages.find(
        (m) => m.role === 'tool' && m.toolCallId === 'fin_1',
      );
      expect(firstFinishResult).toBeDefined();
      expect(JSON.parse(firstFinishResult!.content ?? 'null')).toMatchObject({
        ok: false,
        error: 'PLAN_NOT_COMPLETE',
      });
      // Round 3 messages: 두 번째 finish 가 WORKFLOW_REVIEW_REQUIRED 로 막힌 흔적.
      const thirdRoundMessages = mocks.llmService.chatStream.mock.calls[2][1]
        .messages as Array<{
        role: string;
        content?: string;
        toolCallId?: string;
      }>;
      const reviewFinishResult = thirdRoundMessages.find(
        (m) => m.role === 'tool' && m.toolCallId === 'fin_2',
      );
      expect(reviewFinishResult).toBeDefined();
      expect(JSON.parse(reviewFinishResult!.content ?? 'null')).toMatchObject({
        ok: false,
        error: 'WORKFLOW_REVIEW_REQUIRED',
      });
    });

    it('skips review when clear_plan was called this turn (topic change)', async () => {
      const { service, mocks } = makeService();
      const addMany = JSON.stringify({
        type: 'http_request',
        label: 'N1',
        position: { x: 0, y: 0 },
        config: {},
      });
      const addMany2 = JSON.stringify({
        type: 'http_request',
        label: 'N2',
        position: { x: 0, y: 0 },
        config: {},
      });
      mocks.llmService.chatStream.mockImplementation(() =>
        asyncIter<ChatStreamEvent>([
          {
            type: 'tool_call_end',
            id: 'clr',
            name: 'clear_plan',
            arguments: '{"reason":"user changed topic"}',
          },
          {
            type: 'tool_call_end',
            id: 'n1',
            name: 'add_node',
            arguments: addMany,
          },
          {
            type: 'tool_call_end',
            id: 'n2',
            name: 'add_node',
            arguments: addMany2,
          },
          {
            type: 'tool_call_end',
            id: 'fin',
            name: 'finish',
            arguments: '{}',
          },
          {
            type: 'done',
            usage: { inputTokens: 20, outputTokens: 5, totalTokens: 25 },
            model: 'gpt-4o',
            finishReason: 'tool_calls',
          },
        ]),
      );

      await collect(
        service.streamMessage('sess-1', 'ws-1', 'u-1', baseDto as never),
      );
      expect(mocks.llmService.chatStream).toHaveBeenCalledTimes(1);
    });

    it('Phase 3: verify_workflow returns VERIFY_INCOMPLETE when verifiedNodeIds miss any node currently on the canvas', async () => {
      // dto 에 trigger + 2 노드 박고 verify_workflow 를 일부 id 만 포함해 호출.
      // 서버는 missingNodeIds 를 정확히 돌려줘야 LLM 이 무엇을 안 봤는지 안다.
      const { service, mocks } = makeService();
      const dto = {
        content: 'Hello',
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
            {
              id: 'node-x',
              type: 'http_request',
              category: 'integration',
              label: 'X',
              positionX: 400,
              positionY: 200,
              config: {},
            },
            {
              id: 'node-y',
              type: 'http_request',
              category: 'integration',
              label: 'Y',
              positionX: 700,
              positionY: 200,
              config: {},
            },
          ],
          edges: [
            {
              id: 'e1',
              sourceNodeId: 'trig-1',
              sourcePort: 'out',
              targetNodeId: 'node-x',
              targetPort: 'in',
              type: 'data',
            },
          ],
        },
      };
      mocks.llmService.chatStream.mockImplementation(() =>
        asyncIter<ChatStreamEvent>([
          {
            type: 'tool_call_end',
            id: 'v1',
            name: 'verify_workflow',
            arguments: JSON.stringify({
              // node-y 와 e1 누락
              verifiedNodeIds: ['trig-1', 'node-x'],
              verifiedEdgeIds: [],
              requestCoverage: 'half checked',
            }),
          },
          {
            type: 'tool_call_end',
            id: 'fin',
            name: 'finish',
            arguments: '{}',
          },
          {
            type: 'done',
            usage: { inputTokens: 10, outputTokens: 3, totalTokens: 13 },
            model: 'gpt-4o',
            finishReason: 'stop',
          },
        ]),
      );

      const events = await collect(
        service.streamMessage('sess-1', 'ws-1', 'u-1', dto as never),
      );
      const verifyEvent = events.find(
        (e) =>
          e.event === 'tool_call' &&
          (e.data as { name: string }).name === 'verify_workflow',
      );
      expect(verifyEvent).toBeDefined();
      const verifyResult = (
        verifyEvent!.data as {
          result: {
            ok: boolean;
            error?: string;
            missingNodeIds?: string[];
            missingEdgeIds?: string[];
          };
        }
      ).result;
      expect(verifyResult.ok).toBe(false);
      expect(verifyResult.error).toBe('VERIFY_INCOMPLETE');
      expect(verifyResult.missingNodeIds).toEqual(['node-y']);
      expect(verifyResult.missingEdgeIds).toEqual(['e1']);
    });

    it('Phase 3: verify_workflow returns ok and lets the next finish pass through when every node and edge is covered', async () => {
      // 같은 dto, 이번엔 모든 id 포함 → ok:true → state.reviewCompleted = true →
      // 두 번째 finish (verify gate 가 노드 ≥ 3 일 때 재발동 가능) 도 통과.
      const { service, mocks } = makeService();
      const dto = {
        content: 'Hello',
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
            {
              id: 'node-a',
              type: 'http_request',
              category: 'integration',
              label: 'A',
              positionX: 400,
              positionY: 200,
              config: {},
            },
            {
              id: 'node-b',
              type: 'http_request',
              category: 'integration',
              label: 'B',
              positionX: 700,
              positionY: 200,
              config: {},
            },
            {
              id: 'node-c',
              type: 'http_request',
              category: 'integration',
              label: 'C',
              positionX: 1000,
              positionY: 200,
              config: {},
            },
          ],
          edges: [
            {
              id: 'eA',
              sourceNodeId: 'trig-1',
              sourcePort: 'out',
              targetNodeId: 'node-a',
              targetPort: 'in',
              type: 'data',
            },
            {
              id: 'eB',
              sourceNodeId: 'node-a',
              sourcePort: 'out',
              targetNodeId: 'node-b',
              targetPort: 'in',
              type: 'data',
            },
            {
              id: 'eC',
              sourceNodeId: 'node-b',
              sourcePort: 'out',
              targetNodeId: 'node-c',
              targetPort: 'in',
              type: 'data',
            },
          ],
        },
      };
      mocks.llmService.chatStream.mockImplementation(() =>
        asyncIter<ChatStreamEvent>([
          {
            type: 'tool_call_end',
            id: 'u1',
            name: 'update_node',
            arguments: JSON.stringify({
              id: 'node-a',
              patch: { label: 'A-renamed' },
            }),
          },
          {
            type: 'tool_call_end',
            id: 'v1',
            name: 'verify_workflow',
            arguments: JSON.stringify({
              verifiedNodeIds: ['trig-1', 'node-a', 'node-b', 'node-c'],
              verifiedEdgeIds: ['eA', 'eB', 'eC'],
              requestCoverage: 'all four nodes and three edges accounted for',
            }),
          },
          {
            type: 'tool_call_end',
            id: 'fin',
            name: 'finish',
            arguments: '{}',
          },
          {
            type: 'done',
            usage: { inputTokens: 30, outputTokens: 5, totalTokens: 35 },
            model: 'gpt-4o',
            finishReason: 'stop',
          },
        ]),
      );

      const events = await collect(
        service.streamMessage('sess-1', 'ws-1', 'u-1', dto as never),
      );
      // 단일 round — verify_workflow 의 ok:true 가 reviewCompleted 를 set 해
      // 같은 round 내 finish 가 verify 게이트에 다시 막히지 않는다.
      expect(mocks.llmService.chatStream).toHaveBeenCalledTimes(1);
      const done = events[events.length - 1];
      expect(done).toMatchObject({
        event: 'done',
        data: { finishReason: 'stop' },
      });
      // verify_workflow 호출이 SSE tool_call 이벤트로 발행되었고 result 가 ok:true.
      const verifyEvent = events.find(
        (e) =>
          e.event === 'tool_call' &&
          (e.data as { name: string }).name === 'verify_workflow',
      );
      expect(verifyEvent).toBeDefined();
      const verifyResult = (
        verifyEvent!.data as {
          result: { ok: boolean; verifiedNodeCount: number };
        }
      ).result;
      expect(verifyResult.ok).toBe(true);
      expect(verifyResult.verifiedNodeCount).toBe(4);
    });
  });

  // 사용자 보고 케이스: `schema: carousel × 5` 처럼 같은 타입의 스키마를 한
  // 턴에 다섯 번 조회하는 낭비 패턴. 첫 호출은 정상, 2~3회차는 cached+warning,
  // 4회차부터 REDUNDANT_SCHEMA_LOOKUP 로 하드 스톱.
  describe('get_node_schema redundant-call guard', () => {
    it('returns cached result with warning on second call, hard-stops on the 3rd+', async () => {
      const { service, mocks } = makeService();
      mocks.exploreTools.getNodeSchema.mockResolvedValue({
        ok: true,
        type: 'carousel',
        configSchema: { type: 'object' },
      });
      mocks.llmService.chatStream.mockImplementation(() =>
        asyncIter<ChatStreamEvent>([
          {
            type: 'tool_call_end',
            id: 'call_1',
            name: 'get_node_schema',
            arguments: JSON.stringify({ type: 'carousel' }),
          },
          {
            type: 'tool_call_end',
            id: 'call_2',
            name: 'get_node_schema',
            arguments: JSON.stringify({ type: 'carousel' }),
          },
          {
            type: 'tool_call_end',
            id: 'call_3',
            name: 'get_node_schema',
            arguments: JSON.stringify({ type: 'carousel' }),
          },
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

      // DB / registry 호출은 첫 번째 tool_call 때 딱 한 번만.
      expect(mocks.exploreTools.getNodeSchema).toHaveBeenCalledTimes(1);

      const toolEvents = events.filter((e) => e.event === 'tool_call');
      expect(toolEvents).toHaveLength(3);
      const firstResult = (
        toolEvents[0].data as { result: Record<string, unknown> }
      ).result;
      expect(firstResult).toMatchObject({ ok: true, type: 'carousel' });
      expect(firstResult.warning).toBeUndefined();

      const secondResult = (
        toolEvents[1].data as { result: Record<string, unknown> }
      ).result;
      expect(secondResult.ok).toBe(true);
      expect(secondResult.warning).toBe('REDUNDANT_SCHEMA_LOOKUP');
      expect(secondResult.cached).toBe(true);

      const thirdResult = (
        toolEvents[2].data as { result: Record<string, unknown> }
      ).result;
      expect(thirdResult.ok).toBe(false);
      expect(thirdResult.error).toBe('REDUNDANT_SCHEMA_LOOKUP');
    });

    it('does NOT share the cache across different node types', async () => {
      const { service, mocks } = makeService();
      mocks.exploreTools.getNodeSchema.mockImplementation(async () => ({
        ok: true,
      }));
      mocks.llmService.chatStream.mockImplementation(() =>
        asyncIter<ChatStreamEvent>([
          {
            type: 'tool_call_end',
            id: 'call_1',
            name: 'get_node_schema',
            arguments: JSON.stringify({ type: 'carousel' }),
          },
          {
            type: 'tool_call_end',
            id: 'call_2',
            name: 'get_node_schema',
            arguments: JSON.stringify({ type: 'switch' }),
          },
          {
            type: 'done',
            usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
            model: 'gpt-4o',
            finishReason: 'stop',
          },
        ]),
      );

      await collect(
        service.streamMessage('sess-1', 'ws-1', 'u-1', baseDto as never),
      );

      // 서로 다른 타입이므로 각각 한 번씩 실제 조회.
      expect(mocks.exploreTools.getNodeSchema).toHaveBeenCalledTimes(2);
    });
  });

  // DANGLING_OUTPUT_PORTS: 사용자 스크린샷 (gemini-3-flash-preview) 에서
  // carousel 버튼 중 일부만 edge 로 연결하고 finish 한 시나리오의 축소 재현.
  // 서버의 self-review 가 미연결 포트를 잡아 LLM 에게 교정 기회를 준다.
  describe('WORKFLOW_REVIEW_REQUIRED — DANGLING_OUTPUT_PORTS', () => {
    it('surfaces DANGLING_OUTPUT_PORTS in the review checklist when a carousel button has no outgoing edge', async () => {
      const { service, mocks } = makeService();
      // carousel 정의를 주입해 resolveEffectiveOutputPorts 가 실제 동적 포트
      // (버튼 → 포트) 를 계산할 수 있게 한다.
      mocks.nodeRegistry.listDefinitions.mockReturnValue([
        {
          metadata: {
            type: 'manual_trigger',
            category: 'trigger',
            description: 'Manual trigger',
          },
          ports: {
            inputs: [],
            outputs: [{ id: 'out', label: 'Output', type: 'data' }],
          },
        },
        {
          metadata: {
            type: 'carousel',
            category: 'presentation',
            description: 'Carousel',
            dynamicPorts: {
              kind: 'presentation-buttons',
              supportsItems: true,
              supportsItemButtons: true,
              continueId: 'continue',
            },
          },
          ports: {
            inputs: [{ id: 'in', label: 'Input', type: 'data' }],
            outputs: [{ id: 'out', label: 'Output', type: 'data' }],
          },
        },
        {
          metadata: {
            type: 'template',
            category: 'presentation',
            description: 'Template',
          },
          ports: {
            inputs: [{ id: 'in', label: 'Input', type: 'data' }],
            outputs: [{ id: 'out', label: 'Output', type: 'data' }],
          },
        },
      ]);

      // 초기 canvas: trigger → carousel(btn_a, btn_b) → template (btn_a only).
      // btn_b 포트는 dangling. turn 안에서 LLM 이 update_node 로 아무 의미있는
      // 변경 (성공 edit 1건 이상) 을 해야 review 가 발동 (nonTrigger ≤ 1 skip
      // 조건 해제 + hadSuccessfulEdit 조건 만족).
      const primedDto = {
        content: '메뉴 선택 라벨을 업데이트해줘',
        currentWorkflow: {
          nodes: [
            {
              id: 'trig-1',
              type: 'manual_trigger',
              category: 'trigger',
              label: 'Start',
              positionX: 0,
              positionY: 0,
              config: {},
            },
            {
              id: 'node-carousel',
              type: 'carousel',
              category: 'presentation',
              label: '메뉴 선택',
              positionX: 300,
              positionY: 0,
              config: {
                mode: 'static',
                items: [
                  {
                    title: '메뉴',
                    buttons: [
                      { id: 'btn_a', label: 'A', type: 'port' },
                      { id: 'btn_b', label: 'B', type: 'port' },
                    ],
                  },
                ],
              },
            },
            {
              id: 'node-template',
              type: 'template',
              category: 'presentation',
              label: '결과 A',
              positionX: 600,
              positionY: 0,
              config: { html: 'A' },
            },
          ],
          edges: [
            {
              id: 'e-trig',
              sourceNodeId: 'trig-1',
              sourcePort: 'out',
              targetNodeId: 'node-carousel',
              targetPort: 'in',
              type: 'data',
            },
            {
              id: 'e-btn-a',
              sourceNodeId: 'node-carousel',
              sourcePort: 'btn_a',
              targetNodeId: 'node-template',
              targetPort: 'in',
              type: 'data',
            },
          ],
        },
      };

      // Round 1: label 수정 (성공 edit 1건) + finish → review 가 btn_b dangling
      // 을 찾아 WORKFLOW_REVIEW_REQUIRED 로 block.
      mocks.llmService.chatStream.mockImplementationOnce(() =>
        asyncIter<ChatStreamEvent>([
          {
            type: 'tool_call_end',
            id: 'call_upd',
            name: 'update_node',
            arguments: JSON.stringify({
              id: 'node-template',
              patch: { label: '결과 화면' },
            }),
          },
          {
            type: 'tool_call_end',
            id: 'call_fin_1',
            name: 'finish',
            arguments: '{}',
          },
          {
            type: 'done',
            usage: { inputTokens: 10, outputTokens: 3, totalTokens: 13 },
            model: 'gemini-3-flash-preview',
            finishReason: 'stop',
          },
        ]),
      );
      // Round 2: "검토 완료" 코멘트 + 두 번째 finish — Phase 6 stuck 제거로
      // dangling 잔존이라 review 다시 fire.
      mocks.llmService.chatStream.mockImplementationOnce(() =>
        asyncIter<ChatStreamEvent>([
          { type: 'text_delta', delta: '검토 완료.' },
          {
            type: 'tool_call_end',
            id: 'call_fin_2',
            name: 'finish',
            arguments: '{}',
          },
          {
            type: 'done',
            usage: { inputTokens: 3, outputTokens: 2, totalTokens: 5 },
            model: 'gemini-3-flash-preview',
            finishReason: 'tool_calls',
          },
        ]),
      );
      // Round 3: 상한 도달로 통과.
      mocks.llmService.chatStream.mockImplementationOnce(() =>
        asyncIter<ChatStreamEvent>([
          { type: 'text_delta', delta: '검토 한계.' },
          {
            type: 'tool_call_end',
            id: 'call_fin_3',
            name: 'finish',
            arguments: '{}',
          },
          {
            type: 'done',
            usage: { inputTokens: 2, outputTokens: 1, totalTokens: 3 },
            model: 'gemini-3-flash-preview',
            finishReason: 'stop',
          },
        ]),
      );

      const events = await collect(
        service.streamMessage('sess-1', 'ws-1', 'u-1', primedDto as never),
      );

      expect(mocks.llmService.chatStream).toHaveBeenCalledTimes(3);

      // Round 2 messages 에 첫 finish 의 WORKFLOW_REVIEW_REQUIRED 가 실려 있어야
      // 하고, checklist 에 DANGLING_OUTPUT_PORTS + btn_b 언급이 있어야 한다.
      const secondRoundMessages = mocks.llmService.chatStream.mock.calls[1][1]
        .messages as Array<{
        role: string;
        content?: string;
        toolCallId?: string;
      }>;
      const reviewResult = secondRoundMessages.find(
        (m) => m.role === 'tool' && m.toolCallId === 'call_fin_1',
      );
      expect(reviewResult).toBeDefined();
      const parsed = JSON.parse(reviewResult!.content ?? 'null');
      expect(parsed).toMatchObject({
        ok: false,
        error: 'WORKFLOW_REVIEW_REQUIRED',
      });
      const danglingItem = (
        parsed.checklist as Array<{
          code: string;
          details: string;
          data?: unknown;
        }>
      ).find((c) => c.code === 'DANGLING_OUTPUT_PORTS');
      expect(danglingItem).toBeDefined();
      expect(danglingItem?.details).toContain('btn_b');
      expect(
        (danglingItem?.data as Array<{ portId: string }>).map((d) => d.portId),
      ).toEqual(['btn_b']);

      // 최종적으로 정상 종료.
      const done = events[events.length - 1];
      expect(done).toMatchObject({
        event: 'done',
        data: { finishReason: 'stop' },
      });
    });
  });

  // Stall 자동 복구 (gpt-oss-120b 임의 중단 quirk 대응).
  // 시나리오: history 에 approved plan 이 있고 아직 pending step 이 남아있는데
  // LLM 이 tool call 없이 text 만 뱉고 stop 으로 종료. 서버가 auto-nudge 를
  // 주입해 한 라운드 더 돌리고, 2라운드째에 edit 이 성공하면 정상 종료.
  describe('auto-continue on stall with pending plan', () => {
    // 1-step plan 을 쓰면 review guard 의 `nonTriggerCount <= 1` skip 조건이
    // 만족되어 테스트의 primary assertion (stall auto-continue) 에만 집중할 수
    // 있다. 2-step 이상은 orphan 검출이 별도 라운드를 유발해 stall 경로를 흐린다.
    function primeApprovedPlan() {
      return {
        role: 'assistant' as const,
        content: '',
        toolCalls: [
          {
            id: 'p0',
            name: 'propose_plan',
            arguments: {},
            kind: 'plan' as const,
            result: { ok: true },
          },
        ],
        plan: {
          title: 'One-step build',
          summary: '',
          steps: [{ id: 's1', action: 'add_node' as const, description: 's1' }],
          approvedAt: '2026-04-22T00:00:00Z',
        },
      };
    }

    it('auto-nudges LLM when a round ends text-only + stop + plan has pending steps', async () => {
      const { service, mocks } = makeService();
      mocks.sessionService.loadMessages.mockResolvedValue([
        { role: 'user', content: '시작', toolCalls: null },
        primeApprovedPlan(),
      ]);
      // Round 1: LLM 이 텍스트만 출력하고 stop (gpt-oss 임의 중단 시뮬레이션).
      mocks.llmService.chatStream.mockImplementationOnce(() =>
        asyncIter<ChatStreamEvent>([
          { type: 'text_delta', delta: '다음 단계에서 이어가겠습니다.' },
          {
            type: 'done',
            usage: { inputTokens: 5, outputTokens: 3, totalTokens: 8 },
            model: 'gpt-oss-120b',
            finishReason: 'stop',
          },
        ]),
      );
      // Round 2: 서버가 "이어서 진행해줘." user nudge 를 주입 후 LLM 호출 →
      // 남은 step 을 edit + finish.
      mocks.llmService.chatStream.mockImplementationOnce(() =>
        asyncIter<ChatStreamEvent>([
          {
            type: 'tool_call_end',
            id: 'call_add',
            name: 'add_node',
            arguments: JSON.stringify({
              type: 'http_request',
              label: 'First',
              position: { x: 500, y: 300 },
              config: {},
              planStepId: 's1',
            }),
          },
          {
            type: 'tool_call_end',
            id: 'call_fin',
            name: 'finish',
            arguments: '{}',
          },
          {
            type: 'done',
            usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
            model: 'gpt-oss-120b',
            finishReason: 'stop',
          },
        ]),
      );

      const events = await collect(
        service.streamMessage('sess-1', 'ws-1', 'u-1', baseDto as never),
      );

      // 2 라운드 내 종료.
      expect(mocks.llmService.chatStream).toHaveBeenCalledTimes(2);

      // Round 2 messages 에 서버가 주입한 user nudge "이어서 진행해줘." 가
      // 포함되어 있어야 한다. 이게 LLM 에게 resume 신호를 준다.
      const secondRoundMessages = mocks.llmService.chatStream.mock.calls[1][1]
        .messages as Array<{ role: string; content?: string }>;
      const nudge = secondRoundMessages
        .slice()
        .reverse()
        .find((m) => m.role === 'user');
      expect(nudge?.content).toBe('이어서 진행해줘.');

      // (1) SSE 스트림에 `auto_resume` 이벤트가 정확히 1회, attempt=1 로 발행.
      //     이 이벤트는 프론트가 현재 assistant 버블을 확정하고 새 버블로
      //     분리하는 트리거로 쓰인다.
      const autoResumeEvents = events.filter((e) => e.event === 'auto_resume');
      expect(autoResumeEvents).toHaveLength(1);
      expect(autoResumeEvents[0]).toMatchObject({
        event: 'auto_resume',
        data: {
          reason: 'stall_pending_steps',
          attempt: 1,
          max: 2,
        },
      });

      // (2) Assistant row 가 2회 persist (중간 row + 최종 row). 반복 문구
      //     가 한 박스에 몰리는 근본 원인 "한 턴 = 한 row" 가 해소됐는지
      //     확인. (user message persist 는 별도 호출이라 `role` 필터링.)
      const persistCalls = mocks.sessionService.appendMessage.mock.calls
        .map((c) => c[1])
        .filter(
          (payload): payload is { role: string } & Record<string, unknown> =>
            (payload as { role?: string }).role === 'assistant',
        ) as Array<{
        content: string | null;
        finishReason: string | null;
        autoResumed: boolean;
        autoResumeReason: string | null;
        autoResumeAttempt: number | null;
        plan: unknown;
      }>;
      expect(persistCalls).toHaveLength(2);

      // 중간 row: stall 직전까지의 텍스트. finishReason 마커 + autoResumed=false.
      expect(persistCalls[0]).toMatchObject({
        content: '다음 단계에서 이어가겠습니다.',
        finishReason: 'auto_resume_pending',
        autoResumed: false,
        autoResumeReason: null,
        autoResumeAttempt: null,
      });

      // 최종 row: 재개 후 라운드 텍스트 (이번 시나리오에서는 edit+finish 라
      // text 가 없음). autoResumed=true + attempt=1 메타.
      expect(persistCalls[1]).toMatchObject({
        finishReason: 'stop',
        autoResumed: true,
        autoResumeReason: 'stall_pending_steps',
        autoResumeAttempt: 1,
      });

      // planPersisted 가드 — 이번 턴에서 `planForTurn` 이 null (history 로부터
      // 이어받은 plan 만 존재) 이므로 두 row 모두 plan=null. planPersisted 가
      // 오동작해 중간 row 에 역주입되지 않는지 고정 (review W-5).
      expect(persistCalls[0].plan).toBeNull();
      expect(persistCalls[1].plan).toBeNull();

      // (3) 최종적으로 정상 종료.
      const done = events[events.length - 1];
      expect(done).toMatchObject({
        event: 'done',
        data: { finishReason: 'stop' },
      });
    });

    // review W-8: stall 이 발동하기 전에 성공한 edit 이 있는 경우 중간 row
    // 에 그 toolCalls 가 포함되고, 재개 라운드의 row 에는 새 toolCalls 만
    // 들어가는 경계 동작을 고정.
    //
    // 실제 stall 경로는 "tool call 없이 텍스트만" 으로 끝났을 때 발동하지만,
    // 같은 턴의 **앞선 라운드**에서 성공한 edit 이 `pendingToolCalls` 에 쌓여
    // 있을 수 있다. 본 케이스는 Round 1 에 edit 성공 → Round 2 에 text only
    // stall → Round 3 에 마무리. Round 2 시점의 중간 persist 가 Round 1 의
    // edit tool 을 담아야 하고, 최종 persist 는 Round 3 이후의 tool 만 담아야
    // 한다.
    it('persists prior-round tool calls in the intermediate row and resets pendingToolCalls for the resumed round', async () => {
      const { service, mocks } = makeService();
      // 2-step plan (step 2 개가 각 라운드에 나눠 실행됨).
      mocks.sessionService.loadMessages.mockResolvedValue([
        { role: 'user', content: '시작', toolCalls: null },
        {
          role: 'assistant' as const,
          content: '',
          toolCalls: [
            {
              id: 'p0',
              name: 'propose_plan',
              arguments: {},
              kind: 'plan' as const,
              result: { ok: true },
            },
          ],
          plan: {
            title: 'Two-step build',
            summary: '',
            steps: [
              { id: 's1', action: 'add_node' as const, description: 's1' },
              { id: 's2', action: 'add_node' as const, description: 's2' },
            ],
            approvedAt: '2026-04-22T00:00:00Z',
          },
        },
      ]);
      // Round 1: edit 성공 → round-trip.
      mocks.llmService.chatStream.mockImplementationOnce(() =>
        asyncIter<ChatStreamEvent>([
          {
            type: 'tool_call_end',
            id: 'call_add_1',
            name: 'add_node',
            arguments: JSON.stringify({
              type: 'http_request',
              label: 'First',
              position: { x: 500, y: 300 },
              config: {},
              planStepId: 's1',
            }),
          },
          {
            type: 'done',
            usage: { inputTokens: 5, outputTokens: 3, totalTokens: 8 },
            model: 'gpt-oss-120b',
            finishReason: 'tool_calls',
          },
        ]),
      );
      // Round 2: text only stall — 서버 auto-resume.
      mocks.llmService.chatStream.mockImplementationOnce(() =>
        asyncIter<ChatStreamEvent>([
          { type: 'text_delta', delta: '계속 진행해도 될까요?' },
          {
            type: 'done',
            usage: { inputTokens: 3, outputTokens: 3, totalTokens: 6 },
            model: 'gpt-oss-120b',
            finishReason: 'stop',
          },
        ]),
      );
      // Round 3: nudge 수신 후 남은 step 실행 + finish.
      mocks.llmService.chatStream.mockImplementationOnce(() =>
        asyncIter<ChatStreamEvent>([
          {
            type: 'tool_call_end',
            id: 'call_add_2',
            name: 'add_node',
            arguments: JSON.stringify({
              type: 'http_request',
              label: 'Second',
              position: { x: 800, y: 300 },
              config: {},
              planStepId: 's2',
            }),
          },
          {
            type: 'tool_call_end',
            id: 'call_fin',
            name: 'finish',
            arguments: '{}',
          },
          {
            type: 'done',
            usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
            model: 'gpt-oss-120b',
            finishReason: 'stop',
          },
        ]),
      );

      await collect(
        service.streamMessage('sess-1', 'ws-1', 'u-1', baseDto as never),
      );

      const persistCalls = mocks.sessionService.appendMessage.mock.calls
        .map((c) => c[1])
        .filter(
          (p): p is { role: string } & Record<string, unknown> =>
            (p as { role?: string }).role === 'assistant',
        ) as Array<{
        content: string | null;
        toolCalls: Array<{ id: string; name: string }> | null;
        autoResumed: boolean;
      }>;
      expect(persistCalls).toHaveLength(2);

      // 중간 row: Round 1 의 edit + Round 2 의 stall 텍스트.
      //   toolCalls 에 call_add_1 은 반드시 있어야 하고, call_add_2/call_fin
      //   은 최종 row 로 넘어가야 한다.
      expect(persistCalls[0].content).toContain('계속 진행해도 될까요?');
      expect((persistCalls[0].toolCalls ?? []).map((t) => t.id)).toEqual([
        'call_add_1',
      ]);

      // 최종 row: Round 3 의 tool call 만. 중간 row 의 call_add_1 이 중복
      // 저장되면 pendingToolCalls 리셋 누락을 의미.
      expect((persistCalls[1].toolCalls ?? []).map((t) => t.id)).toEqual([
        'call_add_2',
        'call_fin',
      ]);
      expect(persistCalls[1].autoResumed).toBe(true);
    });

    // review W-7: stall 복구가 1회 이상 성공한 뒤 에러가 발생하면, 에러 경로의
    // persist 도 `autoResumed=true` 메타를 실어야 한다. 그래야 rehydrate 시
    // 에러 bubble 앞에 divider 가 그려져 "턴이 분리됐다" 는 시각 signal 이 유지.
    it('carries autoResumed=true onto the error-path row when a stall already triggered at least once', async () => {
      const { service, mocks } = makeService();
      mocks.sessionService.loadMessages.mockResolvedValue([
        { role: 'user', content: '시작', toolCalls: null },
        primeApprovedPlan(),
      ]);
      // Round 1: text-only stall → auto-resume.
      mocks.llmService.chatStream.mockImplementationOnce(() =>
        asyncIter<ChatStreamEvent>([
          { type: 'text_delta', delta: '잠시만요' },
          {
            type: 'done',
            usage: { inputTokens: 3, outputTokens: 3, totalTokens: 6 },
            model: 'gpt-oss-120b',
            finishReason: 'stop',
          },
        ]),
      );
      // Round 2: provider 에러 이벤트.
      mocks.llmService.chatStream.mockImplementationOnce(() =>
        asyncIter<ChatStreamEvent>([
          {
            type: 'error',
            code: 'LLM_RATE_LIMIT',
            message: 'rate limited',
          },
        ]),
      );

      await collect(
        service.streamMessage('sess-1', 'ws-1', 'u-1', baseDto as never),
      );

      const persistCalls = mocks.sessionService.appendMessage.mock.calls
        .map((c) => c[1])
        .filter(
          (p): p is { role: string } & Record<string, unknown> =>
            (p as { role?: string }).role === 'assistant',
        ) as Array<{
        finishReason: string | null;
        autoResumed: boolean;
        autoResumeReason: string | null;
        autoResumeAttempt: number | null;
      }>;

      // 중간 row + 에러 경로 최종 row.
      expect(persistCalls).toHaveLength(2);
      expect(persistCalls[0].finishReason).toBe('auto_resume_pending');
      expect(persistCalls[0].autoResumed).toBe(false);

      // 에러 row: finishReason 은 'error' 지만 복구 맥락을 유지하기 위해
      // autoResumed/attempt 는 실려 있어야 한다.
      expect(persistCalls[1].finishReason).toBe('error');
      expect(persistCalls[1].autoResumed).toBe(true);
      expect(persistCalls[1].autoResumeReason).toBe('stall_pending_steps');
      expect(persistCalls[1].autoResumeAttempt).toBe(1);
    });

    it('gives up after MAX_STALL_ROUNDS (2) consecutive text-only stalls to prevent runaway loops', async () => {
      const { service, mocks } = makeService();
      mocks.sessionService.loadMessages.mockResolvedValue([
        { role: 'user', content: '시작', toolCalls: null },
        primeApprovedPlan(),
      ]);
      // LLM 이 계속 텍스트만 뱉고 stop — 서버는 2회 nudge 후 포기.
      const stallStream = () =>
        asyncIter<ChatStreamEvent>([
          { type: 'text_delta', delta: '다음에 이어갑니다.' },
          {
            type: 'done',
            usage: { inputTokens: 3, outputTokens: 3, totalTokens: 6 },
            model: 'gpt-oss-120b',
            finishReason: 'stop',
          },
        ]);
      mocks.llmService.chatStream.mockImplementation(stallStream);

      const events = await collect(
        service.streamMessage('sess-1', 'ws-1', 'u-1', baseDto as never),
      );

      // 3 라운드 호출: Round 1 (stall=1), Round 2 (stall=2), Round 3 (포기).
      // Round 3 도 stall 이지만 counter 가 MAX 에 도달해 더 이상 continue 안 함.
      expect(mocks.llmService.chatStream).toHaveBeenCalledTimes(3);

      // `auto_resume` SSE 이벤트는 복구를 "시도" 한 횟수 만큼 발행
      // (MAX_STALL_ROUNDS=2 → 2회, attempt 1, 2). 복구 포기 라운드(3번째)는
      // continue 자체를 안 하므로 이벤트 없음.
      const autoResumeEvents = events.filter((e) => e.event === 'auto_resume');
      expect(autoResumeEvents).toHaveLength(2);
      expect(
        autoResumeEvents.map((e) => (e.data as { attempt: number }).attempt),
      ).toEqual([1, 2]);

      // Assistant row 총 3회 persist: 중간 row 2개 (MAX 만큼 분리) + 최종
      // row 1개. 최종 row 는 autoResumed=true + attempt=MAX (2). user
      // message persist 는 별도 호출이라 `role` 로 필터링.
      const persistCalls = mocks.sessionService.appendMessage.mock.calls
        .map((c) => c[1])
        .filter(
          (payload): payload is { role: string } & Record<string, unknown> =>
            (payload as { role?: string }).role === 'assistant',
        ) as Array<{
        finishReason: string | null;
        autoResumed: boolean;
        autoResumeAttempt: number | null;
      }>;
      expect(persistCalls).toHaveLength(3);
      expect(persistCalls[0].finishReason).toBe('auto_resume_pending');
      expect(persistCalls[0].autoResumed).toBe(false);
      expect(persistCalls[1].finishReason).toBe('auto_resume_pending');
      expect(persistCalls[1].autoResumed).toBe(false);
      expect(persistCalls[2].autoResumed).toBe(true);
      expect(persistCalls[2].autoResumeAttempt).toBe(2);
      // 향후 reason 이 추가되면 여기 토픽이 깨지도록 명시적 고정 (review INFO-6).
      expect(
        (persistCalls[2] as { autoResumeReason: string }).autoResumeReason,
      ).toBe('stall_pending_steps');
    });

    it('does NOT auto-continue when plan has no pending actionable steps', async () => {
      const { service, mocks } = makeService();
      // 모든 step 이 completed 인 plan.
      mocks.sessionService.loadMessages.mockResolvedValue([
        { role: 'user', content: '시작', toolCalls: null },
        {
          role: 'assistant' as const,
          content: '',
          toolCalls: [
            {
              id: 'p0',
              name: 'propose_plan',
              arguments: {},
              kind: 'plan' as const,
              result: { ok: true },
            },
            {
              id: 't1',
              name: 'add_node',
              arguments: {},
              kind: 'edit' as const,
              result: { ok: true, id: 'n-1' },
              planStepId: 's1',
            },
          ],
          plan: {
            title: 'Done plan',
            summary: '',
            steps: [
              { id: 's1', action: 'add_node' as const, description: 's1' },
            ],
            approvedAt: '2026-04-22T00:00:00Z',
          },
        },
      ]);
      mocks.llmService.chatStream.mockImplementationOnce(() =>
        asyncIter<ChatStreamEvent>([
          { type: 'text_delta', delta: '이미 완료된 plan 입니다.' },
          {
            type: 'done',
            usage: { inputTokens: 3, outputTokens: 3, totalTokens: 6 },
            model: 'gpt-4o',
            finishReason: 'stop',
          },
        ]),
      );

      const events = await collect(
        service.streamMessage('sess-1', 'ws-1', 'u-1', baseDto as never),
      );

      // 단일 라운드로 종료 — pending step 이 없어 stall 가드가 발동 안 함.
      expect(mocks.llmService.chatStream).toHaveBeenCalledTimes(1);

      // `auto_resume` 이벤트도 없고, assistant row 는 1회 persist,
      // autoResumed=false 가 기본.
      expect(events.filter((e) => e.event === 'auto_resume')).toHaveLength(0);
      const assistantPersist = mocks.sessionService.appendMessage.mock.calls
        .map((c) => c[1])
        .filter(
          (p): p is { role: string } & Record<string, unknown> =>
            (p as { role?: string }).role === 'assistant',
        );
      expect(assistantPersist).toHaveLength(1);
      const call = assistantPersist[0] as unknown as {
        autoResumed: boolean;
        autoResumeReason: string | null;
        autoResumeAttempt: number | null;
      };
      expect(call.autoResumed).toBe(false);
      expect(call.autoResumeReason).toBeNull();
      expect(call.autoResumeAttempt).toBeNull();
    });
  });

  // PORT_NOT_FOUND: stream.service 가 ShadowWorkflow 에 portResolver 를 주입해
  // LLM 이 존재하지 않는 포트로 add_edge 시도할 때 초기에 reject 하는지 검증.
  // 특히 사용자 스크린샷 (config 미완 → 동적 포트 없음 → edge 실패 × 18) 시나리오.
  describe('add_edge port validation (PORT_NOT_FOUND)', () => {
    it('rejects add_edge when source_port does not exist on a carousel (config missed the buttons)', async () => {
      const { service, mocks } = makeService();
      // Registry 에 carousel 정의 주입 — dynamicPorts: presentation-buttons.
      mocks.nodeRegistry.listDefinitions.mockReturnValue([
        {
          metadata: {
            type: 'manual_trigger',
            category: 'trigger',
            description: 'Manual trigger',
          },
          ports: {
            inputs: [],
            outputs: [{ id: 'out', label: 'Output', type: 'data' }],
          },
        },
        {
          metadata: {
            type: 'carousel',
            category: 'presentation',
            description: 'Carousel',
            dynamicPorts: {
              kind: 'presentation-buttons',
              supportsItems: true,
              supportsItemButtons: true,
              continueId: 'continue',
            },
          },
          ports: {
            inputs: [{ id: 'in', label: 'Input', type: 'data' }],
            outputs: [{ id: 'out', label: 'Output', type: 'data' }],
          },
        },
        {
          metadata: {
            type: 'template',
            category: 'presentation',
            description: 'Template',
          },
          ports: {
            inputs: [{ id: 'in', label: 'Input', type: 'data' }],
            outputs: [{ id: 'out', label: 'Output', type: 'data' }],
          },
        },
      ]);
      // 초기 canvas: trigger + carousel(config 비어있음 = 버튼 없음) + template.
      const primedDto = {
        content: '엣지 연결해줘',
        currentWorkflow: {
          nodes: [
            {
              id: 'trig-1',
              type: 'manual_trigger',
              category: 'trigger',
              label: 'Start',
              positionX: 0,
              positionY: 0,
              config: {},
            },
            {
              id: 'n-c',
              type: 'carousel',
              category: 'presentation',
              label: '메뉴 선택',
              positionX: 300,
              positionY: 0,
              // buttons 설정 안 됨 → 동적 포트 없음 (fallback out 만).
              config: {},
            },
            {
              id: 'n-t',
              type: 'template',
              category: 'presentation',
              label: '결과',
              positionX: 600,
              positionY: 0,
              config: {},
            },
          ],
          edges: [],
        },
      };
      mocks.llmService.chatStream.mockImplementation(() =>
        asyncIter<ChatStreamEvent>([
          {
            type: 'tool_call_end',
            id: 'call_edge',
            name: 'add_edge',
            // LLM 이 btn_a 포트에 연결을 시도 — config 에 해당 버튼 없음.
            arguments: JSON.stringify({
              source_id: 'n-c',
              source_port: 'btn_a',
              target_id: 'n-t',
              target_port: 'in',
            }),
          },
          {
            type: 'done',
            usage: { inputTokens: 5, outputTokens: 3, totalTokens: 8 },
            model: 'gpt-4o',
            finishReason: 'stop',
          },
        ]),
      );

      const events = await collect(
        service.streamMessage('sess-1', 'ws-1', 'u-1', primedDto as never),
      );

      const edgeEvent = events.find(
        (e) =>
          e.event === 'tool_call' &&
          (e.data as { name: string }).name === 'add_edge',
      );
      expect(edgeEvent).toBeDefined();
      const result = (
        edgeEvent!.data as {
          result: {
            ok: boolean;
            error?: string;
            portInfo?: {
              side: string;
              attemptedPort: string;
              knownPorts: string[];
            };
          };
        }
      ).result;
      expect(result.ok).toBe(false);
      expect(result.error).toBe('PORT_NOT_FOUND');
      expect(result.portInfo?.side).toBe('source');
      expect(result.portInfo?.attemptedPort).toBe('btn_a');
      // carousel 의 config 가 비어 fallback static 'out' 만 노출됨.
      expect(result.portInfo?.knownPorts).toEqual(['out']);
    });
  });

  // 실행 조회 도구 2종이 dispatch → ExploreToolsService 위임 → SSE tool_call
  // (kind=explore) 로 정상 래핑되는지 회귀 방어. 개별 메서드의 단위 테스트는
  // explore-tools.service.spec.ts 에서 수행한다.
  describe('execution read tools — get_workflow_executions / get_execution_details', () => {
    it('delegates get_workflow_executions to ExploreToolsService with session workflowId and emits explore tool_call', async () => {
      const { service, mocks } = makeService();
      mocks.exploreTools.getWorkflowExecutions.mockResolvedValue({
        ok: true,
        workflowId: 'wf-1',
        workflowName: 'WF',
        items: [
          {
            id: 'ex-1',
            status: 'failed',
            startedAt: new Date().toISOString(),
            finishedAt: new Date().toISOString(),
            durationMs: 100,
            nodeStats: { total: 3, completed: 2, failed: 1 },
          },
        ],
      });
      mocks.llmService.chatStream.mockImplementation(() =>
        asyncIter<ChatStreamEvent>([
          {
            type: 'tool_call_end',
            id: 'call_1',
            name: 'get_workflow_executions',
            arguments: JSON.stringify({ limit: 5, status: 'failed' }),
          },
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

      expect(mocks.exploreTools.getWorkflowExecutions).toHaveBeenCalledWith(
        'ws-1',
        'wf-1',
        { limit: 5, status: 'failed' },
      );
      const toolEvent = events.find(
        (e) =>
          e.event === 'tool_call' &&
          (e.data as { name: string }).name === 'get_workflow_executions',
      );
      expect(toolEvent).toBeDefined();
      expect((toolEvent!.data as { kind: string }).kind).toBe('explore');
      const result = (toolEvent!.data as { result: Record<string, unknown> })
        .result;
      expect(result.ok).toBe(true);
      expect((result.items as unknown[])[0]).toMatchObject({ id: 'ex-1' });
    });

    it('delegates get_execution_details to ExploreToolsService with the session workflowId scope', async () => {
      const { service, mocks } = makeService();
      mocks.exploreTools.getExecutionDetails.mockResolvedValue({
        ok: true,
        execution: { id: 'ex-1', status: 'failed' },
        timeline: [
          { nodeExecutionId: 'ne-1', nodeId: 'n-1', status: 'failed' },
        ],
        subExecutions: [],
      });
      mocks.llmService.chatStream.mockImplementation(() =>
        asyncIter<ChatStreamEvent>([
          {
            type: 'tool_call_end',
            id: 'call_1',
            name: 'get_execution_details',
            arguments: JSON.stringify({
              id: '11111111-1111-4111-8111-111111111111',
            }),
          },
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

      expect(mocks.exploreTools.getExecutionDetails).toHaveBeenCalledWith(
        'ws-1',
        'wf-1',
        '11111111-1111-4111-8111-111111111111',
      );
      const toolEvent = events.find(
        (e) =>
          e.event === 'tool_call' &&
          (e.data as { name: string }).name === 'get_execution_details',
      );
      expect(toolEvent).toBeDefined();
      expect((toolEvent!.data as { kind: string }).kind).toBe('explore');
    });
  });

  // 사용자 보고: "Maximum 10 buttons allowed per node" 가 워크플로우 실행 시점에
  // INVALID_NODE_CONFIG 로 떨어지는 케이스. 7487d49 가 shadow 단계 hard-reject 를
  // 비차단 configWarnings 로 demote 했지만, LLM 이 그 경고를 인지·교정하도록
  // 강제하는 finish 가드는 빠져 있었다. NODE_CONFIG_WARNINGS 체크리스트가
  // 그 갭을 메우는지 end-to-end 로 고정한다.
  describe('NODE_CONFIG_WARNINGS — finish gate for handler.validate non-blocking warnings', () => {
    it('blocks the first finish when an add_node returned configWarnings, then passes after update_node clears them', async () => {
      const { service, mocks } = makeService();
      // Object-form ports 는 shadow 의 add_edge / dangling 검사가 정상 동작
      // 하도록 보장. NODE_CONFIG_WARNINGS 와는 직접 무관하지만 review checklist
      // 의 다른 항목이 잘못 fire 하지 않도록 baseline 을 깨끗이 둔다.
      mocks.nodeRegistry.listDefinitions.mockReturnValue([
        {
          metadata: {
            type: 'manual_trigger',
            category: 'trigger',
            description: 'Manual trigger',
          },
          ports: {
            inputs: [],
            outputs: [{ id: 'out', label: 'Output', type: 'data' }],
          },
        },
        {
          metadata: {
            type: 'http_request',
            category: 'integration',
            description: 'HTTP request',
          },
          ports: {
            inputs: [{ id: 'in', label: 'Input', type: 'data' }],
            outputs: [{ id: 'out', label: 'Output', type: 'data' }],
          },
        },
      ]);
      // configValidator 브리지 — `handlerRegistry.has(type)` 가 true 이면
      // `handlerRegistry.get(type).validate(config)` 가 시뮬레이션된다. 본
      // 테스트에서는 http_request 노드의 config 에 `tooMany: true` 가 있을
      // 때만 errors 를 반환해 "validate 실패 → configWarnings 동봉" 경로를
      // 재현한다. update_node 로 false 로 바뀌면 깨끗.
      mocks.handlerRegistry.has.mockImplementation(
        (t: string) => t === 'http_request',
      );
      mocks.handlerRegistry.get.mockImplementation(() => ({
        validate: (cfg: Record<string, unknown>) =>
          cfg.tooMany === true
            ? {
                valid: false,
                errors: ['Maximum 10 buttons allowed per node'],
              }
            : { valid: true, errors: [] },
      }));

      // Round 1: 두 노드 추가 (review skip 조건 nonTriggerCount<=1 회피용),
      //          엣지 두 개 추가, finish 호출 → 첫 finish 는 NODE_CONFIG_WARNINGS
      //          로 block.
      // Round 2: LLM (mock) 이 update_node 로 config.tooMany 를 false 로 정정
      //          한 뒤 finish 다시 호출 → review_completed 로 통과.
      mocks.llmService.chatStream.mockImplementation((_cfg, params) => {
        const round = mocks.llmService.chatStream.mock.calls.length;
        if (round === 1) {
          return asyncIter<ChatStreamEvent>([
            {
              type: 'tool_call_end',
              id: 'add_warn',
              name: 'add_node',
              arguments: JSON.stringify({
                type: 'http_request',
                label: '메뉴 카드',
                position: { x: 400, y: 200 },
                config: { tooMany: true },
              }),
            },
            {
              type: 'tool_call_end',
              id: 'add_clean',
              name: 'add_node',
              arguments: JSON.stringify({
                type: 'http_request',
                label: '결과',
                position: { x: 600, y: 200 },
                config: { tooMany: false },
              }),
            },
            {
              type: 'done',
              usage: { inputTokens: 30, outputTokens: 20, totalTokens: 50 },
              model: 'gpt-4o',
              finishReason: 'tool_calls',
            },
          ]);
        }
        if (round === 2) {
          // 라운드 1 의 add_node 결과에서 두 UUID 를 추출 — 엣지 연결과
          // 후속 update_node 가 공통적으로 필요로 한다.
          const msgs = (
            params as {
              messages: Array<{
                role: string;
                content?: string | null;
                toolCallId?: string;
              }>;
            }
          ).messages;
          const idByCall = new Map<string, string>();
          for (const m of msgs) {
            if (m.role !== 'tool') continue;
            if (!m.toolCallId) continue;
            const parsed = JSON.parse(m.content as string) as {
              id?: string;
            };
            if (typeof parsed.id === 'string') {
              idByCall.set(m.toolCallId, parsed.id);
            }
          }
          const warnId = idByCall.get('add_warn')!;
          const cleanId = idByCall.get('add_clean')!;
          expect(warnId).toMatch(/[0-9a-f-]{36}/);
          return asyncIter<ChatStreamEvent>([
            {
              type: 'tool_call_end',
              id: 'edge_a',
              name: 'add_edge',
              arguments: JSON.stringify({
                source_id: 'trig-1',
                target_id: warnId,
              }),
            },
            {
              type: 'tool_call_end',
              id: 'edge_b',
              name: 'add_edge',
              arguments: JSON.stringify({
                source_id: warnId,
                target_id: cleanId,
              }),
            },
            {
              type: 'tool_call_end',
              id: 'fin1',
              name: 'finish',
              arguments: '{}',
            },
            {
              type: 'done',
              usage: { inputTokens: 40, outputTokens: 8, totalTokens: 48 },
              model: 'gpt-4o',
              finishReason: 'tool_calls',
            },
          ]);
        }
        // Round 3: 검토 응답을 받은 LLM 이 update_node 로 교정 후 finish 재호출.
        const msgs = (
          params as {
            messages: Array<{
              role: string;
              content?: string | null;
              toolCallId?: string;
            }>;
          }
        ).messages;
        const finalAddResult = msgs.find(
          (m) => m.role === 'tool' && m.toolCallId === 'add_warn',
        );
        const warnId = (
          JSON.parse(finalAddResult!.content as string) as { id: string }
        ).id;
        return asyncIter<ChatStreamEvent>([
          {
            type: 'tool_call_end',
            id: 'fix',
            name: 'update_node',
            arguments: JSON.stringify({
              id: warnId,
              patch: { config: { tooMany: false } },
            }),
          },
          {
            type: 'tool_call_end',
            id: 'fin2',
            name: 'finish',
            arguments: '{}',
          },
          {
            type: 'done',
            usage: { inputTokens: 25, outputTokens: 6, totalTokens: 31 },
            model: 'gpt-4o',
            finishReason: 'stop',
          },
        ]);
      });

      const events = await collect(
        service.streamMessage('sess-1', 'ws-1', 'u-1', baseDto as never),
      );

      // (a) 첫 add_node 결과에 configWarnings 가 실린다 (shadow 비차단 정책).
      const addWarnEvent = events.find(
        (e) =>
          e.event === 'tool_call' &&
          (e.data as { id: string }).id === 'add_warn',
      );
      expect(addWarnEvent).toBeDefined();
      const addWarnResult = (
        addWarnEvent!.data as {
          result: { ok: boolean; configWarnings?: string[] };
        }
      ).result;
      expect(addWarnResult.ok).toBe(true);
      expect(addWarnResult.configWarnings).toEqual([
        'Maximum 10 buttons allowed per node',
      ]);

      // (b) 첫 finish (fin1) 는 review block — fin1 의 tool_result 에
      //     WORKFLOW_REVIEW_REQUIRED 가 포함되고 checklist 에 NODE_CONFIG_WARNINGS
      //     가 있어야 한다.
      const round3Messages = mocks.llmService.chatStream.mock.calls[2][1]
        .messages as Array<{
        role: string;
        content?: string;
        toolCallId?: string;
      }>;
      const fin1Result = round3Messages.find(
        (m) => m.role === 'tool' && m.toolCallId === 'fin1',
      );
      expect(fin1Result).toBeDefined();
      const parsed = JSON.parse(fin1Result!.content ?? 'null') as {
        ok: boolean;
        error?: string;
        checklist?: Array<{ code: string; data?: unknown }>;
      };
      expect(parsed.ok).toBe(false);
      expect(parsed.error).toBe('WORKFLOW_REVIEW_REQUIRED');
      const codes = (parsed.checklist ?? []).map((c) => c.code);
      expect(codes).toContain('NODE_CONFIG_WARNINGS');
      const warnItem = parsed.checklist!.find(
        (c) => c.code === 'NODE_CONFIG_WARNINGS',
      )!;
      const data = warnItem.data as Array<{
        nodeId: string;
        nodeLabel?: string;
        warnings: string[];
      }>;
      expect(data).toHaveLength(1);
      expect(data[0].nodeLabel).toBe('메뉴 카드');
      expect(data[0].warnings).toEqual(['Maximum 10 buttons allowed per node']);

      // (c) 두 번째 finish (fin2) 는 통과 — review_completed 로 재검증 skip.
      //     스트림이 정상 종료(stop) 되었는지 확인.
      const done = events[events.length - 1];
      expect(done).toMatchObject({
        event: 'done',
        data: { finishReason: 'stop' },
      });

      // (d) update_node 로 교정 후 호출은 ok:true / configWarnings 없음.
      const fixEvent = events.find(
        (e) =>
          e.event === 'tool_call' && (e.data as { id: string }).id === 'fix',
      );
      expect(fixEvent).toBeDefined();
      const fixResult = (
        fixEvent!.data as { result: { ok: boolean; configWarnings?: string[] } }
      ).result;
      expect(fixResult.ok).toBe(true);
      expect(fixResult.configWarnings).toBeUndefined();
    });
  });

  // LLM 이 한 메시지(=한 라운드)에 여러 tool_use 블록을 동시에 emit 하는
  // 병렬 경로. 인프라(anthropic.client 스트림 디코더 + stream service 라운드
  // 루프)는 이미 이 시나리오를 허용한다. 모델이 실제로 그렇게 냈을 때
  // (a) 모두 shadow 에 순차 적용되고, (b) 단 한 번의 round-trip 으로 LLM 에
  // 피드백되는지 (한 assistant 메시지에 여러 toolCalls + 짝지어진 role:'tool'
  // 메시지) 고정한다. 그리고 연속 라운드에서 "노드 배치 → 엣지 배치" 의
  // 계층화 시나리오도 각 라운드의 배치가 온전히 round-trip 되는지 확인한다.
  describe('parallel tool calls (multiple tool_use blocks per round)', () => {
    // 포트 검증 (validateEdgePorts) 이 known 포트를 인식하도록 object-form
    // 으로 listDefinitions 를 내려줄 때 공통으로 쓰는 fixture.
    const objectFormDefs = [
      {
        metadata: {
          type: 'manual_trigger',
          category: 'trigger',
          description: 'Manual trigger',
        },
        ports: {
          inputs: [],
          outputs: [{ id: 'out', label: 'Output', type: 'data' }],
        },
      },
      {
        metadata: {
          type: 'http_request',
          category: 'integration',
          description: 'HTTP request',
        },
        ports: {
          inputs: [{ id: 'in', label: 'Input', type: 'data' }],
          outputs: [
            { id: 'out', label: 'Output', type: 'data' },
            { id: 'error', label: 'Error', type: 'error' },
          ],
        },
      },
    ];

    it('applies all add_node blocks in one round and round-trips them together', async () => {
      const { service, mocks } = makeService();
      mocks.nodeRegistry.listDefinitions.mockReturnValue(objectFormDefs);
      // Round 1: add_node × 3 parallel → finishReason 'tool_calls'
      // Round 2: text-only close (no tool calls) → loop exits naturally.
      // 이 테스트는 "한 라운드의 다중 tool_use 가 배치로 shadow 에 적용되고
      // 단일 round-trip 으로 LLM 에 되돌아간다" 만 검증한다. finish 는 review
      // 가드 (orphan 노드 감지) 가 개입하는 별개 경로라 여기서는 배제.
      mocks.llmService.chatStream.mockImplementation(() => {
        const callIdx = mocks.llmService.chatStream.mock.calls.length;
        if (callIdx === 1) {
          return asyncIter<ChatStreamEvent>([
            {
              type: 'tool_call_end',
              id: 'c_a',
              name: 'add_node',
              arguments: JSON.stringify({
                type: 'http_request',
                label: 'Fetch A',
                position: { x: 400, y: 200 },
                config: { method: 'GET' },
              }),
            },
            {
              type: 'tool_call_end',
              id: 'c_b',
              name: 'add_node',
              arguments: JSON.stringify({
                type: 'http_request',
                label: 'Fetch B',
                position: { x: 600, y: 200 },
                config: { method: 'GET' },
              }),
            },
            {
              type: 'tool_call_end',
              id: 'c_c',
              name: 'add_node',
              arguments: JSON.stringify({
                type: 'http_request',
                label: 'Fetch C',
                position: { x: 800, y: 200 },
                config: { method: 'GET' },
              }),
            },
            {
              type: 'done',
              usage: { inputTokens: 40, outputTokens: 30, totalTokens: 70 },
              model: 'gpt-4o',
              finishReason: 'tool_calls',
            },
          ]);
        }
        return asyncIter<ChatStreamEvent>([
          { type: 'text_delta', delta: 'ok' },
          {
            type: 'done',
            usage: { inputTokens: 5, outputTokens: 2, totalTokens: 7 },
            model: 'gpt-4o',
            finishReason: 'stop',
          },
        ]);
      });

      const events = await collect(
        service.streamMessage('sess-1', 'ws-1', 'u-1', baseDto as never),
      );

      // (a) 세 tool_call SSE 이벤트가 모두 emit, 각각 고유 UUID.
      const toolEvents = events.filter(
        (e) =>
          e.event === 'tool_call' &&
          (e.data as { name: string }).name === 'add_node',
      );
      expect(toolEvents).toHaveLength(3);
      const resultIds = toolEvents.map(
        (e) => (e.data as { result: { id?: string } }).result.id!,
      );
      expect(new Set(resultIds).size).toBe(3);
      resultIds.forEach((id) => expect(id).toMatch(/[0-9a-f-]{36}/));

      // (b) chatStream 은 정확히 두 번 호출 — 3 개의 tool_use 가 한 라운드에
      //     모두 처리되고 round-trip 은 단 한 번.
      expect(mocks.llmService.chatStream).toHaveBeenCalledTimes(2);

      // (c) 두 번째 호출에 전달된 messages 는 assistant.toolCalls 3 개 +
      //     role:'tool' 메시지 3 개 (id 로 paired) 를 포함.
      const secondCallParams = mocks.llmService.chatStream.mock.calls[1][1] as {
        messages: Array<{
          role: string;
          content?: string | null;
          toolCalls?: Array<{ id: string; name: string }>;
          toolCallId?: string;
        }>;
      };
      const assistantMsg = secondCallParams.messages.find(
        (m) => m.role === 'assistant' && m.toolCalls,
      );
      expect(assistantMsg).toBeDefined();
      expect(assistantMsg!.toolCalls).toHaveLength(3);
      const batchedIds = assistantMsg!.toolCalls!.map((t) => t.id).sort();
      expect(batchedIds).toEqual(['c_a', 'c_b', 'c_c']);
      const toolMsgs = secondCallParams.messages.filter(
        (m) => m.role === 'tool',
      );
      expect(toolMsgs.map((m) => m.toolCallId).sort()).toEqual([
        'c_a',
        'c_b',
        'c_c',
      ]);

      // (d) assistant DB row 에 3 edit tool_calls 가 모두 기록된다.
      const assistantPersisted =
        mocks.sessionService.appendMessage.mock.calls[1][1];
      const editToolCalls = (
        assistantPersisted.toolCalls as Array<{ kind: string; name: string }>
      ).filter((t) => t.kind === 'edit');
      expect(editToolCalls).toHaveLength(3);
      expect(editToolCalls.map((t) => t.name)).toEqual([
        'add_node',
        'add_node',
        'add_node',
      ]);
    });

    it('batches add_node×2 then add_edge×2 across two rounds, each fully round-tripped in a single message', async () => {
      const { service, mocks } = makeService();
      mocks.nodeRegistry.listDefinitions.mockReturnValue(objectFormDefs);
      // 서비스가 `messages` 배열을 mutable 하게 push 하므로 jest 의 mock.calls
      // 는 같은 레퍼런스를 공유한다. 각 라운드 시점의 상태를 비교하려면 호출
      // 시점에 deep clone 을 찍어둬야 한다.
      const perRoundMessages: Array<
        Array<{
          role: string;
          content?: string | null;
          toolCalls?: Array<{ id: string; name: string }>;
          toolCallId?: string;
        }>
      > = [];
      // Round 1: add_node × 2 (둘 다 trig-1 에서 독립)
      // Round 2: add_edge × 2 (라운드 1 에서 받은 UUID 로 엣지 2개 배치)
      // Round 3: text-only close (review / finish 경로는 별개 테스트 영역).
      mocks.llmService.chatStream.mockImplementation((_cfg, params) => {
        perRoundMessages.push(
          JSON.parse(
            JSON.stringify(
              (
                params as {
                  messages: unknown[];
                }
              ).messages,
            ),
          ),
        );
        const callIdx = mocks.llmService.chatStream.mock.calls.length;
        if (callIdx === 1) {
          return asyncIter<ChatStreamEvent>([
            {
              type: 'tool_call_end',
              id: 'c_n1',
              name: 'add_node',
              arguments: JSON.stringify({
                type: 'http_request',
                label: 'N1',
                position: { x: 400, y: 200 },
                config: { method: 'GET' },
              }),
            },
            {
              type: 'tool_call_end',
              id: 'c_n2',
              name: 'add_node',
              arguments: JSON.stringify({
                type: 'http_request',
                label: 'N2',
                position: { x: 600, y: 200 },
                config: { method: 'GET' },
              }),
            },
            {
              type: 'done',
              usage: { inputTokens: 40, outputTokens: 30, totalTokens: 70 },
              model: 'gpt-4o',
              finishReason: 'tool_calls',
            },
          ]);
        }
        if (callIdx === 2) {
          // 라운드 1 tool_result 에서 새 UUID 2 개를 추출 (실제 LLM 도 tool
          // output 을 읽은 뒤 다음 라운드 add_edge 인자에 그 UUID 를 채운다).
          const msgs = (
            params as {
              messages: Array<{
                role: string;
                content?: string | null;
                toolCallId?: string;
              }>;
            }
          ).messages;
          const newIds = msgs
            .filter(
              (m) =>
                m.role === 'tool' &&
                (m.toolCallId === 'c_n1' || m.toolCallId === 'c_n2'),
            )
            .map((m) => JSON.parse(m.content as string).id as string);
          expect(newIds).toHaveLength(2);
          return asyncIter<ChatStreamEvent>([
            {
              type: 'tool_call_end',
              id: 'c_e1',
              name: 'add_edge',
              arguments: JSON.stringify({
                source_id: 'trig-1',
                target_id: newIds[0],
              }),
            },
            {
              type: 'tool_call_end',
              id: 'c_e2',
              name: 'add_edge',
              arguments: JSON.stringify({
                source_id: newIds[0],
                target_id: newIds[1],
              }),
            },
            {
              type: 'done',
              usage: { inputTokens: 45, outputTokens: 20, totalTokens: 65 },
              model: 'gpt-4o',
              finishReason: 'tool_calls',
            },
          ]);
        }
        return asyncIter<ChatStreamEvent>([
          { type: 'text_delta', delta: 'ok' },
          {
            type: 'done',
            usage: { inputTokens: 5, outputTokens: 2, totalTokens: 7 },
            model: 'gpt-4o',
            finishReason: 'stop',
          },
        ]);
      });

      const events = await collect(
        service.streamMessage('sess-1', 'ws-1', 'u-1', baseDto as never),
      );

      // (a) chatStream 은 정확히 세 번 — 두 번의 병렬 배치 + 종료 라운드.
      expect(mocks.llmService.chatStream).toHaveBeenCalledTimes(3);

      // (b) add_node × 2, add_edge × 2 가 모두 ok:true 로 기록된다.
      const nodeEvents = events.filter(
        (e) =>
          e.event === 'tool_call' &&
          (e.data as { name: string }).name === 'add_node',
      );
      const edgeEvents = events.filter(
        (e) =>
          e.event === 'tool_call' &&
          (e.data as { name: string }).name === 'add_edge',
      );
      expect(nodeEvents).toHaveLength(2);
      expect(edgeEvents).toHaveLength(2);
      nodeEvents.forEach((e) =>
        expect((e.data as { result: { ok: boolean } }).result.ok).toBe(true),
      );
      edgeEvents.forEach((e) =>
        expect((e.data as { result: { ok: boolean } }).result.ok).toBe(true),
      );

      // (c) 라운드 2 의 전달된 messages 에서 assistant.toolCalls 가 2 개
      //     (라운드 1 의 병렬 add_node) 와 role:'tool' 2 개가 짝 지어짐.
      const r2Msgs = perRoundMessages[1];
      const r2Assistant = r2Msgs.find(
        (m) =>
          m.role === 'assistant' &&
          m.toolCalls?.length === 2 &&
          m.toolCalls.every((t) => t.name === 'add_node'),
      );
      expect(r2Assistant).toBeDefined();
      const r2ToolIds = r2Msgs
        .filter((m) => m.role === 'tool')
        .map((m) => m.toolCallId);
      expect(new Set(r2ToolIds)).toEqual(new Set(['c_n1', 'c_n2']));

      // (d) 라운드 3 의 전달된 messages 에는 라운드 2 의 병렬 add_edge 쌍이
      //     배치된 assistant 메시지가 포함.
      const r3Msgs = perRoundMessages[2];
      const r3EdgeBatch = r3Msgs.find(
        (m) =>
          m.role === 'assistant' &&
          m.toolCalls?.every((t) => t.name === 'add_edge') &&
          m.toolCalls.length === 2,
      );
      expect(r3EdgeBatch).toBeDefined();
      const r3EdgeToolIds = r3Msgs
        .filter((m) => m.role === 'tool' && m.toolCallId?.startsWith('c_e'))
        .map((m) => m.toolCallId);
      expect(new Set(r3EdgeToolIds)).toEqual(new Set(['c_e1', 'c_e2']));
    });
  });
});

/**
 * ED-AI-40 §4.3.2 포트 type 정규화 계약. node registry 가 돌려주는
 * `ResolvedPort.type` 은 `'data' | 'system' | 'error' | 'control'` 4종이지만,
 * tool_result 의 `result.ports[*].type` 은 `'data' | 'error'` 2종으로 좁혀
 * LLM 이 edge type 결정에만 집중하도록 한다. 이 테스트는 그 매핑을 고정한다
 * (review W-3).
 */
describe('toRuntimePortDescriptor — runtime port type 정규화', () => {
  it("preserves 'error' type as-is (edge type hint for LLM)", () => {
    const p = toRuntimePortDescriptor({
      id: 'err_out',
      type: 'error',
    });
    expect(p.type).toBe('error');
  });

  it.each([['data'], ['system'], ['control'], ['unknown_future_type']])(
    "coerces internal '%s' type to 'data' (external contract §4.3.2)",
    (rawType) => {
      const p = toRuntimePortDescriptor({ id: 'p', type: rawType });
      expect(p.type).toBe('data');
    },
  );

  it('sanitizes user-provided label (strips newlines and angle brackets)', () => {
    const p = toRuntimePortDescriptor({
      id: 'btn_x',
      type: 'data',
      label: 'Bad\n## HACK\n<script>alert(1)</script>',
    });
    expect(p.label).toBeDefined();
    expect(p.label).not.toMatch(/\n/);
    expect(p.label).not.toMatch(/<script>/);
  });

  it('omits label field entirely when source has none (no empty-object noise)', () => {
    const p = toRuntimePortDescriptor({ id: 'out', type: 'data' });
    expect('label' in p).toBe(false);
  });
});
