import { FormInteractionService } from './form-interaction.service';
import { ExecutionContextService } from './context/execution-context.service';
import { ConversationThreadService } from './conversation-thread/conversation-thread.service';
import type { ExecutionEventEmitter } from './events/execution-event-emitter.service';
import type { InteractionEngineDriver } from './engine-driver.interface';
import {
  Execution,
  ExecutionStatus,
} from '../executions/entities/execution.entity';
import {
  NodeExecution,
  NodeExecutionStatus,
} from '../node-executions/entities/node-execution.entity';
import { Node, NodeCategory } from '../nodes/entities/node.entity';
import type { ExecutionContext } from '../../nodes/core/node-handler.interface';
import { PARK_RELEASED } from '../../shared/execution-resume/process-turn-result';

// ────────────────────────────────────────────────────────────────────────────
// C-1 step3 — FormInteractionService 단위 테스트.
//
// 엔진(god-class)에서 추출된 form blocking-interaction 의 두 메서드를 격리 검증한다:
//  - waitForFormSubmission (park → WAITING 전이 + EXECUTION_WAITING_FOR_INPUT emit)
//  - processFormResumeTurn (폼 제출 직접 처리 — 추출 전 engine spec 의
//    `processFormResumeTurn — 4 branches (SUMMARY W1)` + `waitForFormSubmission —
//    back-compat fallback (W13)` §5.5 블록을 본 spec 으로 이관, assertion 보존).
//
// 엔진 잔류 메서드(updateExecutionStatus / stageDurableResumeSnapshot /
// contextKeyOf)는 mocked EngineDriver 로 검증한다 (엔진=시그니처 source of truth).
// ConversationThreadService / ExecutionContextService 는 stateless 라 실제 인스턴스
// 사용. ExecutionEventEmitter 는 mock.
// ────────────────────────────────────────────────────────────────────────────

const wfId = 'wf-form-resume';
const execId = 'exec-form-resume';

