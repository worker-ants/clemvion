import { ButtonInteractionService } from './button-interaction.service';
import { ExecutionContextService } from './context/execution-context.service';
import { ConversationThreadService } from './conversation-thread/conversation-thread.service';
import type { ExecutionEventEmitter } from './events/execution-event-emitter.service';
import type { EngineDriver } from './engine-driver.interface';
import {
  Execution,
  ExecutionStatus,
} from '../executions/entities/execution.entity';
import { NodeExecutionStatus } from '../node-executions/entities/node-execution.entity';
import { Node, NodeCategory } from '../nodes/entities/node.entity';
import type { ExecutionContext } from '../../nodes/core/node-handler.interface';
import type { ButtonConfig } from '../../nodes/presentation/_shared/button.types';
import { PARK_RELEASED } from '../../shared/execution-resume/process-turn-result';

// ────────────────────────────────────────────────────────────────────────────
// C-1 step3 — ButtonInteractionService 단위 테스트.
//
// 엔진(god-class)에서 추출된 button blocking-interaction 의 두 메서드를 격리 검증한다:
//  - waitForButtonInteraction (park → WAITING 전이 + buttonConfig emit)
//  - processButtonResumeTurn (버튼 클릭 직접 처리 — port 선택·output 갱신·
//    thread append·NodeExecution COMPLETED 전이).
//
// 엔진 잔류 메서드(updateExecutionStatus / stageDurableResumeSnapshot /
// contextKeyOf)는 mocked EngineDriver 로 검증한다 (엔진=시그니처 source of truth).
// ConversationThreadService / ExecutionContextService 는 stateless 라 실제 인스턴스
// 사용. ExecutionEventEmitter 는 mock.
// ────────────────────────────────────────────────────────────────────────────

const wfId = 'wf-button';
const execId = 'exec-button';

