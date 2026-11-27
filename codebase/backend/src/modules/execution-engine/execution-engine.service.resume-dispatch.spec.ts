import { ExecutionEngineService } from './execution-engine.service';
import { CALL_STACK_SCHEMA_VERSION } from '../../shared/execution-resume/resume-call-stack.types';
import { ParkReleaseSignal } from '../../shared/execution-resume/park-release-signal';
import { PARK_RELEASED } from '../../shared/execution-resume/process-turn-result';
import { NodeHandlerRegistry } from '../../nodes/core/node-handler.registry';
import { AiTurnOrchestrator } from './ai-turn-orchestrator.service';
import { FormInteractionService } from './form-interaction.service';
import { ButtonInteractionService } from './button-interaction.service';
import {
  Execution,
  ExecutionStatus,
} from '../executions/entities/execution.entity';
import {
  NodeExecution,
  NodeExecutionStatus,
} from '../node-executions/entities/node-execution.entity';
import { NodeCategory } from '../nodes/entities/node.entity';
import { ExecutionContext } from '../../nodes/core/node-handler.interface';
import {
  type EngineServiceHarness,
  createEngineServiceHarness,
  executionId,
  mockWorkflow,
  workflowId,
} from './__test-utils__/engine-service-harness';

/**
 * ExecutionEngineService 단위 테스트: 재개 dispatch registry · callStack 재개 · resumeFromCheckpoint.
 *
 * 옛 `execution-engine.service.spec.ts` 를 관심사별로 나눈 파일 가운데 하나다(CLE-T-YEDCJK).
 * 서비스 구성과 mock 레포지토리는 `__test-utils__/engine-service-harness.ts` 공용 하네스가 만든다.
 */
