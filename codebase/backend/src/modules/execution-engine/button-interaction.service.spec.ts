import {
  ButtonInteractionService,
  resolveButtonInteraction,
  buildResumedStructuredOutput,
  isButtonClickPayload,
  type ButtonClickPayload,
  type StructuredInteraction,
} from './button-interaction.service';
import type { NodeHandlerOutput } from '../../nodes/core/node-handler.interface';
import { ExecutionContextService } from './context/execution-context.service';
import { ConversationThreadService } from './conversation-thread/conversation-thread.service';
import type { ExecutionEventEmitter } from './events/execution-event-emitter.service';
import type { InteractionEngineDriver } from './engine-driver.interface';
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
  let mockDriver: jest.Mocked<InteractionEngineDriver>;

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
    } as unknown as jest.Mocked<InteractionEngineDriver>;

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
      const setStructuredSpy = jest.spyOn(
        contextService,
        'setStructuredOutput',
      );

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
      // Fix 2 — structured output 도 동일 노드에 set 됨: buildResumedStructuredOutput
      // 결과의 핵심 필드(interaction.type, port, status='resumed')를 단언.
      const structCall = setStructuredSpy.mock.calls.find(
        (c) => c[1] === nodeId,
      );
      const structured = structCall?.[2] as {
        port?: string;
        status?: string;
        output?: { interaction?: { type?: string } };
      };
      expect(structured.port).toBe('approve');
      expect(structured.status).toBe('resumed');
      expect(structured.output?.interaction?.type).toBe('button_click');
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