describe('ButtonInteractionService', () => {
  let service: ButtonInteractionService;
  let contextService: ExecutionContextService;
  let conversationThreadService: ConversationThreadService;
  let mockEventEmitter: jest.Mocked<
    Pick<ExecutionEventEmitter, 'emitExecution' | 'emitNode'>
  >;
  let mockNodeExecutionRepository: Record<string, jest.Mock>;
  let mockDriver: jest.Mocked<EngineDriver>;

  beforeEach(() => {
    contextService = new ExecutionContextService();
    conversationThreadService = new ConversationThreadService();
    mockEventEmitter = {
      emitExecution: jest.fn().mockResolvedValue(undefined),
      emitNode: jest.fn().mockResolvedValue(undefined),
    };
    mockNodeExecutionRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockImplementation((e: unknown) => Promise.resolve(e)),
    };
    mockDriver = {
      updateExecutionStatus: jest.fn().mockResolvedValue(true),
      stageDurableResumeSnapshot: jest.fn(),
      buildRetryReentryState: jest.fn(),
      buildResumeCheckpoint: jest.fn(),
      isCheckpointEligibleNodeType: jest.fn().mockReturnValue(false),
      // in-memory context Map 키 — 엔진과 동일하게 비-background 는 executionId.
      contextKeyOf: jest.fn((ctx: ExecutionContext) => ctx.executionId),
      applyPortSelection: jest.fn((o: unknown) => o),
    } as unknown as jest.Mocked<EngineDriver>;

    service = new ButtonInteractionService(
      contextService,
      conversationThreadService,
      mockEventEmitter as unknown as ExecutionEventEmitter,
      mockNodeExecutionRepository as unknown as never,
      mockDriver,
    );
  });

  afterEach(() => jest.restoreAllMocks());

  const makeButtonNode = (nodeId = 'node-btn'): Node =>
    ({
      id: nodeId,
      workflowId: wfId,
      type: 'carousel',
      category: NodeCategory.PRESENTATION,
      label: 'Buttons',
      config: {},
      isDisabled: false,
    }) as unknown as Node;

  const makeExecution = (
    status: ExecutionStatus = ExecutionStatus.WAITING_FOR_INPUT,
  ): Execution =>
    ({
      id: execId,
      workflowId: wfId,
      status,
      startedAt: new Date(),
      inputData: {},
    }) as unknown as Execution;

  const seedButtonContext = (
    nodeId: string,
    buttonConfig: ButtonConfig,
    extra: Record<string, unknown> = {},
  ): ExecutionContext => {
    const ctx = contextService.createContext(execId, wfId);
    ctx.nodeOutputCache[nodeId] = {
      status: 'waiting_for_input',
      buttonConfig,
      ...extra,
    };
    (
      ctx as { structuredOutputCache: Record<string, unknown> }
    ).structuredOutputCache = {
      [nodeId]: {
        config: { buttonConfig },
        output: extra,
        status: 'waiting_for_input',
      },
    };
    return ctx;
  };

  // ──────────────────────────────────────────────────────────────────────────
  // waitForButtonInteraction — park (release) 경로
  // ──────────────────────────────────────────────────────────────────────────
  describe('waitForButtonInteraction', () => {
    it('PARK_RELEASED 반환 + WAITING 전이(driver) + buttons emit (buttonConfig 동봉)', async () => {
      const nodeId = 'node-btn-park';
      const buttonConfig: ButtonConfig = {
        buttons: [{ id: 'b1', type: 'port', label: 'B1' }],
      };
      const ctx = seedButtonContext(nodeId, buttonConfig);
      mockNodeExecutionRepository.findOne.mockResolvedValueOnce({
        id: 'ne-park',
        nodeId,
        startedAt: new Date(),
      });

      const out = await service.waitForButtonInteraction(
        makeExecution(),
        execId,
        makeButtonNode(nodeId),
        ctx,
        [],
      );

      expect(out).toBe(PARK_RELEASED);
      expect(mockDriver.stageDurableResumeSnapshot).toHaveBeenCalledTimes(1);
      expect(mockDriver.updateExecutionStatus).toHaveBeenCalledWith(
        expect.anything(),
        ExecutionStatus.WAITING_FOR_INPUT,
        expect.objectContaining({ id: 'ne-park' }),
      );
      expect(mockEventEmitter.emitExecution).toHaveBeenCalledWith(
        execId,
        'execution.waiting_for_input',
        expect.objectContaining({
          interactionType: 'buttons',
          buttonConfig: expect.objectContaining({
            buttons: buttonConfig.buttons,
          }),
        }),
      );
    });

    it('buttonConfig 부재 → MISSING_BUTTON_CONFIG throw', async () => {
      const nodeId = 'node-btn-missing';
      const ctx = contextService.createContext(execId, wfId);
      ctx.nodeOutputCache[nodeId] = { status: 'waiting_for_input' };

      await expect(
        service.waitForButtonInteraction(
          makeExecution(),
          execId,
          makeButtonNode(nodeId),
          ctx,
          [],
        ),
      ).rejects.toThrow('MISSING_BUTTON_CONFIG');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // processButtonResumeTurn — port click / link continue / fallback / guards
  // ──────────────────────────────────────────────────────────────────────────
  describe('processButtonResumeTurn', () => {
    it('button_click(port) — _selectedPort=buttonId + nodeExec COMPLETED + thread append', async () => {
      const nodeId = 'node-btn-a';
      const buttonConfig: ButtonConfig = {
        buttons: [{ id: 'approve', type: 'port', label: 'Approve' }],
      };
      const ctx = seedButtonContext(nodeId, buttonConfig);
      mockNodeExecutionRepository.findOne.mockResolvedValueOnce({
        id: 'ne-btn-a',
        nodeId,
        executionId: execId,
        status: NodeExecutionStatus.WAITING_FOR_INPUT,
        startedAt: new Date(),
      });
      const appendSpy = jest.spyOn(
        conversationThreadService,
        'appendPresentationInteraction',
      );
      const setNodeSpy = jest.spyOn(contextService, 'setNodeOutput');

      await service.processButtonResumeTurn(
        makeExecution(ExecutionStatus.WAITING_FOR_INPUT),
        execId,
        makeButtonNode(nodeId),
        ctx,
        { type: 'button_click', buttonId: 'approve' },
      );

      // flat output 에 _selectedPort=approve 로 라우팅 반영.
      const flatCall = setNodeSpy.mock.calls.find((c) => c[1] === nodeId);
      expect((flatCall?.[2] as { _selectedPort?: string })._selectedPort).toBe(
        'approve',
      );
      // nodeExec COMPLETED 갱신. status !== RUNNING 이므로 NodeExecution save 는
      // driver.updateExecutionStatus(execution, RUNNING, nodeExec) 의 원자 트랜잭션
      // 안에서 일어난다 (엔진 잔류) — COMPLETED 로 마킹된 nodeExec 이 driver 로
      // 전달됐는지로 검증한다 (추출 전엔 실제 updateExecutionStatus 가 save 수행).
      expect(mockDriver.updateExecutionStatus).toHaveBeenCalledWith(
        expect.anything(),
        ExecutionStatus.RUNNING,
        expect.objectContaining({ status: NodeExecutionStatus.COMPLETED }),
      );
      // thread 에 button_click 상호작용 append.
      expect(appendSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          interaction: expect.objectContaining({ type: 'button_click' }),
        }),
      );
      // NODE_COMPLETED + EXECUTION_RESUMED emit.
      expect(mockEventEmitter.emitNode).toHaveBeenCalledWith(
        execId,
        nodeId,
        'execution.node.completed',
        expect.objectContaining({ status: NodeExecutionStatus.COMPLETED }),
      );
      expect(mockEventEmitter.emitExecution).toHaveBeenCalledWith(
        execId,
        'execution.resumed',
        expect.objectContaining({ status: ExecutionStatus.RUNNING }),
      );
    });

    it('button_click(link) — _selectedPort=continue (button_continue)', async () => {
      const nodeId = 'node-btn-link';
      const buttonConfig: ButtonConfig = {
        buttons: [
          { id: 'go', type: 'link', label: 'Go', url: 'https://x.test' },
        ],
      };
      const ctx = seedButtonContext(nodeId, buttonConfig);
      mockNodeExecutionRepository.findOne.mockResolvedValueOnce({
        id: 'ne-btn-link',
        nodeId,
        executionId: execId,
        status: NodeExecutionStatus.WAITING_FOR_INPUT,
        startedAt: new Date(),
      });
      const setNodeSpy = jest.spyOn(contextService, 'setNodeOutput');

      await service.processButtonResumeTurn(
        makeExecution(ExecutionStatus.WAITING_FOR_INPUT),
        execId,
        makeButtonNode(nodeId),
        ctx,
        { type: 'button_click', buttonId: 'go' },
      );

      const flatCall = setNodeSpy.mock.calls.find((c) => c[1] === nodeId);
      expect((flatCall?.[2] as { _selectedPort?: string })._selectedPort).toBe(
        'continue',
      );
    });

    it('non-button_click payload — fallback continue (_selectedPort=continue)', async () => {
      const nodeId = 'node-btn-fb';
      const buttonConfig: ButtonConfig = {
        buttons: [{ id: 'b1', type: 'port', label: 'B1' }],
      };
      const ctx = seedButtonContext(nodeId, buttonConfig);
      mockNodeExecutionRepository.findOne.mockResolvedValueOnce({
        id: 'ne-btn-fb',
        nodeId,
        executionId: execId,
        status: NodeExecutionStatus.WAITING_FOR_INPUT,
        startedAt: new Date(),
      });
      const setNodeSpy = jest.spyOn(contextService, 'setNodeOutput');

      await service.processButtonResumeTurn(
        makeExecution(ExecutionStatus.WAITING_FOR_INPUT),
        execId,
        makeButtonNode(nodeId),
        ctx,
        { type: 'something_else' },
      );

      const flatCall = setNodeSpy.mock.calls.find((c) => c[1] === nodeId);
      expect((flatCall?.[2] as { _selectedPort?: string })._selectedPort).toBe(
        'continue',
      );
    });

    it('item-level button (__item_) — base port 로 라우팅 + selectedItem 해석', async () => {
      const nodeId = 'node-btn-item';
      const buttonConfig: ButtonConfig = {
        buttons: [{ id: 'pick__item_1', type: 'port', label: 'Pick' }],
        buttonItemMap: { pick__item_1: 1 },
      };
      const ctx = seedButtonContext(nodeId, buttonConfig, {
        items: [{ title: 'A' }, { title: 'B' }],
      });
      mockNodeExecutionRepository.findOne.mockResolvedValueOnce({
        id: 'ne-btn-item',
        nodeId,
        executionId: execId,
        status: NodeExecutionStatus.WAITING_FOR_INPUT,
        startedAt: new Date(),
      });
      const setNodeSpy = jest.spyOn(contextService, 'setNodeOutput');

      await service.processButtonResumeTurn(
        makeExecution(ExecutionStatus.WAITING_FOR_INPUT),
        execId,
        makeButtonNode(nodeId),
        ctx,
        { type: 'button_click', buttonId: 'pick__item_1' },
      );

      const flatCall = setNodeSpy.mock.calls.find((c) => c[1] === nodeId);
      const out = flatCall?.[2] as {
        _selectedPort?: string;
        selectedItem?: { title?: string };
      };
      // "{defId}__item_{idx}" → base port "pick".
      expect(out._selectedPort).toBe('pick');
      // buttonItemMap[btnId]=1 → items[1].
      expect(out.selectedItem).toEqual({ title: 'B' });
    });

    it('알 수 없는 buttonId → INVALID_BUTTON_ID throw', async () => {
      const nodeId = 'node-btn-bad';
      const buttonConfig: ButtonConfig = {
        buttons: [{ id: 'b1', type: 'port', label: 'B1' }],
      };
      const ctx = seedButtonContext(nodeId, buttonConfig);
      mockNodeExecutionRepository.findOne.mockResolvedValueOnce({
        id: 'ne-btn-bad',
        nodeId,
        executionId: execId,
        status: NodeExecutionStatus.WAITING_FOR_INPUT,
        startedAt: new Date(),
      });

      await expect(
        service.processButtonResumeTurn(
          makeExecution(ExecutionStatus.WAITING_FOR_INPUT),
          execId,
          makeButtonNode(nodeId),
          ctx,
          { type: 'button_click', buttonId: 'nope' },
        ),
      ).rejects.toThrow('INVALID_BUTTON_ID');
    });

    it('buttonConfig 부재 → MISSING_BUTTON_CONFIG throw', async () => {
      const nodeId = 'node-btn-nocfg';
      const ctx = contextService.createContext(execId, wfId);
      ctx.nodeOutputCache[nodeId] = { status: 'waiting_for_input' };

      await expect(
        service.processButtonResumeTurn(
          makeExecution(ExecutionStatus.WAITING_FOR_INPUT),
          execId,
          makeButtonNode(nodeId),
          ctx,
          { type: 'button_click', buttonId: 'b1' },
        ),
      ).rejects.toThrow('MISSING_BUTTON_CONFIG');
    });

    it('savedExecution.status === RUNNING — nodeExec 만 save, updateExecutionStatus 미호출', async () => {
      const nodeId = 'node-btn-running';
      const buttonConfig: ButtonConfig = {
        buttons: [{ id: 'b1', type: 'port', label: 'B1' }],
      };
      const ctx = seedButtonContext(nodeId, buttonConfig);
      mockNodeExecutionRepository.findOne.mockResolvedValueOnce({
        id: 'ne-btn-running',
        nodeId,
        executionId: execId,
        status: NodeExecutionStatus.WAITING_FOR_INPUT,
        startedAt: new Date(),
      });

      await service.processButtonResumeTurn(
        makeExecution(ExecutionStatus.RUNNING),
        execId,
        makeButtonNode(nodeId),
        ctx,
        { type: 'button_click', buttonId: 'b1' },
      );

      // RUNNING→RUNNING assertTransition 회피 — updateExecutionStatus 미호출.
      expect(mockDriver.updateExecutionStatus).not.toHaveBeenCalled();
      expect(mockNodeExecutionRepository.save).toHaveBeenCalled();
    });

    it('savedExecution.status !== RUNNING — updateExecutionStatus(RUNNING) 호출', async () => {
      const nodeId = 'node-btn-notrunning';
      const buttonConfig: ButtonConfig = {
        buttons: [{ id: 'b1', type: 'port', label: 'B1' }],
      };
      const ctx = seedButtonContext(nodeId, buttonConfig);
      mockNodeExecutionRepository.findOne.mockResolvedValueOnce({
        id: 'ne-btn-notrunning',
        nodeId,
        executionId: execId,
        status: NodeExecutionStatus.WAITING_FOR_INPUT,
        startedAt: new Date(),
      });
      const statusCalls: unknown[] = [];
      mockDriver.updateExecutionStatus.mockImplementation(
        async (_e: unknown, status: unknown) => {
          statusCalls.push(status);
          return true;
        },
      );

      await service.processButtonResumeTurn(
        makeExecution(ExecutionStatus.WAITING_FOR_INPUT),
        execId,
        makeButtonNode(nodeId),
        ctx,
        { type: 'button_click', buttonId: 'b1' },
      );

      expect(statusCalls).toContain(ExecutionStatus.RUNNING);
    });

    it('nodeExec null — save/emit 스킵, 예외 없이 완료 (updateExecutionStatus 호출)', async () => {
      const nodeId = 'node-btn-nullne';
      const buttonConfig: ButtonConfig = {
        buttons: [{ id: 'b1', type: 'port', label: 'B1' }],
      };
      const ctx = seedButtonContext(nodeId, buttonConfig);
      mockNodeExecutionRepository.findOne.mockResolvedValueOnce(null);

      await expect(
        service.processButtonResumeTurn(
          makeExecution(ExecutionStatus.WAITING_FOR_INPUT),
          execId,
          makeButtonNode(nodeId),
          ctx,
          { type: 'button_click', buttonId: 'b1' },
        ),
      ).resolves.toBeUndefined();

      expect(mockNodeExecutionRepository.save).not.toHaveBeenCalled();
      expect(mockEventEmitter.emitNode).not.toHaveBeenCalled();
      // updateExecutionStatus 는 호출됨 (status !== RUNNING).
      expect(mockDriver.updateExecutionStatus).toHaveBeenCalled();
    });
  });
});
