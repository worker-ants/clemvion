import { BackgroundExecutionJob } from './queues/background-execution.queue';
import { toDownstreamValue } from './handler-output.adapter';
import { ExecutionEngineService } from './execution-engine.service';
import { NodeHandlerRegistry } from '../../nodes/core/node-handler.registry';
import {
  ExecutionContextService,
  CreateContextOptions,
} from './context/execution-context.service';
import { ExecutionStatus } from '../executions/entities/execution.entity';
import { Node, NodeCategory } from '../nodes/entities/node.entity';
import { Edge, EdgeType } from '../edges/entities/edge.entity';
import {
  ExecutionContext,
  NodeHandler,
  NodeHandlerOutput,
} from '../../nodes/core/node-handler.interface';
import { mockOutput } from './__test__/mock-output';
import {
  type EngineServiceHarness,
  createEngineServiceHarness,
  executionId,
  flushPromises,
  mockEdges,
  mockHandler,
  mockNodes,
  withWorkspace,
  workflowId,
} from './__test-utils__/engine-service-harness';
import { BackgroundHandler } from '../../nodes/logic/background/background.handler';
import { CodeHandler } from '../../nodes/data/code/code.handler';
import { IfElseHandler } from '../../nodes/logic/if-else/if-else.handler';
import {
  armSlowPathResume,
  flushResumeDrive,
} from './__test-utils__/engine-service-resume-drive';

/**
 * ExecutionEngineService 단위 테스트: 템플릿 표현식 · rawConfig · 순환 · 도달성 · 배열 출력 · 입력 수집.
 *
 * 옛 `execution-engine.service.spec.ts` 를 관심사별로 나눈 파일 가운데 하나다(CLE-T-YEDCJK).
 * 서비스 구성과 mock 레포지토리는 `__test-utils__/engine-service-harness.ts` 공용 하네스가 만든다.
 */
