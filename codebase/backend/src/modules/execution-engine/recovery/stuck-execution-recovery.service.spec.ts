import type { Repository } from 'typeorm';
import { SUB_WORKFLOW_MAX_RECURSION_DEPTH } from '../../../nodes/core/node-types.constants';
import {
  Execution,
  ExecutionStatus,
} from '../../executions/entities/execution.entity';
import {
  NodeExecution,
  NodeExecutionStatus,
} from '../../node-executions/entities/node-execution.entity';
import type { ContinuationBusService } from '../continuation/continuation-bus.service';
import {
  RECOVERY_LOCK_TTL_SECONDS,
  STUCK_RECOVERY_STALE_MS,
  StuckExecutionRecoveryService,
  type StuckRecoveryEnginePort,
} from './stuck-execution-recovery.service';

// 임계 시각 비교의 시계 허용 오차(테스트 실행 중 흐른 시간).
const CLOCK_TOLERANCE_MS = 5_000;

/** UPDATE … RETURNING 체인 mock. 단계마다 인자를 단언할 수 있게 각 단계를 돌려준다. */
function updateChain(result: { affected?: number; raw: unknown[] }) {
  const execute = jest.fn().mockResolvedValue(result);
  const returning = jest.fn().mockReturnValue({ execute });
  const andWhere = jest.fn().mockReturnValue({ returning });
  const where = jest.fn().mockReturnValue({ andWhere });
  const set = jest.fn().mockReturnValue({ where });
  const update = jest.fn().mockReturnValue({ set });
  return { execute, returning, andWhere, where, set, update };
}