describe('ExecutionEngineService', () => {
  let h: EngineServiceHarness;
  let service: ExecutionEngineService;
  // C-1 step2 — AI 멀티턴 lifecycle 은 AiTurnOrchestrator 로 추출됨. 엔진의
  // dispatch/registry/retry 가 위임하므로, 추출된 메서드를 spy 하는 테스트는 본
  // 인스턴스를 대상으로 한다 (엔진 인스턴스가 아님).
  let aiTurnOrchestrator: AiTurnOrchestrator;
  // C-1 step3 — Form/Button blocking-interaction 은 FormInteractionService /
  // ButtonInteractionService 로 추출됨. 엔진의 dispatch/registry 가 위임하므로,
  // 위임된 메서드를 spy 하는 테스트는 이 인스턴스를 대상으로 한다 (엔진 인스턴스
  // 가 아님 — AiTurnOrchestrator 선례와 동일).
  let formInteraction: FormInteractionService;
  let buttonInteraction: ButtonInteractionService;
  let handlerRegistry: NodeHandlerRegistry;
  let mockWebsocketService: EngineServiceHarness['mockWebsocketService'];

  // Mock repositories
  let mockExecutionRepo: Record<string, jest.Mock>;
  let mockNodeExecutionRepo: Record<string, jest.Mock>;
  let mockNodeRepo: Record<string, jest.Mock>;
  let mockWorkflowRepo: Record<string, jest.Mock>;
  let mockExecutionNodeLogRepo: Record<string, jest.Mock>;
  // 테스트가 다시 대입하는 `dbExecutionStatus` · `waitingRawRows` ·
  // `waitingQueryError` 는 mock 클로저가 읽는 하네스 필드라 `h.` 로 대입한다.

  // 서비스 구성 · mock 레포지토리는 `__test-utils__/engine-service-harness.ts` 공용 하네스.
  beforeEach(async () => {
    h = await createEngineServiceHarness();
    ({
      service,
      aiTurnOrchestrator,
      formInteraction,
      buttonInteraction,
      handlerRegistry,
      mockWebsocketService,
      mockExecutionRepo,
      mockNodeExecutionRepo,
      mockNodeRepo,
      mockWorkflowRepo,
      mockExecutionNodeLogRepo,
    } = h);
  });

  // ──────────────────────────────────────────────────────────────────────
  // exec-park B-1 — resume dispatch registry (`dispatchResumeTurn`). top-level
  // (`driveResumeAwaited`)·중첩(`driveResumeFrame`) 양쪽이 공유하는 단일 진입점의
  // 선택 우선순위(form → buttons → ai)·미지원 throw·PARK_RELEASED 전파를 검증.
  // 처리기(processForm/Button/handleAiResumeTurn)는 spy 로 라우팅만 확인. spec §7.5.
  // ──────────────────────────────────────────────────────────────────────
  describe('dispatchResumeTurn — resume dispatch registry (exec-park B-1)', () => {
    // private 메서드를 직접 spy/호출하기 위한 테스트 전용 캐스팅 타입.
    // C-1 step3 — form/button resume turn 처리는 Form/ButtonInteractionService 로
    // 위임되므로 그 메서드는 본 (엔진) 캐스팅 타입에서 제거됐다. 라우팅 검증은 위임
    // 대상 인스턴스(formInteraction / buttonInteraction)를 직접 spy 한다
    // (AiTurnOrchestrator 선례와 동일).
    type DispatchSubject = {
      dispatchResumeTurn: (ctx: Record<string, unknown>) => Promise<unknown>;
      handleAiResumeTurn: (ctx: Record<string, unknown>) => Promise<unknown>;
      processAiResumeTurn: (...a: unknown[]) => Promise<unknown>;
      buildRetryReentryState: (...a: unknown[]) => { resumeState: unknown };
      contextKeyOf: (...a: unknown[]) => string;
      _resumeTurnRegistry?: unknown;
    };

    const makeCtx = (overrides: Record<string, unknown>) => ({
      savedExecution: { id: 'exec-1' },
      executionId: 'exec-1',
      node: { id: 'n1', type: 'form' },
      context: { variables: {} },
      nodeExec: null,
      persistedInteractionType: undefined,
      isAiConversation: false,
      resumeCheckpoint: undefined,
      cachedOutput: undefined,
      payload: { type: 'form_submitted', formData: {} },
      ...overrides,
    });

    afterEach(() => {
      jest.restoreAllMocks();
      // lazy registry 캐시 리셋 — restoreAllMocks 는 spy 만 복원하므로 명시 초기화
      // (ai-review W4 — 향후 registry 순서/항목 테스트 간 상태 누수 방지).
      (service as unknown as DispatchSubject)._resumeTurnRegistry = undefined;
    });

    it('form interaction → processFormResumeTurn 라우팅 (void → 순회 계속)', async () => {
      const svc = service as unknown as DispatchSubject;
      jest
        .spyOn(handlerRegistry, 'getMetadata')
        .mockReturnValue({ kind: 'blocking', interaction: 'form' } as never);
      const formSpy = jest
        .spyOn(formInteraction, 'processFormResumeTurn')
        .mockResolvedValue(undefined);
      const buttonSpy = jest
        .spyOn(buttonInteraction, 'processButtonResumeTurn')
        .mockResolvedValue(undefined);

      const out = await svc.dispatchResumeTurn(
        makeCtx({ node: { id: 'f1', type: 'form' } }),
      );

      expect(out).toBeUndefined();
      expect(formSpy).toHaveBeenCalledTimes(1);
      expect(buttonSpy).not.toHaveBeenCalled();
    });

    it('persistedInteractionType=buttons → processButtonResumeTurn 라우팅', async () => {
      const svc = service as unknown as DispatchSubject;
      jest
        .spyOn(handlerRegistry, 'getMetadata')
        .mockReturnValue({ kind: 'blocking', interaction: 'buttons' } as never);
      const formSpy = jest
        .spyOn(formInteraction, 'processFormResumeTurn')
        .mockResolvedValue(undefined);
      const buttonSpy = jest
        .spyOn(buttonInteraction, 'processButtonResumeTurn')
        .mockResolvedValue(undefined);

      const out = await svc.dispatchResumeTurn(
        makeCtx({
          node: { id: 'b1', type: 'carousel' },
          persistedInteractionType: 'buttons',
        }),
      );

      expect(out).toBeUndefined();
      expect(buttonSpy).toHaveBeenCalledTimes(1);
      expect(formSpy).not.toHaveBeenCalled();
    });

    it('ai_conversation + checkpoint + eligible node → handleAiResumeTurn 라우팅', async () => {
      const svc = service as unknown as DispatchSubject;
      jest
        .spyOn(handlerRegistry, 'getMetadata')
        .mockReturnValue({ kind: 'standard' } as never);
      // C-1 step2 — registry 의 ai_conversation 항목은 orchestrator 로 위임.
      const aiSpy = jest
        .spyOn(aiTurnOrchestrator, 'handleAiResumeTurn')
        .mockResolvedValue(undefined);

      const out = await svc.dispatchResumeTurn(
        makeCtx({
          node: { id: 'ai1', type: 'ai_agent' },
          persistedInteractionType: 'ai_conversation',
          isAiConversation: true,
          resumeCheckpoint: { schemaVersion: 1 },
        }),
      );

      expect(out).toBeUndefined();
      expect(aiSpy).toHaveBeenCalledTimes(1);
    });

    it('ai handler 가 PARK_RELEASED 반환 → dispatch 가 그대로 전파 (re-park)', async () => {
      const svc = service as unknown as DispatchSubject;
      jest
        .spyOn(handlerRegistry, 'getMetadata')
        .mockReturnValue({ kind: 'standard' } as never);
      // C-1 step2 — registry 의 ai_conversation 항목은 orchestrator 로 위임.
      jest
        .spyOn(aiTurnOrchestrator, 'handleAiResumeTurn')
        .mockResolvedValue(PARK_RELEASED);

      const out = await svc.dispatchResumeTurn(
        makeCtx({
          node: { id: 'ai1', type: 'information_extractor' },
          persistedInteractionType: 'ai_conversation',
          isAiConversation: true,
          resumeCheckpoint: { schemaVersion: 1 },
        }),
      );

      expect(out).toBe(PARK_RELEASED);
    });

    it('form 이 buttons 보다 우선 (interaction=form & persistedInteractionType=buttons → form)', async () => {
      const svc = service as unknown as DispatchSubject;
      jest
        .spyOn(handlerRegistry, 'getMetadata')
        .mockReturnValue({ kind: 'blocking', interaction: 'form' } as never);
      const formSpy = jest
        .spyOn(formInteraction, 'processFormResumeTurn')
        .mockResolvedValue(undefined);
      const buttonSpy = jest
        .spyOn(buttonInteraction, 'processButtonResumeTurn')
        .mockResolvedValue(undefined);

      await svc.dispatchResumeTurn(
        makeCtx({
          node: { id: 'f1', type: 'form' },
          persistedInteractionType: 'buttons',
        }),
      );

      expect(formSpy).toHaveBeenCalledTimes(1);
      expect(buttonSpy).not.toHaveBeenCalled();
    });

    it('매칭 처리기 없음 → RehydrationError(RESUME_CHECKPOINT_MISSING)', async () => {
      const svc = service as unknown as DispatchSubject;
      jest
        .spyOn(handlerRegistry, 'getMetadata')
        .mockReturnValue({ kind: 'standard' } as never);

      await expect(
        svc.dispatchResumeTurn(
          makeCtx({
            node: { id: 'w1', type: 'webhook' },
            persistedInteractionType: 'unknown_kind',
            isAiConversation: false,
          }),
        ),
      ).rejects.toMatchObject({ code: 'RESUME_CHECKPOINT_MISSING' });
    });

    it('ai 인데 checkpoint 부재 → 매칭 없음(RESUME_CHECKPOINT_MISSING) — registry hasResumeCheckpoint 게이팅', async () => {
      // 프로덕션 경로에선 resumeFromCheckpoint 가 진입 전에 RESUME_INCOMPATIBLE_STATE
      // 로 미리 거르지만, dispatch 단독으로는 ai selector 가 hasResumeCheckpoint 를
      // 요구하므로 매칭이 없어 RESUME_CHECKPOINT_MISSING (동작 보존: 추출 전 else throw).
      const svc = service as unknown as DispatchSubject;
      jest
        .spyOn(handlerRegistry, 'getMetadata')
        .mockReturnValue({ kind: 'standard' } as never);

      await expect(
        svc.dispatchResumeTurn(
          makeCtx({
            node: { id: 'ai1', type: 'ai_agent' },
            persistedInteractionType: 'ai_conversation',
            isAiConversation: true,
            resumeCheckpoint: undefined,
          }),
        ),
      ).rejects.toMatchObject({ code: 'RESUME_CHECKPOINT_MISSING' });
    });

    // handleAiResumeTurn 내부 로직(ai-review W3) — dispatch 라우팅 테스트는 이 메서드를
    // spy 대체하므로, 재구성 실패→throw / 정상 경로→seed+processAiResumeTurn 은 여기서 직접 검증.
    it('handleAiResumeTurn: buildRetryReentryState 실패 → RESUME_INCOMPATIBLE_STATE 전파', async () => {
      // C-1 step2 — handleAiResumeTurn 은 orchestrator 로 이동. buildRetryReentryState
      // 는 EngineDriver(=엔진 인스턴스) 경유 호출이므로 service 에 spy 한다.
      const svc = service as unknown as DispatchSubject;
      jest.spyOn(svc, 'buildRetryReentryState').mockImplementation(() => {
        throw new Error('checkpoint corrupt');
      });

      await expect(
        aiTurnOrchestrator.handleAiResumeTurn(
          makeCtx({
            node: { id: 'ai1', type: 'ai_agent' },
            isAiConversation: true,
            resumeCheckpoint: { schemaVersion: 1 },
          }) as never,
        ),
      ).rejects.toMatchObject({ code: 'RESUME_INCOMPATIBLE_STATE' });
    });

    it('handleAiResumeTurn: 정상 → _resumeState seed(seedNodeOutput) + processAiResumeTurn 결과 전달', async () => {
      // C-1 step2 — handleAiResumeTurn / processAiResumeTurn 은 orchestrator 로
      // 이동. buildRetryReentryState / contextKeyOf 는 driver(=엔진) 경유 호출.
      const svc = service as unknown as DispatchSubject;
      const resumeState = { messages: [], turnCount: 2 };
      jest
        .spyOn(svc, 'buildRetryReentryState')
        .mockReturnValue({ resumeState });
      jest.spyOn(svc, 'contextKeyOf').mockReturnValue('ctx-key');
      const setOutputSpy = jest
        .spyOn(
          (
            aiTurnOrchestrator as unknown as {
              contextService: { seedNodeOutput: unknown };
            }
          ).contextService as { seedNodeOutput: (...a: unknown[]) => void },
          'seedNodeOutput',
        )
        .mockImplementation(() => undefined);
      const aiSpy = jest
        .spyOn(aiTurnOrchestrator, 'processAiResumeTurn')
        .mockResolvedValue(PARK_RELEASED);

      const out = await aiTurnOrchestrator.handleAiResumeTurn(
        makeCtx({
          node: { id: 'ai1', type: 'ai_agent' },
          isAiConversation: true,
          resumeCheckpoint: { schemaVersion: 1 },
          cachedOutput: { foo: 'bar' },
        }) as never,
      );

      expect(out).toBe(PARK_RELEASED);
      expect(setOutputSpy).toHaveBeenCalledTimes(1);
      // seed 는 cachedOutput 병합 + _resumeState 주입.
      const seedArg = setOutputSpy.mock.calls[0][2] as Record<string, unknown>;
      expect(seedArg).toMatchObject({ foo: 'bar', _resumeState: resumeState });
      expect(aiSpy).toHaveBeenCalledTimes(1);
    });

    // #501 회귀 가드 — handleAiResumeTurn 은 대기 NodeExecution row id 를
    // buildRetryReentryState 에 nodeExecutionId 로 넘겨야 resume 턴 통합 usage-log
    // attribution(cafe24/makeshop/mcp)이 복원된다.
    it('handleAiResumeTurn: 대기 NodeExecution id 를 buildRetryReentryState 에 nodeExecutionId 로 전달 (#501)', async () => {
      const svc = service as unknown as DispatchSubject;
      const buildSpy = jest
        .spyOn(svc, 'buildRetryReentryState')
        .mockReturnValue({ resumeState: { messages: [] } });
      jest.spyOn(svc, 'contextKeyOf').mockReturnValue('ctx-key');
      jest
        .spyOn(
          (
            aiTurnOrchestrator as unknown as {
              contextService: { seedNodeOutput: unknown };
            }
          ).contextService as { seedNodeOutput: (...a: unknown[]) => void },
          'seedNodeOutput',
        )
        .mockImplementation(() => undefined);
      jest
        .spyOn(aiTurnOrchestrator, 'processAiResumeTurn')
        .mockResolvedValue(PARK_RELEASED);

      await aiTurnOrchestrator.handleAiResumeTurn(
        makeCtx({
          node: { id: 'ai1', type: 'ai_agent' },
          isAiConversation: true,
          resumeCheckpoint: { schemaVersion: 1 },
          nodeExec: { id: 'ne-resume-1' },
        }) as never,
      );

      expect(buildSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ nodeExecutionId: 'ne-resume-1' }),
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // CRITICAL #1 (ai-review) — driveCallStackResume / driveResumeFrame /
  // injectInvokerOutput 단위 테스트. `as unknown as {...}` 패턴으로 private
  // 접근. 5개 케이스 커버 (단일 depth AI COMPLETED; 2-depth bubble-up + invoker
  // output 주입; 최내/외곽 frame parked → 반환; RehydrationError → markCancelled;
  // ParkReleaseSignal catch 흡수). exec-park D6, spec §7.5.
  // ──────────────────────────────────────────────────────────────────────
  describe('driveCallStackResume / driveResumeFrame / injectInvokerOutput (CRITICAL #1)', () => {
    // 공통 타입 — private API 를 노출해 직접 호출.
    type DriveSubject = {
      driveCallStackResume: (
        savedExecution: unknown,
        context: unknown,
        opts: {
          node: unknown;
          nodeExec: unknown;
          callStack: { version: number; frames: unknown[] };
          persistedInteractionType: string | undefined;
          isAiConversation: boolean;
          resumeCheckpoint: Record<string, unknown> | undefined;
          cachedOutput: Record<string, unknown> | undefined;
          payload: unknown;
        },
      ) => Promise<void>;
      driveResumeFrame: (
        savedExecution: unknown,
        context: unknown,
        opts: Record<string, unknown>,
      ) => Promise<{ parked: boolean; output: unknown }>;
      injectInvokerOutput: (
        context: unknown,
        invokerNode: unknown,
        subOutput: unknown,
      ) => void;
      markExecutionCancelled: (
        executionId: string,
        code: string,
      ) => Promise<void>;
      finalizeRehydrationCleanup: (executionId: string) => void;
      updateExecutionStatus: (
        execution: unknown,
        status: unknown,
      ) => Promise<void>;
      executionRepository: { save: jest.Mock };
      contextService: {
        setStructuredOutput: (
          key: string,
          nodeId: string,
          value: unknown,
        ) => void;
        seedNodeOutput: (key: string, nodeId: string, value: unknown) => void;
        createContext: (
          executionId: string,
          workflowId: string,
        ) => ExecutionContext;
      };
    };

    const driveSubject = () => service as unknown as DriveSubject;

    let mockSavedExecution: Partial<Execution>;
    let mockContext: ExecutionContext;
    let mockNodeExec: Partial<NodeExecution>;
    let buildChain: () => {
      update: jest.Mock;
      set: jest.Mock;
      where: jest.Mock;
      andWhere: jest.Mock;
      execute: jest.Mock;
    };

    beforeEach(() => {
      mockSavedExecution = {
        id: 'exec-drive-1',
        workflowId: 'wf-top-1',
        status: ExecutionStatus.WAITING_FOR_INPUT,
        startedAt: new Date(),
        recursionDepth: 0,
        inputData: {},
      };
      const contextService = (
        service as unknown as {
          contextService: {
            createContext: (...a: unknown[]) => ExecutionContext;
          };
        }
      ).contextService;
      mockContext = contextService.createContext('exec-drive-1', 'wf-top-1');
      mockContext.variables = {
        ...(mockContext.variables ?? {}),
        __workspaceId: 'ws-1',
      };

      mockNodeExec = {
        id: 'ne-drive-1',
        nodeId: 'node-form-1',
        executionId: 'exec-drive-1',
        status: NodeExecutionStatus.WAITING_FOR_INPUT,
        parentNodeExecutionId: undefined,
      };

      buildChain = () => {
        const chain = {
          update: jest.fn(),
          set: jest.fn(),
          setParameter: jest.fn(),
          where: jest.fn(),
          andWhere: jest.fn(),
          returning: jest.fn(),
          execute: jest
            .fn()
            .mockResolvedValue({ affected: 1, raw: [{ duration_ms: 1234 }] }),
        };
        chain.update.mockReturnValue(chain);
        chain.set.mockReturnValue(chain);
        chain.setParameter.mockReturnValue(chain);
        chain.where.mockReturnValue(chain);
        chain.andWhere.mockReturnValue(chain);
        chain.returning.mockReturnValue(chain);
        return chain;
      };

      mockExecutionRepo.createQueryBuilder = jest
        .fn()
        .mockImplementation(buildChain);
      mockNodeExecutionRepo.createQueryBuilder = jest
        .fn()
        .mockImplementation(buildChain);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    // ── CASE 1: 단일 depth AI COMPLETED ──────────────────────────────
    // 1-frame: innermost(#1) + top-level forward(#2). bubble-up 루프 미실행.
    it('Case1: driveResumeFrame 이 {parked:false} 반환 시 COMPLETED 마감 (단일 frame)', async () => {
      const svcAny = service as unknown as {
        driveCallStackResume: DriveSubject['driveCallStackResume'];
        driveResumeFrame: (
          ...args: unknown[]
        ) => Promise<{ parked: boolean; output: unknown }>;
        injectInvokerOutput: (...args: unknown[]) => void;
        updateExecutionStatus: (...args: unknown[]) => Promise<void>;
        finalizeRehydrationCleanup: (id: string) => void;
      };

      // updateExecutionStatus spy — RUNNING 및 COMPLETED 전이 추적.
      const statusUpdates: unknown[] = [];
      const origUpdate = svcAny.updateExecutionStatus.bind(service);
      jest
        .spyOn(svcAny, 'updateExecutionStatus')
        .mockImplementation(async (exec, status) => {
          statusUpdates.push(status);
          return origUpdate(exec, status);
        });

      // driveResumeFrame spy — 두 번 호출 모두 not-parked 반환 (innermost + top).
      jest
        .spyOn(svcAny, 'driveResumeFrame')
        .mockResolvedValue({ parked: false, output: { done: true } });

      // injectInvokerOutput spy (top-level invoker 주입 경로).
      jest
        .spyOn(svcAny, 'injectInvokerOutput')
        .mockImplementation(() => undefined);

      // cleanup spy.
      jest
        .spyOn(svcAny, 'finalizeRehydrationCleanup')
        .mockImplementation(() => undefined);

      // top-level invoker node lookup (frames[0].invokerNodeId).
      mockNodeRepo.findOneBy = jest
        .fn()
        .mockResolvedValue({ id: 'node-invoker-1', type: 'workflow_node' });

      const callStack = {
        version: CALL_STACK_SCHEMA_VERSION,
        frames: [
          {
            workflowId: 'wf-sub-1',
            invokerNodeId: 'node-invoker-1',
            recursionDepth: 1,
          },
        ],
      };

      await driveSubject().driveCallStackResume(
        mockSavedExecution,
        mockContext,
        {
          node: { id: 'node-form-1', type: 'form_node' } as unknown,
          nodeExec: mockNodeExec,
          callStack,
          persistedInteractionType: 'ai_conversation',
          isAiConversation: true,
          resumeCheckpoint: {},
          cachedOutput: undefined,
          payload: { type: 'ai_message', message: 'hi' },
        },
      );

      // RUNNING → COMPLETED 전이 확인.
      expect(statusUpdates).toContain(ExecutionStatus.RUNNING);
      expect(statusUpdates).toContain(ExecutionStatus.COMPLETED);
      // driveResumeFrame: innermost(1) + top-level forward(1) = 2 회.
      expect(svcAny.driveResumeFrame).toHaveBeenCalledTimes(2);
      // cleanup 호출 확인.
      expect(svcAny.finalizeRehydrationCleanup).toHaveBeenCalledWith(
        'exec-drive-1',
      );
      // 이 경로의 `durationMs` emit 이 두 라운드째 미검증이었다 (`10_52_08` testing W1).
      // 계산부·emit 부 모두 헬퍼 경유로 맞춰 뒀으나 그걸 고정하는 단언이 없었다.
      const completedEmit = (
        mockWebsocketService.emitExecutionEvent as jest.Mock
      ).mock.calls.find((c: unknown[]) => c[1] === 'execution.completed');
      expect(completedEmit).toBeDefined();
      expect(
        (completedEmit?.[2] as { durationMs?: number | null } | undefined)
          ?.durationMs,
      ).toEqual(expect.any(Number));
    });

    // ── CASE 2: 2-depth bubble-up + invoker output 주입 ──────────────
    it('Case2: 2-depth — innermost 완료 후 bubble-up 외곽 frame 구동, invoker output 주입', async () => {
      const svcAny = service as unknown as {
        driveResumeFrame: (
          ...args: unknown[]
        ) => Promise<{ parked: boolean; output: unknown }>;
        injectInvokerOutput: (...args: unknown[]) => void;
        finalizeRehydrationCleanup: (id: string) => void;
      };

      const frameResults = [
        { parked: false, output: { inner: 'done' } }, // innermost: 완료
        { parked: false, output: { outer: 'done' } }, // bubble-up frame (0)
        { parked: false, output: { top: 'done' } }, // top-level forward
      ];
      let frameCallCount = 0;
      jest.spyOn(svcAny, 'driveResumeFrame').mockImplementation(async () => {
        return (
          frameResults[frameCallCount++] ?? { parked: false, output: undefined }
        );
      });

      const injectCalls: unknown[][] = [];
      jest
        .spyOn(svcAny, 'injectInvokerOutput')
        .mockImplementation((...args: unknown[]) => {
          injectCalls.push(args);
        });

      jest
        .spyOn(svcAny, 'finalizeRehydrationCleanup')
        .mockImplementation(() => undefined);

      // invokerNode lookup: frames[1].invokerNodeId → node-invoker-B,
      //                     frames[0].invokerNodeId → node-invoker-A (top-level)
      const invokerNodeB = { id: 'node-invoker-B', type: 'workflow_node' };
      const invokerNodeA = { id: 'node-invoker-A', type: 'workflow_node' };
      let invokeLookupCount = 0;
      mockNodeRepo.findOneBy = jest.fn().mockImplementation(() => {
        return Promise.resolve(
          invokeLookupCount++ === 0 ? invokerNodeB : invokerNodeA,
        );
      });

      const callStack = {
        version: CALL_STACK_SCHEMA_VERSION,
        frames: [
          {
            workflowId: 'wf-sub-A',
            invokerNodeId: 'node-invoker-A',
            recursionDepth: 1,
          },
          {
            workflowId: 'wf-sub-B',
            invokerNodeId: 'node-invoker-B',
            recursionDepth: 2,
          },
        ],
      };

      await driveSubject().driveCallStackResume(
        mockSavedExecution,
        mockContext,
        {
          node: { id: 'node-form-2', type: 'form_node' } as unknown,
          nodeExec: mockNodeExec,
          callStack,
          persistedInteractionType: 'form',
          isAiConversation: false,
          resumeCheckpoint: undefined,
          cachedOutput: undefined,
          payload: { data: 'submitted' },
        },
      );

      // driveResumeFrame: innermost(1) + bubble-up(1) + top(1) = 3 회
      expect(svcAny.driveResumeFrame).toHaveBeenCalledTimes(3);
      // injectInvokerOutput: bubble-up 마다 1회 + top-level 1회 = 2 회
      expect(injectCalls).toHaveLength(2);
      // 첫 주입: invokerNodeB 노드 + inner output
      expect(injectCalls[0][1]).toMatchObject({ id: 'node-invoker-B' });
      expect(injectCalls[0][2]).toEqual({ inner: 'done' });
      // 두 번째 주입: invokerNodeA 노드 + outer output
      expect(injectCalls[1][1]).toMatchObject({ id: 'node-invoker-A' });
      expect(injectCalls[1][2]).toEqual({ outer: 'done' });
    });

    // ── CASE 3a: 최내 frame 이 parked → 즉시 return ─────────────────
    it('Case3a: 최내 frame parked — return 으로 bubble-up 생략', async () => {
      const svcAny = service as unknown as {
        driveResumeFrame: (
          ...args: unknown[]
        ) => Promise<{ parked: boolean; output: unknown }>;
        finalizeRehydrationCleanup: (id: string) => void;
        updateExecutionStatus: (...args: unknown[]) => Promise<void>;
      };

      jest
        .spyOn(svcAny, 'driveResumeFrame')
        .mockResolvedValue({ parked: true, output: undefined });
      jest
        .spyOn(svcAny, 'finalizeRehydrationCleanup')
        .mockImplementation(() => undefined);
      const statusUpdates: unknown[] = [];
      const origUpdate = svcAny.updateExecutionStatus.bind(service);
      jest
        .spyOn(svcAny, 'updateExecutionStatus')
        .mockImplementation(async (exec, status) => {
          statusUpdates.push(status);
          return origUpdate(exec, status);
        });

      const callStack = {
        version: CALL_STACK_SCHEMA_VERSION,
        frames: [
          {
            workflowId: 'wf-sub-1',
            invokerNodeId: 'node-inv-1',
            recursionDepth: 1,
          },
        ],
      };

      await driveSubject().driveCallStackResume(
        mockSavedExecution,
        mockContext,
        {
          node: { id: 'node-form-3', type: 'form_node' } as unknown,
          nodeExec: mockNodeExec,
          callStack,
          persistedInteractionType: 'form',
          isAiConversation: false,
          resumeCheckpoint: undefined,
          cachedOutput: undefined,
          payload: {},
        },
      );

      // parked → RUNNING 으로만 전이, COMPLETED 없음.
      expect(statusUpdates).toContain(ExecutionStatus.RUNNING);
      expect(statusUpdates).not.toContain(ExecutionStatus.COMPLETED);
      // driveResumeFrame 1회 (innermost 만 호출, bubble-up 없음)
      expect(svcAny.driveResumeFrame).toHaveBeenCalledTimes(1);
    });

    // ── CASE 3b: 외곽 bubble-up frame parked → 즉시 return ──────────
    it('Case3b: bubble-up 중 외곽 frame parked — COMPLETED 없이 return', async () => {
      const svcAny = service as unknown as {
        driveResumeFrame: (
          ...args: unknown[]
        ) => Promise<{ parked: boolean; output: unknown }>;
        finalizeRehydrationCleanup: (id: string) => void;
        updateExecutionStatus: (...args: unknown[]) => Promise<void>;
        injectInvokerOutput: (...args: unknown[]) => void;
      };

      // innermost 완료, bubble-up frame parked
      const results = [
        { parked: false, output: { inner: 'ok' } },
        { parked: true, output: undefined },
      ];
      let callIdx = 0;
      jest
        .spyOn(svcAny, 'driveResumeFrame')
        .mockImplementation(
          async () =>
            results[callIdx++] ?? { parked: false, output: undefined },
        );
      jest
        .spyOn(svcAny, 'injectInvokerOutput')
        .mockImplementation(() => undefined);
      jest
        .spyOn(svcAny, 'finalizeRehydrationCleanup')
        .mockImplementation(() => undefined);
      const statusUpdates: unknown[] = [];
      const origUpdate = svcAny.updateExecutionStatus.bind(service);
      jest
        .spyOn(svcAny, 'updateExecutionStatus')
        .mockImplementation(async (exec, status) => {
          statusUpdates.push(status);
          return origUpdate(exec, status);
        });

      mockNodeRepo.findOneBy = jest
        .fn()
        .mockResolvedValue({ id: 'node-inv-outer', type: 'workflow_node' });

      const callStack = {
        version: CALL_STACK_SCHEMA_VERSION,
        frames: [
          {
            workflowId: 'wf-outer',
            invokerNodeId: 'node-inv-outer',
            recursionDepth: 1,
          },
          {
            workflowId: 'wf-inner',
            invokerNodeId: 'node-inv-inner',
            recursionDepth: 2,
          },
        ],
      };

      await driveSubject().driveCallStackResume(
        mockSavedExecution,
        mockContext,
        {
          node: { id: 'node-form-4', type: 'form_node' } as unknown,
          nodeExec: mockNodeExec,
          callStack,
          persistedInteractionType: 'form',
          isAiConversation: false,
          resumeCheckpoint: undefined,
          cachedOutput: undefined,
          payload: {},
        },
      );

      // driveResumeFrame: innermost(1) + bubble-up(1) = 2 회, top-level forward 미호출
      expect(svcAny.driveResumeFrame).toHaveBeenCalledTimes(2);
      expect(statusUpdates).not.toContain(ExecutionStatus.COMPLETED);
    });

    // ── CASE 4: RehydrationError → markExecutionCancelled ───────────
    it('Case4: 일반 Error 발생 시 finalizeResumedExecutionOutcome 경로 진입 (detach 에러 처리)', async () => {
      const svcAny = service as unknown as {
        driveResumeFrame: (
          ...args: unknown[]
        ) => Promise<{ parked: boolean; output: unknown }>;
        markExecutionCancelled: (id: string, code: string) => Promise<void>;
        finalizeRehydrationCleanup: (id: string) => void;
      };

      const cancelSpy = jest
        .spyOn(svcAny, 'markExecutionCancelled')
        .mockResolvedValue(undefined);
      jest
        .spyOn(svcAny, 'finalizeRehydrationCleanup')
        .mockImplementation(() => undefined);

      // 일반 Error(RehydrationError 아님) → finalizeResumedExecutionOutcome 경로.
      jest
        .spyOn(svcAny, 'driveResumeFrame')
        .mockRejectedValue(new Error('generic-engine-error'));

      const finalizeOutcomeSpy = jest.fn().mockResolvedValue(undefined);
      (
        service as unknown as { finalizeResumedExecutionOutcome: unknown }
      ).finalizeResumedExecutionOutcome = finalizeOutcomeSpy;

      const callStackForCase4 = {
        version: CALL_STACK_SCHEMA_VERSION,
        frames: [
          {
            workflowId: 'wf-err2',
            invokerNodeId: 'node-inv-err2',
            recursionDepth: 1,
          },
        ],
      };

      await driveSubject().driveCallStackResume(
        mockSavedExecution,
        mockContext,
        {
          node: { id: 'node-form-err', type: 'form_node' } as unknown,
          nodeExec: mockNodeExec,
          callStack: callStackForCase4,
          persistedInteractionType: 'form',
          isAiConversation: false,
          resumeCheckpoint: undefined,
          cachedOutput: undefined,
          payload: {},
        },
      );

      // 일반 Error → finalizeResumedExecutionOutcome 호출.
      expect(finalizeOutcomeSpy).toHaveBeenCalled();
      // markExecutionCancelled 는 일반 Error 경로에서는 미호출.
      expect(cancelSpy).not.toHaveBeenCalled();
    });

    // ── CASE 4b: frame 필드 결손 → RESUME_CHECKPOINT_MISSING ─────────────
    // 영속된 frame 의 workflowId · invokerNodeId 가 비면 조회가 일반 TypeORMError 로 끝나 일반
    // 실패 경로(finalizeResumedExecutionOutcome, 실행 failed)를 탔다. 체크포인트 결손이므로 조회 전에
    // RehydrationError 로 분류한다(CLE-T-BV4YXZ). 필드별 판정은 call-stack-frame.spec.ts 가 고정한다.
    it.each([
      [
        'innermost frame 의 invokerNodeId 없음',
        [
          {
            workflowId: 'wf-top-1',
            invokerNodeId: 'node-inv-a',
            recursionDepth: 1,
          },
          { workflowId: 'wf-sub-1', recursionDepth: 2 },
        ],
      ],
      [
        'top-level frame 의 invokerNodeId 빈 문자열',
        [{ workflowId: 'wf-top-1', invokerNodeId: '', recursionDepth: 1 }],
      ],
      ['workflowId 없음', [{ invokerNodeId: 'node-inv-a', recursionDepth: 1 }]],
      ['frame 이 객체가 아님', [null]],
      [
        'workflowId 빈 문자열',
        [{ workflowId: '', invokerNodeId: 'node-inv-a', recursionDepth: 1 }],
      ],
      [
        'invokerNodeId 가 문자열이 아님',
        [{ workflowId: 'wf-top-1', invokerNodeId: 123, recursionDepth: 1 }],
      ],
    ])(
      'Case4b: %s → 조회 없이 RESUME_CHECKPOINT_MISSING 으로 취소',
      async (_label, frames) => {
        const svcAny = service as unknown as {
          driveResumeFrame: (
            ...args: unknown[]
          ) => Promise<{ parked: boolean; output: unknown }>;
          markExecutionCancelled: (id: string, code: string) => Promise<void>;
          markNodeExecutionFailed: (id: string, code: string) => Promise<void>;
          finalizeRehydrationCleanup: (id: string) => void;
          updateExecutionStatus: (...a: unknown[]) => Promise<void>;
        };
        const cancelSpy = jest
          .spyOn(svcAny, 'markExecutionCancelled')
          .mockResolvedValue(undefined);
        const nodeFailedSpy = jest
          .spyOn(svcAny, 'markNodeExecutionFailed')
          .mockResolvedValue(undefined);
        jest
          .spyOn(svcAny, 'finalizeRehydrationCleanup')
          .mockImplementation(() => undefined);
        const finalizeOutcomeSpy = jest.fn().mockResolvedValue(undefined);
        (
          service as unknown as { finalizeResumedExecutionOutcome: unknown }
        ).finalizeResumedExecutionOutcome = finalizeOutcomeSpy;
        const statusSpy = jest
          .spyOn(svcAny, 'updateExecutionStatus')
          .mockResolvedValue(undefined);
        const driveSpy = jest.spyOn(svcAny, 'driveResumeFrame');
        mockNodeRepo.findOneBy.mockClear();

        await driveSubject().driveCallStackResume(
          mockSavedExecution,
          mockContext,
          {
            node: { id: 'node-form-1', type: 'form_node' } as unknown,
            nodeExec: mockNodeExec,
            callStack: { version: CALL_STACK_SCHEMA_VERSION, frames },
            persistedInteractionType: 'form',
            isAiConversation: false,
            resumeCheckpoint: undefined,
            cachedOutput: undefined,
            payload: {},
          },
        );

        expect(cancelSpy).toHaveBeenCalledWith(
          'exec-drive-1',
          'RESUME_CHECKPOINT_MISSING',
        );
        // 짝 노드 실행도 같은 코드로 failed 마감하고 일반 실패 경로는 타지 않는다.
        expect(nodeFailedSpy).toHaveBeenCalledWith(
          'ne-drive-1',
          'RESUME_CHECKPOINT_MISSING',
        );
        expect(finalizeOutcomeSpy).not.toHaveBeenCalled();
        expect(driveSpy).not.toHaveBeenCalled();
        expect(mockNodeRepo.findOneBy).not.toHaveBeenCalled();
        // 상태 전이(WAITING → RUNNING) 전에 멈춘다.
        expect(statusSpy).not.toHaveBeenCalled();
      },
    );

    // ── CASE 5: ParkReleaseSignal catch 흡수 ──────────────────────────
    it('Case5: ParkReleaseSignal 이 catch 에 도달하면 흡수(return) — 전파 없음', async () => {
      const svcAny = service as unknown as {
        driveResumeFrame: (
          ...args: unknown[]
        ) => Promise<{ parked: boolean; output: unknown }>;
        finalizeRehydrationCleanup: (id: string) => void;
      };

      // driveResumeFrame 이 ParkReleaseSignal 을 throw (방어적 경로).
      jest
        .spyOn(svcAny, 'driveResumeFrame')
        .mockRejectedValue(new ParkReleaseSignal());
      jest
        .spyOn(svcAny, 'finalizeRehydrationCleanup')
        .mockImplementation(() => undefined);

      const callStack = {
        version: CALL_STACK_SCHEMA_VERSION,
        frames: [
          {
            workflowId: 'wf-park',
            invokerNodeId: 'node-inv-park',
            recursionDepth: 1,
          },
        ],
      };

      // driveCallStackResume 는 throw 하지 않아야 한다 (catch 흡수).
      await expect(
        driveSubject().driveCallStackResume(mockSavedExecution, mockContext, {
          node: { id: 'node-form-park', type: 'form_node' } as unknown,
          nodeExec: mockNodeExec,
          callStack,
          persistedInteractionType: 'form',
          isAiConversation: false,
          resumeCheckpoint: undefined,
          cachedOutput: undefined,
          payload: {},
        }),
      ).resolves.toBeUndefined();
    });

    // ── CASE W6: frames.length === 0 방어 가드 ───────────────────────
    it('W6: frames 가 빈 배열이면 RehydrationError 대신 markCancelled 경로 진입', async () => {
      const svcAny = service as unknown as {
        finalizeRehydrationCleanup: (id: string) => void;
        markExecutionCancelled: (id: string, code: string) => Promise<void>;
      };
      jest
        .spyOn(svcAny, 'finalizeRehydrationCleanup')
        .mockImplementation(() => undefined);
      const cancelSpy = jest
        .spyOn(svcAny, 'markExecutionCancelled')
        .mockResolvedValue(undefined);

      const emptyCallStack = { version: CALL_STACK_SCHEMA_VERSION, frames: [] };

      await driveSubject().driveCallStackResume(
        mockSavedExecution,
        mockContext,
        {
          node: { id: 'node-x', type: 'form_node' } as unknown,
          nodeExec: mockNodeExec,
          callStack: emptyCallStack,
          persistedInteractionType: 'form',
          isAiConversation: false,
          resumeCheckpoint: undefined,
          cachedOutput: undefined,
          payload: {},
        },
      );

      // frames.length === 0 → RehydrationError('RESUME_CHECKPOINT_MISSING') → markExecutionCancelled
      expect(cancelSpy).toHaveBeenCalledWith(
        'exec-drive-1',
        'RESUME_CHECKPOINT_MISSING',
      );
    });

    // ── injectInvokerOutput: output 주입 형태 검증 ───────────────────
    it('injectInvokerOutput: setNodeOutputs 한 번으로 두 캐시에 output.result wrapping 을 쓴다', () => {
      const outputsCalls: unknown[][] = [];
      (
        service as unknown as {
          contextService: { setNodeOutputs: jest.Mock };
        }
      ).contextService.setNodeOutputs = jest.fn((...args) =>
        outputsCalls.push(args),
      );

      const invokerNode = {
        id: 'inv-node',
        type: 'workflow',
        config: { workflowId: 'wf-sub' },
      };
      const subOutput = { answer: 42 };

      driveSubject().injectInvokerOutput(mockContext, invokerNode, subOutput);

      // 구조화 출력은 { config, output: { result: subOutput } } 형태이고 flat 값과 함께 쓴다.
      // flat 값으로 구조화 출력을 다시 만들지 않는다(NERV Task CLE-T-ZJR3AF).
      expect(outputsCalls).toHaveLength(1);
      expect(outputsCalls[0][2]).toMatchObject({
        config: invokerNode.config,
        output: { result: subOutput },
      });
      expect(outputsCalls[0][3]).toEqual({ result: subOutput });
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // CRITICAL #2 (ai-review) — resumeFromCheckpoint callStack non-null 분기
  // 통합 테스트: driveCallStackResume spyOn 검증 + version 가드.
  // exec-park D6, spec §7.5 Rehydration §7.5 step 2.
  // ──────────────────────────────────────────────────────────────────────
  describe('resumeFromCheckpoint — callStack non-null 분기 (CRITICAL #2)', () => {
    type ResumeFromCpSubject = {
      resumeFromCheckpoint: (
        savedExecution: unknown,
        context: unknown,
        opts: { node: unknown; nodeExec: unknown; payload: unknown },
      ) => Promise<void>;
      driveCallStackResume: (...args: unknown[]) => Promise<void>;
      rehydrateAndResume: (
        executionId: string,
        nodeExecutionId: string,
        payload: unknown,
      ) => Promise<void>;
    };
    const rfcSubject = () => service as unknown as ResumeFromCpSubject;

    const makeRehydrationSetup = (
      resumeCallStack: Record<string, unknown> | null,
      overrideNodeOutput?: Record<string, unknown>,
    ) => {
      mockExecutionRepo.findOneBy.mockReset();
      mockExecutionRepo.findOneBy.mockResolvedValue({
        id: executionId,
        workflowId,
        status: ExecutionStatus.WAITING_FOR_INPUT,
        startedAt: new Date(),
        resumeCallStack,
        inputData: {},
      });
      mockNodeExecutionRepo.findOneBy = jest.fn().mockResolvedValue({
        id: 'ne-cs-1',
        nodeId: 'node-1',
        status: NodeExecutionStatus.WAITING_FOR_INPUT,
        outputData: overrideNodeOutput ?? {
          interactionType: 'form',
          meta: { interactionType: 'form' },
          status: 'waiting_for_input',
        },
      });
      mockNodeRepo.findOneBy = jest.fn().mockResolvedValue({
        id: 'node-1',
        type: 'form_node',
        workflowId,
        category: NodeCategory.LOGIC,
        label: 'Form',
        config: {},
        isDisabled: false,
      });
      mockWorkflowRepo.findOne.mockResolvedValue({
        ...mockWorkflow,
        workspaceId: 'ws-1',
        workspace: { id: 'ws-1', name: 'WS', settings: {} },
      });
      mockExecutionNodeLogRepo.find.mockResolvedValue([]);
    };

    let buildChain: () => {
      update: jest.Mock;
      set: jest.Mock;
      where: jest.Mock;
      andWhere: jest.Mock;
      execute: jest.Mock;
    };

    beforeEach(() => {
      buildChain = () => {
        const chain = {
          update: jest.fn(),
          set: jest.fn(),
          setParameter: jest.fn(),
          where: jest.fn(),
          andWhere: jest.fn(),
          returning: jest.fn(),
          execute: jest
            .fn()
            .mockResolvedValue({ affected: 1, raw: [{ duration_ms: 1234 }] }),
        };
        chain.update.mockReturnValue(chain);
        chain.set.mockReturnValue(chain);
        chain.setParameter.mockReturnValue(chain);
        chain.where.mockReturnValue(chain);
        chain.andWhere.mockReturnValue(chain);
        chain.returning.mockReturnValue(chain);
        return chain;
      };
      mockExecutionRepo.createQueryBuilder = jest
        .fn()
        .mockImplementation(buildChain);
      mockNodeExecutionRepo.createQueryBuilder = jest
        .fn()
        .mockImplementation(buildChain);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    // C2-a: callStack non-null → driveCallStackResume 호출 검증
    it('C2-a: resumeCallStack 영속 시 driveCallStackResume 가 호출된다', async () => {
      const callStack = {
        version: CALL_STACK_SCHEMA_VERSION,
        frames: [
          {
            workflowId: 'wf-sub-cs',
            invokerNodeId: 'node-wf-cs',
            recursionDepth: 1,
          },
        ],
      };
      makeRehydrationSetup(callStack);

      const driveSpy = jest
        .spyOn(rfcSubject(), 'driveCallStackResume')
        .mockResolvedValue(undefined);

      await rfcSubject().rehydrateAndResume(executionId, 'ne-cs-1', {
        data: 'submitted',
      });

      // driveCallStackResume 가 호출됐다.
      expect(driveSpy).toHaveBeenCalledTimes(1);
      // callStack 이 그대로 전달됐다.
      const callArg = driveSpy.mock.calls[0][2] as { callStack: unknown };
      expect(callArg.callStack).toMatchObject({
        version: CALL_STACK_SCHEMA_VERSION,
        frames: [expect.objectContaining({ workflowId: 'wf-sub-cs' })],
      });
    });

    // C2-b: version > CALL_STACK_SCHEMA_VERSION → RESUME_INCOMPATIBLE_STATE
    it('C2-b: version > CALL_STACK_SCHEMA_VERSION → RESUME_INCOMPATIBLE_STATE 취소 마킹', async () => {
      const futureVersionCallStack = {
        version: 999,
        frames: [
          {
            workflowId: 'wf-sub-future',
            invokerNodeId: 'node-wf-future',
            recursionDepth: 1,
          },
        ],
      };
      makeRehydrationSetup(futureVersionCallStack);

      await rfcSubject().rehydrateAndResume(executionId, 'ne-cs-1', {
        data: 'submitted',
      });

      // RESUME_INCOMPATIBLE_STATE 로 마킹됐는지 확인 — createQueryBuilder().set 에 코드 포함.
      expect(mockExecutionRepo.createQueryBuilder).toHaveBeenCalled();
      const setArg = mockExecutionRepo.createQueryBuilder.mock.results[0]?.value
        ?.set?.mock?.calls?.[0]?.[0] as
        { error?: { code?: string } } | undefined;
      expect(setArg?.error?.code).toBe('RESUME_INCOMPATIBLE_STATE');
    });

    // C2-c: callStack === null → driveCallStackResume 미호출 (top-level resume 경로)
    it('C2-c: resumeCallStack=null 이면 driveCallStackResume 미호출 (top-level 경로)', async () => {
      makeRehydrationSetup(null);

      const driveSpy = jest
        .spyOn(rfcSubject(), 'driveCallStackResume')
        .mockResolvedValue(undefined);

      // top-level resume 경로: loadAndBuildGraph 를 spy 해 간단한 단일 노드 그래프로.
      const svcAny = service as unknown as {
        loadAndBuildGraph: (...args: unknown[]) => Promise<unknown>;
        driveResumeAwaited: (...args: unknown[]) => Promise<void>;
      };
      jest.spyOn(svcAny, 'loadAndBuildGraph').mockResolvedValue({
        graphNodes: [],
        graphEdges: [],
        forwardEdges: [],
        backEdges: [],
        sortedNodeIds: ['node-1'],
        sortedIndexMap: new Map([['node-1', 0]]),
        backEdgeMap: new Map(),
        outgoingEdgeMap: new Map(),
        incomingEdgeMap: new Map(),
        nodeMap: new Map([['node-1', { id: 'node-1', type: 'form_node' }]]),
      });
      jest.spyOn(svcAny, 'driveResumeAwaited').mockResolvedValue(undefined);

      await rfcSubject().rehydrateAndResume(executionId, 'ne-cs-1', {
        data: 'submitted',
      });

      expect(driveSpy).not.toHaveBeenCalled();
    });
  });
});
