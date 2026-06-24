import { ShutdownStateService } from './shutdown-state.service';
import {
  Execution,
  ExecutionStatus,
} from '../../executions/entities/execution.entity';
import {
  NodeExecution,
  NodeExecutionStatus,
} from '../../node-executions/entities/node-execution.entity';
import type { Repository } from 'typeorm';

describe('ShutdownStateService', () => {
  let executionRepo: Pick<Repository<Execution>, 'createQueryBuilder'>;
  let nodeExecutionRepo: Pick<Repository<NodeExecution>, 'createQueryBuilder'>;
  let executionUpdateMock: jest.Mock;
  let nodeExecutionUpdateMock: jest.Mock;
  let service: ShutdownStateService;

  beforeEach(() => {
    executionUpdateMock = jest.fn().mockResolvedValue({ affected: 0 });
    nodeExecutionUpdateMock = jest.fn().mockResolvedValue({ affected: 0 });

    const buildChain = (executor: jest.Mock) => ({
      update: jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            andWhere: jest.fn().mockReturnValue({
              execute: executor,
            }),
          }),
        }),
      }),
    });

    executionRepo = {
      createQueryBuilder: jest
        .fn()
        .mockReturnValue(buildChain(executionUpdateMock)),
    };
    nodeExecutionRepo = {
      createQueryBuilder: jest
        .fn()
        .mockReturnValue(buildChain(nodeExecutionUpdateMock)),
    };
  });

  const buildService = (graceMs: number, pollMs = 10) =>
    new ShutdownStateService(
      executionRepo as Repository<Execution>,
      nodeExecutionRepo as Repository<NodeExecution>,
      graceMs,
      pollMs,
    );

  // Phase 1.2 — 기본 상태와 in-flight 등록/해제.
  describe('isShuttingDown / inFlight registry', () => {
    beforeEach(() => {
      service = buildService(100);
    });

    it('초기에는 shutting down 아님', () => {
      expect(service.isShuttingDown).toBe(false);
      expect(service.inFlightCount).toBe(0);
    });

    it('register/unregister 가 inFlightCount 를 정확히 반영', () => {
      service.registerInFlight('ne-1', 'exec-1');
      service.registerInFlight('ne-2', 'exec-1');
      expect(service.inFlightCount).toBe(2);
      service.unregisterInFlight('ne-1');
      expect(service.inFlightCount).toBe(1);
      service.unregisterInFlight('ne-2');
      expect(service.inFlightCount).toBe(0);
    });

    it('retryAfterSec 은 graceMs 를 초로 ceil', () => {
      expect(buildService(30000).retryAfterSec).toBe(30);
      expect(buildService(30500).retryAfterSec).toBe(31);
      expect(buildService(999).retryAfterSec).toBe(1);
    });
  });

  // Phase 1.2 — onApplicationShutdown 동작.
  describe('onApplicationShutdown', () => {
    it('in-flight 가 없으면 즉시 종료하고 isShuttingDown true', async () => {
      service = buildService(1000);
      await service.onApplicationShutdown('SIGTERM');
      expect(service.isShuttingDown).toBe(true);
      // 마킹할 게 없으므로 UPDATE 호출 자체가 없어야 한다.
      expect(executionUpdateMock).not.toHaveBeenCalled();
      expect(nodeExecutionUpdateMock).not.toHaveBeenCalled();
    });

    it('graceMs 안에 in-flight 가 drain 되면 UPDATE 호출 없이 종료', async () => {
      service = buildService(500, 10);
      service.registerInFlight('ne-1', 'exec-1');
      // 50ms 후 drain
      setTimeout(() => service.unregisterInFlight('ne-1'), 50);
      await service.onApplicationShutdown('SIGTERM');
      expect(service.isShuttingDown).toBe(true);
      expect(service.inFlightCount).toBe(0);
      expect(executionUpdateMock).not.toHaveBeenCalled();
      expect(nodeExecutionUpdateMock).not.toHaveBeenCalled();
    });

    it('graceMs 초과 시 남은 in-flight 를 SERVER_INTERRUPTED 로 마킹', async () => {
      service = buildService(50, 10);
      service.registerInFlight('ne-1', 'exec-1');
      service.registerInFlight('ne-2', 'exec-2');

      await service.onApplicationShutdown('SIGTERM');

      expect(service.isShuttingDown).toBe(true);
      // 두 repo 모두 한 번씩 createQueryBuilder → update chain 호출
      expect(nodeExecutionRepo.createQueryBuilder).toHaveBeenCalled();
      expect(executionRepo.createQueryBuilder).toHaveBeenCalled();

      // set 인자에 status=FAILED + error.code='SERVER_INTERRUPTED' 가 들어가는지
      // 검증 — chain 의 set 호출 인자를 jest mock 으로 가로채자.
      // 검증 단순화를 위해 buildChain 의 set 을 spy 로 노출하는 대신,
      // createQueryBuilder 의 결과를 다시 grab 한다.
      const neChain = (nodeExecutionRepo.createQueryBuilder as jest.Mock).mock
        .results[0].value as {
        update: jest.Mock;
      };
      const setArgs = (
        neChain.update.mock.results[0].value as {
          set: jest.Mock;
        }
      ).set.mock.calls[0][0] as Record<string, unknown>;
      expect(setArgs.status).toBe(NodeExecutionStatus.FAILED);
      expect((setArgs.error as { code: string }).code).toBe(
        'SERVER_INTERRUPTED',
      );
    });

    it('shutdown 중(세그먼트 완료 진행 중) register 된 노드도 추적되어 grace 만료 시 마킹된다 (M-2 — §11.4 보존)', async () => {
      service = buildService(50, 10);
      service.registerInFlight('ne-early', 'exec-1');
      const shutdownPromise = service.onApplicationShutdown('SIGTERM');
      // onApplicationShutdown 은 markShutdown 을 동기 실행 후 waitForDrain 에서 await.
      expect(service.isShuttingDown).toBe(true);
      // §11.2 "현재 세그먼트를 완료까지 진행" 동안 in-process while-loop 가 다음 노드를
      // 시작 → registerInFlight 호출. 옛 early-return 은 이를 누락해 zombie RUNNING 을
      // 남겼다. 이제는 등록되어 drain 대상에 포함된다.
      service.registerInFlight('ne-late', 'exec-1');
      expect(service.inFlightCount).toBe(2);

      await shutdownPromise;

      // grace 만료 → 두 노드 모두 SERVER_INTERRUPTED 마킹 대상. WHERE 절에 둘 다 포함.
      // (mock chain 을 직접 순회하므로, 단계가 끊기면 undefined 오탐 대신 명시 실패하도록
      //  중간 단계를 toBeDefined/toHaveBeenCalled 로 가드한다.)
      const neChain = (nodeExecutionRepo.createQueryBuilder as jest.Mock).mock
        .results[0]?.value as { update: jest.Mock } | undefined;
      expect(neChain).toBeDefined();
      const whereCall = (
        neChain!.update.mock.results[0].value as { set: jest.Mock }
      ).set.mock.results[0].value as { where: jest.Mock };
      expect(whereCall.where).toHaveBeenCalled();
      const whereArgs = JSON.stringify(whereCall.where.mock.calls[0]);
      expect(whereArgs).toContain('ne-early');
      expect(whereArgs).toContain('ne-late');
    });

    it('shutdown 중 register 된 노드가 grace 내 drain(정상 완료)되면 마킹하지 않는다 (M-2 — happy-path)', async () => {
      service = buildService(300, 10);
      // shutdown 진입 시 drain 대상이 있어야 drain 루프에 진입한다 (inFlightCount=0 이면 즉시 반환).
      service.registerInFlight('ne-early', 'exec-1');
      const shutdownPromise = service.onApplicationShutdown('SIGTERM');
      expect(service.isShuttingDown).toBe(true);
      // §11.2 세그먼트 완료 진행 중 다음 노드 시작(register) — early-return 제거로 추적됨.
      service.registerInFlight('ne-late', 'exec-1');
      expect(service.inFlightCount).toBe(2);
      // 두 노드 모두 grace 내 정상 완료(unregister) → drain 성공.
      setTimeout(() => {
        service.unregisterInFlight('ne-early');
        service.unregisterInFlight('ne-late');
      }, 30);

      await shutdownPromise;

      // drain 성공 → 정상 완료 노드를 spurious 마킹하지 않는다 (UPDATE 미호출).
      expect(service.inFlightCount).toBe(0);
      expect(nodeExecutionUpdateMock).not.toHaveBeenCalled();
      expect(executionUpdateMock).not.toHaveBeenCalled();
    });
  });

  // Phase 1.2 — SQL WHERE 절이 정확한 nodeExecutionId 만 지정해야 함.
  // (다른 인스턴스의 RUNNING row 를 잘못 건드리면 안 된다.)
  it('SQL UPDATE WHERE 절은 등록된 nodeExecutionId 만 지정', async () => {
    service = buildService(30, 10);
    service.registerInFlight('ne-mine-1', 'exec-mine-1');
    service.registerInFlight('ne-mine-2', 'exec-mine-2');

    await service.onApplicationShutdown('SIGTERM');

    const neChain = (nodeExecutionRepo.createQueryBuilder as jest.Mock).mock
      .results[0].value as { update: jest.Mock };
    const whereCall = (
      neChain.update.mock.results[0].value as { set: jest.Mock }
    ).set.mock.results[0].value as { where: jest.Mock };
    const whereArgs = whereCall.where.mock.calls[0];
    // 'id IN (:...ids)' 같은 패턴으로 호출되었는지
    expect(JSON.stringify(whereArgs)).toContain('ne-mine-1');
    expect(JSON.stringify(whereArgs)).toContain('ne-mine-2');
  });

  // 회귀 가드 — 두 번째 SIGTERM 이 와도 중복 마킹/double-shutdown 없음.
  it('shutdown 멱등성 — 두 번째 호출은 noop', async () => {
    service = buildService(30);
    await service.onApplicationShutdown('SIGTERM');
    executionUpdateMock.mockClear();
    nodeExecutionUpdateMock.mockClear();
    await service.onApplicationShutdown('SIGTERM');
    expect(executionUpdateMock).not.toHaveBeenCalled();
    expect(nodeExecutionUpdateMock).not.toHaveBeenCalled();
  });

  // 정상 시나리오 sanity — ExecutionStatus.FAILED 값 검증 (lint-only)
  it('status enum 참조 sanity', () => {
    expect(ExecutionStatus.FAILED).toBe('failed');
  });

  // W-11 fix (SUMMARY#W-11): markRemainingAsInterrupted 내 DB UPDATE 실패 시
  // graceful degradation 검증 — throw 가 aApplicationShutdown 밖으로 누출되지 않아야 함.
  describe('DB UPDATE 실패 시 graceful degradation', () => {
    it('NodeExecution UPDATE 실패 시 에러를 throw 하지 않고 로그만 남김', async () => {
      nodeExecutionUpdateMock.mockRejectedValueOnce(new Error('DB 연결 실패'));
      service = buildService(30, 10);
      service.registerInFlight('ne-fail', 'exec-fail');

      // 외부로 throw 되면 안 됨 — graceful degradation.
      await expect(
        service.onApplicationShutdown('SIGTERM'),
      ).resolves.not.toThrow();
    });

    it('Execution UPDATE 실패 시 에러를 throw 하지 않고 로그만 남김', async () => {
      executionUpdateMock.mockRejectedValueOnce(
        new Error('Execution DB 연결 실패'),
      );
      service = buildService(30, 10);
      service.registerInFlight('ne-exec-fail', 'exec-exec-fail');

      await expect(
        service.onApplicationShutdown('SIGTERM'),
      ).resolves.not.toThrow();
    });
  });
});