// CLE-T-S03WEV 에서 엔진 스펙(`execution-engine.service.spec.ts`)에서 옮겼다. 엔진이 넘기던
// 재구동 · 세그먼트 기록 · 대기 초과 취소는 포트 mock 으로 본다.
describe('StuckExecutionRecoveryService', () => {
  let execChain: ReturnType<typeof updateChain>;
  let nodeChain: ReturnType<typeof updateChain>;
  let mockExecutionRepo: { createQueryBuilder: jest.Mock; find: jest.Mock };
  let mockNodeExecutionRepo: { createQueryBuilder: jest.Mock };
  let mockBus: { acquireLock: jest.Mock; releaseLock: jest.Mock };
  let port: {
    redriveStuckExecution: jest.Mock<Promise<void>, [string]>;
    recordRunningSegmentStart: jest.Mock<void, [string]>;
    markQueueWaitTimeout: jest.Mock<Promise<void>, [string]>;
  };
  let recovery: StuckExecutionRecoveryService;

  beforeEach(() => {
    // reclaimStuckRunningExecution 의 UPDATE … RETURNING id — 기본 2건 재점유.
    execChain = updateChain({ affected: 2, raw: [{ id: 'e1' }, { id: 'e2' }] });
    // closeOrphanRunningNodeExecutions 의 UPDATE … RETURNING id — 기본 0건.
    nodeChain = updateChain({ affected: 0, raw: [] });
    mockExecutionRepo = {
      createQueryBuilder: jest
        .fn()
        .mockReturnValue({ update: execChain.update }),
      // recoverOrphanPendingExecutions — 기본 대상 없음.
      find: jest.fn().mockResolvedValue([]),
    };
    mockNodeExecutionRepo = {
      createQueryBuilder: jest
        .fn()
        .mockReturnValue({ update: nodeChain.update }),
    };
    mockBus = {
      acquireLock: jest.fn().mockResolvedValue(true),
      releaseLock: jest.fn().mockResolvedValue(true),
    };
    // re-drive 는 fire-and-forget 그래프 실행 — 스텁으로 격리해 re-claim/트리거만 검증.
    port = {
      redriveStuckExecution: jest.fn().mockResolvedValue(undefined),
      recordRunningSegmentStart: jest.fn(),
      markQueueWaitTimeout: jest.fn().mockResolvedValue(undefined),
    };
    recovery = new StuckExecutionRecoveryService(
      mockExecutionRepo as unknown as Repository<Execution>,
      mockNodeExecutionRepo as unknown as Repository<NodeExecution>,
      mockBus as unknown as ContinuationBusService,
    );
  });

  const runScan = () =>
    recovery.recoverStuckExecutions(port as StuckRecoveryEnginePort);

  // PR3 (§7.1/§7.2 point3/§7.5 case B, 2026-07-04) — recoverStuckExecutions 가
  // stale RUNNING 을 "일괄 FAILED 마킹" 이 아니라 "started_at 원자 re-claim + case B
  // rehydration 재구동" 으로 전환됐다. 아래는 그 전환 + 회귀 가드.
  describe('recoverStuckExecutions (PR3 — 크래시 re-drive)', () => {
    it('stale (>30분) RUNNING 을 started_at 원자 re-claim 하고 각 row 를 re-drive 한다 (FAILED 마킹 안 함)', async () => {
      const before = Date.now();
      await runScan();

      expect(mockBus.acquireLock).toHaveBeenCalledWith(
        'exec:recover:lock',
        RECOVERY_LOCK_TTL_SECONDS,
      );
      expect(RECOVERY_LOCK_TTL_SECONDS).toBe(60);
      expect(execChain.update).toHaveBeenCalledWith(Execution);
      // re-claim: started_at=NOW() 로 소유권 이전 — status 를 FAILED 로 두지 않는다.
      const setArg = execChain.set.mock.calls[0][0] as Record<string, unknown>;
      expect(typeof setArg.startedAt).toBe('function');
      expect(setArg.status).toBeUndefined();
      expect(setArg.error).toBeUndefined();
      // 대상: RUNNING + started_at < threshold.
      expect(execChain.where).toHaveBeenCalledWith('status = :status', {
        status: ExecutionStatus.RUNNING,
      });
      expect(execChain.andWhere).toHaveBeenCalledWith(
        'started_at < :threshold',
        expect.objectContaining({ threshold: expect.any(Date) }),
      );
      const arg = (execChain.andWhere.mock.calls[0][1] as { threshold: Date })
        .threshold;
      expect(
        Math.abs(arg.getTime() - (before - STUCK_RECOVERY_STALE_MS)),
      ).toBeLessThan(CLOCK_TOLERANCE_MS);
      // 재점유된 각 id 를 re-drive + segment tracking baseline 기록.
      expect(port.redriveStuckExecution).toHaveBeenCalledTimes(2);
      expect(port.redriveStuckExecution).toHaveBeenCalledWith('e1');
      expect(port.redriveStuckExecution).toHaveBeenCalledWith('e2');
      expect(port.recordRunningSegmentStart).toHaveBeenCalledWith('e1');
      expect(port.recordRunningSegmentStart).toHaveBeenCalledWith('e2');
      expect(mockBus.releaseLock).toHaveBeenCalledWith('exec:recover:lock');
    });

    it('stale 임계는 30분이다', () => {
      expect(STUCK_RECOVERY_STALE_MS).toBe(30 * 60 * 1000);
    });

    it('옛 fail-only 회귀 가드 — set 에 status=FAILED / WORKER_HEARTBEAT_TIMEOUT 을 쓰지 않는다', async () => {
      await runScan();
      const flat = execChain.set.mock.calls
        .flat()
        .map((v) => JSON.stringify(v))
        .join(' ');
      expect(flat).not.toContain('failed');
      expect(flat).not.toContain('FAILED');
      expect(flat).not.toContain('WORKER_HEARTBEAT_TIMEOUT');
    });

    it('재점유 0건이면 re-drive 하지 않고 lock 만 해제한다', async () => {
      execChain.execute.mockResolvedValueOnce({ affected: 0, raw: [] });
      await runScan();
      expect(port.redriveStuckExecution).not.toHaveBeenCalled();
      expect(mockBus.releaseLock).toHaveBeenCalledWith('exec:recover:lock');
    });

    // 회귀 가드 — WAITING_FOR_INPUT 은 re-claim 대상에 절대 포함되지 않는다.
    it('WAITING_FOR_INPUT 은 re-claim WHERE 절에 절대 포함되지 않는다', async () => {
      await runScan();
      const flat = [
        ...execChain.where.mock.calls.flat(),
        ...execChain.andWhere.mock.calls.flat(),
      ]
        .map((v) => JSON.stringify(v))
        .join(' ');
      expect(flat).not.toContain('waiting_for_input');
      expect(flat).not.toContain('WAITING_FOR_INPUT');
    });

    it('lock 획득 실패 시 re-claim/re-drive 를 하지 않는다 (다른 인스턴스가 처리 중)', async () => {
      mockBus.acquireLock.mockResolvedValueOnce(false);
      await runScan();
      expect(mockBus.acquireLock).toHaveBeenCalledTimes(1);
      expect(execChain.update).not.toHaveBeenCalled();
      expect(port.redriveStuckExecution).not.toHaveBeenCalled();
      expect(mockBus.releaseLock).not.toHaveBeenCalled();
    });

    // 재구동은 fire-and-forget 이라 실패해도 스캔은 다음 단계로 간다.
    it('재구동이 reject 해도 스캔은 throw 하지 않고 error 로그를 남긴 뒤 다음 단계를 돈다', async () => {
      port.redriveStuckExecution.mockRejectedValueOnce(new Error('boom'));
      const logger = (
        recovery as unknown as { logger: { error: (m: string) => void } }
      ).logger;
      const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
      try {
        await expect(runScan()).resolves.toBeUndefined();
        await new Promise((r) => setImmediate(r));
        expect(
          errorSpy.mock.calls.some((c) =>
            String(c[0]).includes('Crash re-drive failed for execution e1'),
          ),
        ).toBe(true);
        expect(mockExecutionRepo.find).toHaveBeenCalled();
        expect(nodeChain.update).toHaveBeenCalled();
      } finally {
        errorSpy.mockRestore();
      }
    });

    // re-claim DB 오류 시 lock 누수 방지 (try/finally).
    it('re-claim DB 오류가 발생해도 lock 을 해제하고 오류를 전파한다', async () => {
      execChain.execute.mockRejectedValueOnce(new Error('db down'));
      await expect(runScan()).rejects.toThrow('db down');
      expect(mockBus.releaseLock).toHaveBeenCalledWith('exec:recover:lock');
    });

    it('단계 순서는 재점유 → orphan pending → 노드 실행 행 정리다', async () => {
      const order: string[] = [];
      execChain.execute.mockImplementationOnce(() => {
        order.push('reclaim');
        return Promise.resolve({ affected: 0, raw: [] });
      });
      mockExecutionRepo.find.mockImplementationOnce(() => {
        order.push('pending');
        return Promise.resolve([]);
      });
      nodeChain.execute.mockImplementationOnce(() => {
        order.push('orphan-node');
        return Promise.resolve({ raw: [] });
      });
      mockBus.releaseLock.mockImplementationOnce(() => {
        order.push('release');
        return Promise.resolve(true);
      });
      await runScan();
      expect(order).toEqual(['reclaim', 'pending', 'orphan-node', 'release']);
    });
  });

  // CLE-T-CCEQEC — 종결된 실행 아래 running 으로 남은 노드 실행 행을 부팅 스캔이 거둔다.
  // SQL 의미(부모 체인 · Background 제외)는 실제 DB 가 있는 e2e
  // (test/execution-crash-redrive.e2e-spec.ts)가 확인한다. 여기서는 스캔에 붙는 위치,
  // 조건부 UPDATE 모양, 넘기는 임계값과 상태 목록, 실패가 부팅을 막지 않는 것을 고정한다.
  describe('closeOrphanRunningNodeExecutions (CLE-T-CCEQEC 부팅 스캔 백스톱)', () => {
    beforeEach(() => {
      // 재점유 0건(재구동 없음).
      execChain.execute.mockResolvedValue({ affected: 0, raw: [] });
      // 이 단계의 UPDATE … RETURNING id — 기본 2건 마감.
      nodeChain.execute.mockResolvedValue({
        affected: 2,
        raw: [{ id: 'n1' }, { id: 'n2' }],
      });
    });

    it('재점유할 실행이 없어도 종결된 실행 아래 30분 넘은 running 노드 행을 failed 로 마감한다', async () => {
      const before = Date.now();
      await runScan();

      expect(nodeChain.update).toHaveBeenCalledWith(NodeExecution);
      const setArg = nodeChain.set.mock.calls[0][0] as {
        status: unknown;
        error: { message: string };
        finishedAt: unknown;
      };
      expect(setArg.status).toBe(NodeExecutionStatus.FAILED);
      expect(setArg.error.message).toContain('boot recovery scan');
      expect(setArg.finishedAt).toBeInstanceOf(Date);
      // 조건부 UPDATE — 그 사이 마감된 행은 건드리지 않는다.
      expect(nodeChain.where).toHaveBeenCalledWith('status = :running', {
        running: NodeExecutionStatus.RUNNING,
      });
      expect(nodeChain.returning).toHaveBeenCalledWith('id');

      const [subquery, params] = nodeChain.andWhere.mock.calls[0] as [
        string,
        {
          orphanThreshold: Date;
          orphanTerminalStatuses: string[];
          orphanBackgroundType: string;
          orphanMaxDepth: number;
        },
      ];
      // 노드 행 started_at 30분(STUCK_RECOVERY_STALE_MS 재사용).
      expect(subquery).toContain('ne.started_at < :orphanThreshold');
      expect(
        Math.abs(
          params.orphanThreshold.getTime() - (before - STUCK_RECOVERY_STALE_MS),
        ),
      ).toBeLessThan(CLOCK_TOLERANCE_MS);
      // 부모 실행이 종결 상태일 때만. 대기 · 실행 중 · 대기열 실행은 빠진다.
      expect(subquery).toContain('e.status IN (:...orphanTerminalStatuses)');
      expect([...params.orphanTerminalStatuses].sort()).toEqual(
        [
          ExecutionStatus.CANCELLED,
          ExecutionStatus.COMPLETED,
          ExecutionStatus.FAILED,
        ].sort(),
      );
      // 부모 체인에 Background 노드 행이 있는 본문 행은 뺀다.
      expect(subquery).toContain('parent_node_execution_id');
      expect(subquery).toContain('n.type = :orphanBackgroundType');
      expect(params.orphanBackgroundType).toBe('background');
      // 부모 체인 깊이 한도는 서브 워크플로우 재귀 한도보다 커야 정상 체인이 잘리지 않는다.
      expect(params.orphanMaxDepth).toBeGreaterThan(
        SUB_WORKFLOW_MAX_RECURSION_DEPTH,
      );
      // UpdateQueryBuilder 는 접두사 없는 낱말 중 NodeExecution 속성 이름(execution · node)을
      // 컬럼 이름(execution_id · node_id)으로 바꿔 쓴다. 테이블 이름은 모두 따옴표로 감싸야 한다.
      const tableRefs = [...subquery.matchAll(/\b(?:FROM|JOIN)\s+(\S+)/g)].map(
        (m) => m[1],
      );
      expect(tableRefs.length).toBeGreaterThan(0);
      for (const ref of tableRefs) {
        if (ref === 'candidate' || ref === 'ancestor') continue; // CTE 이름
        expect(ref).toMatch(/^"[a-z_]+"$/);
      }
      expect(mockBus.releaseLock).toHaveBeenCalledWith('exec:recover:lock');
    });

    it('마감 단계가 실패해도 부팅 스캔은 throw 하지 않고 lock 을 해제한다 (오류는 error 로그)', async () => {
      nodeChain.execute.mockRejectedValueOnce(new Error('db hiccup'));
      const logger = (
        recovery as unknown as { logger: { error: (m: string) => void } }
      ).logger;
      const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
      try {
        await expect(runScan()).resolves.toBeUndefined();
        expect(
          errorSpy.mock.calls.some((c) => String(c[0]).includes('db hiccup')),
        ).toBe(true);
        expect(mockBus.releaseLock).toHaveBeenCalledWith('exec:recover:lock');
      } finally {
        errorSpy.mockRestore();
      }
    });

    it('lock 을 얻지 못하면 마감 단계도 돌지 않는다', async () => {
      mockBus.acquireLock.mockResolvedValueOnce(false);
      await runScan();
      expect(nodeChain.update).not.toHaveBeenCalled();
    });
  });

  // §8 orphan pending backstop (2026-07-04) — admission 재큐 job 소실로 재-pick up
  // 안 되는 대기 초과 pending 을 recoverStuckExecutions 부팅 스캔이 wait-timeout cancel.
  describe('recoverOrphanPendingExecutions (orphan pending backstop §8)', () => {
    beforeEach(() => {
      execChain.execute.mockResolvedValue({ affected: 0, raw: [] });
    });

    it('대기 한도 초과 pending(queued_at < now - timeout) 을 markQueueWaitTimeout 으로 cancel 한다', async () => {
      mockExecutionRepo.find.mockResolvedValueOnce([
        { id: 'p1' },
        { id: 'p2' },
      ]);
      await runScan();
      // 대상 필터: status=PENDING + queued_at < threshold(LessThan operator).
      const findArg = mockExecutionRepo.find.mock.calls[0][0] as {
        where: { status: unknown; queuedAt: unknown };
      };
      expect(findArg.where.status).toBe(ExecutionStatus.PENDING);
      expect(findArg.where.queuedAt).toBeDefined();
      expect(port.markQueueWaitTimeout).toHaveBeenCalledWith('p1');
      expect(port.markQueueWaitTimeout).toHaveBeenCalledWith('p2');
      expect(port.markQueueWaitTimeout).toHaveBeenCalledTimes(2);
    });

    it('초과 pending 이 없으면 아무 것도 cancel 하지 않는다', async () => {
      mockExecutionRepo.find.mockResolvedValueOnce([]);
      await runScan();
      expect(port.markQueueWaitTimeout).not.toHaveBeenCalled();
    });

    it('recoverStuckExecutions 는 stale running 0건이어도 orphan pending 스캔을 수행한다 (early-return 제거)', async () => {
      mockExecutionRepo.find.mockResolvedValueOnce([{ id: 'op' }]);
      await runScan();
      expect(port.redriveStuckExecution).not.toHaveBeenCalled();
      expect(port.markQueueWaitTimeout).toHaveBeenCalledWith('op');
      expect(mockBus.releaseLock).toHaveBeenCalled();
    });
  });
});
