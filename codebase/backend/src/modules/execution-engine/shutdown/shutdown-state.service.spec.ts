import { WorkerHost } from '@nestjs/bullmq';
import type { DiscoveryService } from '@nestjs/core';
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

/** BullMQ `Worker` 에서 종료 처리가 부르는 두 메서드만 흉내 낸다. */
interface FakeWorker {
  name: string;
  pause: jest.Mock<Promise<void>, [boolean?]>;
  close: jest.Mock<Promise<void>, [boolean?]>;
}

/**
 * `busy` 면 진행 중 작업이 있는 워커다. `pause()`(진행 중 작업을 기다리는 형태)는 `finishJobs()` 를 부를 때까지
 * 끝나지 않는다. BullMQ `Worker.pause(false)` 가 `whenCurrentJobsFinished` 를 기다리는 것과 같다.
 */
function makeWorker(
  name: string,
  busy: boolean,
): { worker: FakeWorker; finishJobs: () => void } {
  let finish: () => void = () => undefined;
  const jobsDone = busy
    ? new Promise<void>((resolve) => {
        finish = resolve;
      })
    : Promise.resolve();
  const worker: FakeWorker = {
    name,
    pause: jest.fn((doNotWaitActive?: boolean) =>
      doNotWaitActive ? Promise.resolve() : jobsDone,
    ),
    close: jest.fn(() => Promise.resolve()),
  };
  return { worker, finishJobs: () => finish() };
}

/** `@nestjs/bullmq` 의 BullExplorer 가 하듯 `_worker` 를 채운 processor 인스턴스. */
function hostFor(worker: FakeWorker): WorkerHost {
  const host = Object.create(WorkerHost.prototype) as WorkerHost;
  Object.defineProperty(host, '_worker', { value: worker });
  return host;
}

