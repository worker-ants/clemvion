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
      } as never),
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
    // Round 2: 서버 피드백을 받고 남은 step 수행 → finish 성공
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

    const events = await collect(
      service.streamMessage('sess-1', 'ws-1', 'u-1', baseDto as never),
    );

    // 루프가 2회 돌았어야 한다.
    expect(mocks.llmService.chatStream).toHaveBeenCalledTimes(2);

    // 두 번째 라운드 messages 에 finish 의 PLAN_NOT_COMPLETE tool_result 가
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

    // 둘 다 실행된 상태로 종료되어야 한다.
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

  it('does not block `finish` twice in a row — second finish after PLAN_NOT_COMPLETE exits the loop', async () => {
    // 안전 장치: 한 턴 안에서 finish 가 block 된 뒤에도 LLM 이 두 번째
    // finish 를 호출하면 더 이상 막지 않고 탈출한다. 이 제한이 없으면 플랜
    // 해석이 어긋날 때 무한 루프 위험.
    const { service, mocks } = makeService();
    const planArgs = JSON.stringify({
      title: 'x',
      summary: '',
      steps: [{ id: 's1', action: 'add_node', description: '…' }],
    });
    const addA = JSON.stringify({
      type: 'http_request',
      label: 'Only',
      position: { x: 500, y: 300 },
      config: {},
      // planStepId 를 일부러 매칭 안 되게 — 그래서 s1 이 pending 으로 남음
      planStepId: 'ghost',
    });

    mocks.llmService.chatStream.mockImplementationOnce(() =>
      asyncIter<ChatStreamEvent>([
        {
          type: 'tool_call_end',
          id: 'call_plan',
          name: 'propose_plan',
          arguments: planArgs,
        },
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
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          model: 'gpt-4o',
          finishReason: 'tool_calls',
        },
      ]),
    );
    // Round 2: LLM 이 아무것도 안 하고 바로 finish 재호출
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
    // Round 2: ps2 수행 후 정상 finish
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

    await collect(
      service.streamMessage('sess-1', 'ws-1', 'u-1', baseDto as never),
    );
    expect(mocks.llmService.chatStream).toHaveBeenCalledTimes(2);
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
      } as never),
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
      } as never),
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
      } as never),
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
      } as never),
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
