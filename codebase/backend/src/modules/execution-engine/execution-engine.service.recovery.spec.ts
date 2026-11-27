import { ExecutionEngineService } from './execution-engine.service';
import { RehydrationError } from './ai-conversation-helpers';
import { ExecutionContextService } from './context/execution-context.service';
import {
  ExecutionEventType,
  NodeEventType,
} from '../websocket/websocket-events.types';
import {
  Execution,
  ExecutionStatus,
} from '../executions/entities/execution.entity';
import {
  NodeExecution,
  NodeExecutionStatus,
} from '../node-executions/entities/node-execution.entity';
import { Node } from '../nodes/entities/node.entity';
import {
  StuckExecutionRecoveryService,
  type StuckRecoveryEnginePort,
} from './recovery/stuck-execution-recovery.service';
import {
  type EngineServiceHarness,
  createEngineServiceHarness,
  executionId,
  workflowId,
} from './__test-utils__/engine-service-harness';
import { installTxUpdateBuilders } from './__test-utils__/update-query-builder.mock';

/**
 * ExecutionEngineService 단위 테스트: 부팅 복구 · 멈춘 실행 재구동 · orphan 정리 · stalled 소진 종결.
 *
 * 옛 `execution-engine.service.spec.ts` 를 관심사별로 나눈 파일 가운데 하나다(CLE-T-YEDCJK).
 * 서비스 구성과 mock 레포지토리는 `__test-utils__/engine-service-harness.ts` 공용 하네스가 만든다.
 */