describe('FormInteractionService', () => {
  let service: FormInteractionService;
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

    service = new FormInteractionService(
      contextService,
      conversationThreadService,
      mockEventEmitter as unknown as ExecutionEventEmitter,
      mockNodeExecutionRepository as unknown as never,
      mockDriver,
    );
  });

  afterEach(() => jest.restoreAllMocks());

  const makeFormNode = (nodeId = 'node-form-w1'): Node =>
    ({
      id: nodeId,
      workflowId: wfId,
      type: 'form',
      category: NodeCategory.LOGIC,
      label: 'Form',
      config: { fields: [{ name: 'answer' }] },
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

  const makeContext = (): ExecutionContext =>
    contextService.createContext(execId, wfId);

  // ──────────────────────────────────────────────────────────────────────────
  // waitForFormSubmission — park (release) 경로
  // ──────────────────────────────────────────────────────────────────────────
  describe('waitForFormSubmission', () => {
    it('PARK_RELEASED 반환 + WAITING 전이(driver) + EXECUTION_WAITING_FOR_INPUT emit', async () => {
      const nodeId = 'node-form-park';
      const ctx = makeContext();
      ctx.nodeOutputCache[nodeId] = {
        status: 'waiting_for_input',
        interactionType: 'form',
      };
      mockNodeExecutionRepository.findOne.mockResolvedValueOnce({
        id: 'ne-park',
        nodeId,
        startedAt: new Date(),
      });

      const out = await service.waitForFormSubmission(
        makeExecution(),
        execId,
        makeFormNode(nodeId),
        ctx,
      );

      expect(out).toBe(PARK_RELEASED);
      // park 직전 durable 스냅샷 스테이징 + WAITING 전이 (driver 경유).
      expect(mockDriver.stageDurableResumeSnapshot).toHaveBeenCalledTimes(1);
      expect(mockDriver.updateExecutionStatus).toHaveBeenCalledWith(
        expect.anything(),
        ExecutionStatus.WAITING_FOR_INPUT,
        expect.objectContaining({ id: 'ne-park' }),
      );
      // 폼 렌더용 waiting 이벤트 — top-level interactionType='form' 명시.
      expect(mockEventEmitter.emitExecution).toHaveBeenCalledWith(
        execId,
        'execution.waiting_for_input',
        expect.objectContaining({ interactionType: 'form' }),
      );
    });

    it('nodeExec 부재 시에도 WAITING 전이 + emit (save 인자 undefined)', async () => {
      const nodeId = 'node-form-park-null';
      const ctx = makeContext();
      ctx.nodeOutputCache[nodeId] = { status: 'waiting_for_input' };
      mockNodeExecutionRepository.findOne.mockResolvedValueOnce(null);

      const out = await service.waitForFormSubmission(
        makeExecution(),
        execId,
        makeFormNode(nodeId),
        ctx,
      );

      expect(out).toBe(PARK_RELEASED);
      expect(mockDriver.updateExecutionStatus).toHaveBeenCalledWith(
        expect.anything(),
        ExecutionStatus.WAITING_FOR_INPUT,
        undefined,
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // processFormResumeTurn — 4 branches (relocated from engine spec, SUMMARY W1)
  // 4개 경로: (a) sentinel 정상 unwrap, (b) non-sentinel warn 폴백,
  // (c) savedExecution.status === RUNNING skip-transition vs !== RUNNING transition,
  // (d) nodeExec null skip. exec-park D6 full B3, spec §10.9, spec §7.5.
  // ──────────────────────────────────────────────────────────────────────────
  describe('processFormResumeTurn — 4 branches (SUMMARY W1)', () => {
    // (a) sentinel 정상 unwrap — `{type:'form_submitted', formData:{answer:'yes'}}` 가
    //     올바르게 unwrap 돼 interactionData 에 반영된다.
    it('(a) sentinel form_submitted — formData 정상 unwrap + nodeExec COMPLETED 갱신', async () => {
      const nodeId = 'node-form-a';
      const nodeExecRow: Partial<NodeExecution> = {
        id: 'ne-form-a',
        nodeId,
        executionId: execId,
        status: NodeExecutionStatus.WAITING_FOR_INPUT,
        startedAt: new Date(),
      };
      mockNodeExecutionRepository.findOne = jest
        .fn()
        .mockResolvedValue(nodeExecRow);

      const ctx = makeContext();
      const saved = makeExecution(ExecutionStatus.WAITING_FOR_INPUT);
      const appendSpy = jest.spyOn(
        conversationThreadService,
        'appendPresentationInteraction',
      );

      await service.processFormResumeTurn(
        saved,
        execId,
        makeFormNode(nodeId),
        ctx,
        {
          type: 'form_submitted',
          formData: { answer: 'yes' },
        },
      );

      // nodeExec COMPLETED 로 갱신됐는지 확인. status !== RUNNING 이므로 NodeExecution
      // save 는 driver.updateExecutionStatus(execution, RUNNING, nodeExec) 의 원자
      // 트랜잭션 안에서 일어난다 (엔진 잔류) — COMPLETED 로 마킹된 nodeExec 이 driver
      // 로 전달됐는지로 검증한다 (추출 전엔 실제 updateExecutionStatus 가 save 수행).
      expect(mockDriver.updateExecutionStatus).toHaveBeenCalledWith(
        expect.anything(),
        ExecutionStatus.RUNNING,
        expect.objectContaining({ status: NodeExecutionStatus.COMPLETED }),
      );
      // nodeOutputCache 에 form_submitted 상호작용 기록 확인 (setNodeOutput 경로).
      expect(ctx.nodeOutputCache[nodeId]).toBeDefined();
      // W-2 — ConversationThread 에 form_submitted 상호작용 append (단일 mutation
      // entrypoint, button spec 의 button_click append 검증과 대칭).
      expect(appendSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          interaction: expect.objectContaining({
            type: 'form_submitted',
            data: expect.objectContaining({ answer: 'yes' }),
          }),
        }),
      );
      // W-1 — NODE_COMPLETED + EXECUTION_RESUMED emit (button spec 와 동일 shape).
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

    // W-3(a) 필드 화이트리스트 — config.fields 에 없는 키는 영속 interaction/output
    //   data 에서 제거 (WARN #8 Security defense-in-depth). makeFormNode 의
    //   config.fields=[{name:'answer'}] 이므로 'evil' 키는 통과 못 한다.
    it('W-3(a) config.fields 미정의 키 → 영속 interaction data 에서 제거', async () => {
      const nodeId = 'node-form-wl-strip';
      const nodeExecRow: Partial<NodeExecution> = {
        id: 'ne-form-wl-strip',
        nodeId,
        executionId: execId,
        status: NodeExecutionStatus.WAITING_FOR_INPUT,
        startedAt: new Date(),
      };
      mockNodeExecutionRepository.findOne = jest
        .fn()
        .mockResolvedValue(nodeExecRow);

      const ctx = makeContext();
      const saved = makeExecution(ExecutionStatus.WAITING_FOR_INPUT);
      const appendSpy = jest.spyOn(
        conversationThreadService,
        'appendPresentationInteraction',
      );
      const setStructuredSpy = jest.spyOn(
        contextService,
        'setStructuredOutput',
      );

      await service.processFormResumeTurn(
        saved,
        execId,
        makeFormNode(nodeId), // config.fields = [{ name: 'answer' }]
        ctx,
        {
          type: 'form_submitted',
          formData: { answer: 'yes', evil: '<script>alert(1)</script>' },
        },
      );

      // 영속 interaction data: 화이트리스트 통과 키만 (evil 제거).
      const appendArg = appendSpy.mock.calls[0]?.[1] as {
        interaction?: { data?: Record<string, unknown> };
      };
      expect(appendArg?.interaction?.data).toEqual({ answer: 'yes' });
      expect(appendArg?.interaction?.data).not.toHaveProperty('evil');
      // structured output 의 interaction.data 도 동일하게 strip.
      const structuredCall = setStructuredSpy.mock.calls.find(
        (c) => c[1] === nodeId,
      );
      const structuredOut = structuredCall?.[2] as {
        output?: { interaction?: { data?: Record<string, unknown> } };
      };
      expect(structuredOut?.output?.interaction?.data).toEqual({
        answer: 'yes',
      });
      expect(structuredOut?.output?.interaction?.data).not.toHaveProperty(
        'evil',
      );
    });

    // W-3(b) config.fields = [] (빈 배열) → allowedFieldNames.size === 0 분기로
    //   모든 제출 키가 verbatim 통과 (현재 동작 lock).
    it('W-3(b) config.fields=[] → 모든 제출 키 verbatim 통과', async () => {
      const nodeId = 'node-form-wl-empty';
      const nodeExecRow: Partial<NodeExecution> = {
        id: 'ne-form-wl-empty',
        nodeId,
        executionId: execId,
        status: NodeExecutionStatus.WAITING_FOR_INPUT,
        startedAt: new Date(),
      };
      mockNodeExecutionRepository.findOne = jest
        .fn()
        .mockResolvedValue(nodeExecRow);

      const emptyFieldsNode = {
        id: nodeId,
        workflowId: wfId,
        type: 'form',
        category: NodeCategory.LOGIC,
        label: 'Form',
        config: { fields: [] },
        isDisabled: false,
      } as unknown as Node;

      const ctx = makeContext();
      const saved = makeExecution(ExecutionStatus.WAITING_FOR_INPUT);
      const appendSpy = jest.spyOn(
        conversationThreadService,
        'appendPresentationInteraction',
      );

      await service.processFormResumeTurn(saved, execId, emptyFieldsNode, ctx, {
        type: 'form_submitted',
        formData: { foo: 1, bar: 'two', anything: true },
      });

      // 빈 화이트리스트 → 모든 키 verbatim 보존.
      const appendArg = appendSpy.mock.calls[0]?.[1] as {
        interaction?: { data?: Record<string, unknown> };
      };
      expect(appendArg?.interaction?.data).toEqual({
        foo: 1,
        bar: 'two',
        anything: true,
      });
    });

    // (b) non-sentinel warn 폴백 — sentinel 없는 payload 는 warn 을 기록하고 payload 를
    //     그대로 rawData 로 취급 (interactionData 로 진행, 예외 없음).
    it('(b) non-sentinel payload — warn 기록 + 예외 없이 완료', async () => {
      const nodeId = 'node-form-b';
      const nodeExecRow: Partial<NodeExecution> = {
        id: 'ne-form-b',
        nodeId,
        executionId: execId,
        status: NodeExecutionStatus.WAITING_FOR_INPUT,
        startedAt: new Date(),
      };
      mockNodeExecutionRepository.findOne = jest
        .fn()
        .mockResolvedValue(nodeExecRow);

      const ctx = makeContext();
      const saved = makeExecution(ExecutionStatus.WAITING_FOR_INPUT);

      const logger = (service as unknown as { logger: { warn: jest.Mock } })
        .logger;
      const warnSpy = jest.spyOn(logger, 'warn');

      // No sentinel — raw object payload.
      await expect(
        service.processFormResumeTurn(
          saved,
          execId,
          makeFormNode(nodeId),
          ctx,
          {
            answer: 'raw-no-sentinel',
          },
        ),
      ).resolves.toBeUndefined();

      // warn 이 기록됐는지 확인.
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('sentinel 없는 폴백'),
      );
      warnSpy.mockRestore();
    });

    // (c-running) status === RUNNING — RUNNING→RUNNING assertTransition 회피.
    //   드라이브가 이미 RUNNING 전이했으면 nodeExec 만 save 하고 updateExecutionStatus 미호출.
    it('(c-running) savedExecution.status === RUNNING — nodeExec 만 save, updateExecutionStatus 미호출', async () => {
      const nodeId = 'node-form-c1';
      const nodeExecRow: Partial<NodeExecution> = {
        id: 'ne-form-c1',
        nodeId,
        executionId: execId,
        status: NodeExecutionStatus.WAITING_FOR_INPUT,
        startedAt: new Date(),
      };
      mockNodeExecutionRepository.findOne = jest
        .fn()
        .mockResolvedValue(nodeExecRow);

      const ctx = makeContext();
      const saved = makeExecution(ExecutionStatus.RUNNING);

      await service.processFormResumeTurn(
        saved,
        execId,
        makeFormNode(nodeId),
        ctx,
        {
          type: 'form_submitted',
          formData: { answer: 'x' },
        },
      );

      // status === RUNNING 이면 updateExecutionStatus 미호출 (RUNNING→RUNNING 회피).
      // (엔진 잔류 메서드 — driver 경유 호출.)
      expect(mockDriver.updateExecutionStatus).not.toHaveBeenCalled();
      // nodeExec 은 save 됨.
      expect(mockNodeExecutionRepository.save).toHaveBeenCalled();
    });

    // (c-not-running) status !== RUNNING — updateExecutionStatus(RUNNING, nodeExec) 호출.
    it('(c-not-running) savedExecution.status !== RUNNING — updateExecutionStatus 호출', async () => {
      const nodeId = 'node-form-c2';
      const nodeExecRow: Partial<NodeExecution> = {
        id: 'ne-form-c2',
        nodeId,
        executionId: execId,
        status: NodeExecutionStatus.WAITING_FOR_INPUT,
        startedAt: new Date(),
      };
      mockNodeExecutionRepository.findOne = jest
        .fn()
        .mockResolvedValue(nodeExecRow);

      const ctx = makeContext();
      const saved = makeExecution(ExecutionStatus.WAITING_FOR_INPUT);

      const statusCalls: unknown[] = [];
      mockDriver.updateExecutionStatus.mockImplementation(
        async (_exec: unknown, status: unknown) => {
          statusCalls.push(status);
          return true;
        },
      );

      await service.processFormResumeTurn(
        saved,
        execId,
        makeFormNode(nodeId),
        ctx,
        {
          type: 'form_submitted',
          formData: { answer: 'y' },
        },
      );

      // updateExecutionStatus(RUNNING) 이 호출됐어야 한다.
      expect(statusCalls).toContain(ExecutionStatus.RUNNING);
    });

    // (d) nodeExec null skip — findOne 이 null 이면 nodeExec 관련 save/emit 생략,
    //     예외 없이 완료.
    it('(d) nodeExec null — nodeExec save 스킵, 예외 없이 완료', async () => {
      const nodeId = 'node-form-d';
      // findOne returns null → nodeExec is null.
      mockNodeExecutionRepository.findOne = jest.fn().mockResolvedValue(null);

      const ctx = makeContext();
      const saved = makeExecution(ExecutionStatus.WAITING_FOR_INPUT);

      await expect(
        service.processFormResumeTurn(
          saved,
          execId,
          makeFormNode(nodeId),
          ctx,
          {
            type: 'form_submitted',
            formData: { answer: 'z' },
          },
        ),
      ).resolves.toBeUndefined();

      // nodeExec null → nodeExecutionRepo.save 미호출.
      expect(mockNodeExecutionRepository.save).not.toHaveBeenCalled();
      // updateExecutionStatus 는 호출됨 (status !== RUNNING).
      expect(mockDriver.updateExecutionStatus).toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // §5.5 — resume 시 meta.durationMs 갱신 (relocated from engine spec W13 block).
  // ──────────────────────────────────────────────────────────────────────────
  describe('processFormResumeTurn — §5.5 meta.durationMs', () => {
    it('§5.5 resume 시 meta.durationMs 를 nodeExec.startedAt 경과로 갱신', async () => {
      // 대기 진입 5초 전 startedAt — durationMs 가 0 이 아니라 ~5000 이어야 한다.
      const startedAt = new Date(Date.now() - 5000);
      mockNodeExecutionRepository.findOne.mockResolvedValueOnce({
        id: 'ne-dur',
        nodeId: 'f-dur',
        startedAt,
      });
      mockNodeExecutionRepository.save.mockResolvedValueOnce(undefined);
      const context = contextService.createContext('exec-dur', wfId);
      // waiting tick 에 저장된 meta.durationMs=0 을 시뮬레이션.
      (
        context as { structuredOutputCache: Record<string, unknown> }
      ).structuredOutputCache = {
        'f-dur': {
          config: {},
          output: {},
          status: 'waiting_for_input',
          meta: { durationMs: 0, interactionType: 'form' },
        },
      };
      const setSpy = jest.spyOn(contextService, 'setStructuredOutput');

      await service.processFormResumeTurn(
        {
          id: 'exec-dur',
          status: ExecutionStatus.RUNNING,
        } as unknown as Execution,
        'exec-dur',
        {
          id: 'f-dur',
          type: 'form',
          config: { fields: [{ name: 'name' }] },
        } as unknown as Node,
        context,
        { type: 'form_submitted', formData: { name: 'A' } },
      );

      const call = setSpy.mock.calls.find((c) => c[1] === 'f-dur');
      expect(call).toBeDefined();
      const out = call?.[2] as { meta?: { durationMs?: number } };
      expect(out.meta?.durationMs).toBeGreaterThanOrEqual(4000);
      // 기존 meta 필드는 보존.
      expect((out.meta as { interactionType?: string }).interactionType).toBe(
        'form',
      );
      // I11 — DB nodeExec.durationMs 도 동일하게 갱신됐는지.
      const savedNe = mockNodeExecutionRepository.save.mock.calls
        .map((c) => c[0] as { id?: string; durationMs?: number })
        .find((e) => e?.id === 'ne-dur');
      expect(savedNe?.durationMs).toBeGreaterThanOrEqual(4000);
    });

    // §5.5 엣지 케이스 헬퍼 — node/nodeExec/prevMeta 조합별 resumedMeta 검증.
    const runFormResume = async (opts: {
      nodeExec: Record<string, unknown> | null;
      prevMeta: Record<string, unknown> | undefined | 'absent';
      execId: string;
      nodeId: string;
    }) => {
      mockNodeExecutionRepository.findOne.mockResolvedValueOnce(opts.nodeExec);
      mockNodeExecutionRepository.save.mockResolvedValueOnce(undefined);
      const context = contextService.createContext(opts.execId, wfId);
      const cache: Record<string, unknown> = {};
      cache[opts.nodeId] = {
        config: {},
        output: {},
        status: 'waiting_for_input',
        ...(opts.prevMeta === 'absent' ? {} : { meta: opts.prevMeta }),
      };
      (
        context as { structuredOutputCache: Record<string, unknown> }
      ).structuredOutputCache = cache;
      const setSpy = jest.spyOn(contextService, 'setStructuredOutput');
      await service.processFormResumeTurn(
        {
          id: opts.execId,
          status: ExecutionStatus.RUNNING,
        } as unknown as Execution,
        opts.execId,
        {
          id: opts.nodeId,
          type: 'form',
          config: { fields: [{ name: 'x' }] },
        } as unknown as Node,
        context,
        { type: 'form_submitted', formData: { x: '1' } },
      );
      const call = setSpy.mock.calls.find((c) => c[1] === opts.nodeId);
      return call?.[2] as { meta?: Record<string, unknown> };
    };

    it('§5.5 nodeExec.startedAt 부재 → durationMs 미설정, 기존 meta 보존', async () => {
      const out = await runFormResume({
        nodeExec: { id: 'ne-ns', nodeId: 'f-ns' },
        prevMeta: { interactionType: 'form', custom: 1 },
        execId: 'exec-ns',
        nodeId: 'f-ns',
      });
      expect(out.meta?.durationMs).toBeUndefined();
      expect(out.meta?.interactionType).toBe('form');
      expect(out.meta?.custom).toBe(1);
    });

    it('§5.5 시계 역행(미래 startedAt) → durationMs 0 클램핑', async () => {
      const out = await runFormResume({
        nodeExec: {
          id: 'ne-fut',
          nodeId: 'f-fut',
          startedAt: new Date(Date.now() + 5000),
        },
        prevMeta: { interactionType: 'form' },
        execId: 'exec-fut',
        nodeId: 'f-fut',
      });
      expect(out.meta?.durationMs).toBe(0);
    });

    it('§5.5 prevMeta 부재(재수화) → form fallback interactionType + durationMs', async () => {
      const out = await runFormResume({
        nodeExec: {
          id: 'ne-rh',
          nodeId: 'f-rh',
          startedAt: new Date(Date.now() - 3000),
        },
        prevMeta: 'absent',
        execId: 'exec-rh',
        nodeId: 'f-rh',
      });
      // 재수화 경로에서도 interactionType 보존(W1) + durationMs 계산.
      expect(out.meta?.interactionType).toBe('form');
      expect(out.meta?.durationMs as number).toBeGreaterThanOrEqual(2000);
    });
  });
});