// ────────────────────────────────────────────────────────────────────────────
// resolveButtonInteraction — 추출된 순수 결정 함수의 격리 단위 테스트.
//
// I/O 의존성 없이 (payload, buttons, buttonItemMap, outputItems, cleanNodeOutput,
// now) 만으로 (selectedPort, interactionData, updatedOutput, structuredInteraction)
// 를 산출하는지 variant 별로 단언한다 — processButtonResumeTurn 의 행위보존을 함수
// 레벨에서 못박는다.
// ────────────────────────────────────────────────────────────────────────────
describe('resolveButtonInteraction', () => {
  const NOW = '2026-06-19T00:00:00.000Z';
  const clean = (): Record<string, unknown> => ({
    buttonConfig: {},
    foo: 'bar',
  });

  describe('isButtonClickPayload (type guard)', () => {
    it('button_click → true (narrowing)', () => {
      const p: ButtonClickPayload = { type: 'button_click', buttonId: 'b1' };
      expect(isButtonClickPayload(p)).toBe(true);
    });
    it('그 외 type → false (fallback 경로)', () => {
      const p: ButtonClickPayload = { type: 'something_else' };
      expect(isButtonClickPayload(p)).toBe(false);
    });
  });

  it('(a) button_click port 버튼 — _selectedPort=buttonId + button_click interaction', () => {
    const cleanNodeOutput = clean();
    const res = resolveButtonInteraction(
      { type: 'button_click', buttonId: 'approve' },
      [{ id: 'approve', type: 'port', label: 'Approve' }],
      undefined,
      undefined,
      cleanNodeOutput,
      NOW,
    );

    expect(res.selectedPort).toBe('approve');
    expect(res.updatedOutput).toEqual({
      type: 'button_click',
      buttonId: 'approve',
      buttonLabel: 'Approve',
      clickedAt: NOW,
      nodeOutput: cleanNodeOutput,
      _selectedPort: 'approve',
    });
    expect(res.interactionData).toEqual({
      interactionType: 'button_click',
      buttonId: 'approve',
      buttonLabel: 'Approve',
      clickedAt: NOW,
    });
    expect(res.structuredInteraction).toEqual({
      type: 'button_click',
      data: { buttonId: 'approve', buttonLabel: 'Approve' },
      receivedAt: NOW,
    });
    // selectedItem 미해석 시 동봉 안 됨.
    expect(res.updatedOutput).not.toHaveProperty('selectedItem');
    expect(res.structuredInteraction.data).not.toHaveProperty('selectedItem');
  });

  it('(b) button_click link 버튼 — _selectedPort=continue + button_continue(url 동봉)', () => {
    const res = resolveButtonInteraction(
      { type: 'button_click', buttonId: 'go' },
      [{ id: 'go', type: 'link', label: 'Go', url: 'https://x.test' }],
      undefined,
      undefined,
      clean(),
      NOW,
    );

    expect(res.selectedPort).toBe('continue');
    expect(res.interactionData).toEqual({
      interactionType: 'button_continue',
      clickedAt: NOW,
    });
    expect(res.structuredInteraction).toEqual({
      type: 'button_continue',
      data: { buttonId: 'go', buttonLabel: 'Go', url: 'https://x.test' },
      receivedAt: NOW,
    });
    expect(res.updatedOutput.type).toBe('button_continue');
    expect(res.updatedOutput._selectedPort).toBe('continue');
    // link 버튼 updatedOutput 에는 buttonId 미동봉 (continue 형태).
    expect(res.updatedOutput).not.toHaveProperty('buttonId');
  });

  it('(b2) link 버튼 url 부재 — structuredInteraction.data 에 url 키 없음', () => {
    const res = resolveButtonInteraction(
      { type: 'button_click', buttonId: 'noUrl' },
      [{ id: 'noUrl', type: 'link', label: 'NoUrl' }],
      undefined,
      undefined,
      clean(),
      NOW,
    );
    expect(res.selectedPort).toBe('continue');
    expect(res.structuredInteraction.data).not.toHaveProperty('url');
    expect(res.structuredInteraction.data).toEqual({
      buttonId: 'noUrl',
      buttonLabel: 'NoUrl',
    });
  });

  it('(c) item-level button (__item_) — base port 라우팅 + selectedItem 해석', () => {
    const res = resolveButtonInteraction(
      { type: 'button_click', buttonId: 'pick__item_1' },
      [{ id: 'pick__item_1', type: 'port', label: 'Pick' }],
      { pick__item_1: 1 },
      [{ title: 'A' }, { title: 'B' }],
      clean(),
      NOW,
    );

    // "{defId}__item_{idx}" → base port "pick".
    expect(res.selectedPort).toBe('pick');
    // buttonItemMap[btnId]=1 → items[1].
    expect(res.updatedOutput.selectedItem).toEqual({ title: 'B' });
    expect(res.structuredInteraction.data.selectedItem).toEqual({ title: 'B' });
    // base port 가 updatedOutput._selectedPort 에 반영.
    expect(res.updatedOutput._selectedPort).toBe('pick');
  });

  it('(d) fallback (non-button_click) — _selectedPort=continue, 빈 data', () => {
    const cleanNodeOutput = clean();
    const res = resolveButtonInteraction(
      { type: 'message_received_or_other' },
      [{ id: 'b1', type: 'port', label: 'B1' }],
      undefined,
      undefined,
      cleanNodeOutput,
      NOW,
    );

    expect(res.selectedPort).toBe('continue');
    expect(res.interactionData).toEqual({
      interactionType: 'button_continue',
      clickedAt: NOW,
    });
    expect(res.structuredInteraction).toEqual({
      type: 'button_continue',
      data: {},
      receivedAt: NOW,
    });
    expect(res.updatedOutput).toEqual({
      type: 'button_continue',
      clickedAt: NOW,
      nodeOutput: cleanNodeOutput,
      _selectedPort: 'continue',
    });
  });

  it('알 수 없는 buttonId → INVALID_BUTTON_ID throw (에러 보존)', () => {
    expect(() =>
      resolveButtonInteraction(
        { type: 'button_click', buttonId: 'nope' },
        [{ id: 'b1', type: 'port', label: 'B1' }],
        undefined,
        undefined,
        clean(),
        NOW,
      ),
    ).toThrow('INVALID_BUTTON_ID');
  });

  // Fix 3 — buttonId 자체가 누락된 button_click payload. 가드는 여전히 true 라
  // find(b.id === undefined) 가 미스 → INVALID_BUTTON_ID throw (fallback 아님).
  // #6 타입안전 정리(buttonId! 제거) 후에도 이 행위가 보존됨을 못박는다.
  it('button_click(buttonId 누락) → INVALID_BUTTON_ID throw (fallback 아님)', () => {
    expect(() =>
      resolveButtonInteraction(
        { type: 'button_click' },
        [{ id: 'b1', type: 'port', label: 'B1' }],
        undefined,
        undefined,
        clean(),
        NOW,
      ),
    ).toThrow('INVALID_BUTTON_ID');
  });

  // Fix 4 — link 버튼 + item-level(selectedItem 동봉) 조합. link 분기에서도
  // buttonItemMap → outputItems → selectedItem 해석이 적용돼 data/updatedOutput
  // 양쪽에 동봉된다.
  it('(b3) link 버튼 + item-level — selectedItem 동봉 (data + updatedOutput)', () => {
    const res = resolveButtonInteraction(
      { type: 'button_click', buttonId: 'go__item_0' },
      [{ id: 'go__item_0', type: 'link', label: 'Go', url: 'https://x.test' }],
      { go__item_0: 0 },
      [{ title: 'A' }, { title: 'B' }],
      clean(),
      NOW,
    );

    // link 버튼은 항상 continue 로 라우팅 (port 무시).
    expect(res.selectedPort).toBe('continue');
    expect(res.structuredInteraction.type).toBe('button_continue');
    // buttonItemMap[btnId]=0 → items[0] 이 selectedItem 으로 동봉.
    expect(res.structuredInteraction.data.selectedItem).toEqual({ title: 'A' });
    expect(res.updatedOutput.selectedItem).toEqual({ title: 'A' });
    // url 도 함께 동봉 (link).
    expect(res.structuredInteraction.data.url).toBe('https://x.test');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// buildResumedStructuredOutput — 재개 tick 의 structured NodeHandlerOutput 구성
// 순수함수. (prevStructured, structuredInteraction, selectedPort, cleanNodeOutput)
// 만으로 config/meta/output 을 보존·파생하는지 변형별로 단언한다. 호출자는 반드시
// setNodeOutput() 직후의 view 를 prevStructured 로 넘긴다 (read-timing 행위).
// ────────────────────────────────────────────────────────────────────────────
describe('buildResumedStructuredOutput', () => {
  const NOW = '2026-06-19T00:00:00.000Z';
  const SI: StructuredInteraction = {
    type: 'button_click',
    data: { buttonId: 'b1', buttonLabel: 'B1' },
    receivedAt: NOW,
  };

  it('(a) prevStructured undefined — config={}, meta 키 없음, output 은 cleanNodeOutput 파생', () => {
    const cleanNodeOutput = { foo: 'bar' };
    const res = buildResumedStructuredOutput(
      undefined,
      SI,
      'p',
      cleanNodeOutput,
    );

    expect(res.config).toEqual({});
    expect(res.port).toBe('p');
    expect(res.status).toBe('resumed');
    // prevMeta 부재 → meta 키 자체가 결과에 없음.
    expect('meta' in res).toBe(false);
    // output 은 cleanNodeOutput(prevStructured?.output ?? cleanNodeOutput) 에서 파생.
    const out = res.output as Record<string, unknown>;
    expect(out.foo).toBe('bar');
    expect(out.interaction).toEqual(SI);
    // previousOutput 은 (strip 후의) cleanNodeOutput.
    expect(out.previousOutput).toEqual({ foo: 'bar' });
  });

  it('(b) Array 입력 fallback — strip 생략, 배열 그대로 previousOutput + 인덱스 spread', () => {
    const prev = {
      config: { c: 1 },
      output: [{ a: 1 }],
      meta: { m: 2 },
    } as unknown as NodeHandlerOutput;
    const res = buildResumedStructuredOutput(prev, SI, 'p', { foo: 'bar' });

    const out = res.output as Record<string, unknown>;
    // Array.isArray(rawPrevOutput) → strip 분기 우회, prevOutput = 배열 그대로.
    expect(Array.isArray(out.previousOutput)).toBe(true);
    expect(out.previousOutput).toEqual([{ a: 1 }]);
    // `{ ...array }` spread → 인덱스 키('0')로 펼쳐짐.
    expect(out['0']).toEqual({ a: 1 });
    expect(out.interaction).toEqual(SI);
  });

  it('(c) previousOutput 키 제거 (체인 방지) — output.previousOutput 가 결과에 남지 않음', () => {
    const prev = {
      config: {},
      output: { x: 1, previousOutput: { OLD: true } },
    } as unknown as NodeHandlerOutput;
    const res = buildResumedStructuredOutput(prev, SI, 'p', { foo: 'bar' });

    const out = res.output as Record<string, unknown>;
    const prevOut = out.previousOutput as Record<string, unknown>;
    // 직전 output 의 nested previousOutput 이 strip 됨 → 체인 미형성.
    expect(prevOut).toEqual({ x: 1 });
    expect('previousOutput' in prevOut).toBe(false);
    expect(prevOut.OLD).toBeUndefined();
    // top-level runtime 필드(x)는 보존.
    expect(out.x).toBe(1);
  });

  it('(d-1) prevMeta 부재 — meta 키 미포함', () => {
    const prev = {
      config: { c: 9 },
      output: { x: 1 },
    } as unknown as NodeHandlerOutput;
    const res = buildResumedStructuredOutput(prev, SI, 'p', { foo: 'bar' });

    expect('meta' in res).toBe(false);
  });

  it('(d-2) prevMeta 존재 — meta 조건부 포함 (원본 보존)', () => {
    const prev = {
      config: { c: 9 },
      output: { x: 1 },
      meta: { tokenUsage: 5 },
    } as unknown as NodeHandlerOutput;
    const res = buildResumedStructuredOutput(prev, SI, 'p', { foo: 'bar' });

    expect(res.meta).toEqual({ tokenUsage: 5 });
  });

  it('(e) port·status(resumed)·config 보존', () => {
    const prev = {
      config: { buttonConfig: { buttons: [] } },
      output: { y: 2 },
    } as unknown as NodeHandlerOutput;
    const res = buildResumedStructuredOutput(prev, SI, 'approve', {
      foo: 'bar',
    });

    // selectedPort → port 그대로.
    expect(res.port).toBe('approve');
    // 항상 'resumed'.
    expect(res.status).toBe('resumed');
    // prevStructured.config 원본 보존.
    expect(res.config).toEqual({ buttonConfig: { buttons: [] } });
    // interaction append.
    expect((res.output as Record<string, unknown>).interaction).toEqual(SI);
  });
});