describe('ExecutionEngineService', () => {
  let h: EngineServiceHarness;
  let service: ExecutionEngineService;

  // Mock repositories
  let mockExecutionRepo: Record<string, jest.Mock>;
  let mockNodeExecutionRepo: Record<string, jest.Mock>;
  let mockNodeRepo: Record<string, jest.Mock>;
  let mockExecutionNodeLogRepo: Record<string, jest.Mock>;
  // 테스트가 다시 대입하는 `dbExecutionStatus` · `waitingRawRows` ·
  // `waitingQueryError` 는 mock 클로저가 읽는 하네스 필드라 `h.` 로 대입한다.

  // 서비스 구성 · mock 레포지토리는 `__test-utils__/engine-service-harness.ts` 공용 하네스.
  beforeEach(async () => {
    h = await createEngineServiceHarness();
    ({
      service,
      mockExecutionRepo,
      mockNodeExecutionRepo,
      mockNodeRepo,
      mockExecutionNodeLogRepo,
    } = h);
  });

  // CLE-T-S03WEV — 부팅 복구 스캔은 StuckExecutionRecoveryService 로 옮겼다(스캔 자체의 테스트는
  // recovery/stuck-execution-recovery.service.spec.ts). 여기서는 엔진이 부팅 훅 · e2e 트리거에서
  // 그 서비스를 부르고, 재구동 · 세그먼트 기록 · 대기 초과 취소를 엔진 자신의 메서드로 넘기는지 본다.
  describe('부팅 복구 스캔 위임 (CLE-T-S03WEV)', () => {
    let mockBus: { acquireLock: jest.Mock; releaseLock: jest.Mock };
    let recovery: StuckExecutionRecoveryService;
    let scanSpy: jest.SpyInstance;

    beforeEach(() => {
      mockBus = (service as unknown as { continuationBus: typeof mockBus })
        .continuationBus;
      mockBus.acquireLock.mockResolvedValue(false);
      mockBus.releaseLock.mockResolvedValue(true);
      recovery = (
        service as unknown as { stuckRecovery: StuckExecutionRecoveryService }
      ).stuckRecovery;
      scanSpy = jest.spyOn(recovery, 'recoverStuckExecutions');
    });

    afterEach(() => scanSpy.mockRestore());

    // recovery 는 onModuleInit 이 아니라 onApplicationBootstrap 에서 실행돼야 한다.
    it('onModuleInit 은 recovery 를 트리거하지 않는다', () => {
      service.onModuleInit();
      expect(scanSpy).not.toHaveBeenCalled();
      expect(mockBus.acquireLock).not.toHaveBeenCalled();
    });

    it('onApplicationBootstrap 이 핸들러 정합성 검사 뒤 recovery 를 트리거한다', async () => {
      const registry = (
        service as unknown as {
          handlerRegistry: { assertConsistency: () => void };
        }
      ).handlerRegistry;
      const order: string[] = [];
      const consistencySpy = jest
        .spyOn(registry, 'assertConsistency')
        .mockImplementation(() => {
          order.push('consistency');
        });
      scanSpy.mockImplementation(() => {
        order.push('scan');
        return Promise.resolve();
      });
      try {
        await service.onApplicationBootstrap();
        expect(order).toEqual(['consistency', 'scan']);
      } finally {
        consistencySpy.mockRestore();
      }
    });

    it('핸들러 정합성 검사가 던지면 recovery 를 돌지 않는다', async () => {
      const registry = (
        service as unknown as {
          handlerRegistry: { assertConsistency: () => void };
        }
      ).handlerRegistry;
      const consistencySpy = jest
        .spyOn(registry, 'assertConsistency')
        .mockImplementation(() => {
          throw new Error('missing metadata');
        });
      try {
        await expect(service.onApplicationBootstrap()).rejects.toThrow(
          'missing metadata',
        );
        expect(scanSpy).not.toHaveBeenCalled();
      } finally {
        consistencySpy.mockRestore();
      }
    });

    it('onApplicationBootstrap 은 실제 스캔으로 lock 을 잡는다', async () => {
      await service.onApplicationBootstrap();
      expect(mockBus.acquireLock).toHaveBeenCalledWith('exec:recover:lock', 60);
    });

    it('runStuckRecoveryScan 도 같은 스캔을 부르고 포트는 엔진 메서드로 이어진다', async () => {
      const internals = service as unknown as {
        redriveStuckExecution: (id: string) => Promise<void>;
        recordRunningSegmentStart: (id: string) => void;
        markQueueWaitTimeout: (id: string) => Promise<void>;
      };
      const redrive = jest
        .spyOn(internals, 'redriveStuckExecution')
        .mockResolvedValue(undefined);
      const segStart = jest
        .spyOn(internals, 'recordRunningSegmentStart')
        .mockImplementation(() => {});
      const waitTimeout = jest
        .spyOn(internals, 'markQueueWaitTimeout')
        .mockResolvedValue(undefined);
      try {
        await service.runStuckRecoveryScan();
        expect(scanSpy).toHaveBeenCalledTimes(1);
        const port = scanSpy.mock.calls[0][0] as StuckRecoveryEnginePort;
        await port.redriveStuckExecution('e1');
        port.recordRunningSegmentStart('e2');
        await port.markQueueWaitTimeout('p1');
        expect(redrive).toHaveBeenCalledWith('e1');
        expect(segStart).toHaveBeenCalledWith('e2');
        expect(waitTimeout).toHaveBeenCalledWith('p1');
      } finally {
        redrive.mockRestore();
        segStart.mockRestore();
        waitTimeout.mockRestore();
      }
    });
  });

  // CLE-T-CE5YR3 — rehydrate 의 waiting 노드 복원은 `setNodeOutputs` 로 두 캐시를 쓴다.
  // 평면 캐시는 저장 값 그대로, 구조화 캐시는 라우팅 표지 `_selectedPort` 를 떼고 둔다.
  describe('rehydrateContext — waiting 노드 복원 (CLE-T-CE5YR3)', () => {
    it('평면 캐시에는 저장 값 그대로, 구조화 캐시에는 `_selectedPort` 없이 쓴다', async () => {
      const contextService = (
        service as unknown as { contextService: ExecutionContextService }
      ).contextService;
      mockExecutionNodeLogRepo.find.mockResolvedValueOnce([]);
      const outputData = {
        status: 'waiting_for_input',
        meta: { interactionType: 'form' },
        output: { answer: 'x' },
        _selectedPort: 'default',
      };

      const context = await service.rehydrateContext(
        {
          id: executionId,
          workflowId,
          status: ExecutionStatus.WAITING_FOR_INPUT,
          recursionDepth: 0,
        } as unknown as Execution,
        {
          id: 'ne-waiting',
          executionId,
          nodeId: 'node-w',
          outputData,
        } as unknown as NodeExecution,
      );

      try {
        expect(context.nodeOutputCache['node-w']).toEqual(outputData);
        // 대기 봉투는 핸들러 출력 모양이 아니라서 `output` 으로 감싼다. 표지만 빠지고
        // 나머지 필드는 값까지 그대로 옮겨야 한다.
        expect(context.structuredOutputCache['node-w']).toEqual({
          config: {},
          output: {
            status: 'waiting_for_input',
            meta: { interactionType: 'form' },
            output: { answer: 'x' },
          },
          status: 'waiting_for_input',
        });
      } finally {
        contextService.deleteContext(executionId);
      }
    });
  });

  // PR3 — redriveStuckExecution (case B 진입) 단위. 재구동 setup 분기.
  describe('redriveStuckExecution (PR3 case B)', () => {
    let driveSpy: jest.SpyInstance;
    let rehydrateSpy: jest.SpyInstance;
    let cancelSpy: jest.SpyInstance;
    let orphanSpy: jest.SpyInstance;

    beforeEach(() => {
      orphanSpy = jest
        .spyOn(
          service as unknown as {
            failOrphanRunningNodeExecutions: (id: string) => Promise<void>;
          },
          'failOrphanRunningNodeExecutions',
        )
        .mockResolvedValue(undefined);
      driveSpy = jest
        .spyOn(
          service as unknown as {
            driveStuckRedrive: (...a: unknown[]) => Promise<void>;
          },
          'driveStuckRedrive',
        )
        .mockResolvedValue(undefined);
      rehydrateSpy = jest
        .spyOn(
          service as unknown as {
            rehydrateContext: (...a: unknown[]) => Promise<unknown>;
          },
          'rehydrateContext',
        )
        .mockResolvedValue({ nodeOutputCache: {}, _executedNodes: new Set() });
      jest
        .spyOn(
          service as unknown as {
            loadAndBuildGraph: (...a: unknown[]) => Promise<unknown>;
          },
          'loadAndBuildGraph',
        )
        .mockResolvedValue({ sortedNodeIds: [] });
      cancelSpy = jest
        .spyOn(
          service as unknown as {
            markExecutionCancelled: (...a: unknown[]) => Promise<void>;
          },
          'markExecutionCancelled',
        )
        .mockResolvedValue(undefined);
    });

    afterEach(() => jest.restoreAllMocks());

    it('RUNNING 세그먼트면 rehydrate + driveStuckRedrive 로 재구동한다', async () => {
      mockExecutionRepo.findOneBy.mockResolvedValueOnce({
        id: 'e1',
        status: ExecutionStatus.RUNNING,
        workflowId: 'wf1',
        startedAt: new Date(),
      } as unknown as Execution);
      await (
        service as unknown as {
          redriveStuckExecution: (id: string) => Promise<void>;
        }
      ).redriveStuckExecution('e1');
      expect(rehydrateSpy).toHaveBeenCalled();
      // case B — waiting NodeExecution 없이 null 로 rehydrate.
      expect(rehydrateSpy.mock.calls[0][1]).toBeNull();
      // 크래시 orphan RUNNING NodeExecution 을 재구동 전에 마감(ai-review side-effect W).
      expect(orphanSpy).toHaveBeenCalledWith('e1');
      expect(driveSpy).toHaveBeenCalled();
      expect(cancelSpy).not.toHaveBeenCalled();
    });

    it('execution 부재(findOneBy null)면 skip — rehydrate/orphan-cascade 안 함', async () => {
      mockExecutionRepo.findOneBy.mockResolvedValueOnce(null);
      await (
        service as unknown as {
          redriveStuckExecution: (id: string) => Promise<void>;
        }
      ).redriveStuckExecution('gone');
      expect(rehydrateSpy).not.toHaveBeenCalled();
      expect(orphanSpy).not.toHaveBeenCalled();
      expect(driveSpy).not.toHaveBeenCalled();
    });

    it('RUNNING 이 아니면(동시 cancel 등) skip — rehydrate/재구동 안 함', async () => {
      mockExecutionRepo.findOneBy.mockResolvedValueOnce({
        id: 'e1',
        status: ExecutionStatus.CANCELLED,
      } as unknown as Execution);
      await (
        service as unknown as {
          redriveStuckExecution: (id: string) => Promise<void>;
        }
      ).redriveStuckExecution('e1');
      expect(rehydrateSpy).not.toHaveBeenCalled();
      expect(driveSpy).not.toHaveBeenCalled();
    });

    it('재구동 setup(rehydrate) 실패 시 RESUME_CHECKPOINT_MISSING terminal 로 마감한다', async () => {
      mockExecutionRepo.findOneBy.mockResolvedValueOnce({
        id: 'e1',
        status: ExecutionStatus.RUNNING,
        workflowId: 'wf1',
        startedAt: new Date(),
      } as unknown as Execution);
      rehydrateSpy.mockRejectedValueOnce(
        new RehydrationError('RESUME_CHECKPOINT_MISSING', 'no checkpoint'),
      );
      await (
        service as unknown as {
          redriveStuckExecution: (id: string) => Promise<void>;
        }
      ).redriveStuckExecution('e1');
      expect(cancelSpy).toHaveBeenCalledWith('e1', 'RESUME_CHECKPOINT_MISSING');
      expect(driveSpy).not.toHaveBeenCalled();
    });

    it('setup 이 비-RehydrationError 로 실패해도 RESUME_CHECKPOINT_MISSING terminal 로 마감한다', async () => {
      mockExecutionRepo.findOneBy.mockResolvedValueOnce({
        id: 'e1',
        status: ExecutionStatus.RUNNING,
        workflowId: 'wf1',
        startedAt: new Date(),
      } as unknown as Execution);
      // loadAndBuildGraph 가 일반 Error 로 실패 (DB 오류 등).
      jest
        .spyOn(
          service as unknown as {
            loadAndBuildGraph: (...a: unknown[]) => Promise<unknown>;
          },
          'loadAndBuildGraph',
        )
        .mockRejectedValueOnce(new Error('graph load boom'));
      await (
        service as unknown as {
          redriveStuckExecution: (id: string) => Promise<void>;
        }
      ).redriveStuckExecution('e1');
      expect(cancelSpy).toHaveBeenCalledWith('e1', 'RESUME_CHECKPOINT_MISSING');
      expect(driveSpy).not.toHaveBeenCalled();
    });
  });

  // CLE-T-K9RZQV — §7.5 case B 에서 재개 턴 중 크래시한 멀티턴 AI 노드는 처리 중이던 턴을
  // 새 행으로 다시 돌린다(CLE-EXEC-STATE-RESUME 「크래시 재구동에서 처리 중이던 턴을 다시
  // 돌린다」). 재료가 온전하지 않으면 그 노드를 처음부터 다시 실행한다(기존 재구동).
  describe('redriveStuckExecution — 크래시한 AI 재개 턴 재생 (CLE-T-K9RZQV)', () => {
    type Internals = {
      redriveStuckExecution: (id: string) => Promise<void>;
      failOrphanRunningNodeExecutions: (...a: unknown[]) => Promise<void>;
      driveStuckRedrive: (...a: unknown[]) => Promise<void>;
      rehydrateContext: (...a: unknown[]) => Promise<unknown>;
      loadAndBuildGraph: (...a: unknown[]) => Promise<unknown>;
      markExecutionCancelled: (...a: unknown[]) => Promise<void>;
      markNodeExecutionFailed: (...a: unknown[]) => Promise<void>;
      resumeFromCheckpoint: (...a: unknown[]) => Promise<void>;
      createNodeExecution: (...a: unknown[]) => Promise<unknown>;
      buildRetryReentryState: (...a: unknown[]) => unknown;
      contextKeyOf: (...a: unknown[]) => string;
      eventEmitter: { emitNode: (...a: unknown[]) => Promise<void> };
      contextService: { setNodeOutputs: (...a: unknown[]) => void };
    };
    const internals = (): Internals => service as unknown as Internals;
    const checkpoint = { schemaVersion: 1, turnCount: 1, messages: [] };
    const context = { nodeOutputCache: {}, _executedNodes: new Set() };
    const newRow = {
      id: 'ne-new',
      startedAt: new Date('2026-11-19T00:00:00Z'),
    };
    const aiNode = { id: 'n-ai', type: 'ai_agent', label: 'Agent' };
    const resumedOutput = (
      interaction: Record<string, unknown> = {
        type: 'message_received',
        data: { content: 'turn-two', role: 'user' },
        receivedAt: 'now',
      },
      extra: Record<string, unknown> = {},
    ) => ({
      config: {},
      output: {
        result: {
          messages: [
            { role: 'user', content: 'turn-one' },
            { role: 'assistant', content: 'reply-one' },
            { role: 'user', content: 'turn-two' },
          ],
        },
        interaction,
      },
      meta: { interactionType: 'ai_conversation', durationMs: 0 },
      status: 'resumed',
      _resumeCheckpoint: checkpoint,
      ...extra,
    });
    const aiRow = (over: Record<string, unknown> = {}) => ({
      id: 'ne-old',
      nodeId: 'n-ai',
      status: NodeExecutionStatus.RUNNING,
      parentNodeExecutionId: null,
      inputData: { in: 1 },
      outputData: resumedOutput(),
      ...over,
    });
    const execStartedAt = new Date('2026-11-19T00:00:00Z');
    const execution = (over: Record<string, unknown> = {}) =>
      ({
        id: 'e1',
        status: ExecutionStatus.RUNNING,
        workflowId: 'wf1',
        startedAt: execStartedAt,
        resumeCallStack: null,
        ...over,
      }) as unknown as Execution;

    let orphanSpy: jest.SpyInstance;
    let driveSpy: jest.SpyInstance;
    let resumeSpy: jest.SpyInstance;
    let createSpy: jest.SpyInstance;
    let buildSpy: jest.SpyInstance;
    let emitSpy: jest.SpyInstance;
    let seedSpy: jest.SpyInstance;
    let cancelSpy: jest.SpyInstance;
    let nodeFailSpy: jest.SpyInstance;

    beforeEach(() => {
      const svc = internals();
      orphanSpy = jest
        .spyOn(svc, 'failOrphanRunningNodeExecutions')
        .mockResolvedValue(undefined);
      driveSpy = jest
        .spyOn(svc, 'driveStuckRedrive')
        .mockResolvedValue(undefined);
      jest.spyOn(svc, 'rehydrateContext').mockResolvedValue(context);
      jest
        .spyOn(svc, 'loadAndBuildGraph')
        .mockResolvedValue({ sortedNodeIds: [] });
      cancelSpy = jest
        .spyOn(svc, 'markExecutionCancelled')
        .mockResolvedValue(undefined);
      nodeFailSpy = jest
        .spyOn(svc, 'markNodeExecutionFailed')
        .mockResolvedValue(undefined);
      resumeSpy = jest
        .spyOn(svc, 'resumeFromCheckpoint')
        .mockResolvedValue(undefined);
      createSpy = jest
        .spyOn(svc, 'createNodeExecution')
        .mockResolvedValue(newRow);
      buildSpy = jest
        .spyOn(svc, 'buildRetryReentryState')
        .mockReturnValue({ resumeState: {}, initialAction: undefined });
      jest.spyOn(svc, 'contextKeyOf').mockReturnValue('e1');
      emitSpy = jest
        .spyOn(svc.eventEmitter, 'emitNode')
        .mockResolvedValue(undefined);
      seedSpy = jest
        .spyOn(svc.contextService, 'setNodeOutputs')
        .mockImplementation(() => undefined);
      mockNodeRepo.findOneBy = jest.fn().mockResolvedValue(aiNode);
    });

    afterEach(() => jest.restoreAllMocks());

    const run = async (exec: Execution, rows: unknown[]) => {
      mockExecutionRepo.findOneBy.mockResolvedValueOnce(exec);
      mockNodeExecutionRepo.find = jest.fn().mockResolvedValue(rows);
      await internals().redriveStuckExecution('e1');
    };
    const expectFallback = () => {
      expect(resumeSpy).not.toHaveBeenCalled();
      expect(createSpy).not.toHaveBeenCalled();
      expect(orphanSpy).toHaveBeenCalledWith('e1');
      expect(driveSpy).toHaveBeenCalled();
    };

    it('최상위 메시지 턴: 옛 행만 마감하고 새 행으로 그 턴을 다시 돌린다', async () => {
      await run(execution(), [aiRow()]);

      expect(mockNodeExecutionRepo.find).toHaveBeenCalledWith({
        where: { executionId: 'e1', status: NodeExecutionStatus.RUNNING },
      });
      expect(orphanSpy).toHaveBeenCalledWith('e1', 'ne-old');
      expect(createSpy).toHaveBeenCalledWith(
        'e1',
        'n-ai',
        NodeExecutionStatus.RUNNING,
        undefined,
        { in: 1 },
      );
      // 턴 이전 대기 봉투를 두 캐시에 함께 싣는다(사용자 메시지를 두 번 싣지 않는다).
      const [, seededNodeId, seeded, seededFlat] = seedSpy.mock.calls[0] as [
        string,
        string,
        { status: string; output: { result: { messages: unknown[] } } },
        unknown,
      ];
      expect(seededNodeId).toBe('n-ai');
      expect(seededFlat).toEqual(seeded);
      expect(seeded.status).toBe('waiting_for_input');
      expect(seeded.output.result.messages).toHaveLength(2);
      expect(seeded.output).not.toHaveProperty('interaction');
      expect(emitSpy).toHaveBeenCalledWith(
        'e1',
        'n-ai',
        NodeEventType.NODE_STARTED,
        expect.objectContaining({
          nodeExecutionId: 'ne-new',
          status: NodeExecutionStatus.RUNNING,
          nodeType: 'ai_agent',
        }),
      );
      expect(resumeSpy).toHaveBeenCalledWith(execution(), context, {
        node: aiNode,
        nodeExec: newRow,
        payload: { type: 'ai_message', message: 'turn-two' },
      });
      // 재구성 가능 여부는 재생 전에 같은 재구성기로 확인한다.
      expect(buildSpy).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'e1' }),
        aiNode,
        context,
        checkpoint,
        expect.objectContaining({ resumeMode: true }),
      );
      expect(driveSpy).not.toHaveBeenCalled();
      expect(cancelSpy).not.toHaveBeenCalled();
    });

    it('폼 제출 턴은 form_submitted 입력으로 다시 돌린다', async () => {
      await run(execution(), [
        aiRow({
          outputData: resumedOutput({
            type: 'form_submitted',
            data: { email: 'a@b.c' },
            receivedAt: 'now',
          }),
        }),
      ]);
      expect(resumeSpy.mock.calls[0][2]).toMatchObject({
        payload: { type: 'form_submitted', formData: { email: 'a@b.c' } },
      });
    });

    it('중첩: 호출 노드 행은 두고 AI 행만 마감한 뒤 같은 부모 아래 새 행으로 다시 돌린다', async () => {
      const callStack = {
        version: 1,
        frames: [
          { workflowId: 'sub1', invokerNodeId: 'inv1', recursionDepth: 1 },
          { workflowId: 'sub2', invokerNodeId: 'inv2', recursionDepth: 2 },
        ],
      };
      await run(execution({ resumeCallStack: callStack }), [
        { id: 'ne-inv1', nodeId: 'inv1', parentNodeExecutionId: null },
        { id: 'ne-inv2', nodeId: 'inv2', parentNodeExecutionId: 'ne-inv1' },
        aiRow({ parentNodeExecutionId: 'ne-inv2' }),
      ]);
      expect(orphanSpy).toHaveBeenCalledTimes(1);
      expect(orphanSpy).toHaveBeenCalledWith('e1', 'ne-old');
      expect(createSpy).toHaveBeenCalledWith(
        'e1',
        'n-ai',
        NodeExecutionStatus.RUNNING,
        'ne-inv2',
        { in: 1 },
      );
      expect(emitSpy.mock.calls[0][3]).toMatchObject({
        parentNodeExecutionId: 'ne-inv2',
      });
      expect(resumeSpy).toHaveBeenCalled();
      expect(driveSpy).not.toHaveBeenCalled();
    });

    it.each([
      [
        '체크포인트 미래 버전',
        () => [
          aiRow({
            outputData: resumedOutput(undefined, {
              _resumeCheckpoint: { schemaVersion: 999 },
            }),
          }),
        ],
        () => execution(),
      ],
      [
        '체크포인트 없음',
        () => [
          aiRow({
            outputData: resumedOutput(undefined, {
              _resumeCheckpoint: undefined,
            }),
          }),
        ],
        () => execution(),
      ],
      [
        '체크포인트가 객체 아님',
        () => [
          aiRow({
            outputData: resumedOutput(undefined, { _resumeCheckpoint: 'x' }),
          }),
        ],
        () => execution(),
      ],
      [
        '입력을 읽을 수 없음',
        () => [aiRow({ outputData: resumedOutput({ type: 'button_click' }) })],
        () => execution(),
      ],
      [
        '재개 스냅샷이 아님',
        () => [aiRow({ outputData: { status: 'waiting_for_input' } })],
        () => execution(),
      ],
      [
        '최상위인데 다른 running 행이 있음',
        () => [
          aiRow(),
          { id: 'ne-x', nodeId: 'x', parentNodeExecutionId: null },
        ],
        () => execution(),
      ],
      [
        '최상위인데 부모 행이 있음',
        () => [aiRow({ parentNodeExecutionId: 'ne-p' })],
        () => execution(),
      ],
      [
        '재개 스냅샷 행이 둘',
        () => [aiRow(), aiRow({ id: 'ne-old2' })],
        () => execution(),
      ],
      [
        '중첩인데 호출 노드 행이 프레임과 맞지 않음',
        () => [
          { id: 'ne-inv9', nodeId: 'inv9', parentNodeExecutionId: null },
          aiRow({ parentNodeExecutionId: 'ne-inv9' }),
        ],
        () =>
          execution({
            resumeCallStack: {
              version: 1,
              frames: [
                {
                  workflowId: 'sub1',
                  invokerNodeId: 'inv1',
                  recursionDepth: 1,
                },
              ],
            },
          }),
      ],
      [
        '중첩인데 AI 행의 부모가 가장 안쪽 호출 노드 행이 아님',
        () => [
          { id: 'ne-inv1', nodeId: 'inv1', parentNodeExecutionId: null },
          aiRow({ parentNodeExecutionId: 'ne-other' }),
        ],
        () =>
          execution({
            resumeCallStack: {
              version: 1,
              frames: [
                {
                  workflowId: 'sub1',
                  invokerNodeId: 'inv1',
                  recursionDepth: 1,
                },
              ],
            },
          }),
      ],
      [
        '중첩 호출 스택 프레임에 invokerNodeId 가 없음',
        () => [
          { id: 'ne-inv1', nodeId: 'inv1', parentNodeExecutionId: null },
          aiRow({ parentNodeExecutionId: 'ne-inv1' }),
        ],
        () =>
          execution({
            resumeCallStack: {
              version: 1,
              frames: [{ workflowId: 'sub1', recursionDepth: 1 }],
            } as unknown as Execution['resumeCallStack'],
          }),
      ],
      [
        '중첩 호출 스택 미래 버전',
        () => [
          { id: 'ne-inv1', nodeId: 'inv1', parentNodeExecutionId: null },
          aiRow({ parentNodeExecutionId: 'ne-inv1' }),
        ],
        () =>
          execution({
            resumeCallStack: {
              version: 999,
              frames: [
                {
                  workflowId: 'sub1',
                  invokerNodeId: 'inv1',
                  recursionDepth: 1,
                },
              ],
            },
          }),
      ],
    ])(
      '재료가 온전하지 않으면 처음부터 다시 실행한다: %s',
      async (_l, rows, exec) => {
        await run(exec(), rows());
        expectFallback();
      },
    );

    it('노드 정의가 없거나 체크포인트 대상 타입이 아니면 처음부터 다시 실행한다', async () => {
      mockNodeRepo.findOneBy = jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...aiNode, type: 'form' });
      await run(execution(), [aiRow()]);
      expectFallback();
      orphanSpy.mockClear();
      driveSpy.mockClear();
      await run(execution(), [aiRow()]);
      expectFallback();
    });

    it('재구성기가 실패하면 처음부터 다시 실행한다 (RESUME_INCOMPATIBLE_STATE 로 끝내지 않는다)', async () => {
      buildSpy.mockImplementation(() => {
        throw new Error('bad checkpoint');
      });
      await run(execution(), [aiRow()]);
      expectFallback();
      expect(cancelSpy).not.toHaveBeenCalled();
    });

    it('재생 진입이 RehydrationError 가 아닌 오류로 실패하면 RESUME_CHECKPOINT_MISSING 으로 마감한다', async () => {
      resumeSpy.mockRejectedValueOnce(new Error('boom'));
      await run(execution(), [aiRow()]);
      expect(nodeFailSpy).toHaveBeenCalledWith(
        'ne-new',
        'RESUME_CHECKPOINT_MISSING',
      );
      expect(cancelSpy).toHaveBeenCalledWith('e1', 'RESUME_CHECKPOINT_MISSING');
      expect(driveSpy).not.toHaveBeenCalled();
    });

    it('재생 진입 사전 검사가 실패하면 새 행과 실행을 RESUME_* 로 마감한다', async () => {
      resumeSpy.mockRejectedValueOnce(
        new RehydrationError('RESUME_CHECKPOINT_MISSING', 'not in graph'),
      );
      await run(execution(), [aiRow()]);
      expect(nodeFailSpy).toHaveBeenCalledWith(
        'ne-new',
        'RESUME_CHECKPOINT_MISSING',
      );
      expect(cancelSpy).toHaveBeenCalledWith('e1', 'RESUME_CHECKPOINT_MISSING');
      expect(driveSpy).not.toHaveBeenCalled();
    });
  });

  // PR3 — failOrphanRunningNodeExecutions: 크래시 orphan RUNNING NodeExecution 마감.
  describe('failOrphanRunningNodeExecutions (PR3 orphan cascade)', () => {
    it('executionId 의 RUNNING NodeExecution 만 FAILED 로 마감한다', async () => {
      const qb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        setParameter: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        returning: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      };
      mockNodeExecutionRepo.createQueryBuilder = jest.fn().mockReturnValue(qb);
      await (
        service as unknown as {
          failOrphanRunningNodeExecutions: (id: string) => Promise<void>;
        }
      ).failOrphanRunningNodeExecutions('e1');
      expect(qb.set).toHaveBeenCalledWith(
        expect.objectContaining({ status: NodeExecutionStatus.FAILED }),
      );
      expect(qb.where).toHaveBeenCalledWith('execution_id = :executionId', {
        executionId: 'e1',
      });
      expect(qb.andWhere).toHaveBeenCalledWith(
        'status = :running',
        expect.objectContaining({ running: NodeExecutionStatus.RUNNING }),
      );
    });

    it('행 id 를 주면 그 RUNNING 행 하나만 마감한다 (CLE-T-K9RZQV 재생 경로)', async () => {
      const qb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      };
      mockNodeExecutionRepo.createQueryBuilder = jest.fn().mockReturnValue(qb);
      await (
        service as unknown as {
          failOrphanRunningNodeExecutions: (
            id: string,
            nodeExecutionId?: string,
          ) => Promise<void>;
        }
      ).failOrphanRunningNodeExecutions('e1', 'ne-old');
      expect(qb.andWhere).toHaveBeenCalledWith('id = :nodeExecutionId', {
        nodeExecutionId: 'ne-old',
      });
    });
  });

  // PR3 — driveStuckRedrive: forward 재구동의 완료/park/에러 3분기.
  describe('driveStuckRedrive (PR3 case B drive)', () => {
    let loopSpy: jest.SpyInstance;
    let updateStatusSpy: jest.SpyInstance;
    let finalizeSpy: jest.SpyInstance;
    let emitSpy: jest.Mock;

    const graphState = {
      sortedNodeIds: ['n1'],
      nodeMap: new Map(),
      forwardEdges: [],
      outgoingEdgeMap: new Map(),
    };
    const mkExec = () =>
      ({
        id: 'e1',
        status: ExecutionStatus.RUNNING,
        startedAt: new Date(),
      }) as unknown as Execution;
    const ctx = () =>
      ({ nodeOutputCache: {}, _executedNodes: new Set() }) as never;

    beforeEach(() => {
      const gt = (
        service as unknown as {
          graphTraversal: {
            seedInitialReachability: (...a: unknown[]) => Set<string>;
            propagateReachability: (...a: unknown[]) => void;
          };
        }
      ).graphTraversal;
      jest
        .spyOn(gt, 'seedInitialReachability')
        .mockReturnValue(new Set<string>());
      loopSpy = jest.spyOn(
        service as unknown as {
          runNodeDispatchLoop: (...a: unknown[]) => Promise<{
            parked: boolean;
          }>;
        },
        'runNodeDispatchLoop',
      );
      updateStatusSpy = jest
        .spyOn(
          service as unknown as {
            updateExecutionStatus: (...a: unknown[]) => Promise<boolean>;
          },
          'updateExecutionStatus',
        )
        .mockResolvedValue(true);
      finalizeSpy = jest
        .spyOn(
          service as unknown as {
            finalizeResumedExecutionOutcome: (...a: unknown[]) => Promise<void>;
          },
          'finalizeResumedExecutionOutcome',
        )
        .mockResolvedValue(undefined);
      jest
        .spyOn(
          service as unknown as {
            finalizeRehydrationCleanup: (...a: unknown[]) => void;
          },
          'finalizeRehydrationCleanup',
        )
        .mockImplementation(() => {});
      const ee = (
        service as unknown as {
          eventEmitter: {
            emitExecution: (...a: unknown[]) => Promise<void>;
          };
        }
      ).eventEmitter;
      emitSpy = jest
        .spyOn(ee, 'emitExecution')
        .mockResolvedValue(undefined) as unknown as jest.Mock;
    });

    afterEach(() => jest.restoreAllMocks());

    it('그래프가 park 없이 끝나면 COMPLETED 마감 + EXECUTION_COMPLETED emit', async () => {
      loopSpy.mockResolvedValue({ parked: false });
      await (
        service as unknown as {
          driveStuckRedrive: (
            e: Execution,
            c: unknown,
            g: unknown,
          ) => Promise<void>;
        }
      ).driveStuckRedrive(mkExec(), ctx(), graphState);
      expect(loopSpy).toHaveBeenCalled();
      // skipExecutedNodes 가 case B 에서 켜져 완료 노드 재실행을 막는다.
      expect(loopSpy.mock.calls[0][0]).toEqual(
        expect.objectContaining({ skipExecutedNodes: true, pointer: 0 }),
      );
      expect(updateStatusSpy).toHaveBeenCalledWith(
        expect.anything(),
        ExecutionStatus.COMPLETED,
      );
      // COMPLETED 마감 후 execution 이벤트 emit (updateExecutionStatus=true 이므로).
      expect(emitSpy).toHaveBeenCalled();
      expect(finalizeSpy).not.toHaveBeenCalled();
    });

    it('재구동 중 downstream 이 fresh park 하면 COMPLETED 마감 없이 반환', async () => {
      loopSpy.mockResolvedValue({ parked: true });
      await (
        service as unknown as {
          driveStuckRedrive: (
            e: Execution,
            c: unknown,
            g: unknown,
          ) => Promise<void>;
        }
      ).driveStuckRedrive(mkExec(), ctx(), graphState);
      expect(updateStatusSpy).not.toHaveBeenCalledWith(
        expect.anything(),
        ExecutionStatus.COMPLETED,
      );
      expect(finalizeSpy).not.toHaveBeenCalled();
    });

    it('재구동 중 예외는 finalizeResumedExecutionOutcome 로 in-band 단말 처리', async () => {
      const boom = new Error('node boom');
      loopSpy.mockRejectedValue(boom);
      await (
        service as unknown as {
          driveStuckRedrive: (
            e: Execution,
            c: unknown,
            g: unknown,
          ) => Promise<void>;
        }
      ).driveStuckRedrive(mkExec(), ctx(), graphState);
      expect(finalizeSpy).toHaveBeenCalledWith(expect.anything(), boom);
      expect(updateStatusSpy).not.toHaveBeenCalledWith(
        expect.anything(),
        ExecutionStatus.COMPLETED,
      );
    });
  });

  // PR4 — stalled 소진 dead-letter 마감 (ExecutionRunProcessor.onFailed 호출).
  describe('finalizeStalledExhausted (PR4)', () => {
    // 자매 `installCancelTx` 와 같은 유틸 — 두 UPDATE 가 **같은 트랜잭션 manager** 를 탄다.
    // 트랜잭션 밖 repo 를 쓰면 즉시 터지도록 무장해, 다시 밖으로 나가는 회귀를 잡는다.
    const installStalledTx = ({ execution }: { execution: number }) => {
      const { execQb, nodeQb, tx, managerCqb } = installTxUpdateBuilders(
        service,
        {
          // `duration_ms` 는 SQL 로 계산해 RETURNING 으로 되받는다 — **snake_case** 로 온다
          // (드라이버 원본이라 ORM 매핑을 안 탄다, #1168 에서 배운 형태).
          execution: {
            affected: execution,
            raw: [{ id: 'exec-stalled', duration_ms: 4242 }],
          },
          nodeExecution: { affected: 1 },
        },
      );
      mockExecutionRepo.createQueryBuilder = jest.fn(() => {
        throw new Error('트랜잭션 밖 executionRepository 사용');
      });
      mockNodeExecutionRepo.createQueryBuilder = jest.fn(() => {
        throw new Error('트랜잭션 밖 nodeExecutionRepository 사용');
      });
      return { execQb, nodeQb, tx, managerCqb };
    };

    // 자매 둘(`cancelParkedExecution`·`markWebChatIdleTimeout`)은 같은 2-테이블 쓰기를
    // 이미 `dataSource.transaction` 으로 원자화했는데 이 함수만 밖에 있었다. 첫 UPDATE 가
    // 커밋된 뒤 둘째가 실패하면 자식 NodeExecution 이 **영구 `RUNNING`** 으로 잔류한다 —
    // 자매 두 함수의 주석이 경고하는 바로 그 실패 모드다.
    //
    // mock 은 롤백을 흉내내지 못한다. 이 테스트가 보증하는 것은 **두 UPDATE 가 같은
    // 트랜잭션 manager 를 탄다**는 것까지다(원자성 자체가 아니라 그 전제).
    it('Execution·NodeExecution 두 UPDATE 가 같은 트랜잭션 manager 를 탄다', async () => {
      const { execQb, nodeQb, tx, managerCqb } = installStalledTx({
        execution: 1,
      });
      jest
        .spyOn(
          (
            service as unknown as {
              eventEmitter: {
                emitExecution: (...a: unknown[]) => Promise<void>;
              };
            }
          ).eventEmitter,
          'emitExecution',
        )
        .mockResolvedValue(undefined);

      await service.finalizeStalledExhausted('exec-stalled');

      expect(tx).toHaveBeenCalledTimes(1);
      // 같은 manager 로 두 번 — Execution → NodeExecution 순서.
      expect(managerCqb).toHaveBeenCalledTimes(2);
      expect(execQb.update.mock.calls[0][0]).toBe(Execution);
      expect(nodeQb.update.mock.calls[0][0]).toBe(NodeExecution);
      // 두 UPDATE 가 **같은 execution** 을 겨냥하는지 — 트랜잭션에 묶여도 대상이 어긋나면
      // 원자성은 무의미하다.
      expect(execQb.where).toHaveBeenCalledWith('id = :id', {
        id: 'exec-stalled',
      });
      expect(nodeQb.where).toHaveBeenCalledWith('execution_id = :executionId', {
        executionId: 'exec-stalled',
      });
    });

    it('RUNNING 이면 failed + WORKER_HEARTBEAT_TIMEOUT 마킹 + 자식 cascade + EXECUTION_FAILED emit', async () => {
      const { execQb, nodeQb } = installStalledTx({ execution: 1 });
      const emitSpy = jest
        .spyOn(
          (
            service as unknown as {
              eventEmitter: {
                emitExecution: (...a: unknown[]) => Promise<void>;
              };
            }
          ).eventEmitter,
          'emitExecution',
        )
        .mockResolvedValue(undefined);

      await service.finalizeStalledExhausted('exec-stalled');

      // 조건부 UPDATE: status=FAILED + code=WORKER_HEARTBEAT_TIMEOUT, WHERE status=running.
      const setArg = execQb.set.mock.calls[0][0] as Record<string, unknown>;
      expect(setArg.status).toBe(ExecutionStatus.FAILED);
      expect((setArg.error as { code: string }).code).toBe(
        'WORKER_HEARTBEAT_TIMEOUT',
      );
      // 대상 식별 자체도 단언한다 — 지난 라운드에 **자식 cascade 의 WHERE 만** 하드닝하고
      // 바로 위 Execution UPDATE 의 `id` 조건은 놓쳤다(`16_19_26` testing W1 이 뮤테이션으로
      // 생존 실측). 오식별하면 엉뚱한 실행을 마킹하거나 진짜 stalled 를 조용히 no-op 시킨다.
      expect(execQb.where).toHaveBeenCalledWith('id = :id', {
        id: 'exec-stalled',
      });
      expect(execQb.andWhere).toHaveBeenCalledWith('status = :running', {
        running: ExecutionStatus.RUNNING,
      });
      // 자식 RUNNING NodeExecution cascade.
      // `status` 만 단언하면 `error.code` 를 바꿔도 GREEN 이다 — 뮤테이션으로 실측됐다
      // (`23_34_12` testing W1). **이 줄이야말로 "손으로 값을 반복하면 갈린다" 는 이번
      // 변경의 교훈이 재현된 자리**(부모 상수를 참조하도록 고친 곳)라 값을 고정한다.
      // WHERE 가드도 단언한다 — 종전엔 `set` 만 봐서 **WHERE 값을 바꿔도 GREEN** 이었다
      // (`16_04_38` testing W1 이 뮤테이션으로 실측). `execution_id` 범위를 잃으면 다른
      // 실행의 노드를 마감하고, `status` 가드를 잃으면 이미 끝난 노드를 덮어쓴다.
      expect(nodeQb.where).toHaveBeenCalledWith('execution_id = :executionId', {
        executionId: 'exec-stalled',
      });
      expect(nodeQb.andWhere).toHaveBeenCalledWith('status = :running', {
        running: NodeExecutionStatus.RUNNING,
      });
      expect(nodeQb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: NodeExecutionStatus.FAILED,
          error: {
            code: 'WORKER_HEARTBEAT_TIMEOUT',
            message: 'Node failed: parent execution stalled (재배달 소진)',
          },
        }),
      );
      // 종전엔 `toHaveBeenCalled()` 로 호출 여부만 봤다 — emit 의 `error` 값을 아무도
      // 보고 있지 않아 뮤테이션에서 그 자리를 바꿔도 GREEN 이었다 (`22_55_51` testing W8).
      // DB 에 쓴 것과 **같은 문구**가 나가는지가 이 변경의 요점이므로 값을 고정한다.
      expect(emitSpy).toHaveBeenCalledWith(
        'exec-stalled',
        ExecutionEventType.EXECUTION_FAILED,
        {
          status: ExecutionStatus.FAILED,
          error: {
            code: 'WORKER_HEARTBEAT_TIMEOUT',
            message:
              'Execution failed: worker crash (stalled 재배달 attempts 소진)',
            nodeId: null,
          },
          // **UPDATE 의 RETURNING 이 돌려준 값 그대로** — 이 경로는 엔티티를 로드하지
          // 않으므로 JS 에서 다시 계산할 수 없고, 계산하면 DB 와 갈린다.
          durationMs: 4242,
        },
      );
      emitSpy.mockRestore();
    });

    // 자매 `cancelParkedExecution`/`markWebChatIdleTimeout` 은 이 계약을 잠그는 전용
    // 테스트를 갖는데 이 함수만 없었다 (`16_31_53` testing W1) — **또 자매 비대칭**이다.
    //
    // 이 함수는 함수 레벨 try/catch 가 없다(의도적 — 유일 호출부 `execution-run.processor`
    // `onFailed` 의 `.catch()` 가 흡수한다). 그래서 트랜잭션이 실패하면 **그대로 던져야**
    // 하고, 던지는 대신 삼키면 실패가 관측 불가능해진다. 그리고 커밋되지 않았으므로
    // 종결 이벤트도 나가면 안 된다.
    it('트랜잭션 중간 실패는 삼키지 않고 던진다 + 종결 이벤트도 안 나간다', async () => {
      const { nodeQb } = installStalledTx({ execution: 1 });
      nodeQb.execute = jest
        .fn()
        .mockRejectedValue(new Error('deadlock detected'));
      const emitSpy = jest
        .spyOn(
          (
            service as unknown as {
              eventEmitter: {
                emitExecution: (...a: unknown[]) => Promise<void>;
              };
            }
          ).eventEmitter,
          'emitExecution',
        )
        .mockResolvedValue(undefined);

      await expect(
        service.finalizeStalledExhausted('exec-stalled'),
      ).rejects.toThrow('deadlock detected');
      expect(emitSpy).not.toHaveBeenCalled();
      emitSpy.mockRestore();
    });

    it('이미 terminal (affected=0) 이면 no-op — cascade/emit 안 함', async () => {
      const { nodeQb, managerCqb } = installStalledTx({ execution: 0 });
      const emitSpy = jest
        .spyOn(
          (
            service as unknown as {
              eventEmitter: {
                emitExecution: (...a: unknown[]) => Promise<void>;
              };
            }
          ).eventEmitter,
          'emitExecution',
        )
        .mockResolvedValue(undefined);

      await service.finalizeStalledExhausted('exec-already-terminal');

      // 트랜잭션 안에서 **Execution UPDATE 하나만** 만들어졌어야 한다 — 자식 cascade 는
      // Execution 이 실제로 전이됐을 때만 돈다. 종전 단언(`mockNodeExecutionRepo.
      // createQueryBuilder` 미호출)은 이제 그 repo 를 아예 안 쓰므로 **항상 참**이 된다.
      expect(managerCqb).toHaveBeenCalledTimes(1);
      expect(nodeQb.execute).not.toHaveBeenCalled();
      expect(emitSpy).not.toHaveBeenCalled();
      emitSpy.mockRestore();
    });
  });
});
