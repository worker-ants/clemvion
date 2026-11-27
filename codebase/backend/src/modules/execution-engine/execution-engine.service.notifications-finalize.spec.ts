import { ExecutionEngineService } from './execution-engine.service';
import { ExecutionStatus } from '../executions/entities/execution.entity';
import {
  type EngineServiceHarness,
  createEngineServiceHarness,
} from './__test-utils__/engine-service-harness';

/**
 * ExecutionEngineService 단위 테스트: 실패 알림 발송 · FAILED/CANCELLED 종결 · 알림 서비스 지연 해석.
 *
 * 옛 `execution-engine.service.spec.ts` 를 관심사별로 나눈 파일 가운데 하나다(CLE-T-YEDCJK).
 * 서비스 구성과 mock 레포지토리는 `__test-utils__/engine-service-harness.ts` 공용 하네스가 만든다.
 */
describe('ExecutionEngineService', () => {
  let h: EngineServiceHarness;
  let service: ExecutionEngineService;

  // Mock repositories
  let mockExecutionRepo: Record<string, jest.Mock>;
  let mockWorkflowRepo: Record<string, jest.Mock>;
  // 테스트가 다시 대입하는 `dbExecutionStatus` · `waitingRawRows` ·
  // `waitingQueryError` 는 mock 클로저가 읽는 하네스 필드라 `h.` 로 대입한다.

  // 서비스 구성 · mock 레포지토리는 `__test-utils__/engine-service-harness.ts` 공용 하네스.
  beforeEach(async () => {
    h = await createEngineServiceHarness();
    ({ service, mockExecutionRepo, mockWorkflowRepo } = h);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('dispatchExecutionFailedNotification (execution_failed, spec §1.1)', () => {
    // NotificationsService 는 @Optional 이라 본 스펙 셋업엔 미주입 — 각 케이스에서 직접
    // mock 주입. service 는 beforeEach 로 매 테스트 재생성되므로 mutation 누수 없음.
    async function callDispatch(
      execution: Record<string, unknown>,
      createMany: jest.Mock,
      channelMap?: Map<string, 'both' | 'in_app' | 'email' | null>,
    ): Promise<void> {
      (
        service as unknown as { notificationsService: unknown }
      ).notificationsService = {
        createMany,
        // 지정이 없으면 수신자마다 기본 채널(both)을 채운다.
        resolveNotificationChannels: jest
          .fn()
          .mockImplementation((ids: string[]) =>
            Promise.resolve(
              channelMap ?? new Map(ids.map((id) => [id, 'both' as const])),
            ),
          ),
      };
      await (
        service as unknown as {
          dispatchExecutionFailedNotification: (
            e: unknown,
            m: string,
          ) => Promise<void>;
        }
      ).dispatchExecutionFailedNotification(execution, 'boom');
    }

    it('top-level 실행 실패 → owner+executor 에게 execution_failed 발사', async () => {
      const createMany = jest.fn().mockResolvedValue(undefined);
      mockWorkflowRepo.findOne = jest.fn().mockResolvedValue({
        id: 'wf',
        name: 'W',
        workspaceId: 'ws',
        createdBy: 'owner',
      });

      await callDispatch(
        {
          id: 'ex-1',
          workflowId: 'wf',
          executedBy: 'runner',
          parentExecutionId: null,
        },
        createMany,
      );

      expect(createMany).toHaveBeenCalledTimes(1);
      const entries = createMany.mock.calls[0][0] as Array<
        Record<string, unknown>
      >;
      expect(entries.map((e) => e.userId).sort()).toEqual(['owner', 'runner']);
      expect(entries.every((e) => e.type === 'execution_failed')).toBe(true);
      // 딥링크 계약(href.ts §3.1): resource = workflow (execution id 아님).
      expect(entries[0]).toMatchObject({
        workspaceId: 'ws',
        resourceType: 'workflow',
        resourceId: 'wf',
        channel: 'both',
      });
    });

    it('executionFailedEmail=off(opt-out) 수신자는 channel 인앱만 (per-recipient)', async () => {
      const createMany = jest.fn().mockResolvedValue(undefined);
      mockWorkflowRepo.findOne = jest.fn().mockResolvedValue({
        id: 'wf',
        name: 'W',
        workspaceId: 'ws',
        createdBy: 'owner',
      });

      // owner 는 이메일 off → in_app, runner 는 기본 both.
      await callDispatch(
        {
          id: 'ex-pref',
          workflowId: 'wf',
          executedBy: 'runner',
          parentExecutionId: null,
        },
        createMany,
        new Map<string, 'both' | 'in_app'>([
          ['owner', 'in_app'],
          ['runner', 'both'],
        ]),
      );

      const entries = createMany.mock.calls[0][0] as Array<
        Record<string, unknown>
      >;
      const byUser = new Map(entries.map((e) => [e.userId, e.channel]));
      expect(byUser.get('owner')).toBe('in_app');
      expect(byUser.get('runner')).toBe('both');
    });

    it('인앱만 끈 수신자는 채널 email, 둘 다 끈 수신자는 건너뛴다 (CLE-T-EJFQ1Y)', async () => {
      const createMany = jest.fn().mockResolvedValue(undefined);
      mockWorkflowRepo.findOne = jest.fn().mockResolvedValue({
        id: 'wf',
        name: 'W',
        workspaceId: 'ws',
        createdBy: 'owner',
      });

      await callDispatch(
        {
          id: 'ex-off',
          workflowId: 'wf',
          executedBy: 'runner',
          parentExecutionId: null,
        },
        createMany,
        new Map<string, 'both' | 'in_app' | 'email' | null>([
          ['owner', 'email'],
          ['runner', null],
        ]),
      );

      const entries = createMany.mock.calls[0][0] as Array<
        Record<string, unknown>
      >;
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({ userId: 'owner', channel: 'email' });
    });

    it('수신자가 모두 둘 다 껐으면 알림을 만들지 않는다', async () => {
      const createMany = jest.fn().mockResolvedValue(undefined);
      mockWorkflowRepo.findOne = jest.fn().mockResolvedValue({
        id: 'wf',
        name: 'W',
        workspaceId: 'ws',
        createdBy: 'owner',
      });

      await callDispatch(
        {
          id: 'ex-none',
          workflowId: 'wf',
          executedBy: 'owner',
          parentExecutionId: null,
        },
        createMany,
        new Map<string, 'both' | 'in_app' | 'email' | null>([['owner', null]]),
      );

      expect(createMany).not.toHaveBeenCalled();
    });

    it('owner==executor 는 dedup 되어 1건', async () => {
      const createMany = jest.fn().mockResolvedValue(undefined);
      mockWorkflowRepo.findOne = jest.fn().mockResolvedValue({
        id: 'wf',
        name: 'W',
        workspaceId: 'ws',
        createdBy: 'same',
      });

      await callDispatch(
        {
          id: 'ex-2',
          workflowId: 'wf',
          executedBy: 'same',
          parentExecutionId: null,
        },
        createMany,
      );

      expect(createMany.mock.calls[0][0]).toHaveLength(1);
    });

    it('하위 실행(parentExecutionId 존재)은 발사 안 함 (background_failed 중복 회피)', async () => {
      const createMany = jest.fn();
      await callDispatch(
        {
          id: 'ex-3',
          workflowId: 'wf',
          executedBy: 'r',
          parentExecutionId: 'parent-exec',
        },
        createMany,
      );
      expect(createMany).not.toHaveBeenCalled();
    });

    it('notificationsService 미주입(@Optional) 이면 no-op — 예외 없음', async () => {
      // 기본 셋업엔 @Optional 이라 미주입(undefined). guard 로 조용히 리턴.
      await expect(
        (
          service as unknown as {
            dispatchExecutionFailedNotification: (
              e: unknown,
              m: string,
            ) => Promise<void>;
          }
        ).dispatchExecutionFailedNotification(
          {
            id: 'ex-4',
            workflowId: 'wf',
            executedBy: 'r',
            parentExecutionId: null,
          },
          'boom',
        ),
      ).resolves.toBeUndefined();
    });

    it('workflow 미존재 시 createMany 미호출', async () => {
      const createMany = jest.fn();
      mockWorkflowRepo.findOne = jest.fn().mockResolvedValue(null);
      await callDispatch(
        {
          id: 'ex-5',
          workflowId: 'wf',
          executedBy: 'r',
          parentExecutionId: null,
        },
        createMany,
      );
      expect(createMany).not.toHaveBeenCalled();
    });

    it('workflow 조회가 throw 해도 dispatch 는 reject 안 함 (best-effort)', async () => {
      const createMany = jest.fn();
      mockWorkflowRepo.findOne = jest
        .fn()
        .mockRejectedValue(new Error('db down'));
      await expect(
        callDispatch(
          {
            id: 'ex-6',
            workflowId: 'wf',
            executedBy: 'r',
            parentExecutionId: null,
          },
          createMany,
        ),
      ).resolves.toBeUndefined();
      expect(createMany).not.toHaveBeenCalled();
    });

    it('알림 메시지의 원본 예외를 새니타이징한다 (connection string redact — 이메일 노출 방어)', async () => {
      const createMany = jest.fn().mockResolvedValue(undefined);
      mockWorkflowRepo.findOne = jest.fn().mockResolvedValue({
        id: 'wf',
        name: 'W',
        workspaceId: 'ws',
        createdBy: 'owner',
      });
      (
        service as unknown as { notificationsService: unknown }
      ).notificationsService = {
        createMany,
        resolveNotificationChannels: jest
          .fn()
          .mockImplementation((ids: string[]) =>
            Promise.resolve(new Map(ids.map((id) => [id, 'both' as const]))),
          ),
      };
      await (
        service as unknown as {
          dispatchExecutionFailedNotification: (
            e: unknown,
            m: string,
          ) => Promise<void>;
        }
      ).dispatchExecutionFailedNotification(
        {
          id: 'ex-7',
          workflowId: 'wf',
          executedBy: 'owner',
          parentExecutionId: null,
        },
        'connect failed postgres://user:secret@db.internal:5432/app',
      );
      const entries = createMany.mock.calls[0][0] as Array<{ message: string }>;
      // sanitizeErrorMessage 가 적용됐으면 connection string 이 redact 된다.
      // 호출이 삭제/오배선되면 원본 URI 가 인앱+이메일로 노출 → 본 케이스가 실패.
      expect(entries[0].message).toContain('[REDACTED_URI]');
      expect(entries[0].message).not.toContain('postgres://');
      expect(entries[0].message).not.toContain('secret');
    });
  });

  describe('finalizeFailedExecution — 초기·재개 세그먼트 공유 FAILED 종결 (버그 A 회귀 가드)', () => {
    // runExecution catch(초기)·finalizeResumedExecutionOutcome(재개) 가 공유하는 공통 헬퍼.
    // 재개 경로 종결이 status 마킹 + DB save + EXECUTION_FAILED emit + execution_failed dispatch 를
    // 모두 수행하는지 직접 검증 — PR #841 버그 A(재개 경로 dispatch 누락) 재발 가드.
    it('재개(rehydrated) 종결이 status·save·EXECUTION_FAILED emit·execution_failed dispatch 를 모두 수행', async () => {
      const createMany = jest.fn().mockResolvedValue(undefined);
      mockWorkflowRepo.findOne = jest.fn().mockResolvedValue({
        id: 'wf',
        name: 'W',
        workspaceId: 'ws',
        createdBy: 'owner',
      });
      (
        service as unknown as { notificationsService: unknown }
      ).notificationsService = {
        createMany,
        resolveNotificationChannels: jest
          .fn()
          .mockImplementation((ids: string[]) =>
            Promise.resolve(new Map(ids.map((id) => [id, 'both' as const]))),
          ),
      };
      const eventEmitter = (
        service as unknown as { eventEmitter: { emitExecution: jest.Mock } }
      ).eventEmitter;
      const emitSpy = jest
        .spyOn(eventEmitter, 'emitExecution')
        .mockResolvedValue(undefined);
      const saved: Record<string, unknown> = {
        id: 'ex-fail-1',
        // ai-review CRITICAL #1 (2026-07-27, 6차 라운드) — FAILED 마킹이 이제
        // `updateExecutionStatus`(state-machine 가드) 를 거치므로 assertTransition
        // 이 유효한 시작 상태를 요구한다 (재개 세그먼트는 항상 RUNNING/WAITING_FOR_INPUT).
        status: ExecutionStatus.RUNNING,
        workflowId: 'wf',
        executedBy: 'owner',
        parentExecutionId: null,
        startedAt: new Date(),
      };

      await (
        service as unknown as {
          finalizeFailedExecution: (
            e: unknown,
            err: unknown,
            o?: unknown,
          ) => Promise<void>;
        }
      ).finalizeFailedExecution(saved, new Error('boom'), { rehydrated: true });

      expect(saved.status).toBe(ExecutionStatus.FAILED);
      // CRITICAL #1 — guarded UPDATE(raw query) 경유로 바뀌어 더 이상 full-entity
      // `.save()` 를 호출하지 않는다.
      expect(mockExecutionRepo.query).toHaveBeenCalledWith(
        expect.stringMatching(/UPDATE execution/),
        expect.arrayContaining([ExecutionStatus.FAILED]),
      );
      // EXECUTION_FAILED WS emit (payload 에 FAILED 상태 포함)
      expect(emitSpy).toHaveBeenCalledWith(
        'ex-fail-1',
        expect.anything(),
        expect.objectContaining({ status: ExecutionStatus.FAILED }),
      );
      // 재개 세그먼트 경로에서도 execution_failed 발사 — 버그 A 가 누락시켰던 바로 그 dispatch
      expect(createMany).toHaveBeenCalledTimes(1);
      expect(
        (createMany.mock.calls[0][0] as Array<{ type: string }>)[0].type,
      ).toBe('execution_failed');
    });

    // ai-review CRITICAL #1 (2026-07-27, 6차 라운드, concurrency) — 동시 Stop 이
    // 이미 CANCELLED 로 커밋한 뒤 (finalizeAiNode isFailed 가드 통과 이후) 자연
    // 실패가 이 함수에 도달해도, guarded UPDATE(0행 매칭) 가 재마킹을 막아야
    // 한다. 가드(`updateExecutionStatus` 위임)를 제거하고 다시 무조건
    // `executionRepository.save()` 로 되돌리면 이 테스트가 RED 로 떨어진다
    // (emit/dispatch 가 다시 무조건 발사됨).
    it('동시 cancel 이 이미 terminal 로 선점(guarded UPDATE 0행) → FAILED 재마킹·EXECUTION_FAILED emit·execution_failed dispatch 를 모두 skip', async () => {
      const createMany = jest.fn().mockResolvedValue(undefined);
      (
        service as unknown as { notificationsService: unknown }
      ).notificationsService = {
        createMany,
        resolveNotificationChannels: jest
          .fn()
          .mockImplementation((ids: string[]) =>
            Promise.resolve(new Map(ids.map((id) => [id, 'both' as const]))),
          ),
      };
      const eventEmitter = (
        service as unknown as { eventEmitter: { emitExecution: jest.Mock } }
      ).eventEmitter;
      const emitSpy = jest
        .spyOn(eventEmitter, 'emitExecution')
        .mockResolvedValue(undefined);
      // 행 잠금 0행 = stop() 이 이미 CANCELLED 로 마감(guarded UPDATE 의 WHERE
      // status IN (non-terminal) 이 매칭 실패).
      mockExecutionRepo.query.mockResolvedValueOnce([]);
      const saved: Record<string, unknown> = {
        id: 'ex-fail-preempted',
        status: ExecutionStatus.RUNNING, // stale in-memory — DB 는 이미 CANCELLED.
        workflowId: 'wf',
        executedBy: 'owner',
        parentExecutionId: null,
        startedAt: new Date(),
      };

      await (
        service as unknown as {
          finalizeFailedExecution: (
            e: unknown,
            err: unknown,
            o?: unknown,
          ) => Promise<void>;
        }
      ).finalizeFailedExecution(saved, new Error('boom — post-cancel failure'));

      // CANCELLED 로 이미 커밋된 실행을 FAILED 로 사후 덮어쓰지 않는다 — 이벤트도
      // 알림도 발사되면 안 된다(사용자가 명시적으로 Stop 한 실행에 대한 사후 오시그널 방지).
      expect(emitSpy).not.toHaveBeenCalled();
      expect(createMany).not.toHaveBeenCalled();
    });
  });

  // **0행 매칭은 두 가지를 뜻한다** — 이 구분을 뭉개면 어느 쪽으로든 결함이 된다.
  // 처음 이 가드를 넣을 때 자매 `finalizeFailedExecution` 을 그대로 흉내내 무조건 skip
  // 했는데, 그러면 **사용자가 누른 Stop 이 외부에 영영 통지되지 않는다**: `stop()` 은
  // RUNNING/PENDING 경로에서 이벤트를 쏘지 않아(WAITING 만 `cancelParkedExecution` 이
  // emit) 이 헬퍼가 유일한 알림 지점이다. 자매는 "FAILED 로 덮어쓰지 말라" 가 목적이라
  // 극성이 반대다.
  describe('finalizeCancelledExecution — 0행 매칭의 두 의미', () => {
    const LIVE_FINISHED_AT = new Date('2026-08-15T02:03:04.000Z');
    const arrange = (liveStatus: ExecutionStatus | null) => {
      const eventEmitter = (
        service as unknown as { eventEmitter: { emitExecution: jest.Mock } }
      ).eventEmitter;
      const emitSpy = jest
        .spyOn(eventEmitter, 'emitExecution')
        .mockResolvedValue(undefined);
      // guarded UPDATE 0행.
      mockExecutionRepo.query.mockResolvedValueOnce([]);
      // **DB 가 실제로 뭐라고 하는지**를 명시한다 — 기본 mock 에 기대면 통과 이유가
      // 우연이 된다.
      mockExecutionRepo.findOneBy.mockResolvedValueOnce(
        liveStatus === null
          ? null
          : {
              id: 'ex-cancel-preempted',
              status: liveStatus,
              durationMs: 777,
              finishedAt: LIVE_FINISHED_AT,
            },
      );
      return emitSpy;
    };
    // `finishedAt`/`durationMs` 는 **되쓰기 대상**이라 타입에 명시한다 — 추론에 맡기면
    // 단언 줄에서 "속성이 없다" 로 떨어진다.
    const saved = (): {
      id: string;
      status: ExecutionStatus;
      workflowId: string;
      executedBy: string;
      parentExecutionId: null;
      startedAt: Date;
      finishedAt?: Date;
      durationMs?: number;
    } => ({
      id: 'ex-cancel-preempted',
      status: ExecutionStatus.RUNNING, // stale in-memory
      workflowId: 'wf',
      executedBy: 'owner',
      parentExecutionId: null,
      startedAt: new Date(),
    });
    const run = (e: unknown) =>
      (
        service as unknown as {
          finalizeCancelledExecution: (x: unknown, c: string) => Promise<void>;
        }
      ).finalizeCancelledExecution(e, 'test');

    it('(a) DB 가 이미 cancelled — stop() 이 마감한 정상 경로라 **emit 한다**', async () => {
      const emitSpy = arrange(ExecutionStatus.CANCELLED);
      const exec = saved();
      await run(exec);
      expect(emitSpy).toHaveBeenCalled();
      // 값도 DB 정본으로 맞춘다 — wire 가 DB 와 같은 값을 말해야 한다.
      const payload = emitSpy.mock.calls[0][2] as { durationMs: number };
      expect(payload.durationMs).toBe(777);
      // `finishedAt` 도 되쓰기 대상이다 — 종전엔 그 줄을 지워도 GREEN 이었다.
      // 같은 PR 이 자매(`retry-turn`)에서 정확히 이 형태를 스스로 찾아 고쳐 놓고
      // 형제 함수엔 적용하지 않았다 (`15_00_41` W2).
      expect(exec.finishedAt).toEqual(LIVE_FINISHED_AT);
    });

    it('(b) DB 가 failed — 다른 종결자가 이겼으므로 cancelled 를 쏘지 않는다', async () => {
      const emitSpy = arrange(ExecutionStatus.FAILED);
      await run(saved());
      expect(emitSpy).not.toHaveBeenCalled();
    });

    it('(d) 재조회가 throw 해도 호출자로 전파하지 않는다 — 호출부가 catch 안이다', async () => {
      const eventEmitter = (
        service as unknown as { eventEmitter: { emitExecution: jest.Mock } }
      ).eventEmitter;
      const emitSpy = jest
        .spyOn(eventEmitter, 'emitExecution')
        .mockResolvedValue(undefined);
      mockExecutionRepo.query.mockResolvedValueOnce([]);
      mockExecutionRepo.findOneBy.mockRejectedValueOnce(new Error('db down'));

      // throw 가 새어 나가면 워커의 에러 핸들러 자체가 터진다.
      await expect(run(saved())).resolves.toBeUndefined();
      expect(emitSpy).not.toHaveBeenCalled();
    });

    it('(c) 행을 못 읽으면 쏘지 않는다 (fail-closed)', async () => {
      const emitSpy = arrange(null);
      await run(saved());
      expect(emitSpy).not.toHaveBeenCalled();
    });
  });

  describe('getNotificationsService — ModuleRef 지연 해석 (버그 B 회귀 가드)', () => {
    // ExecutionEngineService 가 순환 그래프로 먼저 인스턴스화되면 생성자 @Optional
    // NotificationsService 가 undefined 로 남는다. getNotificationsService 는 그 경우
    // ModuleRef(strict:false)로 지연 해석한다. 4개 분기(주입/지연해석/throw/캐시) 검증.
    type Svc = {
      notificationsService?: unknown;
      moduleRef?: { get: jest.Mock };
      resolvedNotificationsService?: unknown;
      getNotificationsService: () => unknown;
    };
    const asSvc = () => service as unknown as Svc;

    it('생성자 주입이 있으면 그대로 반환 — ModuleRef 미조회', () => {
      const injected = { createMany: jest.fn() };
      const get = jest.fn();
      asSvc().notificationsService = injected;
      asSvc().moduleRef = { get };
      asSvc().resolvedNotificationsService = undefined;
      expect(asSvc().getNotificationsService()).toBe(injected);
      expect(get).not.toHaveBeenCalled();
    });

    it('생성자 주입이 undefined 면 ModuleRef(strict:false)로 지연 해석', () => {
      const resolved = { createMany: jest.fn() };
      const get = jest.fn().mockReturnValue(resolved);
      asSvc().notificationsService = undefined;
      asSvc().moduleRef = { get };
      asSvc().resolvedNotificationsService = undefined;
      expect(asSvc().getNotificationsService()).toBe(resolved);
      expect(get).toHaveBeenCalledTimes(1);
    });

    it('ModuleRef.get 가 throw 하면 undefined (조용히 no-op)', () => {
      const get = jest.fn().mockImplementation(() => {
        throw new Error('not found');
      });
      asSvc().notificationsService = undefined;
      asSvc().moduleRef = { get };
      asSvc().resolvedNotificationsService = undefined;
      expect(asSvc().getNotificationsService()).toBeUndefined();
    });

    it('해석 결과를 캐시 — 두 번째 호출은 ModuleRef 재조회 안 함', () => {
      const resolved = { createMany: jest.fn() };
      const get = jest.fn().mockReturnValue(resolved);
      asSvc().notificationsService = undefined;
      asSvc().moduleRef = { get };
      asSvc().resolvedNotificationsService = undefined;
      asSvc().getNotificationsService();
      asSvc().getNotificationsService();
      expect(get).toHaveBeenCalledTimes(1);
    });
  });
});