describe('ExecutionEngineService', () => {
  let h: EngineServiceHarness;
  let service: ExecutionEngineService;
  let handlerRegistry: NodeHandlerRegistry;

  // Mock repositories
  let mockExecutionRepo: Record<string, jest.Mock>;
  let mockNodeRepo: Record<string, jest.Mock>;
  let mockEdgeRepo: Record<string, jest.Mock>;
  // 테스트가 다시 대입하는 `dbExecutionStatus` · `waitingRawRows` ·
  // `waitingQueryError` 는 mock 클로저가 읽는 하네스 필드라 `h.` 로 대입한다.

  // 서비스 구성 · mock 레포지토리는 `__test-utils__/engine-service-harness.ts` 공용 하네스.
  beforeEach(async () => {
    h = await createEngineServiceHarness();
    ({
      service,
      handlerRegistry,
      mockExecutionRepo,
      mockNodeRepo,
      mockEdgeRepo,
    } = h);
  });

  describe('Template node expression resolution', () => {
    const varDeclNodes: Partial<Node>[] = [
      {
        id: 'node-trigger',
        workflowId,
        type: 'test_node',
        category: NodeCategory.LOGIC,
        label: 'Trigger',
        config: {},
        isDisabled: false,
        containerId: undefined,
        toolOwnerId: undefined,
      },
      {
        id: 'node-template',
        workflowId,
        type: 'template',
        category: NodeCategory.PRESENTATION,
        label: 'Template',
        config: {
          template:
            'Hello {{ name }}, token: {{ $var.token }}, trigger: {{ $node["Trigger"].output.greeting }}',
          outputFormat: 'text',
        },
        isDisabled: false,
        containerId: undefined,
        toolOwnerId: undefined,
      },
    ];

    const varDeclEdges: Partial<Edge>[] = [
      {
        id: 'edge-1',
        workflowId,
        sourceNodeId: 'node-trigger',
        sourcePort: 'out',
        targetNodeId: 'node-template',
        targetPort: 'in',
        type: EdgeType.DATA,
      },
    ];

    let templateExecuteSpy: jest.Mock;

    beforeEach(() => {
      mockNodeRepo.findBy.mockResolvedValue(varDeclNodes);
      mockEdgeRepo.findBy.mockResolvedValue(varDeclEdges);

      // Trigger node outputs { name: 'Alice', greeting: 'Hi' }
      const triggerHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest
          .fn()
          .mockResolvedValue(mockOutput({ name: 'Alice', greeting: 'Hi' })),
      };
      handlerRegistry.register('test_node', triggerHandler);

      // Template handler: capture resolved config
      templateExecuteSpy = jest
        .fn<
          Promise<Record<string, unknown>>,
          [unknown, Record<string, unknown>]
        >()
        .mockImplementation((_input, config) =>
          Promise.resolve({
            type: 'template',
            format: config.outputFormat as string,
            content: config.template as string,
          }),
        );
      const templateHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: templateExecuteSpy,
      };
      handlerRegistry.register('template', templateHandler);
    });

    it('should resolve $var, $node, and input-data references in template config', async () => {
      // Inject variable into execution context

      // INFO #15 — `(service as any)` 패턴 제거. 같은 file 의 다른 spy 들과 동일한
      // `as unknown as { ... }` 형태로 통일 (private 멤버 접근의 안전한 캐스팅).
      const contextService = (
        service as unknown as { contextService: ExecutionContextService }
      ).contextService;
      const origCreate = contextService.createContext.bind(contextService);
      // ai-review 2026-06-03: injects extra initialVariables into the options-bag
      // to verify that template expression resolution reads $var.token correctly.
      jest
        .spyOn(contextService, 'createContext')
        .mockImplementation(
          (execId: string, wfId: string, options: CreateContextOptions = {}) =>
            origCreate(execId, wfId, {
              ...options,
              initialVariables: {
                ...(options.initialVariables ?? {}),
                token: 'xyz789',
              },
            }),
        );

      await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
      await flushPromises();

      expect(templateExecuteSpy).toHaveBeenCalledTimes(1);

      const resolvedConfig = (
        templateExecuteSpy.mock.calls[0] as unknown[]
      )[1] as Record<string, unknown>;

      // {{ name }} resolved from input data (root-level spread)
      // {{ $var.token }} resolved from execution variables
      // {{ $node["Trigger"].output.greeting }} resolved from node output
      expect(resolvedConfig.template).toBe(
        'Hello Alice, token: xyz789, trigger: Hi',
      );
    });

    it('should not spread array input into expression context', async () => {
      // Make trigger return an array
      const arrayHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn().mockResolvedValue(mockOutput(['a', 'b', 'c'])),
      };
      handlerRegistry.register('test_node', arrayHandler);

      // Template uses $input to reference array
      mockNodeRepo.findBy.mockResolvedValue([
        varDeclNodes[0],
        {
          ...varDeclNodes[1],
          config: {
            template: 'Data: {{ $input }}',
            outputFormat: 'text',
          },
        },
      ]);

      await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
      await flushPromises();

      // Should still execute without error (array not spread)
      expect(templateExecuteSpy).toHaveBeenCalledTimes(1);
    });

    it('should not override built-in context with input data keys', async () => {
      // Trigger outputs data with a key named "$var" (edge case)
      const conflictHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn().mockResolvedValue(
          mockOutput({
            $var: { token: 'overridden' },
            name: 'Bob',
          }),
        ),
      };
      handlerRegistry.register('test_node', conflictHandler);

      // INFO #15 — `(service as any)` 패턴 제거. 같은 file 의 다른 spy 들과 동일한
      // `as unknown as { ... }` 형태로 통일 (private 멤버 접근의 안전한 캐스팅).
      const contextService = (
        service as unknown as { contextService: ExecutionContextService }
      ).contextService;
      const origCreate = contextService.createContext.bind(contextService);
      // ai-review 2026-06-03: injects a 'token' initialVariable via the options-bag
      // to verify that $var.token is not overridden by conflicting input-data spreads.
      jest
        .spyOn(contextService, 'createContext')
        .mockImplementation(
          (execId: string, wfId: string, options: CreateContextOptions = {}) =>
            origCreate(execId, wfId, {
              ...options,
              initialVariables: {
                ...(options.initialVariables ?? {}),
                token: 'original',
              },
            }),
        );

      mockNodeRepo.findBy.mockResolvedValue([
        varDeclNodes[0],
        {
          ...varDeclNodes[1],
          config: {
            template: '{{ $var.token }} {{ name }}',
            outputFormat: 'text',
          },
        },
      ]);

      await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
      await flushPromises();

      expect(templateExecuteSpy).toHaveBeenCalledTimes(1);

      const resolvedConfig = (
        templateExecuteSpy.mock.calls[0] as unknown[]
      )[1] as Record<string, unknown>;

      // $var should be the original context value, not overridden by input
      // name from input should be spread as root-level since it doesn't conflict
      expect(resolvedConfig.template).toBe('original Bob');
    });
  });

  // ENG-RC-* — 엔진이 핸들러에 노출하는 ExecutionContext.rawConfig 가
  // expression 평가 전 원본을 그대로 담고 mutation 으로부터 보호되어야 한다.
  // 핸들러는 NodeHandlerOutput.config echo 시 rawConfig 를 사용하여
  // CONVENTIONS Principle 1.1 / Principle 7 의 직교성을 유지한다.
  describe('ENG-RC-* — ExecutionContext.rawConfig exposure', () => {
    const wf = workflowId;

    const triggerNode: Partial<Node> = {
      id: 'rc-trigger',
      workflowId: wf,
      type: 'test_node',
      category: NodeCategory.LOGIC,
      label: 'Trigger',
      config: {},
      isDisabled: false,
    };
    // 'template' 노드 타입을 활용 — 런타임 NodeComponentRegistry 에 이미 등록되어
    // 있어 엔진이 경로를 인식한다. 본 테스트는 ExecutionContext.rawConfig 노출
    // 동작만 검증하므로 노드 타입의 도메인 의미와는 무관.
    const exprNode: Partial<Node> = {
      id: 'rc-expr',
      workflowId: wf,
      type: 'template',
      category: NodeCategory.PRESENTATION,
      label: 'Expr Target',
      config: {
        subject: 'Hello {{ name }}',
        bodyType: 'text',
        body: 'Greeting: {{ $node["Trigger"].output.greeting }}',
      },
      isDisabled: false,
    };
    const rcEdges: Partial<Edge>[] = [
      {
        id: 'rc-edge',
        workflowId: wf,
        sourceNodeId: 'rc-trigger',
        sourcePort: 'out',
        targetNodeId: 'rc-expr',
        targetPort: 'in',
        type: EdgeType.DATA,
      },
    ];

    let captureSpy: jest.Mock<
      Promise<NodeHandlerOutput>,
      [unknown, Record<string, unknown>, ExecutionContext]
    >;

    beforeEach(() => {
      mockNodeRepo.findBy.mockResolvedValue([triggerNode, exprNode]);
      mockEdgeRepo.findBy.mockResolvedValue(rcEdges);

      handlerRegistry.register('test_node', {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest
          .fn()
          .mockResolvedValue(
            mockOutput({ name: 'Alice', greeting: 'Hi there' }),
          ),
      });

      captureSpy = jest
        .fn<
          Promise<NodeHandlerOutput>,
          [unknown, Record<string, unknown>, ExecutionContext]
        >()
        .mockResolvedValue(mockOutput({ ok: true }));
      handlerRegistry.register('template', {
        validate: () => ({ valid: true, errors: [] }),
        execute: captureSpy,
      });
    });

    it('exposes rawConfig with pre-evaluation template strings (config arg has evaluated values)', async () => {
      await service.execute(wf, {}, { workspaceId: 'ws-1' });
      await flushPromises();

      expect(captureSpy).toHaveBeenCalledTimes(1);
      const [, evaluatedConfig, ctx] = captureSpy.mock.calls[0];

      // config arg is post-evaluation (placeholders resolved)
      expect(evaluatedConfig.subject).toBe('Hello Alice');
      expect(evaluatedConfig.body).toBe('Greeting: Hi there');

      // rawConfig is pre-evaluation (placeholders preserved)
      expect(ctx.rawConfig).toBeDefined();
      expect(ctx.rawConfig?.subject).toBe('Hello {{ name }}');
      expect(ctx.rawConfig?.body).toBe(
        'Greeting: {{ $node["Trigger"].output.greeting }}',
      );
      // Non-expression fields are identical in raw and evaluated
      expect(ctx.rawConfig?.bodyType).toBe('text');
      expect(evaluatedConfig.bodyType).toBe('text');
    });

    it('freezes rawConfig — mutation attempts at top level throw in strict mode', async () => {
      let mutationError: unknown = null;
      captureSpy.mockImplementationOnce(
        async (_input, _config, ctx: ExecutionContext) => {
          try {
            // Cast away Readonly to simulate misbehaving handler.
            (ctx.rawConfig as Record<string, unknown>).subject = 'hacked';
          } catch (err) {
            mutationError = err;
          }
          return mockOutput({ ok: true });
        },
      );

      await service.execute(wf, {}, { workspaceId: 'ws-1' });
      await flushPromises();

      // Strict mode (TS / NestJS default) throws TypeError on frozen-property assign.
      expect(mutationError).toBeInstanceOf(TypeError);
      // Underlying object remains untouched.
      const ctx = captureSpy.mock.calls[0][2];
      expect(ctx.rawConfig?.subject).toBe('Hello {{ name }}');
    });

    it('still populates rawConfig when config has no expression placeholders', async () => {
      // expression-free config — engine still injects rawConfig (== node.config snapshot)
      const literalNode: Partial<Node> = {
        ...exprNode,
        config: { subject: 'Static Subject', bodyType: 'html', body: 'Plain' },
      };
      mockNodeRepo.findBy.mockResolvedValue([triggerNode, literalNode]);

      await service.execute(wf, {}, { workspaceId: 'ws-1' });
      await flushPromises();

      expect(captureSpy).toHaveBeenCalledTimes(1);
      const [, evaluatedConfig, ctx] = captureSpy.mock.calls[0];

      // No expression placeholders — raw and evaluated are equivalent in content.
      expect(evaluatedConfig.subject).toBe('Static Subject');
      expect(ctx.rawConfig?.subject).toBe('Static Subject');
      expect(ctx.rawConfig?.bodyType).toBe('html');
    });

    it('snapshots rawConfig into state when handler returns waiting_for_input (multi-turn resume hook)', async () => {
      // Multi-turn 핸들러는 ExecutionContext 가 아닌 state 만 받으므로 (resume),
      // 첫 turn 이 waiting_for_input 으로 진입할 때 엔진이 state.rawConfig 를
      // 자동으로 snapshot 한다. 후속 turn 의 processMultiTurnMessage(message, state)
      // 가 state.rawConfig 로 일관되게 접근할 수 있다.
      const aiNode: Partial<Node> = {
        id: 'rc-ai',
        workflowId: wf,
        type: 'ai_agent',
        category: NodeCategory.AI,
        label: 'Agent',
        config: {
          mode: 'multi_turn',
          // expression-free literal — engine 의 raw snapshot 자체가 검증 대상.
          // expression 평가 에러로 waiting 상태에 진입조차 못하는 부수 문제를 회피.
          systemPrompt: 'You are a helpful assistant',
        },
        isDisabled: false,
      };
      mockNodeRepo.findBy.mockResolvedValue([aiNode]);
      mockEdgeRepo.findBy.mockResolvedValue([]);

      const processSpy = jest.fn<
        Promise<NodeHandlerOutput>,
        [string, Record<string, unknown>]
      >(async () => ({
        config: { mode: 'multi_turn' },
        output: { result: { messages: [], message: '', turnCount: 1 } },
        meta: { interactionType: 'ai_conversation' },
        status: 'waiting_for_input',
        _resumeState: {
          messages: [],
          turnCount: 1,
          model: 'test-model',
          totalInputTokens: 0,
          totalOutputTokens: 0,
          turnDebugHistory: [],
        },
      }));

      handlerRegistry.register('ai_agent', {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => ({
          config: { mode: 'multi_turn' },
          output: { result: { messages: [], message: '', turnCount: 0 } },
          meta: { interactionType: 'ai_conversation' },
          status: 'waiting_for_input',
          _resumeState: {
            messages: [],
            turnCount: 0,
            model: 'test-model',
            totalInputTokens: 0,
            totalOutputTokens: 0,
            turnDebugHistory: [],
          },
        })),
        processMultiTurnMessage: processSpy,
        endMultiTurnConversation: jest.fn(() => ({
          config: { mode: 'multi_turn' },
          output: {},
          meta: {},
          port: 'ended',
          status: 'ended',
        })),
      } as unknown as NodeHandler);

      await service.execute(wf, {}, { workspaceId: 'ws-1' });
      await flushPromises();

      // Phase B (exec-park D4) — 후속 turn 은 §7.5 slow-path(processAiResumeTurn
      // → handleAiMessageTurn → processMultiTurnMessage). slow-path DB lookup 무장.
      armSlowPathResume(h, 'rc-ai', aiNode);
      void service.continueAiConversation(executionId, 'hello');
      await flushResumeDrive();

      expect(processSpy).toHaveBeenCalledTimes(1);
      const stateArg = processSpy.mock.calls[0][1];
      const snapshot = stateArg.rawConfig as
        Record<string, unknown> | undefined;
      expect(snapshot).toBeDefined();
      // 노드 정의의 원본 config 가 state.rawConfig 로 보존되어 후속 turn 의
      // processMultiTurnMessage 가 일관되게 접근할 수 있다.
      expect(snapshot?.systemPrompt).toBe('You are a helpful assistant');
      expect(snapshot?.mode).toBe('multi_turn');
    });
  });

  describe('Cyclic workflow execution (back-edge support)', () => {
    it('should execute a cyclic workflow when back-edge port is conditionally selected', async () => {
      // A -> Switch -> case1 back to A, case2 forward to C
      // Switch selects case1 on first call, case2 on second call
      let switchCallCount = 0;
      const switchHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => {
          switchCallCount++;
          if (switchCallCount === 1) {
            return mockOutput({ iteration: 1 }, { port: 'case1' });
          }
          return mockOutput({ iteration: 2 }, { port: 'case2' });
        }),
      };

      const passHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async (input: unknown) =>
          mockOutput({
            processed: true,
            input,
          }),
        ),
      };

      handlerRegistry.register('cyclic_pass', passHandler);
      handlerRegistry.register('cyclic_switch', switchHandler);

      const cyclicNodes: Partial<Node>[] = [
        {
          id: 'node-a',
          workflowId,
          type: 'cyclic_pass',
          category: NodeCategory.LOGIC,
          label: 'Node A',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        {
          id: 'node-switch',
          workflowId,
          type: 'cyclic_switch',
          category: NodeCategory.LOGIC,
          label: 'Switch',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        {
          id: 'node-c',
          workflowId,
          type: 'cyclic_pass',
          category: NodeCategory.LOGIC,
          label: 'Node C',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
      ];

      const cyclicEdges: Partial<Edge>[] = [
        {
          id: 'edge-a-switch',
          workflowId,
          sourceNodeId: 'node-a',
          sourcePort: 'out',
          targetNodeId: 'node-switch',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'edge-switch-a',
          workflowId,
          sourceNodeId: 'node-switch',
          sourcePort: 'case1',
          targetNodeId: 'node-a',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'edge-switch-c',
          workflowId,
          sourceNodeId: 'node-switch',
          sourcePort: 'case2',
          targetNodeId: 'node-c',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
      ];

      mockNodeRepo.findBy.mockResolvedValue(cyclicNodes);
      mockEdgeRepo.findBy.mockResolvedValue(cyclicEdges);

      await service.execute(
        workflowId,
        { start: true },
        { workspaceId: 'ws-1' },
      );
      await flushPromises();

      // Switch should be called twice (first loop back, then forward)
      expect(switchCallCount).toBe(2);

      // Execution should complete (not fail)
      // M-3 — COMPLETED 마감은 full-save 대신 guarded raw UPDATE(query)로 영속한다
      // (status IN 비-terminal 가드). status 'completed' 가 쿼리 파라미터에 포함.
      expect(mockExecutionRepo.query).toHaveBeenCalledWith(
        expect.stringMatching(/UPDATE execution/),
        expect.arrayContaining([ExecutionStatus.COMPLETED]),
      );
      // #5 — lost-update 가드 문자열 검증.
      expect(mockExecutionRepo.query).toHaveBeenCalledWith(
        expect.stringMatching(/status IN/),
        expect.anything(),
      );
    });

    it('should throw when a node exceeds MAX_NODE_ITERATIONS', async () => {
      // A -> B -> A (always loops back, no exit)
      const alwaysOutputHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => mockOutput({ value: 'data' })),
      };
      handlerRegistry.register('infinite_node', alwaysOutputHandler);

      const infiniteNodes: Partial<Node>[] = [
        {
          id: 'node-a',
          workflowId,
          type: 'infinite_node',
          category: NodeCategory.LOGIC,
          label: 'Node A',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        {
          id: 'node-b',
          workflowId,
          type: 'infinite_node',
          category: NodeCategory.LOGIC,
          label: 'Node B',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
      ];

      const infiniteEdges: Partial<Edge>[] = [
        {
          id: 'edge-a-b',
          workflowId,
          sourceNodeId: 'node-a',
          sourcePort: 'out',
          targetNodeId: 'node-b',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'edge-b-a',
          workflowId,
          sourceNodeId: 'node-b',
          sourcePort: 'out',
          targetNodeId: 'node-a',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
      ];

      mockNodeRepo.findBy.mockResolvedValue(infiniteNodes);
      mockEdgeRepo.findBy.mockResolvedValue(infiniteEdges);

      // ConfigService returns MAX_NODE_ITERATIONS=3 for this test
      const configService = service['configService'] as unknown as {
        get: jest.Mock;
      };
      configService.get.mockImplementation(
        (key: string, defaultValue?: unknown) => {
          if (key === 'MAX_NODE_ITERATIONS') return 3;
          return defaultValue;
        },
      );

      await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
      await flushPromises();

      // Should be marked as failed due to max iteration exceeded. ai-review
      // CRITICAL #1 (2026-07-27, 6차 라운드) — guarded UPDATE(raw query) 경유로
      // 바뀌어 더 이상 full-entity `.save()` 를 호출하지 않는다.
      expect(mockExecutionRepo.query).toHaveBeenCalledWith(
        expect.stringMatching(/UPDATE execution/),
        expect.arrayContaining([
          ExecutionStatus.FAILED,
          expect.stringContaining('exceeded maximum iteration count'),
        ]),
      );
    });

    it('should allow unlimited iterations when MAX_NODE_ITERATIONS=0', async () => {
      // A -> B -> A with B exiting after 5 iterations via port routing
      let bCallCount = 0;
      const loopHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => {
          bCallCount++;
          if (bCallCount < 5) {
            return mockOutput({ count: bCallCount }, { port: 'loop' });
          }
          return mockOutput({ count: bCallCount }, { port: 'exit' });
        }),
      };
      const passHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async (input: unknown) =>
          mockOutput({
            processed: true,
            input,
          }),
        ),
      };

      handlerRegistry.register('loop_switch', loopHandler);
      handlerRegistry.register('loop_pass', passHandler);

      const loopNodes: Partial<Node>[] = [
        {
          id: 'node-a',
          workflowId,
          type: 'loop_pass',
          category: NodeCategory.LOGIC,
          label: 'Node A',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        {
          id: 'node-b',
          workflowId,
          type: 'loop_switch',
          category: NodeCategory.LOGIC,
          label: 'Node B',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        {
          id: 'node-end',
          workflowId,
          type: 'loop_pass',
          category: NodeCategory.LOGIC,
          label: 'End',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
      ];

      const loopEdges: Partial<Edge>[] = [
        {
          id: 'edge-a-b',
          workflowId,
          sourceNodeId: 'node-a',
          sourcePort: 'out',
          targetNodeId: 'node-b',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'edge-b-a',
          workflowId,
          sourceNodeId: 'node-b',
          sourcePort: 'loop',
          targetNodeId: 'node-a',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'edge-b-end',
          workflowId,
          sourceNodeId: 'node-b',
          sourcePort: 'exit',
          targetNodeId: 'node-end',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
      ];

      mockNodeRepo.findBy.mockResolvedValue(loopNodes);
      mockEdgeRepo.findBy.mockResolvedValue(loopEdges);

      // ConfigService returns 0 (unlimited)
      const configService = service['configService'] as unknown as {
        get: jest.Mock;
      };
      configService.get.mockImplementation(
        (key: string, defaultValue?: unknown) => {
          if (key === 'MAX_NODE_ITERATIONS') return 0;
          return defaultValue;
        },
      );

      await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
      await flushPromises();

      // B should have been called 5 times (4 loops + 1 exit)
      expect(bCallCount).toBe(5);

      // Execution should complete successfully
      // M-3 — COMPLETED 마감은 full-save 대신 guarded raw UPDATE(query)로 영속한다
      // (status IN 비-terminal 가드). status 'completed' 가 쿼리 파라미터에 포함.
      expect(mockExecutionRepo.query).toHaveBeenCalledWith(
        expect.stringMatching(/UPDATE execution/),
        expect.arrayContaining([ExecutionStatus.COMPLETED]),
      );
      // #5 — lost-update 가드 문자열 검증.
      expect(mockExecutionRepo.query).toHaveBeenCalledWith(
        expect.stringMatching(/status IN/),
        expect.anything(),
      );
    });

    it('should pass workflowInput to back-edge target start node on first execution', async () => {
      // A (start, also back-edge target) -> B (switch)
      // B -> case1: back to A, case2: forward to C
      const aInputs: unknown[] = [];
      const startHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async (input: unknown) => {
          aInputs.push(input);
          return mockOutput({ fromA: true, input });
        }),
      };

      let switchCount = 0;
      const switchNodeHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => {
          switchCount++;
          if (switchCount === 1) {
            return mockOutput({ loop: true }, { port: 'case1' });
          }
          return mockOutput({ done: true }, { port: 'case2' });
        }),
      };

      const endHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async (input: unknown) =>
          mockOutput({ end: true, input }),
        ),
      };

      handlerRegistry.register('start_input_test', startHandler);
      handlerRegistry.register('switch_input_test', switchNodeHandler);
      handlerRegistry.register('end_input_test', endHandler);

      const nodes: Partial<Node>[] = [
        {
          id: 'node-a',
          workflowId,
          type: 'start_input_test',
          category: NodeCategory.LOGIC,
          label: 'A',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        {
          id: 'node-sw',
          workflowId,
          type: 'switch_input_test',
          category: NodeCategory.LOGIC,
          label: 'SW',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        {
          id: 'node-c',
          workflowId,
          type: 'end_input_test',
          category: NodeCategory.LOGIC,
          label: 'C',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
      ];

      const edges: Partial<Edge>[] = [
        {
          id: 'e1',
          workflowId,
          sourceNodeId: 'node-a',
          sourcePort: 'out',
          targetNodeId: 'node-sw',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e2',
          workflowId,
          sourceNodeId: 'node-sw',
          sourcePort: 'case1',
          targetNodeId: 'node-a',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e3',
          workflowId,
          sourceNodeId: 'node-sw',
          sourcePort: 'case2',
          targetNodeId: 'node-c',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
      ];

      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue(edges);

      await service.execute(
        workflowId,
        { initial: 'data' },
        { workspaceId: 'ws-1' },
      );
      await flushPromises();

      // First execution: A should receive workflowInput (not undefined)
      expect(aInputs[0]).toEqual({ initial: 'data' });
      // Second execution (after back-edge): A should receive switch output
      // _selectedPort is stripped before passing as input to downstream nodes
      expect(aInputs[1]).toEqual(expect.objectContaining({ loop: true }));
    });

    it('should still work for non-cyclic DAG workflows (regression)', async () => {
      // Use default mockNodes/mockEdges (linear: node-1 -> node-2 -> node-3)
      mockNodeRepo.findBy.mockResolvedValue(mockNodes);
      mockEdgeRepo.findBy.mockResolvedValue(mockEdges);

      (mockHandler.execute as jest.Mock).mockResolvedValue(
        mockOutput({ ok: true }),
      );
      handlerRegistry.register('test_node', mockHandler);

      await service.execute(
        workflowId,
        { data: 'test' },
        { workspaceId: 'ws-1' },
      );
      await flushPromises();

      expect(mockHandler.execute).toHaveBeenCalledTimes(3);
      // M-3 — COMPLETED 마감은 full-save 대신 guarded raw UPDATE(query)로 영속한다
      // (status IN 비-terminal 가드). status 'completed' 가 쿼리 파라미터에 포함.
      expect(mockExecutionRepo.query).toHaveBeenCalledWith(
        expect.stringMatching(/UPDATE execution/),
        expect.arrayContaining([ExecutionStatus.COMPLETED]),
      );
      // #5 — lost-update 가드 문자열 검증.
      expect(mockExecutionRepo.query).toHaveBeenCalledWith(
        expect.stringMatching(/status IN/),
        expect.anything(),
      );
    });
  });

  describe('Reachability-based execution', () => {
    it('should only execute the branch matching the selected port', async () => {
      // A(port router) -> port1 -> B, port2 -> C
      // A selects port1, so B executes and C does NOT
      const routerHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () =>
          mockOutput({ routed: true }, { port: 'port1' }),
        ),
      };
      const leafHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async (input: unknown) =>
          mockOutput({ received: true, input }),
        ),
      };
      handlerRegistry.register('port_router', routerHandler);
      handlerRegistry.register('port_leaf', leafHandler);

      const nodes: Partial<Node>[] = [
        {
          id: 'node-a',
          workflowId,
          type: 'port_router',
          category: NodeCategory.LOGIC,
          label: 'Router',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        {
          id: 'node-b',
          workflowId,
          type: 'port_leaf',
          category: NodeCategory.LOGIC,
          label: 'B',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        {
          id: 'node-c',
          workflowId,
          type: 'port_leaf',
          category: NodeCategory.LOGIC,
          label: 'C',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
      ];
      const edges: Partial<Edge>[] = [
        {
          id: 'e-a-b',
          workflowId,
          sourceNodeId: 'node-a',
          sourcePort: 'port1',
          targetNodeId: 'node-b',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e-a-c',
          workflowId,
          sourceNodeId: 'node-a',
          sourcePort: 'port2',
          targetNodeId: 'node-c',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
      ];

      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue(edges);

      await service.execute(
        workflowId,
        { start: true },
        { workspaceId: 'ws-1' },
      );
      await flushPromises();

      expect(routerHandler.execute).toHaveBeenCalledTimes(1);
      expect(leafHandler.execute).toHaveBeenCalledTimes(1);
      // B received the routed data (without _selectedPort)
      const bInput = (leafHandler.execute as jest.Mock).mock.calls[0][0];
      expect(bInput).toEqual({ routed: true });
    });

    // Regression: 5필드 모델 마이그레이션 후, user 의 `output: { data: [array] }`
    // (예: Code 노드가 `return { data: [...] }`) + 명시적 `port` 가 결합되면
    // toEngineFlatShape 가 `{ data: [array], port }` 를 만들고 applyPortSelection
    // 의 legacy `{port, data}` unwrap 이 array 를 spread 해 next input 이
    // `{0: ..., 1: ..., _selectedPort}` 로 깨졌다. 본 테스트는 array data 보존.
    it('should preserve data array key when handler emits { data: [...], port }', async () => {
      const codeStyleHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => ({
          config: { code: 'return { data: [...] }' },
          output: {
            data: [
              { label: '1월', value: 450 },
              { label: '2월', value: 520 },
            ],
          },
          port: 'success',
        })),
      };
      const chartStyleHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async (input: unknown) => mockOutput({ seen: input })),
      };
      handlerRegistry.register('code_style', codeStyleHandler);
      handlerRegistry.register('chart_style', chartStyleHandler);

      const nodes: Partial<Node>[] = [
        {
          id: 'node-code',
          workflowId,
          type: 'code_style',
          category: NodeCategory.DATA,
          label: 'Code',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        {
          id: 'node-chart',
          workflowId,
          type: 'chart_style',
          category: NodeCategory.PRESENTATION,
          label: 'Chart',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
      ];
      const edges: Partial<Edge>[] = [
        {
          id: 'e-code-chart',
          workflowId,
          sourceNodeId: 'node-code',
          sourcePort: 'success',
          targetNodeId: 'node-chart',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
      ];

      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue(edges);

      await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
      await flushPromises();

      const chartInput = (chartStyleHandler.execute as jest.Mock).mock
        .calls[0][0] as Record<string, unknown>;
      // data 키와 array 가 그대로 보존 — `{0: ..., 1: ...}` spread 안 됨
      expect(chartInput).toEqual({
        data: [
          { label: '1월', value: 450 },
          { label: '2월', value: 520 },
        ],
      });
      expect(Array.isArray(chartInput.data)).toBe(true);
      expect(chartInput).not.toHaveProperty('0');
      expect(chartInput).not.toHaveProperty('_selectedPort');
    });

    it('should strip port / status / _resumeState control fields from downstream input', async () => {
      // Regression: form/ai_agent style handlers emit canonical output with
      // top-level port/status/_resumeState control fields. When that output
      // is forwarded to a downstream node as input, the control fields
      // previously leaked through (only `_selectedPort` was stripped),
      // which caused pass-through successors (e.g. switch) to inherit the
      // stale `port: "out"` and misroute every outgoing edge.
      const emitterHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => ({
          config: {},
          output: { interaction: { data: { food_type: '한식' } } },
          status: 'resumed',
          port: 'out',
          _resumeState: { turnCount: 1 },
        })),
      };
      const receiverHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async (input: unknown) => mockOutput({ seen: input })),
      };
      handlerRegistry.register('ctl_emitter', emitterHandler);
      handlerRegistry.register('ctl_receiver', receiverHandler);

      const nodes: Partial<Node>[] = [
        {
          id: 'node-emit',
          workflowId,
          type: 'ctl_emitter',
          category: NodeCategory.PRESENTATION,
          label: 'Emit',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        {
          id: 'node-recv',
          workflowId,
          type: 'ctl_receiver',
          category: NodeCategory.LOGIC,
          label: 'Recv',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
      ];
      const edges: Partial<Edge>[] = [
        {
          id: 'e-emit-recv',
          workflowId,
          sourceNodeId: 'node-emit',
          sourcePort: 'out',
          targetNodeId: 'node-recv',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
      ];

      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue(edges);

      await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
      await flushPromises();

      expect(receiverHandler.execute).toHaveBeenCalledTimes(1);
      const receivedInput = (receiverHandler.execute as jest.Mock).mock
        .calls[0][0] as Record<string, unknown>;
      expect(receivedInput).not.toHaveProperty('port');
      expect(receivedInput).not.toHaveProperty('status');
      expect(receivedInput).not.toHaveProperty('_resumeState');
      expect(receivedInput).not.toHaveProperty('_selectedPort');
      expect(receivedInput).toMatchObject({
        interaction: { data: { food_type: '한식' } },
      });
    });

    it('should not execute nodes downstream of a disabled node', async () => {
      // A -> B(disabled) -> C — C should never execute
      const passHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async (input: unknown) =>
          mockOutput({
            processed: true,
            input,
          }),
        ),
      };
      handlerRegistry.register('reach_pass', passHandler);

      const nodes: Partial<Node>[] = [
        {
          id: 'node-a',
          workflowId,
          type: 'reach_pass',
          category: NodeCategory.LOGIC,
          label: 'A',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        {
          id: 'node-b',
          workflowId,
          type: 'reach_pass',
          category: NodeCategory.LOGIC,
          label: 'B',
          config: {},
          isDisabled: true,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        {
          id: 'node-c',
          workflowId,
          type: 'reach_pass',
          category: NodeCategory.LOGIC,
          label: 'C',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
      ];
      const edges: Partial<Edge>[] = [
        {
          id: 'e-a-b',
          workflowId,
          sourceNodeId: 'node-a',
          sourcePort: 'out',
          targetNodeId: 'node-b',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e-b-c',
          workflowId,
          sourceNodeId: 'node-b',
          sourcePort: 'out',
          targetNodeId: 'node-c',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
      ];

      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue(edges);

      await service.execute(
        workflowId,
        { start: true },
        { workspaceId: 'ws-1' },
      );
      await flushPromises();

      // A executes, B is disabled (skipped), C never executes (unreachable)
      expect(passHandler.execute).toHaveBeenCalledTimes(1);
    });

    it('should isolate parallel branches through port routing', async () => {
      // Trigger -> Router -> [port1->X->Y, port2->P->Q]
      // Router selects port2: P and Q execute, X and Y do NOT
      const triggerHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => mockOutput({ triggered: true })),
      };
      const routerHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () =>
          mockOutput({ branch: 2 }, { port: 'port2' }),
        ),
      };
      const branchHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async (input: unknown) =>
          mockOutput({ done: true, input }),
        ),
      };
      handlerRegistry.register('iso_trigger', triggerHandler);
      handlerRegistry.register('iso_router', routerHandler);
      handlerRegistry.register('iso_branch', branchHandler);

      const nodes: Partial<Node>[] = [
        {
          id: 'trigger',
          workflowId,
          type: 'iso_trigger',
          category: NodeCategory.TRIGGER,
          label: 'Trigger',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        {
          id: 'router',
          workflowId,
          type: 'iso_router',
          category: NodeCategory.LOGIC,
          label: 'Router',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        {
          id: 'x',
          workflowId,
          type: 'iso_branch',
          category: NodeCategory.LOGIC,
          label: 'X',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        {
          id: 'y',
          workflowId,
          type: 'iso_branch',
          category: NodeCategory.LOGIC,
          label: 'Y',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        {
          id: 'p',
          workflowId,
          type: 'iso_branch',
          category: NodeCategory.LOGIC,
          label: 'P',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        {
          id: 'q',
          workflowId,
          type: 'iso_branch',
          category: NodeCategory.LOGIC,
          label: 'Q',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
      ];
      const edges: Partial<Edge>[] = [
        {
          id: 'e-t-r',
          workflowId,
          sourceNodeId: 'trigger',
          sourcePort: 'out',
          targetNodeId: 'router',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e-r-x',
          workflowId,
          sourceNodeId: 'router',
          sourcePort: 'port1',
          targetNodeId: 'x',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e-x-y',
          workflowId,
          sourceNodeId: 'x',
          sourcePort: 'out',
          targetNodeId: 'y',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e-r-p',
          workflowId,
          sourceNodeId: 'router',
          sourcePort: 'port2',
          targetNodeId: 'p',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e-p-q',
          workflowId,
          sourceNodeId: 'p',
          sourcePort: 'out',
          targetNodeId: 'q',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
      ];

      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue(edges);

      await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
      await flushPromises();

      expect(triggerHandler.execute).toHaveBeenCalledTimes(1);
      expect(routerHandler.execute).toHaveBeenCalledTimes(1);
      // P and Q execute (port2 branch)
      expect(branchHandler.execute).toHaveBeenCalledTimes(2);
      // Verify the inputs are from the port2 branch
      const calls = (branchHandler.execute as jest.Mock).mock.calls;
      expect(calls[0][0]).toEqual({ branch: 2 }); // P receives router data
    });
  });

  // 배열 · 원시값 output 이 port 와 함께 오면 엔진 flat 캐시에는 `{ data, port }` 봉투로
  // 실린다. 다음 노드의 `$input` 과 `$node[X].output` 은 봉투가 아니라 핸들러 output 을
  // 받아야 한다(CLE-NODE-CODE 「output 루트에 바로 배치」, NERV Task CLE-T-T30D5S).
  describe('배열 · 원시값 output 전달 (Code 노드)', () => {
    const vNode = (
      id: string,
      type: string,
      config: Record<string, unknown> = {},
    ): Partial<Node> => ({
      id,
      workflowId,
      type,
      category:
        type === 'test_node' ? NodeCategory.TRIGGER : NodeCategory.LOGIC,
      label: id,
      config,
      isDisabled: false,
      containerId: undefined,
      toolOwnerId: undefined,
    });
    const vEdge = (
      source: string,
      sourcePort: string,
      target: string,
    ): Partial<Edge> => ({
      id: `${source}.${sourcePort}->${target}`,
      workflowId,
      sourceNodeId: source,
      sourcePort,
      targetNodeId: target,
      targetPort: 'in',
      type: EdgeType.DATA,
    });

    type SinkCall = { input: unknown; config: Record<string, unknown> };
    let successCalls: SinkCall[];
    let errorCalls: SinkCall[];

    const registerSink = (type: string, calls: () => SinkCall[]) => {
      handlerRegistry.register(type, {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async (input: unknown, config) => {
          calls().push({ input, config });
          return mockOutput({ sink: true });
        }),
      });
    };

    // 정해 둔 output · port 를 돌려주는 핸들러. 실제 Code 와 같은 다섯 필드 모양이다.
    const registerValueNode = (
      type: string,
      output: unknown,
      port = 'success',
    ) =>
      handlerRegistry.register(type, {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => ({ config: {}, output, port })),
      });

    // Code 는 isolated-vm 에서 돌아서 마이크로태스크 몇 번으로는 끝나지 않는다. 조건이 맞을
    // 때까지 기다리고(최대 5초) 남은 포트 처리를 마저 흘려보낸다. 시간이 넘으면 그때까지 받은
    // 호출을 담아 실패한다.
    const waitUntil = async (done: () => boolean, label: string) => {
      const deadline = Date.now() + 5_000;
      while (!done()) {
        if (Date.now() >= deadline) {
          throw new Error(
            `${label} 를 5초 안에 못 봤다. success=${JSON.stringify(
              successCalls,
            )} error=${JSON.stringify(errorCalls)}`,
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      await flushPromises();
      await flushPromises();
    };
    const waitForSink = () =>
      waitUntil(
        () => successCalls.length + errorCalls.length > 0,
        '뒤 노드 호출',
      );

    beforeEach(() => {
      successCalls = [];
      errorCalls = [];
      handlerRegistry.register('code', new CodeHandler());
      registerSink('success_sink', () => successCalls);
      registerSink('error_sink', () => errorCalls);
    });

    // trigger → code ─success→ ok
    //                ─error──→ err
    // `codeType` 을 주면 실제 Code 대신 그 타입의 핸들러를 `code` 노드에 쓴다.
    const runCodeGraph = async (
      code: string,
      sinkConfig: Record<string, unknown> = {},
      codeType = 'code',
    ) => {
      mockNodeRepo.findBy.mockResolvedValue([
        vNode('trigger', 'test_node'),
        vNode('code', codeType, { code }),
        vNode('ok', 'success_sink', sinkConfig),
        vNode('err', 'error_sink'),
      ]);
      mockEdgeRepo.findBy.mockResolvedValue([
        vEdge('trigger', 'out', 'code'),
        vEdge('code', 'success', 'ok'),
        vEdge('code', 'error', 'err'),
      ]);
      await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
      await waitForSink();
    };
    // 실제 Code 대신 `output` 을 그대로 돌려주는 핸들러로 같은 그래프를 돌린다.
    const runValueGraph = async (
      output: unknown,
      sinkConfig: Record<string, unknown> = {},
    ) => {
      registerValueNode('value_node', output);
      await runCodeGraph('', sinkConfig, 'value_node');
    };

    const valueSinkConfig = {
      fromNode: '{{ $node["code"].output }}',
      fromInput: '{{ $input }}',
      port: '{{ $node["code"].port }}',
    };

    // 대표 케이스는 실제 Code(isolated-vm)로 돌린다.
    it('Code 가 배열을 돌려주면 다음 노드의 $input 과 $node["code"].output 이 그 배열이다', async () => {
      const expected = [{ v: 1 }, { v: 2 }, { v: 3 }];
      await runCodeGraph(
        'return [{ v: 1 }, { v: 2 }, { v: 3 }];',
        valueSinkConfig,
      );

      expect(successCalls).toHaveLength(1);
      expect(successCalls[0].input).toEqual(expected);
      expect(successCalls[0].config).toEqual(
        expect.objectContaining({
          fromNode: expected,
          fromInput: expected,
          port: 'success',
        }),
      );
      expect(errorCalls).toHaveLength(0);
    });

    // 포트와 함께 온 객체 output 안에 `data` 키가 있어도(예: HTTP 응답 `{ status, data }`)
    // 다음 노드는 핸들러 output 그대로 받는다. 예전에는 flat 캐시에서 `data` 안의 키를
    // 펼치고 `status` 를 뗀 값을 받았다(NERV Task CLE-T-ZJR3AF, 질문 답 A).
    it('포트와 객체 data 를 함께 내도 다음 노드 $input 은 핸들러 output 그대로다', async () => {
      const expected = { status: 200, data: { a: 1 } };
      await runValueGraph(expected, valueSinkConfig);

      expect(successCalls).toHaveLength(1);
      expect(successCalls[0].input).toEqual(expected);
      expect(successCalls[0].config).toEqual(
        expect.objectContaining({ fromNode: expected, fromInput: expected }),
      );
      expect(errorCalls).toHaveLength(0);
    });

    it.each([
      ['number', 42],
      ['string', 'hello'],
      ['zero', 0],
      ['false', false],
    ])(
      'output 이 %s 이면 다음 노드의 $input 과 $node["code"].output 이 그 값이다',
      async (_label, expected) => {
        await runValueGraph(expected, valueSinkConfig);

        expect(successCalls).toHaveLength(1);
        expect(successCalls[0].input).toEqual(expected);
        expect(successCalls[0].config).toEqual(
          expect.objectContaining({
            fromNode: expected,
            fromInput: expected,
            port: 'success',
          }),
        );
        // success 포트로만 간다. 봉투를 풀어도 라우팅은 그대로다.
        expect(errorCalls).toHaveLength(0);
      },
    );

    // 포트가 있는 객체 출력도 `$node[X].output` 에 라우팅 표지(`_selectedPort`)가 붙지 않는다
    // (CLE-T-JDYHCF 3번). `$input` 은 예전부터 표지를 뗀 값이었다.
    it('포트가 있는 객체 output 의 $node["code"].output 에 _selectedPort 가 붙지 않는다', async () => {
      await runValueGraph({ a: 1 }, valueSinkConfig);

      expect(successCalls).toHaveLength(1);
      expect(successCalls[0].input).toStrictEqual({ a: 1 });
      expect(successCalls[0].config.fromNode).toStrictEqual({ a: 1 });
      expect(successCalls[0].config.port).toBe('success');
      expect(errorCalls).toHaveLength(0);
    });

    // Background 본문은 큐 작업(JSON)으로 넘어간 스냅샷으로 돈다. 구조화 출력이 스냅샷에 없으면
    // 본문의 `$node[X].output` 이 엔진 내부 flat 값(`{ data, _selectedPort }`)으로 보였다
    // (CLE-T-JDYHCF 5번).
    it.each([
      ['array', [1, 2, 3]],
      ['number', 42],
      ['object', { a: 1 }],
    ])(
      'Background 본문의 $node["code"].output 이 %s output 을 그대로 본다',
      async (_label, value) => {
        handlerRegistry.register('background', new BackgroundHandler(), {
          kind: 'background',
        });
        registerValueNode('value_node', value);
        mockNodeRepo.findBy.mockResolvedValue([
          vNode('trigger', 'test_node'),
          vNode('code', 'value_node'),
          vNode('bg', 'background'),
          vNode('ok', 'success_sink', {
            fromNode: '{{ $node["code"].output }}',
            port: '{{ $node["code"].port }}',
          }),
        ]);
        mockEdgeRepo.findBy.mockResolvedValue([
          vEdge('trigger', 'out', 'code'),
          vEdge('code', 'success', 'bg'),
          vEdge('bg', 'background', 'ok'),
        ]);
        const queueAdd = (
          service as unknown as { backgroundQueue: { add: jest.Mock } }
        ).backgroundQueue.add;
        queueAdd.mockClear();

        await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
        await waitUntil(
          () => queueAdd.mock.calls.length > 0,
          'Background 큐 작업',
        );
        expect(successCalls).toHaveLength(0);

        // BullMQ 는 작업을 JSON 으로 저장한다.
        const job = JSON.parse(
          JSON.stringify(queueAdd.mock.calls[0][1]),
        ) as BackgroundExecutionJob;
        await service.executeBackgroundSubgraph(job);
        await waitForSink();

        expect(successCalls).toHaveLength(1);
        expect(successCalls[0].config.fromNode).toStrictEqual(value);
        expect(successCalls[0].config.port).toBe('success');
      },
    );

    // Background 작업에는 구조화 항목이 있는 노드의 flat 값 대신 작은 표지가 실린다. 키는 남아
    // 본문 `$node` 의 같은 이름 `#N` 접미사와 값이 줄이기 전과 같다(CLE-T-XTTSXB).
    it('Background 작업의 flat 값이 표지로 줄어도 본문 $node 의 같은 이름 #N 과 값은 그대로다', async () => {
      handlerRegistry.register('background', new BackgroundHandler(), {
        kind: 'background',
      });
      registerValueNode('value_first', { rows: [1, 2, 3] });
      registerValueNode('value_second', [4, 5]);
      mockNodeRepo.findBy.mockResolvedValue([
        vNode('trigger', 'test_node'),
        { ...vNode('first', 'value_first'), label: 'Dup' },
        { ...vNode('second', 'value_second'), label: 'Dup' },
        vNode('bg', 'background'),
        vNode('ok', 'success_sink', {
          dup1: '{{ $node["Dup"].output }}',
          dup2: '{{ $node["Dup#2"].output }}',
        }),
      ]);
      mockEdgeRepo.findBy.mockResolvedValue([
        vEdge('trigger', 'out', 'first'),
        vEdge('first', 'success', 'second'),
        vEdge('second', 'success', 'bg'),
        vEdge('bg', 'background', 'ok'),
      ]);
      const queueAdd = (
        service as unknown as { backgroundQueue: { add: jest.Mock } }
      ).backgroundQueue.add;
      queueAdd.mockClear();

      await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
      await waitUntil(
        () => queueAdd.mock.calls.length > 0,
        'Background 큐 작업',
      );

      const job = JSON.parse(
        JSON.stringify(queueAdd.mock.calls[0][1]),
      ) as BackgroundExecutionJob;
      // 값은 구조화 캐시에만 실리고 flat 캐시에는 라우팅 표지만 남는다.
      expect(job.nodeOutputCache.first).toStrictEqual({
        _selectedPort: 'success',
      });
      expect(job.nodeOutputCache.second).toStrictEqual({
        _selectedPort: 'success',
      });
      expect(job.structuredOutputCache?.first?.output).toStrictEqual({
        rows: [1, 2, 3],
      });

      await service.executeBackgroundSubgraph(job);
      await waitForSink();

      expect(successCalls).toHaveLength(1);
      expect(successCalls[0].config.dup1).toStrictEqual({ rows: [1, 2, 3] });
      expect(successCalls[0].config.dup2).toStrictEqual([4, 5]);
    });

    // 실행 결과(`Execution.outputData`)와 동기 서브워크플로 결과(`executeInline` 반환값 →
    // `$node["Workflow"].output.result`)는 마지막 노드의 핸들러 `output` 그대로다. 예전에는
    // 엔진 flat 값이라 `{ data, _selectedPort }` · `{ ...값, _selectedPort }` 였다
    // (CLE-T-JDYHCF 결정 1).
    const persistedExecutionOutput = (): unknown => {
      const completedCall = mockExecutionRepo.query.mock.calls.find(
        (c: unknown[]) =>
          typeof c[0] === 'string' &&
          c[0].includes('output_data') &&
          (c[1] as unknown[])?.[1] === ExecutionStatus.COMPLETED,
      );
      return completedCall
        ? (JSON.parse((completedCall[1] as string[])[5]) as unknown)
        : undefined;
    };

    it.each([
      ['array', [1, 2, 3]],
      ['number', 42],
      ['object', { a: 1 }],
    ])(
      '마지막 노드 output 이 %s 이면 실행 결과 outputData 가 그 값이다',
      async (_label, value) => {
        registerValueNode('value_node', value);
        mockNodeRepo.findBy.mockResolvedValue([
          vNode('trigger', 'test_node'),
          vNode('code', 'value_node'),
        ]);
        mockEdgeRepo.findBy.mockResolvedValue([
          vEdge('trigger', 'out', 'code'),
        ]);

        await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
        await waitUntil(
          () => persistedExecutionOutput() !== undefined,
          '실행 완료',
        );

        expect(persistedExecutionOutput()).toStrictEqual(value);
      },
    );

    it.each([
      ['array', [1, 2, 3]],
      ['number', 42],
      ['object', { a: 1 }],
    ])(
      '서브워크플로 마지막 노드 output 이 %s 이면 executeInline 이 그 값을 돌려준다',
      async (_label, value) => {
        registerValueNode('value_node', value);
        mockNodeRepo.findBy.mockResolvedValue([vNode('code', 'value_node')]);
        mockEdgeRepo.findBy.mockResolvedValue([]);
        const contextService = (
          service as unknown as { contextService: ExecutionContextService }
        ).contextService;
        const context = withWorkspace(
          contextService.createContext(executionId, workflowId),
        );

        const result = await service.executeInline(
          workflowId,
          {},
          {
            executionId,
            context,
            executedNodes: new Set<string>(),
            recursionDepth: 1,
            parentNodeExecutionId: 'workflow-node-row',
          },
        );

        expect(result).toStrictEqual(value);
      },
    );

    // Parallel 로 끝나는 서브워크플로는 Parallel 실행 경로(`executeAndDispatchNode` 가 true)로
    // 빠져 `lastOutput` 을 그 자리에서 읽는다. 그 경로도 flat 봉투가 아니라 핸들러 output 을 준다.
    it('서브워크플로가 Parallel 실행 경로로 끝나도 executeInline 은 그 노드의 핸들러 output 을 돌려준다', async () => {
      mockNodeRepo.findBy.mockResolvedValue([vNode('parallel', 'parallel')]);
      mockEdgeRepo.findBy.mockResolvedValue([]);
      const contextService = (
        service as unknown as { contextService: ExecutionContextService }
      ).contextService;
      const context = withWorkspace(
        contextService.createContext(executionId, workflowId),
      );
      const output = [{ branch: 'a' }, { branch: 'b' }];
      jest
        .spyOn(
          service as unknown as {
            executeAndDispatchNode: (arg: {
              node: { id: string };
            }) => Promise<boolean>;
          },
          'executeAndDispatchNode',
        )
        .mockImplementation((arg) => {
          contextService.setNodeOutputs(
            executionId,
            arg.node.id,
            { config: {}, output },
            { data: output, _selectedPort: 'default' },
          );
          return Promise.resolve(true);
        });

      const result = await service.executeInline(
        workflowId,
        {},
        {
          executionId,
          context,
          executedNodes: new Set<string>(),
          recursionDepth: 1,
          parentNodeExecutionId: 'workflow-node-row',
        },
      );

      expect(result).toStrictEqual(output);
    });

    // 예전에는 설정 에코(`code` · `language`)를 펼친 값에 `_selectedPort` 가 없어 success ·
    // error 포트가 함께 열리고 다음 노드가 설정 에코를 받았다(NERV Task CLE-T-X3AH4F).
    // CLE-NODE-CODE: `return` 이 없으면 `output` 은 `undefined` 다. 표현식은 없는 멤버를
    // `null` 로 읽으므로(expression-engine 의 멤버 접근 규칙) `$node[...].output` 은 둘 다 `null` 이다.
    it('Code 가 null 을 돌려주면 success 포트만 열고 다음 노드는 설정 에코가 아니라 null 을 받는다', async () => {
      await runCodeGraph('return null;', {
        fromNode: '{{ $node["code"].output }}',
        port: '{{ $node["code"].port }}',
      });

      expect(successCalls).toHaveLength(1);
      expect(errorCalls).toHaveLength(0);
      expect(successCalls[0].input).toBeNull();
      expect(successCalls[0].config.fromNode).toBeNull();
      expect(successCalls[0].config.port).toBe('success');
    });

    it('output 이 없으면 success 포트만 열고 다음 노드는 설정 에코가 아니라 undefined 를 받는다', async () => {
      await runValueGraph(undefined, {
        fromNode: '{{ $node["code"].output }}',
        port: '{{ $node["code"].port }}',
      });

      expect(successCalls).toHaveLength(1);
      expect(errorCalls).toHaveLength(0);
      expect(successCalls[0].input).toBeUndefined();
      expect(successCalls[0].config.fromNode).toBeNull();
      expect(successCalls[0].config.port).toBe('success');
    });

    // 입력을 그대로 넘기는 분기 노드(If/Else 의 `output: input`)는 `null` 을 받으면 자기
    // 출력도 `null` 이 되어 같은 봉투를 탄다. 고른 포트 하나만 열고 그 뒤 노드는 `null` 을
    // 받는다(NERV Task CLE-T-X3AH4F 의 영향 범위. Switch · Background 도 같은 모양이다).
    it('null 을 받은 If/Else 도 고른 포트로만 보내고 그 뒤 노드는 null 을 받는다', async () => {
      handlerRegistry.register('if_else', new IfElseHandler());
      registerValueNode('value_node', null);
      mockNodeRepo.findBy.mockResolvedValue([
        vNode('trigger', 'test_node'),
        vNode('code', 'value_node'),
        vNode('branch', 'if_else', {
          conditions: [{ field: 'value', operator: 'is_null' }],
          combineMode: 'and',
        }),
        vNode('ok', 'success_sink', { port: '{{ $node["branch"].port }}' }),
        vNode('err', 'error_sink'),
      ]);
      mockEdgeRepo.findBy.mockResolvedValue([
        vEdge('trigger', 'out', 'code'),
        vEdge('code', 'success', 'branch'),
        vEdge('branch', 'true', 'ok'),
        vEdge('branch', 'false', 'err'),
      ]);
      await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
      await waitForSink();

      expect(successCalls).toHaveLength(1);
      expect(errorCalls).toHaveLength(0);
      expect(successCalls[0].input).toBeNull();
      expect(successCalls[0].config.port).toBe('true');
    });

    it('배열 원소를 표현식으로 바로 읽는다', async () => {
      await runValueGraph([{ v: 1 }, { v: 2 }, { v: 3 }], {
        count: '{{ $input.length }}',
        second: '{{ $node["code"].output[1].v }}',
      });

      expect(successCalls[0].config).toEqual(
        expect.objectContaining({ count: 3, second: 2 }),
      );
    });

    it('사용자가 돌려준 { data: [...] } 객체는 풀지 않는다', async () => {
      await runValueGraph(
        { data: [1, 2] },
        { dataFromNode: '{{ $node["code"].output.data }}' },
      );

      expect(successCalls[0].input).toEqual({ data: [1, 2] });
      expect(successCalls[0].config).toEqual(
        expect.objectContaining({ dataFromNode: [1, 2] }),
      );
      expect(errorCalls).toHaveLength(0);
    });

    // 분기 노드가 배열을 그대로 넘겨도(If/Else · Switch 의 `output: input`) 고른 포트로만
    // 가고 그 뒤 노드는 배열을 받는다.
    it('배열 output 을 고른 포트로만 보내고 그 뒤 노드는 배열을 받는다', async () => {
      registerValueNode('array_router', ['a', 'b'], 'true');
      mockNodeRepo.findBy.mockResolvedValue([
        vNode('trigger', 'test_node'),
        vNode('router', 'array_router'),
        vNode('ok', 'success_sink', { picked: '{{ $node["router"].output }}' }),
        vNode('err', 'error_sink'),
      ]);
      mockEdgeRepo.findBy.mockResolvedValue([
        vEdge('trigger', 'out', 'router'),
        vEdge('router', 'true', 'ok'),
        vEdge('router', 'false', 'err'),
      ]);

      await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
      await waitForSink();

      expect(successCalls).toHaveLength(1);
      expect(successCalls[0].input).toEqual(['a', 'b']);
      expect(successCalls[0].config).toEqual(
        expect.objectContaining({ picked: ['a', 'b'] }),
      );
      expect(errorCalls).toHaveLength(0);
    });

    // 입력 노드가 둘이면 `$input` 은 { [sourceId]: 값 } 으로 합쳐진다. 각 값은 봉투가 풀린 배열이다.
    // 합류 노드는 두 입력이 다 온 뒤 한 번만 실행된다.
    it('입력 노드 둘이 배열 + port 를 내보내면 $input 을 { [sourceId]: 배열 } 로 합친다', async () => {
      registerValueNode('array_router_a', ['a1', 'a2'], 'true');
      registerValueNode('array_router_b', ['b1'], 'true');
      mockNodeRepo.findBy.mockResolvedValue([
        vNode('trigger', 'test_node'),
        vNode('ra', 'array_router_a'),
        vNode('rb', 'array_router_b'),
        vNode('ok', 'success_sink'),
      ]);
      mockEdgeRepo.findBy.mockResolvedValue([
        vEdge('trigger', 'out', 'ra'),
        vEdge('trigger', 'out', 'rb'),
        vEdge('ra', 'true', 'ok'),
        vEdge('rb', 'true', 'ok'),
      ]);

      await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
      await waitForSink();

      expect(successCalls).toHaveLength(1);
      const merged = successCalls[0].input as Record<string, unknown>;
      expect(Object.keys(merged).sort()).toEqual(['ra', 'rb']);
      expect(merged.ra).toEqual(['a1', 'a2']);
      expect(merged.rb).toEqual(['b1']);
      expect(errorCalls).toHaveLength(0);
    });
  });

  // 다음 노드 `$input` 은 구조화 출력 캐시의 핸들러 output 이다. 구조화 출력이 없는 노드
  // (구조화 캐시가 없던 옛 컨텍스트 · 옛 큐 작업)만 flat 값에서 제어 필드를 뗀다. 연결선
  // 판정은 flat 값의 `_selectedPort` 로 한다(NERV Task CLE-T-ZJR3AF).
  describe('gatherNodeInput — 구조화 캐시 읽기와 대체 경로 (CLE-T-ZJR3AF)', () => {
    type Caches = {
      nodeOutputCache: Record<string, unknown>;
      structuredOutputCache: Record<string, unknown>;
    };
    const gather = (
      caches: Caches,
      sources: Array<{ id: string; port: string }>,
    ): unknown => {
      const edges = sources.map((src) => ({
        sourceNodeId: src.id,
        sourcePort: src.port,
        targetNodeId: 'next',
        targetPort: 'in',
      }));
      return (
        service as unknown as {
          gatherNodeInput: (
            nodeId: string,
            edges: unknown[],
            executedNodes: Set<string>,
            caches: Caches,
            workflowInput: unknown,
          ) => unknown;
        }
      ).gatherNodeInput(
        'next',
        edges,
        new Set(sources.map((src) => src.id)),
        caches,
        { from: 'workflow' },
      );
    };

    it('구조화 출력이 있으면 flat 봉투 대신 핸들러 output 을 준다', () => {
      const output = { data: [1, 2] };
      expect(
        gather(
          {
            nodeOutputCache: { a: { data: [1, 2], _selectedPort: 'ok' } },
            structuredOutputCache: { a: { config: {}, output, port: 'ok' } },
          },
          [{ id: 'a', port: 'ok' }],
        ),
      ).toBe(output);
    });

    it('구조화 출력이 없으면 flat 값에서 제어 필드만 떼고 봉투는 풀지 않는다', () => {
      expect(
        gather(
          {
            nodeOutputCache: {
              a: { v: 1, _selectedPort: 'ok', status: 'resumed' },
            },
            structuredOutputCache: {},
          },
          [{ id: 'a', port: 'ok' }],
        ),
      ).toEqual({ v: 1 });
      expect(
        gather(
          {
            nodeOutputCache: { a: { data: [1, 2], _selectedPort: 'ok' } },
            structuredOutputCache: {},
          },
          [{ id: 'a', port: 'ok' }],
        ),
      ).toEqual({ data: [1, 2] });
    });

    it('연결선 판정은 flat 값의 _selectedPort 로 하고 여러 입력도 구조화 출력을 모은다', () => {
      const caches: Caches = {
        nodeOutputCache: {
          a: { x: 1, _selectedPort: 'ok' },
          b: { y: 2, _selectedPort: 'other' },
        },
        structuredOutputCache: {
          a: { config: {}, output: { x: 1 }, port: 'ok' },
          b: { config: {}, output: { y: 2 }, port: 'other' },
        },
      };
      expect(gather(caches, [{ id: 'b', port: 'ok' }])).toBeUndefined();
      expect(
        gather(caches, [
          { id: 'a', port: 'ok' },
          { id: 'b', port: 'ok' },
        ]),
      ).toEqual({ a: { x: 1 } });
    });
  });

  // spec node-output §4.2.1 — 구조화 출력이 없는 노드의 대체 경로(toDownstreamValue)는
  // _resumeState 를 떼고 _retryState 를 남긴다. 다음 노드 값은 보통 구조화 캐시에서
  // 읽는다(NERV Task CLE-T-ZJR3AF).
  describe('toDownstreamValue _retryState preservation', () => {
    function strip(output: unknown): unknown {
      return toDownstreamValue(output);
    }

    it('preserves _retryState but strips _resumeState / control fields', () => {
      const out = strip({
        result: { ok: true },
        port: 'error',
        status: 'ended',
        _resumeState: { messages: [] },
        _retryState: {
          messages: [{ role: 'user', content: 'hi' }],
          expiresAt: 'iso',
        },
      }) as Record<string, unknown>;
      expect(out._resumeState).toBeUndefined();
      expect(out.port).toBeUndefined();
      expect(out.status).toBeUndefined();
      expect(out._retryState).toBeDefined();
      expect((out._retryState as Record<string, unknown>).expiresAt).toBe(
        'iso',
      );
    });

    // W16: 입력에 _retryState 가 없는 경우 — 비-retryable 종결 시 output 에
    // _retryState 가 undefined (not present) 임을 검증 (silent regression 방지).
    it('output has no _retryState when input lacks _retryState (non-retryable termination)', () => {
      const out = strip({
        result: { ok: true },
        port: 'user_ended',
        status: 'ended',
        _resumeState: { messages: [] },
        // _retryState: intentionally absent
      }) as Record<string, unknown>;
      expect(out._resumeState).toBeUndefined();
      expect(out._retryState).toBeUndefined();
      expect('_retryState' in out).toBe(false);
    });

    // §7.5 — `_resumeCheckpoint` 는 DB 영속 SoT 이지만 downstream 노드 input
    // 전달 시에는 internal-only 로 strip 돼야 한다 (`_resumeState` 와 동일 정책).
    // 회귀 가드 — `_resumeState` 가 과거 동일 패턴에서 누수 회귀를 겪은 선례.
    it('strips _resumeCheckpoint from downstream input (internal-only)', () => {
      const out = strip({
        result: { ok: true },
        port: 'out',
        _resumeCheckpoint: { messages: [], turnCount: 1, model: 'm' },
      }) as Record<string, unknown>;
      expect(out._resumeCheckpoint).toBeUndefined();
      expect('_resumeCheckpoint' in out).toBe(false);
      // 다른 result 필드는 보존.
      expect(out.result).toEqual({ ok: true });
    });
  });
});