function discoveryOf(instances: unknown[]): DiscoveryService {
  return {
    getProviders: () => instances.map((instance) => ({ instance })),
  } as unknown as DiscoveryService;
}

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

  const buildService = (
    graceMs: number,
    pollMs = 10,
    discovery?: DiscoveryService,
  ) =>
    new ShutdownStateService(
      executionRepo as Repository<Execution>,
      nodeExecutionRepo as Repository<NodeExecution>,
      graceMs,
      pollMs,
      discovery,
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

  // CLE-T-9YHJSD — Nest 는 onModuleDestroy 단계에서 @nestjs/bullmq 가 워커를 close 하고(진행 중 작업을 시간 한도
  // 없이 기다린다) 그 뒤에야 onApplicationShutdown 이 돈다. 그래서 종료 표시 · 503 · grace 를 onModuleDestroy 로
  // 당기고 워커 대기에도 grace 한도를 건다. 이 서비스의 모듈(ExecutionEngineModule)은 전역 BullModule 보다 먼저
  // onModuleDestroy 를 받는다.
  describe('onModuleDestroy — 워커 close 보다 먼저 종료를 시작한다', () => {
    it('호출 즉시 isShuttingDown 이 true 가 되고 모든 워커가 새 작업을 멈춘 채 진행 중 작업을 기다린다', async () => {
      const run = makeWorker('execution-run', true);
      const other = makeWorker('schedule', false);
      service = buildService(
        5_000,
        10,
        discoveryOf([hostFor(run.worker), hostFor(other.worker)]),
      );

      const destroying = service.onModuleDestroy();

      // 첫 await 전에 표시한다. 그래야 워커를 기다리는 동안 수동 실행 진입점이 503 을 낸다.
      expect(service.isShuttingDown).toBe(true);
      // pause() 인자가 없으면(= doNotWaitActive 아님) BullMQ 가 진행 중 작업이 끝날 때까지 기다린다.
      expect(run.worker.pause).toHaveBeenCalledTimes(1);
      expect(run.worker.pause.mock.calls[0][0]).toBeFalsy();
      expect(other.worker.pause).toHaveBeenCalledTimes(1);

      let settled = false;
      void destroying.then(() => {
        settled = true;
      });
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(settled).toBe(false);

      run.finishJobs();
      await destroying;

      // 정상 close 는 BullExplorer 몫이다. 이 서비스는 grace 를 넘겼을 때만 강제 close 한다.
      expect(run.worker.close).not.toHaveBeenCalled();
      expect(other.worker.close).not.toHaveBeenCalled();
      expect(nodeExecutionUpdateMock).not.toHaveBeenCalled();
      expect(executionUpdateMock).not.toHaveBeenCalled();
    });

    it('진행 중 작업이 grace 안에 끝나면 grace 를 다 채우지 않고 반환한다', async () => {
      const run = makeWorker('execution-run', true);
      service = buildService(5_000, 10, discoveryOf([hostFor(run.worker)]));
      setTimeout(() => run.finishJobs(), 50);

      const startedAt = Date.now();
      await service.onModuleDestroy();

      expect(Date.now() - startedAt).toBeLessThan(2_000);
      expect(run.worker.close).not.toHaveBeenCalled();
    });

    it('워커 작업이 grace 를 넘기면 그때 멈추고 추적 중인 노드 실행을 SERVER_INTERRUPTED 로 표시한 뒤 워커를 강제 close 한다', async () => {
      const run = makeWorker('execution-run', true);
      service = buildService(150, 10, discoveryOf([hostFor(run.worker)]));
      service.registerInFlight('ne-1', 'exec-1');

      const startedAt = Date.now();
      await service.onModuleDestroy();
      const elapsed = Date.now() - startedAt;

      expect(elapsed).toBeGreaterThanOrEqual(140);
      expect(elapsed).toBeLessThan(2_000);
      expect(nodeExecutionUpdateMock).toHaveBeenCalledTimes(1);
      expect(executionUpdateMock).toHaveBeenCalledTimes(1);
      // force=true 여야 BullMQ 가 진행 중 작업을 기다리지 않는다. BullMQ 는 첫 close 호출의 promise 를
      // 재사용하므로 뒤이어 BullExplorer 가 부르는 close() 도 이 강제 close 로 끝난다.
      expect(run.worker.close).toHaveBeenCalledWith(true);
      // 표시를 먼저 한다. 강제 close 뒤 다른 인스턴스로 재배달된 작업은 실행이 failed 라 버려진다.
      expect(nodeExecutionUpdateMock.mock.invocationCallOrder[0]).toBeLessThan(
        run.worker.close.mock.invocationCallOrder[0],
      );
    });

    it('노드 실행 추적이 비어도 워커 작업이 남아 있으면 grace 까지 기다린다 (노드와 노드 사이)', async () => {
      const run = makeWorker('execution-run', true);
      service = buildService(150, 10, discoveryOf([hostFor(run.worker)]));

      const startedAt = Date.now();
      await service.onModuleDestroy();

      expect(Date.now() - startedAt).toBeGreaterThanOrEqual(140);
      expect(run.worker.close).toHaveBeenCalledWith(true);
      // 표시할 노드 실행이 없으면 UPDATE 도 없다.
      expect(nodeExecutionUpdateMock).not.toHaveBeenCalled();
      expect(executionUpdateMock).not.toHaveBeenCalled();
    });

    it('워커가 비어도 추적 중인 노드 실행이 남아 있으면 기다린다 (큐를 거치지 않는 실행)', async () => {
      const idle = makeWorker('execution-run', false);
      service = buildService(5_000, 10, discoveryOf([hostFor(idle.worker)]));
      service.registerInFlight('ne-1', 'exec-1');
      setTimeout(() => service.unregisterInFlight('ne-1'), 50);

      const startedAt = Date.now();
      await service.onModuleDestroy();
      const elapsed = Date.now() - startedAt;

      expect(elapsed).toBeGreaterThanOrEqual(40);
      expect(elapsed).toBeLessThan(2_000);
      expect(idle.worker.close).not.toHaveBeenCalled();
      expect(nodeExecutionUpdateMock).not.toHaveBeenCalled();
    });

    it('grace 시계는 하나다 — onModuleDestroy 뒤의 onApplicationShutdown 은 다시 기다리지도 표시하지도 않는다', async () => {
      const run = makeWorker('execution-run', true);
      service = buildService(150, 10, discoveryOf([hostFor(run.worker)]));
      service.registerInFlight('ne-1', 'exec-1');
      await service.onModuleDestroy();
      nodeExecutionUpdateMock.mockClear();
      executionUpdateMock.mockClear();
      const closeCalls = run.worker.close.mock.calls.length;

      const startedAt = Date.now();
      await service.onApplicationShutdown('SIGTERM');

      expect(Date.now() - startedAt).toBeLessThan(100);
      expect(nodeExecutionUpdateMock).not.toHaveBeenCalled();
      expect(executionUpdateMock).not.toHaveBeenCalled();
      expect(run.worker.close.mock.calls.length).toBe(closeCalls);
    });

    it('onModuleDestroy 가 기다리는 중에 onApplicationShutdown 이 와도 같은 종료를 기다린다', async () => {
      const run = makeWorker('execution-run', true);
      service = buildService(5_000, 10, discoveryOf([hostFor(run.worker)]));

      const destroying = service.onModuleDestroy();
      const shuttingDown = service.onApplicationShutdown('SIGTERM');
      run.finishJobs();
      await Promise.all([destroying, shuttingDown]);

      expect(run.worker.pause).toHaveBeenCalledTimes(1);
    });

    it('초기화되지 않은 WorkerHost 와 WorkerHost 가 아닌 provider 는 건너뛴다', async () => {
      const run = makeWorker('execution-run', false);
      const uninitialized = Object.create(WorkerHost.prototype) as WorkerHost;
      service = buildService(
        1_000,
        10,
        discoveryOf([uninitialized, {}, null, undefined, hostFor(run.worker)]),
      );

      await expect(service.onModuleDestroy()).resolves.toBeUndefined();
      expect(run.worker.pause).toHaveBeenCalledTimes(1);
    });

    it('pause 가 실패해도 종료를 막지 않는다', async () => {
      const run = makeWorker('execution-run', false);
      run.worker.pause.mockRejectedValueOnce(new Error('Connection is closed'));
      service = buildService(1_000, 10, discoveryOf([hostFor(run.worker)]));

      await expect(service.onModuleDestroy()).resolves.toBeUndefined();
      expect(service.isShuttingDown).toBe(true);
    });

    it('강제 close 가 실패해도 종료를 막지 않는다', async () => {
      const run = makeWorker('execution-run', true);
      run.worker.close.mockRejectedValueOnce(new Error('Connection is closed'));
      service = buildService(100, 10, discoveryOf([hostFor(run.worker)]));

      await expect(service.onModuleDestroy()).resolves.toBeUndefined();
      expect(run.worker.close).toHaveBeenCalledWith(true);
    });

    it('DiscoveryService 가 없으면 노드 실행 추적만 기다린다', async () => {
      service = buildService(5_000, 10);
      service.registerInFlight('ne-1', 'exec-1');
      setTimeout(() => service.unregisterInFlight('ne-1'), 30);

      await service.onModuleDestroy();

      expect(service.isShuttingDown).toBe(true);
      expect(nodeExecutionUpdateMock).not.toHaveBeenCalled();
    });
  });
});
