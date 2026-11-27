import { EXECUTION_RUN_PRIORITY } from './queues/execution-run.queue';
import { ExecutionEngineService } from './execution-engine.service';
import {
  nonTerminalStatuses,
  type TransitionOptions,
} from './state/state-machine';
import {
  ExecutionTimeLimitError,
  WorkflowNotFoundError,
} from './workflow-errors';
import { ExecutionEventType } from '../websocket/websocket-events.types';
import {
  Execution,
  ExecutionStatus,
} from '../executions/entities/execution.entity';
import { ADD_STOPPED_SEGMENT_SQL } from '../executions/utils';
import { PG_INT4_MAX } from '../../shared/utils/terminal-duration';
import {
  NodeExecution,
  NodeExecutionStatus,
} from '../node-executions/entities/node-execution.entity';
import {
  type EngineServiceHarness,
  createEngineServiceHarness,
  executionId,
  flushPromises,
  workflowId,
} from './__test-utils__/engine-service-harness';

/**
 * ExecutionEngineService 단위 테스트: execute() 시작 · 큐 발행 · admission · worker 진입 · 누적 타임아웃 · DB 가드.
 *
 * 옛 `execution-engine.service.spec.ts` 를 관심사별로 나눈 파일 가운데 하나다(CLE-T-YEDCJK).
 * 서비스 구성과 mock 레포지토리는 `__test-utils__/engine-service-harness.ts` 공용 하네스가 만든다.
 */
describe('ExecutionEngineService', () => {
  let h: EngineServiceHarness;
  let service: ExecutionEngineService;
  // PR1 — execution-run intake 큐 mock (execute() 가 enqueue 하는지 검증).
  let mockExecutionRunQueue: { add: jest.Mock };
  let mockWebsocketService: EngineServiceHarness['mockWebsocketService'];

  // Mock repositories
  let mockExecutionRepo: Record<string, jest.Mock>;
  let mockNodeExecutionRepo: Record<string, jest.Mock>;
  let mockWorkflowRepo: Record<string, jest.Mock>;
  // `updateExecutionStatus` 의 linkedNodeExec(park 짝 전이) 분기가 트랜잭션 안에서
  // 실행하는 terminal 가드(`SELECT ... FOR UPDATE`) 제어. 기본은 "행 잠금 성공(비-terminal)"
  // 이라 기존 테스트가 그대로 통과하고, 선점 테스트만 `[]` 로 재무장한다.
  let mockTxManagerQuery: jest.Mock;
  // 테스트가 다시 대입하는 `dbExecutionStatus` · `waitingRawRows` ·
  // `waitingQueryError` 는 mock 클로저가 읽는 하네스 필드라 `h.` 로 대입한다.

  // 서비스 구성 · mock 레포지토리는 `__test-utils__/engine-service-harness.ts` 공용 하네스.
  beforeEach(async () => {
    h = await createEngineServiceHarness();
    ({
      service,
      mockExecutionRunQueue,
      mockWebsocketService,
      mockExecutionRepo,
      mockNodeExecutionRepo,
      mockWorkflowRepo,
      mockTxManagerQuery,
    } = h);
  });

  it('should return execution ID immediately', async () => {
    const result = await service.execute(
      workflowId,
      { data: 'test' },
      { workspaceId: 'ws-1' },
    );
    expect(result).toBe(executionId);
    expect(mockWorkflowRepo.findOneBy).toHaveBeenCalledWith({ id: workflowId });
    expect(mockExecutionRepo.create).toHaveBeenCalled();
    expect(mockExecutionRepo.save).toHaveBeenCalled();
  });

  // 근거: [데이터 모델 개요 「참조의 소속」](CLE-PLAT-DATA#참조의-소속)
  // NERV Task `CLE-T-XYR067`. 저장 경계 이전에 저장된 트리거 · 스케줄의 workflow_id 가 다른 워크스페이스를
  // 가리키면 엔진이 id 로만 읽어 그 워크플로우를 실행했다.
  describe('execute() — 실행을 시작하는 쪽의 워크스페이스', () => {
    it('워크플로우가 그 워크스페이스에 없으면 없는 워크플로우와 같게 거부하고 실행 행을 만들지 않는다', async () => {
      await expect(
        service.execute(
          workflowId,
          { data: 'test' },
          { triggerId: 'trg-1', workspaceId: 'ws-other' },
        ),
      ).rejects.toBeInstanceOf(WorkflowNotFoundError);

      expect(mockExecutionRepo.save).not.toHaveBeenCalled();
      expect(mockExecutionRunQueue.add).not.toHaveBeenCalled();
    });

    // 타입은 `string` 이지만 JS 호출부나 캐스트로 빈 값이 올 수 있다. 조회 조건에 넣지 않고 명시 비교하므로
    // 빈 값도 거부로 닫힌다. `findOneBy({ id, workspaceId })` 로 바꾸면 이 케이스가 조회 예외로 깨진다.
    it.each([
      ['빈 문자열', ''],
      ['undefined', undefined as unknown as string],
    ])(
      'workspaceId 가 %s 이면 거부하고 실행 행을 만들지 않는다',
      async (_label, workspaceId) => {
        await expect(
          service.execute(workflowId, {}, { executedBy: 'u1', workspaceId }),
        ).rejects.toBeInstanceOf(WorkflowNotFoundError);

        expect(mockWorkflowRepo.findOneBy).toHaveBeenCalledWith({
          id: workflowId,
        });
        expect(mockExecutionRepo.save).not.toHaveBeenCalled();
        expect(mockExecutionRunQueue.add).not.toHaveBeenCalled();
      },
    );

    it('없는 워크플로우와 같은 에러 메시지다', async () => {
      const otherWorkspace = await service
        .execute(workflowId, {}, { executedBy: 'u1', workspaceId: 'ws-other' })
        .catch((err_: unknown) => err_);
      mockWorkflowRepo.findOneBy.mockResolvedValueOnce(null);
      const missing = await service
        .execute(workflowId, {}, { executedBy: 'u1', workspaceId: 'ws-1' })
        .catch((err_: unknown) => err_);

      expect((otherWorkspace as Error).message).toBe(
        (missing as Error).message,
      );
    });
  });

  describe('execute() — trigger metadata persistence', () => {
    // 트리거 출처(수동/스케줄/웹훅)를 Execution 행의 executedBy/triggerId 컬럼에
    // 정확히 기록해야 "최근 실행" 화면이 출처를 schedule/webhook 으로 분류할 수 있다
    // (deriveExecutionTrigger 헬퍼 + spec/2-navigation/14-execution-history.md §2.4).

    it('persists executedBy when options.executedBy is provided (manual run)', async () => {
      await service.execute(
        workflowId,
        { data: 'test' },
        { workspaceId: 'ws-1', executedBy: 'u1' },
      );
      expect(mockExecutionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          workflowId,
          executedBy: 'u1',
          triggerId: undefined,
        }),
      );
    });

    it('persists triggerId when options.triggerId is provided (schedule/webhook run)', async () => {
      await service.execute(
        workflowId,
        { parameters: {} },
        { workspaceId: 'ws-1', triggerId: 'trigger-uuid' },
      );
      expect(mockExecutionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          workflowId,
          triggerId: 'trigger-uuid',
          executedBy: undefined,
        }),
      );
    });

    it('leaves both executedBy and triggerId undefined when no options are provided', async () => {
      await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
      expect(mockExecutionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          workflowId,
          executedBy: undefined,
          triggerId: undefined,
        }),
      );
    });

    // §A.3 호출 이력 — webhook 발화 시 소스 IP·응답 코드를 Execution 행에 영속.
    it('persists sourceIp/responseCode when provided on the triggerId variant (webhook)', async () => {
      await service.execute(
        workflowId,
        { parameters: {} },
        {
          workspaceId: 'ws-1',
          triggerId: 'trg-wh',
          sourceIp: '203.0.113.7',
          responseCode: '202',
        },
      );
      expect(mockExecutionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          workflowId,
          triggerId: 'trg-wh',
          sourceIp: '203.0.113.7',
          responseCode: '202',
        }),
      );
    });

    // schedule 등 비-HTTP 트리거·수동 실행은 두 컬럼이 NULL (회귀 없음).
    it('persists null sourceIp/responseCode when not provided (schedule/manual)', async () => {
      await service.execute(
        workflowId,
        {},
        { workspaceId: 'ws-1', triggerId: 'trg-sched' },
      );
      expect(mockExecutionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          triggerId: 'trg-sched',
          sourceIp: null,
          responseCode: null,
        }),
      );
    });
  });

  describe('execute() — execution-run intake 큐 발행 (PR1)', () => {
    // spec/5-system/4-execution-engine.md §4.1–4.3: execute() 는 fire-and-forget
    // in-process 호출 대신 execution-run 큐에 발행하고 즉시 executionId 반환.
    // row 는 pending 으로 저장(executionId 즉시 발급 계약), job 은 executionId+input.

    // 이 describe 의 테스트는 큐 브릿지를 순수 recorder 로 override 해 execute()
    // 자체 동작만 격리한다 (브릿지 default 는 worker 를 인라인 실행하므로).
    const asRecorder = (): void => {
      mockExecutionRunQueue.add.mockImplementation(() => Promise.resolve());
    };

    it('execute() 는 execution-run 큐에 enqueue 하고 executionId 반환 (runExecution 직접 호출 안 함)', async () => {
      asRecorder();
      const runSpy = jest.spyOn(
        service as unknown as { runExecution: jest.Mock },
        'runExecution',
      );
      const result = await service.execute(
        workflowId,
        { data: 'test' },
        { workspaceId: 'ws-1', executedBy: 'u1' },
      );
      expect(result).toBe(executionId);
      expect(mockExecutionRunQueue.add).toHaveBeenCalledTimes(1);
      const [name, payload, opts] = mockExecutionRunQueue.add.mock.calls[0];
      expect(name).toBe('execution-run');
      expect(payload).toEqual({ executionId, input: { data: 'test' } });
      expect(opts).toEqual(
        expect.objectContaining({ jobId: executionId, attempts: 1 }),
      );
      // execute() 는 worker 가 호출할 runExecution 을 직접 호출하지 않는다.
      expect(runSpy).not.toHaveBeenCalled();
      runSpy.mockRestore();
    });

    it('수동 실행(executedBy)은 manual priority, 트리거 실행은 그보다 낮은 우선순위', async () => {
      asRecorder();
      await service.execute(
        workflowId,
        {},
        { workspaceId: 'ws-1', executedBy: 'u1' },
      );
      await service.execute(
        workflowId,
        {},
        { workspaceId: 'ws-1', triggerId: 'trg-1' },
      );
      const manualOpts = mockExecutionRunQueue.add.mock.calls[0][2];
      const triggerOpts = mockExecutionRunQueue.add.mock.calls[1][2];
      expect(manualOpts.priority).toBe(EXECUTION_RUN_PRIORITY.manual);
      // 트리거 실행은 manual 보다 낮은 우선순위(triggerType 미지정 → webhook fallback).
      expect(triggerOpts.priority).toBeGreaterThan(manualOpts.priority);
    });

    it('triggerType threading — manual>webhook>schedule 3-tier + fallback (PR2)', async () => {
      asRecorder();
      await service.execute(
        workflowId,
        {},
        { workspaceId: 'ws-1', triggerId: 't-w', triggerType: 'webhook' },
      );
      await service.execute(
        workflowId,
        {},
        { workspaceId: 'ws-1', triggerId: 't-s', triggerType: 'schedule' },
      );
      // triggerType 미지정 트리거 → webhook fallback (비-HTTP 방어).
      await service.execute(
        workflowId,
        {},
        { workspaceId: 'ws-1', triggerId: 't-x' },
      );
      const [wOpts, sOpts, fOpts] = [0, 1, 2].map(
        (i) => mockExecutionRunQueue.add.mock.calls[i][2],
      );
      expect(wOpts.priority).toBe(EXECUTION_RUN_PRIORITY.webhook);
      expect(sOpts.priority).toBe(EXECUTION_RUN_PRIORITY.schedule);
      expect(fOpts.priority).toBe(EXECUTION_RUN_PRIORITY.webhook);
      // 3-tier 순서: manual(1) < webhook(2) < schedule(3).
      expect(sOpts.priority).toBeGreaterThan(wOpts.priority);
      expect(wOpts.priority).toBeGreaterThan(EXECUTION_RUN_PRIORITY.manual);
    });

    it('execute() 단계에서는 routing context 를 등록하지 않는다 (worker 로 이동)', async () => {
      asRecorder();
      await service.execute(
        workflowId,
        { chatChannel: { provider: 'telegram', conversationKey: '12345' } },
        { workspaceId: 'ws-1', triggerId: 'trg-tele' },
      );
      expect(
        mockWebsocketService.registerExecutionRouting,
      ).not.toHaveBeenCalled();
    });
  });

  // PR2b — §8 동시성 cap admission gate 흐름 (원자성·COUNT 정확성은 e2e 가 실증).
  describe('admitExecutionOrDefer / markQueueWaitTimeout (PR2b §8)', () => {
    const mkQb = (affected: number) => ({
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      setParameter: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      returning: jest.fn().mockReturnThis(),
      // RETURNING 값을 실제로 돌려줘야 threading 이 테스트를 탄다 — 종전엔 `raw` 가
      // 비어 있어 추출부를 통째로 깨는 뮤테이션도 GREEN 이었다 (`11_44_10` W1).
      execute: jest.fn().mockResolvedValue({
        affected,
        raw: affected > 0 ? [{ id: 'e3', duration_ms: 600000 }] : [],
      }),
    });
    const admit = (exec: unknown, input: unknown = {}) =>
      (
        service as unknown as {
          admitExecutionOrDefer: (
            e: unknown,
            i: unknown,
          ) => Promise<'admitted' | 'cancelled' | 'deferred'>;
        }
      ).admitExecutionOrDefer(exec, input);
    const emitSpy = () =>
      jest
        .spyOn(
          (service as unknown as { eventEmitter: { emitExecution: jest.Mock } })
            .eventEmitter,
          'emitExecution',
        )
        .mockResolvedValue(undefined);

    beforeEach(() => {
      mockWorkflowRepo.findOne.mockResolvedValue({
        id: 'wf',
        workspaceId: 'ws',
        settings: {},
        workspace: { settings: {} },
      });
    });

    /**
     * **드라이버가 실제로 돌려주는 shape 로 admission 을 건다.**
     *
     * 실측(typeorm 0.3.31 + pg, 파라미터·트랜잭션 무관):
     *   `UPDATE … RETURNING` (1행) → `[[{id}], 1]`   ← length 2
     *   `INSERT … RETURNING` (1행) → `[{id}]`        ← length 1
     * `PostgresQueryRunner.query` 의 `switch (raw.command)` 가 UPDATE/DELETE 만
     * `[rows, rowCount]` 로 감싸기 때문이다.
     *
     * 이 스위트의 다른 admission 테스트들은 `[{id}]`(INSERT 형태)를 mock 해 왔고,
     * 그래서 `rows.length === 1` 이 **실제로는 영원히 거짓**이라는 사실을 4개월간
     * 아무도 못 봤다. mock 이 틀린 현실을 인코딩하면 GREEN 은 아무것도 증명하지 않는다.
     *
     * e2e 가 통과한 이유는 admission 실패 후 **UPDATE 는 이미 커밋**돼 row 가 running 이 되고,
     * 재큐된 job 을 `runExecutionFromQueue` 의 RUNNING arm 이 "stalled 재배달" 로 오인해
     * §7.5 rehydration 으로 재구동하기 때문이다 — 결과만 맞고 경로가 틀렸다.
     * 대가: 매 실행마다 `EXECUTION_ADMISSION_RETRY_DELAY_MS`(2s) 지연 + 이 블록의
     * `recordRunningSegmentStart`·`EXECUTION_STARTED` 가 통째로 사문화.
     */
    it('실측 shape([rows,count])로도 admitted 여야 한다 — UPDATE 는 튜플을 돌려준다', async () => {
      (
        mockExecutionRepo.manager as unknown as { transaction: jest.Mock }
      ).transaction = jest.fn(
        async (cb: (m: { query: jest.Mock }) => unknown) =>
          cb({ query: jest.fn().mockResolvedValue([[{ id: 'e1' }], 1]) }),
      );
      const spy = emitSpy();
      try {
        const exec = {
          id: 'e1',
          workflowId: 'wf',
          queuedAt: new Date(),
          status: 'pending',
        };
        await expect(admit(exec)).resolves.toBe('admitted');
      } finally {
        spy.mockRestore();
      }
    });

    it('실측 shape 로 0행 매칭(cap 초과)이면 admitted 가 아니어야 한다', async () => {
      (
        mockExecutionRepo.manager as unknown as { transaction: jest.Mock }
      ).transaction = jest.fn(
        async (cb: (m: { query: jest.Mock }) => unknown) =>
          cb({ query: jest.fn().mockResolvedValue([[], 0]) }),
      );
      const spy = emitSpy();
      try {
        const exec = {
          id: 'e0',
          workflowId: 'wf',
          queuedAt: new Date(),
          status: 'pending',
        };
        // **정확한 값으로 단언한다.** 종전엔 `not.toBe('admitted')` 였는데,
        // 그러면 "0행인데 `cancelled` 를 돌려주는" 회귀도 통과한다 — 느슨한 단언이
        // 버그를 4개월 숨긴 게 이 PR 의 교훈인데 새 테스트가 그걸 재도입한 셈이었다
        // (ai-review `23_46_00` WARNING 3).
        await expect(admit(exec)).resolves.toBe('deferred');
      } finally {
        spy.mockRestore();
      }
    });

    it('cap 여유(affected=1) → admitted: pending→running 동기화 + STARTED emit', async () => {
      mockExecutionRepo.manager.transaction = jest.fn(
        async (cb: (m: { query: jest.Mock }) => unknown) =>
          cb({ query: jest.fn().mockResolvedValue([{ id: 'e1' }]) }),
      );
      const spy = emitSpy();
      // §8 active-running 타임아웃(PR2a) 회귀 가드 — admitted 는 choke point 를
      // 우회하므로 recordRunningSegmentStart 를 직접 호출해야 한다(ai-review CRITICAL).
      const recSpy = jest
        .spyOn(
          service as unknown as {
            recordRunningSegmentStart: (id: string) => void;
          },
          'recordRunningSegmentStart',
        )
        .mockImplementation(() => undefined);
      const exec = {
        id: 'e1',
        workflowId: 'wf',
        queuedAt: new Date(),
        status: 'pending',
      };
      await expect(admit(exec)).resolves.toBe('admitted');
      expect(exec.status).toBe('running');
      expect(recSpy).toHaveBeenCalledWith('e1');
      expect(spy).toHaveBeenCalledWith(
        'e1',
        expect.anything(),
        expect.objectContaining({ status: 'running' }),
      );
      spy.mockRestore();
      recSpy.mockRestore();
    });

    it('cap 초과(affected=0) → deferred: delayed 재큐', async () => {
      mockExecutionRepo.manager.transaction = jest.fn(
        async (cb: (m: { query: jest.Mock }) => unknown) =>
          cb({ query: jest.fn().mockResolvedValue([]) }),
      );
      const exec = {
        id: 'e2',
        workflowId: 'wf',
        queuedAt: new Date(),
        status: 'pending',
      };
      await expect(admit(exec, { a: 1 })).resolves.toBe('deferred');
      expect(mockExecutionRunQueue.add).toHaveBeenCalledWith(
        'execution-run',
        { executionId: 'e2', input: { a: 1 } },
        expect.objectContaining({ delay: expect.any(Number) }),
      );
    });

    it('큐 대기 5분 초과 → cancelled: EXECUTION_CANCELLED cancelledBy=timeout', async () => {
      mockExecutionRepo.createQueryBuilder = jest.fn().mockReturnValue(mkQb(1));
      const spy = emitSpy();
      const exec = {
        id: 'e3',
        workflowId: 'wf',
        queuedAt: new Date(Date.now() - 10 * 60 * 1000), // 10분 전
        status: 'pending',
      };
      mockWorkflowRepo.findOne.mockClear(); // 이전 테스트 누적 호출 격리
      await expect(admit(exec)).resolves.toBe('cancelled');
      expect(spy).toHaveBeenCalledWith(
        'e3',
        expect.anything(),
        expect.objectContaining({
          result: { cancelledBy: 'timeout' },
          error: expect.objectContaining({
            code: 'EXECUTION_QUEUE_WAIT_TIMEOUT',
          }),
          // RETURNING 값이 emit 까지 그대로 흐르는지 — 3라운드째 이월이던 마지막 경로다.
          // 이 값의 의미는 "큐 대기 시간" 이라 다른 4경로로 대체 증명되지 않는다.
          durationMs: 600000,
        }),
      );
      // 5분 cancel 로 단락 → cap 검사(workflow 조회) 이전 return.
      expect(mockWorkflowRepo.findOne).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('queuedAt=null(레거시 row) → 5분 검사 skip, admission 진행', async () => {
      mockExecutionRepo.manager.transaction = jest.fn(
        async (cb: (m: { query: jest.Mock }) => unknown) =>
          cb({ query: jest.fn().mockResolvedValue([{ id: 'e4' }]) }),
      );
      const spy = emitSpy();
      const exec = {
        id: 'e4',
        workflowId: 'wf',
        queuedAt: null,
        status: 'pending',
      };
      await expect(admit(exec)).resolves.toBe('admitted');
      spy.mockRestore();
    });

    /**
     * `EntityManager.query` 의 선언 타입은 `Promise<any>` 라 코드의 제네릭
     * (`query<{ id: string }[]>`) 은 **주장이지 검증이 아니다.** 드라이버가 배열이 아닌 것을
     * 돌려주면 종전에는 `rows.length` 가 `Cannot read properties of undefined` 로 터졌다.
     *
     * **가드는 판정을 바꾸지 않는다 — 진단만 바꾼다.** 처음엔 `return false`(defer)로 삼키게
     * 썼다가 되돌렸다: 그러면 트랜잭션이 **커밋**되는데, shape 이 어긋났다는 건 UPDATE 가
     * 실제로 행을 갱신했는지 알 수 없다는 뜻이다. 갱신됐는데 앱이 defer 로 처리하면 DB 는
     * `running`, 워커는 없음 — 실행이 영영 붕 뜬다. 예외라야 롤백된다.
     */
    it('UPDATE ... RETURNING 이 배열이 아니면 던진다 — 트랜잭션 롤백 보존', async () => {
      (
        mockExecutionRepo.manager as unknown as { transaction: jest.Mock }
      ).transaction = jest.fn(
        async (cb: (m: { query: jest.Mock }) => unknown) =>
          // 드라이버가 배열 아닌 것을 돌려준 상황.
          cb({ query: jest.fn().mockResolvedValue(undefined) }),
      );
      const spy = emitSpy();
      try {
        const exec = {
          id: 'eNonArray',
          workflowId: 'wf',
          queuedAt: new Date(),
          status: 'pending',
        };
        // defer 로 삼키지 않고 던져야 한다 — 삼키면 트랜잭션이 커밋된다.
        await expect(admit(exec)).rejects.toThrow(/배열이 아님/);
      } finally {
        spy.mockRestore();
      }
    });

    /**
     * 자매 `.query()` 지점에도 같은 가드를 폈다 (ai-review `17_15_21` WARNING 1).
     * 세 자리가 같은 위험은 **아니다** — 실패 방향을 각각 재서 확인했다:
     *
     * | 지점 | 가드 없을 때 |
     * |---|---|
     * | `admitExecutionOrDefer` | `rows.length` TypeError (이미 터짐) |
     * | `updateExecutionStatus` | `persisted=false` → **종결 이벤트 emit 생략**. DB 는 UPDATE 됐는데 `execution.completed` 가 안 나가 클라이언트 무기한 대기 |
     * | `lockNonTerminalExecutionRow` | `live.length>0` → false → "live 아님" 으로 중단(fail-closed, 조용함) |
     * | `computeChainDepth` | depth 1 → **RR-PL-05 제한 우회**(fail-open, 유일한 정확성 결함) |
     *
     * 아래 둘은 engine 쪽 두 지점을 고정한다. `computeChainDepth` 는
     * `executions-rerun.service.spec.ts` 가 담당한다.
     */
    /**
     * **튜플과 행 배열을 의미로 가르는 테스트.** 위 "배열이 아니면 던진다" 는 비배열만
     * 잡을 뿐, **잘 만들어진 튜플**에서 `persisted` 를 튜플 길이(항상 2)로 계산하는
     * 회귀는 못 잡는다 — ai-review `22_45_24` CRITICAL 1 이 그 공백을 지적했고,
     * 나는 직전 RESOLUTION 에서 "이미 덮는다" 고 **검증 없이 썼다.**
     *
     * `[[], 0]`(0행) 쪽이 진짜 판별자다: 튜플 길이는 2 라 옛 코드는 `persisted=true`,
     * 올바른 코드는 rows 가 비었으므로 `false`.
     */
    it('실측 shape: 1행 튜플([[{id}],1])이면 persisted=true', async () => {
      mockExecutionRepo.query = jest
        .fn()
        .mockResolvedValue([[{ id: 'eUpd' }], 1]);
      const svcAny = service as unknown as {
        updateExecutionStatus: (...a: unknown[]) => Promise<boolean>;
      };
      await expect(
        svcAny.updateExecutionStatus(
          { id: 'eUpd', workflowId: 'wf', status: ExecutionStatus.RUNNING },
          ExecutionStatus.COMPLETED,
        ),
      ).resolves.toBe(true);
    });

    it('실측 shape: 0행 튜플([[],0])이면 persisted=false — 동시 cancel 선점 분기가 살아난다', async () => {
      mockExecutionRepo.query = jest.fn().mockResolvedValue([[], 0]);
      const svcAny = service as unknown as {
        updateExecutionStatus: (...a: unknown[]) => Promise<boolean>;
      };
      await expect(
        svcAny.updateExecutionStatus(
          { id: 'eUpd0', workflowId: 'wf', status: ExecutionStatus.RUNNING },
          ExecutionStatus.COMPLETED,
        ),
      ).resolves.toBe(false);
    });

    it('updateExecutionStatus: guarded UPDATE 가 배열이 아니면 던진다 — 종결 이벤트 조용한 유실 차단', async () => {
      mockExecutionRepo.query = jest.fn().mockResolvedValue(undefined);
      const svcAny = service as unknown as {
        updateExecutionStatus: (...a: unknown[]) => Promise<boolean>;
      };
      await expect(
        svcAny.updateExecutionStatus(
          { id: 'eUpd', workflowId: 'wf', status: ExecutionStatus.RUNNING },
          ExecutionStatus.COMPLETED,
        ),
      ).rejects.toThrow(/배열이 아님/);
    });

    /**
     * `18_19_33` concurrency INFO 9 — 위 "배열이 아니면 던진다" 는 **관측**까지만 하고
     * 롤백은 보장하지 못했다. 종전 UPDATE 는 트랜잭션 밖 단발이라, 가드가 throw 해도
     * **이미 커밋된 UPDATE 를 되돌리지 못했다.**
     *
     * 그때 남는 상태가 최악이다 — DB 는 terminal 인데 종결 이벤트는 안 나가고, 그 실행은
     * stuck recovery(non-terminal 만 스캔)에도 안 잡힌다. **가드가 막으려던 무기한 대기가
     * 가드가 발동한 순간에 생긴다.**
     *
     * 이제 UPDATE 가 트랜잭션 안에서 돌므로 throw 가 롤백을 부른다. 여기서 고정하는 축은
     * 두 개다: (a) UPDATE 가 트랜잭션 manager 를 경유하는가, (b) throw 가 트랜잭션 콜백
     * **밖으로** 전파되는가(삼켜지면 롤백도 안 되고 false 가 조용히 반환된다).
     *
     * **경계를 분명히 한다** (`17_36_15` testing INFO 3): 실제 DB `ROLLBACK` 자체는
     * TypeORM 의 트랜잭션 계약이라 mock 으로 증명할 수 없다. 여기서 고정하는 것은 그
     * **전제조건 두 개**뿐이다 — 초판 테스트 이름이 "UPDATE 가 롤백된다" 라 결론까지
     * 증명한 것처럼 읽혀 좁혔다. 실 DB 검증은 e2e 몫인데, shape 위반은 드라이버 계약이
     * 바뀌어야 나는 이벤트라 e2e 로 재현할 방법이 없다(드라이버 mock 이 필요하다).
     */
    it('shape 위반 throw 가 트랜잭션 manager 를 경유해 밖으로 전파된다 (롤백 전제조건)', async () => {
      mockExecutionRepo.query = jest.fn().mockResolvedValue(undefined);
      const svcAny = service as unknown as {
        updateExecutionStatus: (...a: unknown[]) => Promise<boolean>;
      };
      const txSpy = (
        service as unknown as { dataSource: { transaction: jest.Mock } }
      ).dataSource.transaction;
      const txCallsBefore = txSpy.mock.calls.length;

      await expect(
        svcAny.updateExecutionStatus(
          {
            id: 'eRollback',
            workflowId: 'wf',
            status: ExecutionStatus.RUNNING,
          },
          ExecutionStatus.COMPLETED,
        ),
      ).rejects.toThrow(/배열이 아님/);

      // (a) 트랜잭션을 실제로 열었다 — 안 열었으면 롤백할 대상 자체가 없다.
      expect(txSpy.mock.calls.length).toBe(txCallsBefore + 1);
      // (b) UPDATE 가 트랜잭션 manager 를 경유했다(repo 직접 호출이 아니다).
      const txUpdateCalls = mockTxManagerQuery.mock.calls.filter(
        (c) => typeof c[0] === 'string' && /UPDATE execution/.test(c[0]),
      );
      expect(txUpdateCalls.length).toBeGreaterThan(0);
    });

    it('정상 경로도 트랜잭션 manager 를 경유한다 — 위 롤백 테스트가 공허하지 않다', async () => {
      // 위 테스트만 있으면 "throw 경로만 트랜잭션" 이어도 통과한다. 정상 경로까지
      // 같은 배선인지 고정해야 (a)(b) 가 이 함수의 성질이 된다.
      mockExecutionRepo.query = jest
        .fn()
        .mockResolvedValue([[{ id: 'eOk' }], 1]);
      const svcAny = service as unknown as {
        updateExecutionStatus: (...a: unknown[]) => Promise<boolean>;
      };
      mockTxManagerQuery.mockClear();

      await expect(
        svcAny.updateExecutionStatus(
          { id: 'eOk', workflowId: 'wf', status: ExecutionStatus.RUNNING },
          ExecutionStatus.COMPLETED,
        ),
      ).resolves.toBe(true);

      const txUpdateCalls = mockTxManagerQuery.mock.calls.filter(
        (c) => typeof c[0] === 'string' && /UPDATE execution/.test(c[0]),
      );
      expect(txUpdateCalls.length).toBe(1);
    });

    it('lockNonTerminalExecutionRow: SELECT FOR UPDATE 가 배열이 아니면 던진다 — 조용한 "live 아님" 과 구분', async () => {
      const svcAny = service as unknown as {
        lockNonTerminalExecutionRow: (
          m: { query: jest.Mock },
          id: string,
        ) => Promise<boolean>;
      };
      // 배열이면 정상 판정 — 가드가 정상 경로를 바꾸지 않음을 같이 고정한다.
      await expect(
        svcAny.lockNonTerminalExecutionRow(
          { query: jest.fn().mockResolvedValue([{ id: 'eLock' }]) },
          'eLock',
        ),
      ).resolves.toBe(true);
      await expect(
        svcAny.lockNonTerminalExecutionRow(
          { query: jest.fn().mockResolvedValue([]) },
          'eLock',
        ),
      ).resolves.toBe(false);
      await expect(
        svcAny.lockNonTerminalExecutionRow(
          { query: jest.fn().mockResolvedValue(undefined) },
          'eLock',
        ),
      ).rejects.toThrow(/배열이 아님/);
    });

    it('원자 UPDATE 파라미터 순서·cap 매핑 회귀: [executionId, workspaceId, wsCap, workflowId, wfCap]', async () => {
      // ws cap(7)·wf cap(2) 를 다르게 둬서 각 파라미터가 올바른 위치에 바인딩되는지
      // 고정한다 — 순서 뒤바뀜/cap 교차 오염(ws↔wf) 회귀 차단. advisory lock 키도
      // workspace 범위(`exec-cap:<workspaceId>`)임을 함께 확인.
      mockWorkflowRepo.findOne.mockResolvedValueOnce({
        id: 'wf',
        workspaceId: 'ws-X',
        settings: { maxConcurrentExecutions: 2 },
        workspace: { settings: { maxConcurrentExecutions: 7 } },
      });
      const queryMock = jest
        .fn()
        .mockResolvedValueOnce([]) // (1) SELECT pg_advisory_xact_lock(...)
        .mockResolvedValueOnce([{ id: 'eSQL' }]); // (2) 조건부 UPDATE → admitted
      mockExecutionRepo.manager.transaction = jest.fn(
        async (cb: (m: { query: jest.Mock }) => unknown) =>
          cb({ query: queryMock }),
      );
      const spy = emitSpy();
      const exec = {
        id: 'eSQL',
        workflowId: 'wf',
        queuedAt: new Date(),
        status: 'pending',
      };
      await expect(admit(exec)).resolves.toBe('admitted');
      // (1) advisory lock — workspace 범위 키로 같은 workspace admission 직렬화.
      expect(queryMock.mock.calls[0][0]).toContain('pg_advisory_xact_lock');
      expect(queryMock.mock.calls[0][1]).toEqual(['exec-cap:ws-X']);
      // (2) 조건부 UPDATE — 파라미터 순서·cap 매핑 고정. wsCap($3)=workspace.settings,
      //     wfCap($5)=workflow.settings 로 교차 없이 매핑돼야 한다.
      expect(queryMock.mock.calls[1][0]).toContain(
        "UPDATE execution SET status = 'running'",
      );
      expect(queryMock.mock.calls[1][1]).toEqual([
        'eSQL', // $1 executionId
        'ws-X', // $2 workspaceId (workspace COUNT join)
        7, // $3 wsCap (workspace.settings)
        'wf', // $4 workflowId (workflow COUNT)
        2, // $5 wfCap (workflow.settings)
      ]);
      spy.mockRestore();
    });
  });

  describe('runExecutionFromQueue — worker 진입점 + routing context 재등록', () => {
    // routing 등록은 work-stealing 으로 job 을 실제 처리하는 인스턴스에서
    // 일어나야 terminal event 의 release 와 짝이 맞는다 → execute() 가 아니라
    // worker(runExecutionFromQueue)가 등록한다. Spec [chat-channel §3.1 CCH-AD-05].

    const pendingRow = (over: Partial<Execution>): Partial<Execution> => ({
      id: executionId,
      workflowId,
      status: ExecutionStatus.PENDING,
      inputData: {},
      ...over,
    });

    it('webhook trigger (triggerId + input.chatChannel) → register 1회 + workflowId + chatChannel 동봉', async () => {
      mockExecutionRepo.findOneBy.mockResolvedValueOnce(
        pendingRow({ triggerId: 'trg-tele' }),
      );
      await service.runExecutionFromQueue(executionId, {
        chatChannel: {
          provider: 'telegram',
          conversationKey: '12345',
          channelUserKey: 'user-1',
        },
      });
      await flushPromises();
      expect(
        mockWebsocketService.registerExecutionRouting,
      ).toHaveBeenCalledWith(executionId, {
        triggerId: 'trg-tele',
        workflowId,
        chatChannel: {
          provider: 'telegram',
          conversationKey: '12345',
          channelUserKey: 'user-1',
        },
      });
    });

    it('일반 webhook (chatChannel 미설정) → triggerId + workflowId 만 register', async () => {
      mockExecutionRepo.findOneBy.mockResolvedValueOnce(
        pendingRow({ triggerId: 'trg-wh' }),
      );
      await service.runExecutionFromQueue(executionId, { parameters: {} });
      await flushPromises();
      expect(
        mockWebsocketService.registerExecutionRouting,
      ).toHaveBeenCalledWith(executionId, {
        triggerId: 'trg-wh',
        workflowId,
      });
    });

    it('수동 실행 (triggerId 없음) → register 호출 안 함', async () => {
      mockExecutionRepo.findOneBy.mockResolvedValueOnce(pendingRow({}));
      await service.runExecutionFromQueue(executionId, { data: 'x' });
      await flushPromises();
      expect(
        mockWebsocketService.registerExecutionRouting,
      ).not.toHaveBeenCalled();
    });

    // PR4 — BullMQ stalled 재배달: RUNNING 상태 job 은 크래시 세그먼트 재구동으로 라우팅.
    it('RUNNING (stalled 재배달) → recordRunningSegmentStart + redriveStuckExecution (runExecution 아님)', async () => {
      mockExecutionRepo.findOneBy.mockResolvedValueOnce(
        pendingRow({ status: ExecutionStatus.RUNNING }),
      );
      const svcAny = service as unknown as {
        recordRunningSegmentStart: (id: string) => void;
        redriveStuckExecution: (id: string) => Promise<void>;
        runExecution: (...a: unknown[]) => Promise<void>;
      };
      const segSpy = jest
        .spyOn(svcAny, 'recordRunningSegmentStart')
        .mockImplementation(() => {});
      const redriveSpy = jest
        .spyOn(svcAny, 'redriveStuckExecution')
        .mockResolvedValue(undefined);
      const runSpy = jest
        .spyOn(svcAny, 'runExecution')
        .mockResolvedValue(undefined);
      await service.runExecutionFromQueue(executionId, {});
      await flushPromises();
      expect(segSpy).toHaveBeenCalledWith(executionId);
      expect(redriveSpy).toHaveBeenCalledWith(executionId);
      expect(runSpy).not.toHaveBeenCalled();
      segSpy.mockRestore();
      redriveSpy.mockRestore();
      runSpy.mockRestore();
    });

    it('terminal (cancelled) → ack-discard (재구동/실행 안 함)', async () => {
      mockExecutionRepo.findOneBy.mockResolvedValueOnce(
        pendingRow({ status: ExecutionStatus.CANCELLED }),
      );
      const svcAny = service as unknown as {
        redriveStuckExecution: (id: string) => Promise<void>;
        runExecution: (...a: unknown[]) => Promise<void>;
      };
      const redriveSpy = jest
        .spyOn(svcAny, 'redriveStuckExecution')
        .mockResolvedValue(undefined);
      const runSpy = jest
        .spyOn(svcAny, 'runExecution')
        .mockResolvedValue(undefined);
      await service.runExecutionFromQueue(executionId, {});
      await flushPromises();
      expect(redriveSpy).not.toHaveBeenCalled();
      expect(runSpy).not.toHaveBeenCalled();
      redriveSpy.mockRestore();
      runSpy.mockRestore();
    });

    it('chatChannel.provider 가 빈 문자열이면 chatChannel 등록 제외', async () => {
      mockExecutionRepo.findOneBy.mockResolvedValueOnce(
        pendingRow({ triggerId: 'trg-bad' }),
      );
      await service.runExecutionFromQueue(executionId, {
        chatChannel: { provider: '', conversationKey: '12345' },
      });
      await flushPromises();
      expect(
        mockWebsocketService.registerExecutionRouting,
      ).toHaveBeenCalledWith(executionId, {
        triggerId: 'trg-bad',
        workflowId,
      });
    });

    // SUMMARY#10 — conversationKey='' 경계값 테스트 복원
    it('chatChannel.conversationKey 가 빈 문자열이면 chatChannel 등록 제외', async () => {
      mockExecutionRepo.findOneBy.mockResolvedValueOnce(
        pendingRow({ triggerId: 'trg-bad2' }),
      );
      await service.runExecutionFromQueue(executionId, {
        chatChannel: { provider: 'telegram', conversationKey: '' },
      });
      await flushPromises();
      expect(
        mockWebsocketService.registerExecutionRouting,
      ).toHaveBeenCalledWith(executionId, {
        triggerId: 'trg-bad2',
        workflowId,
      });
    });

    it('row 가 PENDING 이 아니면 ack-discard (재실행 안 함) — 큐 대기 중 cancel 케이스', async () => {
      mockExecutionRepo.findOneBy.mockResolvedValueOnce(
        pendingRow({ status: ExecutionStatus.CANCELLED, triggerId: 'trg-x' }),
      );
      const runSpy = jest.spyOn(
        service as unknown as { runExecution: jest.Mock },
        'runExecution',
      );
      await service.runExecutionFromQueue(executionId, {});
      expect(runSpy).not.toHaveBeenCalled();
      expect(
        mockWebsocketService.registerExecutionRouting,
      ).not.toHaveBeenCalled();
      runSpy.mockRestore();
    });

    it('row 가 없으면 ack-discard', async () => {
      mockExecutionRepo.findOneBy.mockResolvedValueOnce(null);
      const runSpy = jest.spyOn(
        service as unknown as { runExecution: jest.Mock },
        'runExecution',
      );
      await service.runExecutionFromQueue(executionId, {});
      expect(runSpy).not.toHaveBeenCalled();
      runSpy.mockRestore();
    });

    // ── PR2b §8 admission gate 결과별 회귀 (deferred/cancelled 는 runExecution 미호출) ──
    // admitExecutionOrDefer 를 직접 stub 해 세 결과(admitted/deferred/cancelled)에서
    // runExecutionFromQueue 의 후속 분기(runExecution 진행 여부·routing release)를 고정한다.
    /**
     * `outcome` 이 `Error` 면 admission 이 **reject** 하도록 세운다 — 가드가 throw 하는
     * 경로(드라이버 반환 shape 이상)를 재현하기 위해서다. 종전엔 resolve 3값만 지원해
     * throw arm 이 어떤 테스트도 안 거쳤다 (ai-review `17_15_21` WARNING 2).
     */
    const admitStub = (
      outcome: 'admitted' | 'deferred' | 'cancelled' | Error,
    ): { admitSpy: jest.SpyInstance; runSpy: jest.SpyInstance } => {
      const svcAny = service as unknown as {
        admitExecutionOrDefer: (
          ...a: unknown[]
        ) => Promise<'admitted' | 'cancelled' | 'deferred'>;
        runExecution: (...a: unknown[]) => Promise<void>;
      };
      const admitSpy = jest.spyOn(svcAny, 'admitExecutionOrDefer');
      if (outcome instanceof Error) {
        admitSpy.mockRejectedValue(outcome);
      } else {
        admitSpy.mockResolvedValue(outcome);
      }
      const runSpy = jest
        .spyOn(svcAny, 'runExecution')
        .mockResolvedValue(undefined);
      return { admitSpy, runSpy };
    };

    it('admission deferred → routing 등록 후 release + runExecution 미호출', async () => {
      mockExecutionRepo.findOneBy.mockResolvedValueOnce(
        pendingRow({ triggerId: 'trg-defer' }),
      );
      const { admitSpy, runSpy } = admitStub('deferred');
      await service.runExecutionFromQueue(executionId, { a: 1 });
      await flushPromises();
      // routing 은 admission 이전에 등록됐다가 defer 시 해제된다(재-pick up 시 재등록).
      expect(
        mockWebsocketService.registerExecutionRouting,
      ).toHaveBeenCalledWith(executionId, {
        triggerId: 'trg-defer',
        workflowId,
      });
      expect(mockWebsocketService.releaseExecutionRouting).toHaveBeenCalledWith(
        executionId,
      );
      expect(runSpy).not.toHaveBeenCalled();
      admitSpy.mockRestore();
      runSpy.mockRestore();
    });

    it('admission 이 throw → routing release 후 그대로 재전파 + runExecution 미호출', async () => {
      // 가드(`Array.isArray`)가 throw 하는 경로. 종전엔 admission 이 try/catch 밖이라
      // routing context 가 남았고, 그 사실을 고정하는 테스트도 없었다.
      mockExecutionRepo.findOneBy.mockResolvedValueOnce(
        pendingRow({ triggerId: 'trg-admit-throw' }),
      );
      const boom = new Error('admission: RETURNING 이 배열이 아님');
      const { admitSpy, runSpy } = admitStub(boom);
      try {
        await expect(
          service.runExecutionFromQueue(executionId, { a: 1 }),
        ).rejects.toThrow(boom);
        await flushPromises();
        // 등록됐던 routing 이 해제된다 — 안 하면 재시도 소진 시 map 에 영구 잔류.
        expect(
          mockWebsocketService.registerExecutionRouting,
        ).toHaveBeenCalledWith(executionId, {
          triggerId: 'trg-admit-throw',
          workflowId,
        });
        expect(
          mockWebsocketService.releaseExecutionRouting,
        ).toHaveBeenCalledWith(executionId);
        // 삼키면 BullMQ 가 job 을 성공으로 보고 재배달하지 않는다 — 반드시 재전파.
        expect(runSpy).not.toHaveBeenCalled();
      } finally {
        admitSpy.mockRestore();
        runSpy.mockRestore();
      }
    });

    it('admission cancelled → runExecution 미호출 + runExecutionFromQueue 는 release 안 함 (markQueueWaitTimeout 이 처리)', async () => {
      mockExecutionRepo.findOneBy.mockResolvedValueOnce(
        pendingRow({ triggerId: 'trg-cancel' }),
      );
      const { admitSpy, runSpy } = admitStub('cancelled');
      await service.runExecutionFromQueue(executionId, {});
      await flushPromises();
      expect(runSpy).not.toHaveBeenCalled();
      // cancelled arm 은 deferred 와 달리 runExecutionFromQueue 에서 release 하지 않는다
      // (routing 해제는 markQueueWaitTimeout 내부에서 수행 — 여기선 admit stub 이라 미호출).
      expect(
        mockWebsocketService.releaseExecutionRouting,
      ).not.toHaveBeenCalled();
      admitSpy.mockRestore();
      runSpy.mockRestore();
    });

    it('admission admitted → runExecution(execution, input, true) 진행 + release 안 함', async () => {
      mockExecutionRepo.findOneBy.mockResolvedValueOnce(
        pendingRow({ triggerId: 'trg-admit' }),
      );
      const { admitSpy, runSpy } = admitStub('admitted');
      const input = { p: 1 };
      await service.runExecutionFromQueue(executionId, input);
      await flushPromises();
      expect(runSpy).toHaveBeenCalledWith(
        expect.objectContaining({ id: executionId }),
        input,
        true,
      );
      expect(
        mockWebsocketService.releaseExecutionRouting,
      ).not.toHaveBeenCalled();
      admitSpy.mockRestore();
      runSpy.mockRestore();
    });

    it('runExecution 가 reject 하면 catch 가 routing context 명시 release (안전망)', async () => {
      // setup 단계 throw 시 terminal event 미emit → 자동 release 미작동.
      // runExecutionFromQueue 의 catch 가 명시 release 로 stale context 차단.
      mockExecutionRepo.findOneBy.mockResolvedValueOnce(
        pendingRow({ triggerId: 'trg-throw' }),
      );
      const runSpy = jest
        .spyOn(
          service as unknown as { runExecution: jest.Mock },
          'runExecution',
        )
        .mockRejectedValueOnce(new Error('boom — runExecution reject'));
      try {
        await service.runExecutionFromQueue(executionId, {
          chatChannel: { provider: 'telegram', conversationKey: '12345' },
        });
        await flushPromises();
        expect(
          mockWebsocketService.releaseExecutionRouting,
        ).toHaveBeenCalledWith(executionId);
      } finally {
        runSpy.mockRestore();
      }
    });

    it('W2: setup 단계 throw 시 catch 가 execution 을 FAILED 로 best-effort 마킹', async () => {
      mockExecutionRepo.findOneBy
        .mockResolvedValueOnce(pendingRow({ triggerId: 'trg-w2' }))
        .mockResolvedValueOnce(
          pendingRow({
            status: ExecutionStatus.RUNNING,
            startedAt: new Date(),
          }),
        );
      const runSpy = jest
        .spyOn(
          service as unknown as { runExecution: jest.Mock },
          'runExecution',
        )
        .mockRejectedValueOnce(new Error('setup boom'));
      mockExecutionRepo.save.mockClear();
      const emitSpy = jest
        .spyOn(
          (service as unknown as { eventEmitter: { emitExecution: jest.Mock } })
            .eventEmitter,
          'emitExecution',
        )
        .mockResolvedValue(undefined);
      try {
        await service.runExecutionFromQueue(executionId, {});
        await flushPromises();
        await flushPromises();
        // ai-review WARNING #1 (2026-07-27, 7차 라운드) — guarded
        // `updateExecutionStatus`(raw UPDATE) 경유로 바뀌어 더 이상 full-entity
        // `.save()` 를 호출하지 않는다(형제 `finalizeFailedExecution` 과 동일 패턴).
        const failedCall = mockExecutionRepo.query.mock.calls.find(
          (c: unknown[]) =>
            typeof c[0] === 'string' &&
            /UPDATE execution/.test(c[0]) &&
            (c[1] as unknown[])?.[1] === ExecutionStatus.FAILED,
        );
        expect(failedCall).toBeDefined();
        expect(emitSpy).toHaveBeenCalledWith(
          executionId,
          ExecutionEventType.EXECUTION_FAILED,
          // `status` 만 보면 `error` 자리를 바꿔도 GREEN 이다 — 뮤테이션으로 실측됐다
          // (`23_17_57` testing W4). 네 emit 지점 중 여기만 값이 안 걸려 있었다.
          expect.objectContaining({
            status: ExecutionStatus.FAILED,
            error: {
              code: null,
              message: expect.stringContaining('setup boom') as unknown,
              nodeId: null,
            },
          }),
        );
      } finally {
        runSpy.mockRestore();
        emitSpy.mockRestore();
      }
    });

    // ai-review WARNING #1 (2026-07-27, 7차 라운드) — 위 회귀는 `findOneBy` mock
    // 을 고정값(RUNNING)으로 관측해 초기 `TERMINAL_STATUSES` 가드만 검증했을 뿐,
    // guarded UPDATE 자체의 race 보호는 재현하지 않았다는 지적을 닫는다. reload
    // 는 RUNNING 을 관측하지만(초기 가드 통과), guarded UPDATE 가 도달하는
    // 순간엔 동시 Stop 이 DB 를 이미 CANCELLED 로 커밋해 `WHERE status IN
    // (non-terminal)` 이 0행 매칭(no-op)하는 시나리오를 직접 재현한다. 가드가
    // 제거되면(naked `save()` 로 되돌아가면) 아래 두 단언 모두 RED 가 된다.
    it('W2 실제 race — 동시 cancel 이 guarded UPDATE 를 선점하면(0행) FAILED 재마킹·emit 을 모두 skip', async () => {
      mockExecutionRepo.findOneBy
        .mockResolvedValueOnce(pendingRow({ triggerId: 'trg-w2-race' }))
        .mockResolvedValueOnce(
          pendingRow({
            status: ExecutionStatus.RUNNING,
            startedAt: new Date(),
          }),
        );
      const runSpy = jest
        .spyOn(
          service as unknown as { runExecution: jest.Mock },
          'runExecution',
        )
        .mockRejectedValueOnce(new Error('setup boom — race'));
      mockExecutionRepo.save.mockClear();
      // guarded UPDATE 가 0행 매칭 — 동시 cancel 선점 시뮬레이션.
      mockExecutionRepo.query.mockResolvedValueOnce([]);
      const emitSpy = jest
        .spyOn(
          (service as unknown as { eventEmitter: { emitExecution: jest.Mock } })
            .eventEmitter,
          'emitExecution',
        )
        .mockResolvedValue(undefined);
      try {
        await service.runExecutionFromQueue(executionId, {});
        await flushPromises();
        await flushPromises();
        const failedSave = mockExecutionRepo.save.mock.calls.find(
          (c) =>
            (c[0] as Partial<Execution>)?.status === ExecutionStatus.FAILED,
        );
        expect(failedSave).toBeUndefined();
        expect(emitSpy).not.toHaveBeenCalledWith(
          executionId,
          ExecutionEventType.EXECUTION_FAILED,
          expect.anything(),
        );
      } finally {
        runSpy.mockRestore();
        emitSpy.mockRestore();
      }
    });

    it('W2: failFirstSegmentSetup 은 이미 terminal 이면 재마킹 no-op', async () => {
      mockExecutionRepo.findOneBy
        .mockResolvedValueOnce(pendingRow({ triggerId: 'trg-w2b' }))
        .mockResolvedValueOnce(pendingRow({ status: ExecutionStatus.FAILED }));
      const runSpy = jest
        .spyOn(
          service as unknown as { runExecution: jest.Mock },
          'runExecution',
        )
        .mockRejectedValueOnce(new Error('boom'));
      mockExecutionRepo.save.mockClear();
      try {
        await service.runExecutionFromQueue(executionId, {});
        await flushPromises();
        await flushPromises();
        const failedSave = mockExecutionRepo.save.mock.calls.find(
          (c) =>
            (c[0] as Partial<Execution>)?.status === ExecutionStatus.FAILED,
        );
        expect(failedSave).toBeUndefined();
      } finally {
        runSpy.mockRestore();
      }
    });

    // exec-park D6 full B3 — 배리어(armFirstSegmentBarrier/settleFirstSegment/
    // signalParkBarrier) 와 detach 모델이 제거됐다. runExecutionFromQueue 는
    // try/catch 안에서 runExecution 을 직접 await 하며, park 는 세그먼트 종료
    // (runExecution 정상 반환)이므로 worker 가 자연스럽게 반환한다.
    it('runExecution 을 직접 await 하고 park(정상 반환) 후 worker 가 반환한다', async () => {
      mockExecutionRepo.findOneBy.mockResolvedValueOnce(
        pendingRow({ triggerId: 'trg-park' }),
      );
      // park = runExecution 이 정상 resolve (segment end). 별도 배리어 await 없이
      // runExecutionFromQueue 가 그 promise 를 await 후 반환해야 한다.
      const runSpy = jest
        .spyOn(
          service as unknown as { runExecution: jest.Mock },
          'runExecution',
        )
        .mockResolvedValueOnce(undefined);
      await expect(
        service.runExecutionFromQueue(executionId, {}),
      ).resolves.toBeUndefined();
      expect(runSpy).toHaveBeenCalledTimes(1);
      runSpy.mockRestore();
    });
  });

  describe('PR2a — §8 active-running 누적 타임아웃', () => {
    // private 멤버 접근 헬퍼 (spec 의 기존 `service as unknown as {...}` 패턴).
    const priv = () =>
      service as unknown as {
        maxActiveRunningMs: number;
        segmentStartMs: Map<string, number>;
        assertActiveTimeWithinLimit: (e: {
          id: string;
          activeRunningMs?: number;
        }) => void;
        // 실제 시그니처는 `linkedNodeExec` 를 받고 **boolean 을 반환**한다(전이가 실제로
        // 영속됐는지). 옛 `Promise<void>` 선언은 `expect(applied).toBe(...)` 단언을
        // `void` 대상으로 만들어 사실상 무의미하게 했다 — 실제 타입으로 교정한다.
        //
        // **같은 drift 가 두 번째다.** 프로덕션이 4번째 인자 `opts`(`allowRetryReentry`)를
        // 받게 됐는데 이 손-미러 타입은 3개에 멈춰 있었고, 아래 호출 두 곳이 4개를 넘겨
        // TS2554 를 냈다 — 그런데 `*.spec.ts` 는 `nest build` 에서 exclude 되고 jest 는
        // 타입을 strip 하므로 **어떤 게이트도 이걸 보지 못했다**. 이 PR 의 ratchet 이
        // 막으려는 구멍이 정확히 이것이다.
        updateExecutionStatus: (
          e: Partial<Execution>,
          s: ExecutionStatus,
          linkedNodeExec?: NodeExecution,
          opts?: TransitionOptions,
        ) => Promise<boolean>;
      };

    describe('assertActiveTimeWithinLimit', () => {
      it('누적 active 시간이 한도 이상이면 ExecutionTimeLimitError throw', () => {
        priv().maxActiveRunningMs = 1000;
        expect(() =>
          priv().assertActiveTimeWithinLimit({
            id: 'e1',
            activeRunningMs: 1000,
          }),
        ).toThrow(ExecutionTimeLimitError);
      });

      it('한도 미만이면 통과', () => {
        priv().maxActiveRunningMs = 1000;
        expect(() =>
          priv().assertActiveTimeWithinLimit({
            id: 'e2',
            activeRunningMs: 500,
          }),
        ).not.toThrow();
      });

      it('진행 중 세그먼트 경과분(segmentStartMs)도 합산해 판정', () => {
        priv().maxActiveRunningMs = 1000;
        // 누적 600 + 진행 중 세그먼트(명시적 600ms 전 시작) = 1200 ≥ 1000 → throw.
        // CI 부하 영향 없이 결정론적으로 한도 초과를 보장하도록 충분한 여유값 사용.
        priv().segmentStartMs.set('e3', Date.now() - 600);
        expect(() =>
          priv().assertActiveTimeWithinLimit({
            id: 'e3',
            activeRunningMs: 600,
          }),
        ).toThrow(ExecutionTimeLimitError);
        priv().segmentStartMs.delete('e3');
      });

      it('maxActiveRunningMs=0 은 무제한 — throw 안 함', () => {
        priv().maxActiveRunningMs = 0;
        expect(() =>
          priv().assertActiveTimeWithinLimit({
            id: 'e4',
            activeRunningMs: 999_999,
          }),
        ).not.toThrow();
      });
    });

    describe('updateExecutionStatus 누적 (RUNNING 진입/이탈)', () => {
      // ai-review CRITICAL #1 (2026-07-30, 9차 라운드) — 8R 수정이 처음 도달 가능하게
      // 만든 "turn 계속 → re-park" 경로(`FAILED → WAITING_FOR_INPUT`)를 **짝 전이
      // 분기에서 직접** 잠근다. 9R 은 이 경로의 회귀 안전망이 전무하다고 지적했고,
      // 뮤턴트 D(`reparkAiResumeTurn` 의 opts 전달 제거)가 RED 였던 것은 인자-shape
      // 단언 덕분일 뿐 **opts 가 DB SQL 가드까지 도달하는지는 아무도 안 봤다**.
      //
      // multi-turn continuation 시나리오를 통합으로 구성하려면 핸들러 반환 형태를
      // 정확히 재현해야 해 비용이 크다(시도했으나 `FOR UPDATE` 잠금에 도달조차
      // 못했다). 대신 그 경로가 실제로 쓰는 짝 전이를 직접 호출해 잠근다 —
      // 9R WARNING #6("focused describe 가 새 opts 를 인지하지 못한다")과 같은 취지.
      it('opt-in 시 짝 전이가 FAILED → WAITING_FOR_INPUT 를 persist 한다 (turn 계속 re-park 경로)', async () => {
        const exec = {
          id: executionId,
          status: ExecutionStatus.FAILED,
          activeRunningMs: 0,
        } as unknown as Execution;
        const nodeExec = { id: 'ne-repark' } as unknown as NodeExecution;
        h.dbExecutionStatus = ExecutionStatus.FAILED;

        const persisted = await priv().updateExecutionStatus(
          exec,
          ExecutionStatus.WAITING_FOR_INPUT,
          nodeExec,
          { allowRetryReentry: true },
        );

        expect(persisted).toBe(true);
        const lockSqls = mockTxManagerQuery.mock.calls
          .map((c: unknown[]) => String(c[0]))
          .filter((sql) => sql.includes('FOR UPDATE'));
        expect(lockSqls.length).toBeGreaterThan(0);
        expect(lockSqls.some((sql) => sql.includes("'failed'"))).toBe(true);
      });

      // 대조 — opt-in 이 없으면 FAILED 행은 잠기지 않아야 한다(부활 차단).
      it('opt-in 없으면 FAILED 행의 짝 전이는 persist 되지 않는다', async () => {
        const exec = {
          id: executionId,
          status: ExecutionStatus.RUNNING,
          activeRunningMs: 0,
        } as unknown as Execution;
        const nodeExec = { id: 'ne-repark' } as unknown as NodeExecution;
        h.dbExecutionStatus = ExecutionStatus.FAILED;

        const persisted = await priv().updateExecutionStatus(
          exec,
          ExecutionStatus.WAITING_FOR_INPUT,
          nodeExec,
        );

        expect(persisted).toBe(false);
      });

      // ai-review CRITICAL #1 (2026-07-30) — else 분기(linkedNodeExec 없음)의
      // guarded UPDATE 도 retry 재진입 opt-in 시 FAILED 를 포함해야 한다. 포함하지
      // 않으면 `status IN ('pending','running','waiting_for_input')` 이 FAILED 행을
      // 배제해 **항상 0행**이 되고 재진입이 persist 되지 않는다. mutation 으로
      // 실증했듯(뮤턴트 C) 이 단언이 없으면 FAILED 포함을 제거해도 아무 테스트가
      // 깨지지 않는다.
      it('opt-in(allowRetryReentry) 시 else 분기 guarded UPDATE 가 failed 를 조건에 포함한다', async () => {
        const exec = {
          id: executionId,
          status: ExecutionStatus.FAILED,
          activeRunningMs: 0,
        } as unknown as Execution;
        mockExecutionRepo.query.mockResolvedValueOnce([{ id: executionId }]);

        const persisted = await priv().updateExecutionStatus(
          exec,
          ExecutionStatus.RUNNING,
          undefined,
          { allowRetryReentry: true },
        );

        expect(persisted).toBe(true);
        const sql = String(
          (mockExecutionRepo.query.mock.calls.at(-1) as unknown[])[0],
        );
        expect(sql).toContain("'failed'");
      });

      // 대조 — opt-in 이 없으면 FAILED 를 포함하지 않아야 한다(실패 종결 실행의
      // 우발적 부활 차단이 이 설계의 요지).
      it('opt-in 없으면 else 분기 guarded UPDATE 가 failed 를 포함하지 않는다', async () => {
        const exec = {
          id: executionId,
          status: ExecutionStatus.RUNNING,
          activeRunningMs: 0,
        } as unknown as Execution;
        mockExecutionRepo.query.mockResolvedValueOnce([{ id: executionId }]);

        await priv().updateExecutionStatus(exec, ExecutionStatus.COMPLETED);

        const sql = String(
          (mockExecutionRepo.query.mock.calls.at(-1) as unknown[])[0],
        );
        expect(sql).not.toContain("'failed'");
      });

      // CLE-T-5QG099 #26 — opt-in 이어도 completed · cancelled 행은 잡지 않는다. 상태
      // 머신 계층의 대칭 테스트와 짝을 이루는 DB 가드 계층의 대조다. 진짜 동시 취소가
      // 재진입 짝 전이에 덮이지 않는 것이 이 opt-in 설계의 전제다.
      it.each([ExecutionStatus.COMPLETED, ExecutionStatus.CANCELLED])(
        'opt-in 이어도 DB 가 %s 면 짝 전이는 persist 되지 않는다',
        async (terminal) => {
          const exec = {
            id: executionId,
            status: ExecutionStatus.FAILED,
            activeRunningMs: 0,
          } as unknown as Execution;
          const nodeExec = { id: 'ne-repark' } as unknown as NodeExecution;
          h.dbExecutionStatus = terminal;

          const persisted = await priv().updateExecutionStatus(
            exec,
            ExecutionStatus.WAITING_FOR_INPUT,
            nodeExec,
            { allowRetryReentry: true },
          );

          expect(persisted).toBe(false);
          const lockSqls = mockTxManagerQuery.mock.calls
            .map((c: unknown[]) => String(c[0]))
            .filter((sql) => sql.includes('FOR UPDATE'));
          expect(lockSqls.length).toBeGreaterThan(0);
          expect(lockSqls.some((sql) => sql.includes("'failed'"))).toBe(true);
          expect(lockSqls.some((sql) => sql.includes(`'${terminal}'`))).toBe(
            false,
          );
        },
      );

      it('opt-in 이어도 else 분기 guarded UPDATE 는 completed · cancelled 를 조건에 넣지 않는다', async () => {
        const exec = {
          id: executionId,
          status: ExecutionStatus.FAILED,
          activeRunningMs: 0,
        } as unknown as Execution;
        mockExecutionRepo.query.mockResolvedValueOnce([{ id: executionId }]);

        await priv().updateExecutionStatus(
          exec,
          ExecutionStatus.RUNNING,
          undefined,
          { allowRetryReentry: true },
        );

        const sql = String(
          (mockExecutionRepo.query.mock.calls.at(-1) as unknown[])[0],
        );
        expect(sql).toContain("'failed'");
        expect(sql).not.toContain("'completed'");
        expect(sql).not.toContain("'cancelled'");
      });

      it('RUNNING 진입 시 segmentStart 기록, 이탈 시 active 시간 누적', async () => {
        const exec = {
          id: executionId,
          status: ExecutionStatus.PENDING,
          activeRunningMs: 0,
        } as unknown as Execution;
        // PENDING → RUNNING: 세그먼트 시작 기록
        await priv().updateExecutionStatus(exec, ExecutionStatus.RUNNING);
        expect(priv().segmentStartMs.has(executionId)).toBe(true);
        // 세그먼트를 명시적 과거 시점으로 당겨 경과분 확보.
        // CI 부하 영향 없이 결정론적이도록 충분히 큰 고정 오프셋 사용.
        priv().segmentStartMs.set(executionId, Date.now() - 500);
        // RUNNING → COMPLETED: 누적 + segmentStart 제거
        await priv().updateExecutionStatus(exec, ExecutionStatus.COMPLETED);
        expect(exec.activeRunningMs).toBeGreaterThanOrEqual(300);
        expect(priv().segmentStartMs.has(executionId)).toBe(false);
      });

      it('waiting_for_input 으로 이탈해도 누적되고, 그 park 동안은 추가 누적 없음', async () => {
        const exec = {
          id: executionId,
          status: ExecutionStatus.RUNNING,
          activeRunningMs: 100,
        } as unknown as Execution;
        // 명시적 과거 시점으로 설정해 CI 부하 관계없이 결정론적 누적 보장.
        priv().segmentStartMs.set(executionId, Date.now() - 500);
        await priv().updateExecutionStatus(
          exec,
          ExecutionStatus.WAITING_FOR_INPUT,
        );
        const afterPark = exec.activeRunningMs;
        expect(afterPark).toBeGreaterThanOrEqual(300); // 100 + 최소 200(실제로는 ~500)
        // park: segmentStart 없음 → assertActiveTimeWithinLimit 는 누적분만 사용
        expect(priv().segmentStartMs.has(executionId)).toBe(false);
      });

      // M-3 — else 분기 guarded UPDATE 반환 계약.
      it('else 분기: guarded UPDATE 가 1행 매칭이면 true (적용됨)', async () => {
        mockExecutionRepo.query.mockResolvedValueOnce([{ id: executionId }]);
        const exec = {
          id: executionId,
          status: ExecutionStatus.RUNNING,
          activeRunningMs: 0,
        } as unknown as Execution;
        const applied = await priv().updateExecutionStatus(
          exec,
          ExecutionStatus.COMPLETED,
        );
        expect(applied).toBe(true);
        // status IN (비-terminal) 가드가 쿼리에 포함.
        expect(mockExecutionRepo.query).toHaveBeenCalledWith(
          expect.stringMatching(
            /status IN \('pending', 'running', 'waiting_for_input'\)/,
          ),
          expect.arrayContaining([executionId, ExecutionStatus.COMPLETED]),
        );
      });

      it('else 분기: guarded UPDATE 가 0행이면 false (동시 cancel/park 선점 → emit skip)', async () => {
        mockExecutionRepo.query.mockResolvedValueOnce([]); // affected 0
        const exec = {
          id: executionId,
          status: ExecutionStatus.RUNNING,
          activeRunningMs: 0,
        } as unknown as Execution;
        const applied = await priv().updateExecutionStatus(
          exec,
          ExecutionStatus.COMPLETED,
        );
        expect(applied).toBe(false);
      });

      // CLE-T-ES1J1E — REST 중지는 행을 `cancelled` 로 마감할 뿐 돌고 있는 엔진에 신호를 보내지
      // 않는다. 엔진이 다음 경계에서 구간을 닫을 때 상태 전이는 가드에 막혀 0행이고, 종전에는
      // 구간 합산도 함께 버려져 중지된 실행의 실행 시간에서 마지막 구간이 빠졌다.
      describe('REST 중지로 이미 cancelled 인 행에 마지막 구간을 더한다', () => {
        const ADD_SEGMENT_SQL = /SET active_running_ms = LEAST\(/;
        const addSegmentCalls = () =>
          mockExecutionRepo.query.mock.calls.filter((c: unknown[]) =>
            ADD_SEGMENT_SQL.test(String(c[0])),
          );

        it('else 분기가 0행이면 닫은 구간만큼 cancelled 행의 active_running_ms 에 더한다', async () => {
          const segStart = Date.now() - 500;
          priv().segmentStartMs.set(executionId, segStart);
          mockExecutionRepo.query.mockResolvedValueOnce([]); // guarded UPDATE 0행
          const exec = {
            id: executionId,
            status: ExecutionStatus.RUNNING,
            activeRunningMs: 100,
          } as unknown as Execution;

          const applied = await priv().updateExecutionStatus(
            exec,
            ExecutionStatus.CANCELLED,
          );

          expect(applied).toBe(false);
          const calls = addSegmentCalls();
          expect(calls).toHaveLength(1);
          const [sql, params] = calls[0] as [string, unknown[]];
          const [id, elapsedMs, startMs, status] = params;
          expect(id).toBe(executionId);
          expect(elapsedMs).toBeGreaterThanOrEqual(500);
          expect(startMs).toBe(segStart);
          expect(status).toBe(ExecutionStatus.CANCELLED);
          // 실행 시간 컬럼 하나만 더하고 종결 행의 다른 컬럼은 건드리지 않는다.
          expect(sql).toMatch(/WHERE id = \$1\s+AND status = \$4/);
          const setClause = sql.slice(sql.indexOf('SET'), sql.indexOf('WHERE'));
          expect(setClause).not.toMatch(
            /\b(status|finished_at|duration_ms|output_data|error)\s*=/i,
          );
          // 구간 끝(중지 시각과 지금 중 이른 쪽) · 음수 0 · int4 상한은 SQL 이 정한다. mock 의 query 는 SQL 을
          // 실행하지 않아 여기서는 헬퍼 상수를 쓰는지만 보고, 계산 결과는 engine-cancel-duration e2e 가
          // 실제 Postgres 로 검증한다.
          expect(sql).toBe(ADD_STOPPED_SEGMENT_SQL);
          expect(priv().segmentStartMs.has(executionId)).toBe(false);
        });

        it('AI 재-park 짝 전이가 cancelled 행에 막혀도 닫은 구간을 더한다', async () => {
          priv().segmentStartMs.set(executionId, Date.now() - 500);
          h.dbExecutionStatus = ExecutionStatus.CANCELLED;
          const exec = {
            id: executionId,
            status: ExecutionStatus.RUNNING,
            activeRunningMs: 0,
          } as unknown as Execution;
          const nodeExec = { id: 'ne-repark' } as unknown as NodeExecution;

          const persisted = await priv().updateExecutionStatus(
            exec,
            ExecutionStatus.WAITING_FOR_INPUT,
            nodeExec,
          );

          expect(persisted).toBe(false);
          expect(addSegmentCalls()).toHaveLength(1);
        });

        it('전이가 적용되면 구간은 그 UPDATE 에 실리므로 따로 더하지 않는다', async () => {
          priv().segmentStartMs.set(executionId, Date.now() - 500);
          mockExecutionRepo.query.mockResolvedValueOnce([{ id: executionId }]);
          const exec = {
            id: executionId,
            status: ExecutionStatus.RUNNING,
            activeRunningMs: 0,
          } as unknown as Execution;

          await priv().updateExecutionStatus(exec, ExecutionStatus.CANCELLED);

          expect(addSegmentCalls()).toHaveLength(0);
        });

        it('입력 대기에서 중지된 실행은 열린 구간이 없으므로 대기 시간을 더하지 않는다', async () => {
          // 대기 중에는 구간이 없다. 남아 있더라도 RUNNING 이탈이 아니면 쓰지 않는다는 것을 보이려고 둔다.
          priv().segmentStartMs.set(executionId, Date.now() - 500);
          mockExecutionRepo.query.mockResolvedValueOnce([]); // guarded UPDATE 0행
          const exec = {
            id: executionId,
            status: ExecutionStatus.WAITING_FOR_INPUT,
            activeRunningMs: 0,
          } as unknown as Execution;

          await priv().updateExecutionStatus(exec, ExecutionStatus.CANCELLED);

          expect(addSegmentCalls()).toHaveLength(0);
          priv().segmentStartMs.delete(executionId);
        });

        it('더하는 UPDATE 가 실패해도 던지지 않는다 (호출부가 종결 처리 catch 블록 안이다)', async () => {
          priv().segmentStartMs.set(executionId, Date.now() - 500);
          mockExecutionRepo.query
            .mockResolvedValueOnce([]) // guarded UPDATE 0행
            .mockRejectedValueOnce(new Error('db down')); // 구간 더하기 실패
          const exec = {
            id: executionId,
            status: ExecutionStatus.RUNNING,
            activeRunningMs: 0,
          } as unknown as Execution;

          await expect(
            priv().updateExecutionStatus(exec, ExecutionStatus.CANCELLED),
          ).resolves.toBe(false);
          expect(addSegmentCalls()).toHaveLength(1);
        });
      });

      // 컬럼이 int4 라 합이 상한을 넘으면 상태 전이 UPDATE 가 파라미터 단계에서 실패한다. 그러면 행이
      // 0행인지 가리기 전에 던져서 위 「마지막 구간 더하기」까지 가지 못한다.
      it('RUNNING 을 떠나며 더한 실행 시간이 int4 상한을 넘으면 상한에서 멈춘다', async () => {
        priv().segmentStartMs.set(executionId, Date.now() - 500);
        mockExecutionRepo.query.mockResolvedValueOnce([{ id: executionId }]);
        const exec = {
          id: executionId,
          status: ExecutionStatus.RUNNING,
          activeRunningMs: PG_INT4_MAX - 100,
        } as unknown as Execution;

        await priv().updateExecutionStatus(exec, ExecutionStatus.CANCELLED);

        expect(exec.activeRunningMs).toBe(PG_INT4_MAX);
        const transition = mockExecutionRepo.query.mock.calls.find(
          (c: unknown[]) => /SET status = \$2/.test(String(c[0])),
        ) as [string, unknown[]] | undefined;
        expect(transition?.[1][2]).toBe(PG_INT4_MAX);
      });

      // #6 — PENDING → RUNNING 동시 선점 케이스: 다른 워커가 먼저 상태를 바꿨을 때
      // guarded UPDATE 가 0행 반환 → false (선점 감지).
      it('else 분기: PENDING → RUNNING 전이가 0행(다른 워커 선점)이면 false 반환', async () => {
        mockExecutionRepo.query.mockResolvedValueOnce([]); // 0행 = 선점됨
        const exec = {
          id: executionId,
          status: ExecutionStatus.PENDING,
          activeRunningMs: 0,
        } as unknown as Execution;
        const applied = await priv().updateExecutionStatus(
          exec,
          ExecutionStatus.RUNNING,
        );
        expect(applied).toBe(false);
        // status IN 가드가 쿼리에 포함돼야 선점을 탐지할 수 있다.
        expect(mockExecutionRepo.query).toHaveBeenCalledWith(
          expect.stringMatching(/status IN/),
          expect.anything(),
        );
      });

      // ai-review WARNING #9 (2026-07-26, concurrency/side_effect) — 거부된(no-op)
      // RUNNING 전이는 segmentStartMs 를 기록하지 않아야 한다. 가드보다 먼저
      // 무조건 기록하면, 이 executionId 는 실제로 RUNNING 이 된 적이 없어 "이탈"
      // 분기가 결코 오지 않으므로 in-memory 유령 항목이 정리 기회 없이 누적된다.
      it('else 분기: PENDING → RUNNING 전이가 거부되면(0행) segmentStartMs 를 기록하지 않는다 (WARNING #9)', async () => {
        priv().segmentStartMs.delete(executionId);
        mockExecutionRepo.query.mockResolvedValueOnce([]); // 0행 = 선점됨
        const exec = {
          id: executionId,
          status: ExecutionStatus.PENDING,
          activeRunningMs: 0,
        } as unknown as Execution;
        const applied = await priv().updateExecutionStatus(
          exec,
          ExecutionStatus.RUNNING,
        );
        expect(applied).toBe(false);
        expect(priv().segmentStartMs.has(executionId)).toBe(false);
      });

      // ── linkedNodeExec(park 짝 전이) 분기의 terminal 가드 ───────────────────
      // M-3(2026-06-14)은 else 분기만 guarded UPDATE 로 고치고 짝 전이는 명시적으로
      // "범위 밖" 으로 남겼다. 그 자리가 살아있는 결함이었다 — AI multi-turn 턴 진행 중
      // 사용자 Stop 으로 CANCELLED 된 실행이, 턴 종료 후 re-park 의 **stale** full-entity
      // save 로 WAITING_FOR_INPUT 으로 되살아난다(취소 소실).
      //   `savedExecution` 은 resume 진입 시 로드된 뒤 재로드되지 않으므로 in-memory
      //   status 는 RUNNING 이고, `assertTransition(RUNNING → WAITING_FOR_INPUT)` 은
      //   정상 전이라 통과한다 — 즉 DB 를 보지 않으면 막을 방법이 없다.
      //   ai-review WARNING #1 (2026-07-26, 4차 라운드) — 잠금 조회는
      //   `lockNonTerminalExecutionRow` 로 아래 `tryLockActiveExecutionAndSaveNodeExec
      //   — RUNNING 유지 분기 전용 원자 관측+save` describe 와 공유. 아래 테스트는
      //   그 공유 이후에도 독립적으로 회귀를 가드한다(교차 검증 완료). (ai-review
      //   WARNING #5, 2026-07-27, documentation — 하드코딩 줄 번호 대신 describe
      //   이름 인용으로 교체: 원래 "L5071" 는 이미 도입 시점부터 실제 위치와
      //   어긋나 있었다.)
      describe('linkedNodeExec 짝 전이 — terminal 가드 (park↔resume lost update 차단)', () => {
        const mkPair = () => ({
          exec: {
            id: executionId,
            // stale: DB 는 이미 CANCELLED 일 수 있으나 엔티티는 RUNNING 인 채다.
            status: ExecutionStatus.RUNNING,
            activeRunningMs: 0,
          } as unknown as Execution,
          nodeExec: {
            id: 'node-exec-1',
            status: NodeExecutionStatus.RUNNING,
          } as unknown as NodeExecution,
        });

        it('DB 가 비-terminal 이면 기존대로 짝 전이를 영속하고 true', async () => {
          const { exec, nodeExec } = mkPair();
          const applied = await priv().updateExecutionStatus(
            exec,
            ExecutionStatus.WAITING_FOR_INPUT,
            nodeExec,
          );
          expect(applied).toBe(true);
          expect(mockExecutionRepo.save).toHaveBeenCalled();
          expect(mockNodeExecutionRepo.save).toHaveBeenCalled();
        });

        it('DB 가 이미 terminal(동시 Stop)이면 두 save 를 모두 건너뛰고 false', async () => {
          // 행 잠금이 0행 → stop() 이 이미 CANCELLED 로 마감했다는 뜻.
          mockTxManagerQuery.mockResolvedValueOnce([]);
          const { exec, nodeExec } = mkPair();
          const saveCallsBefore = mockExecutionRepo.save.mock.calls.length;
          const nodeSaveBefore = mockNodeExecutionRepo.save.mock.calls.length;

          const applied = await priv().updateExecutionStatus(
            exec,
            ExecutionStatus.WAITING_FOR_INPUT,
            nodeExec,
          );

          expect(applied).toBe(false);
          // Execution 을 되살리지 않는다 (핵심 회귀 — 취소 소실 차단).
          expect(mockExecutionRepo.save.mock.calls.length).toBe(
            saveCallsBefore,
          );
          // NodeExecution 도 WAITING_FOR_INPUT 으로 되돌리지 않는다.
          expect(mockNodeExecutionRepo.save.mock.calls.length).toBe(
            nodeSaveBefore,
          );
        });

        it('가드는 행 잠금(FOR UPDATE) + 비-terminal 조건으로 조회한다', async () => {
          const { exec, nodeExec } = mkPair();
          await priv().updateExecutionStatus(
            exec,
            ExecutionStatus.WAITING_FOR_INPUT,
            nodeExec,
          );
          // FOR UPDATE 가 없으면 검사와 save 사이에 stop() 이 끼어들 수 있다
          // (검사-후-사용 race). 잠금은 트랜잭션 커밋까지 유지된다.
          expect(mockTxManagerQuery).toHaveBeenCalledWith(
            expect.stringMatching(/FOR UPDATE/),
            [executionId],
          );
          expect(mockTxManagerQuery).toHaveBeenCalledWith(
            expect.stringMatching(
              /status IN \('pending', 'running', 'waiting_for_input'\)/,
            ),
            expect.anything(),
          );
        });

        // ai-review WARNING #9 (2026-07-26, concurrency/side_effect) — 짝 전이
        // 분기가 RUNNING 으로 진입하는 경우(예: retry-last-turn RUNNING 재claim)도
        // 동일하게, 행 잠금 가드가 실제로 거부하면(terminal) segmentStartMs 를
        // 기록하지 않아야 한다.
        it('짝 전이로 RUNNING 진입이 거부되면(terminal) segmentStartMs 를 기록하지 않는다 (WARNING #9)', async () => {
          priv().segmentStartMs.delete(executionId);
          mockTxManagerQuery.mockResolvedValueOnce([]); // 행 잠금 0행 → terminal
          const exec = {
            id: executionId,
            status: ExecutionStatus.PENDING,
            activeRunningMs: 0,
          } as unknown as Execution;
          const nodeExec = {
            id: 'node-exec-reclaim-rejected',
            status: NodeExecutionStatus.RUNNING,
          } as unknown as NodeExecution;

          const applied = await priv().updateExecutionStatus(
            exec,
            ExecutionStatus.RUNNING,
            nodeExec,
          );

          expect(applied).toBe(false);
          expect(priv().segmentStartMs.has(executionId)).toBe(false);
        });

        it('대조: 짝 전이로 RUNNING 진입이 적용되면 segmentStartMs 를 기록한다', async () => {
          priv().segmentStartMs.delete(executionId);
          const exec = {
            id: executionId,
            status: ExecutionStatus.PENDING,
            activeRunningMs: 0,
          } as unknown as Execution;
          const nodeExec = {
            id: 'node-exec-reclaim-ok',
            status: NodeExecutionStatus.RUNNING,
          } as unknown as NodeExecution;

          const applied = await priv().updateExecutionStatus(
            exec,
            ExecutionStatus.RUNNING,
            nodeExec,
          );

          expect(applied).toBe(true);
          expect(priv().segmentStartMs.has(executionId)).toBe(true);
          priv().segmentStartMs.delete(executionId);
        });
      });

      // #6 — query() 자체 reject 케이스: DB 연결 실패 등 인프라 오류는 호출부로 throw.
      it('else 분기: query() reject 시 오류가 상위로 전파된다', async () => {
        const dbError = new Error('connection refused');
        mockExecutionRepo.query.mockRejectedValueOnce(dbError);
        const exec = {
          id: executionId,
          status: ExecutionStatus.RUNNING,
          activeRunningMs: 0,
        } as unknown as Execution;
        await expect(
          priv().updateExecutionStatus(exec, ExecutionStatus.COMPLETED),
        ).rejects.toBe(dbError);
      });
    });
  });

  // ai-review WARNING #1 (2026-07-26, 3차 라운드 — concurrency/architecture/
  // requirement 3개 reviewer 공통 지적) — `finalizeAiNode` 의 "이미 RUNNING
  // 유지" 분기는 `updateExecutionStatus`(짝 전이 choke point) 를 타지 않아
  // (RUNNING→RUNNING 이라 전이 자체가 없음) 형제 분기의 FOR UPDATE 보호를
  // 받지 못했다. 최초 fix 는 `assertExecutionNotCancelled`(단순 SELECT) 로
  // 재확인한 뒤 별도로 `nodeExec` 를 save 해, 그 확인~save 사이에 검사-후-사용
  // 창이 남았다. 위 "linkedNodeExec 짝 전이 — terminal 가드" idiom 을 미러해
  // 관측+save 를 같은 트랜잭션의 행 잠금(FOR UPDATE) 안에서 원자화한다.
  //
  // ai-review WARNING #4 (2026-07-26, 4차 라운드 — maintainability) —
  // `assertActiveExecutionAndSaveNodeExec` 에서 `tryLockActiveExecutionAndSaveNodeExec`
  // 로 개명(non-throwing/bool 반환임을 이름에 명시). 아래 테스트는 그대로
  // 유지되며 개명 후에도 동일한 회귀를 가드한다.
  //
  // ai-review WARNING #1 (2026-07-26, 4차 라운드 — architecture/maintainability)
  // — 잠금 조회(FOR UPDATE + 비-terminal 조건) 자체는 `lockNonTerminalExecutionRow`
  // 로 `updateExecutionStatus` 의 `linkedNodeExec` 분기와 공유하게 추출됐다.
  // 아래 3개 시나리오(비-terminal→save+true / terminal→skip+false / SQL 형태)는
  // 추출 전과 동일하게 이 describe 와 위 `linkedNodeExec 짝 전이 — terminal
  // 가드 (park↔resume lost update 차단)` describe 양쪽에서 **독립적으로**
  // 재현 가능해야 한다 — 공유 헬퍼에서 (a) 조기 return, (b) FOR UPDATE, (c)
  // 비-terminal 조건 중 하나라도 제거되면 두 describe 의 해당 테스트가 각각
  // RED 로 떨어진다(교차 검증 완료, 2026-07-26). (ai-review WARNING #5,
  // 2026-07-27, documentation — 하드코딩 줄 번호 대신 describe 이름 인용으로
  // 교체: 원래 "L4925" 는 이미 도입 시점부터 실제 위치와 어긋나 있었다.)
  // CLE-T-9WG82W — DB 가드의 status 목록은 상태 머신에서 파생한다. 8R CRITICAL 은
  // 상태 머신 opt-in 과 손으로 맞춘 이 목록이 어긋난 결함이었다. 목록 값과 파생 관계를
  // 함께 잠가, 전이 표나 엔진 어느 한쪽만 바뀌면 여기서 드러나게 한다.
  describe('DB 가드 status 목록 — 상태 머신 파생', () => {
    const statics = () =>
      ExecutionEngineService as unknown as {
        NON_TERMINAL_STATUSES_SQL: string;
        NON_TERMINAL_OR_FAILED_STATUSES_SQL: string;
        guardStatusesSql: (opts?: TransitionOptions) => string;
      };
    const toSql = (statuses: string[]) =>
      statuses.map((status) => `'${status}'`).join(', ');

    it('기본 목록은 nonTerminalStatuses() 와 같다', () => {
      expect(statics().NON_TERMINAL_STATUSES_SQL).toBe(
        toSql(nonTerminalStatuses()),
      );
      expect(statics().NON_TERMINAL_STATUSES_SQL).toBe(
        "'pending', 'running', 'waiting_for_input'",
      );
    });

    it('opt-in 목록은 nonTerminalStatuses({ allowRetryReentry: true }) 와 같다', () => {
      expect(statics().NON_TERMINAL_OR_FAILED_STATUSES_SQL).toBe(
        toSql(nonTerminalStatuses({ allowRetryReentry: true })),
      );
      expect(statics().NON_TERMINAL_OR_FAILED_STATUSES_SQL).toBe(
        "'pending', 'running', 'failed', 'waiting_for_input'",
      );
    });

    it('guardStatusesSql 은 opt-in 일 때만 failed 를 포함한 목록을 고른다', () => {
      const { guardStatusesSql } = statics();
      expect(guardStatusesSql({ allowRetryReentry: true })).toBe(
        statics().NON_TERMINAL_OR_FAILED_STATUSES_SQL,
      );
      for (const opts of [undefined, {}, { allowRetryReentry: false }]) {
        expect(guardStatusesSql(opts)).toBe(
          statics().NON_TERMINAL_STATUSES_SQL,
        );
      }
    });
  });

  describe('tryLockActiveExecutionAndSaveNodeExec — RUNNING 유지 분기 전용 원자 관측+save', () => {
    const priv = () =>
      service as unknown as {
        tryLockActiveExecutionAndSaveNodeExec: (
          executionId: string,
          nodeExec: NodeExecution | null,
          opts?: TransitionOptions,
        ) => Promise<boolean>;
      };

    it('DB 가 비-terminal 이면 nodeExec 를 save 하고 true', async () => {
      const nodeExec = {
        id: 'node-exec-running-keep',
        status: NodeExecutionStatus.COMPLETED,
      } as unknown as NodeExecution;

      const persisted = await priv().tryLockActiveExecutionAndSaveNodeExec(
        executionId,
        nodeExec,
      );

      expect(persisted).toBe(true);
      expect(mockNodeExecutionRepo.save).toHaveBeenCalledWith(nodeExec);
      // Execution 자체는 save 하지 않는다 — RUNNING→RUNNING 이라 전이가 없다
      // (updateExecutionStatus 의 linkedNodeExec 분기와의 핵심 차이).
      expect(mockExecutionRepo.save).not.toHaveBeenCalled();
    });

    it('DB 가 이미 terminal(동시 Stop)이면 save 를 건너뛰고 false', async () => {
      mockTxManagerQuery.mockResolvedValueOnce([]); // 행 잠금 0행 → terminal
      const nodeExec = {
        id: 'node-exec-running-keep-2',
        status: NodeExecutionStatus.COMPLETED,
      } as unknown as NodeExecution;
      const saveCallsBefore = mockNodeExecutionRepo.save.mock.calls.length;

      const persisted = await priv().tryLockActiveExecutionAndSaveNodeExec(
        executionId,
        nodeExec,
      );

      expect(persisted).toBe(false);
      // 취소된 NodeExecution 이 잠깐이라도 COMPLETED 로 영속되지 않아야 한다.
      expect(mockNodeExecutionRepo.save.mock.calls.length).toBe(
        saveCallsBefore,
      );
    });

    it('가드는 행 잠금(FOR UPDATE) + 비-terminal 조건으로 조회한다', async () => {
      const nodeExec = {
        id: 'node-exec-running-keep-3',
        status: NodeExecutionStatus.COMPLETED,
      } as unknown as NodeExecution;

      await priv().tryLockActiveExecutionAndSaveNodeExec(executionId, nodeExec);

      // FOR UPDATE 가 없으면 확인과 save 사이에 stop() 이 끼어들 수 있다
      // (검사-후-사용 race). 잠금은 트랜잭션 커밋까지 유지된다.
      expect(mockTxManagerQuery).toHaveBeenCalledWith(
        expect.stringMatching(/FOR UPDATE/),
        [executionId],
      );
      expect(mockTxManagerQuery).toHaveBeenCalledWith(
        expect.stringMatching(
          /status IN \('pending', 'running', 'waiting_for_input'\)/,
        ),
        expect.anything(),
      );
    });

    // CLE-T-5QG099 #27 — 재진입 opt-in 경로. 재진입 턴은 실행이 failed 인 채로 돌아
    // finalizeAiNode 가 이 잠금을 opts 와 함께 부른다. 형제 updateExecutionStatus 에만
    // focused 테스트가 있고 여기는 통합 테스트 1건에 기대던 자리다.
    it('opt-in 이면 DB 가 failed 여도 잠그고 nodeExec 를 save 한다', async () => {
      h.dbExecutionStatus = ExecutionStatus.FAILED;
      const nodeExec = {
        id: 'node-exec-retry-lock',
        status: NodeExecutionStatus.FAILED,
      } as unknown as NodeExecution;

      const persisted = await priv().tryLockActiveExecutionAndSaveNodeExec(
        executionId,
        nodeExec,
        { allowRetryReentry: true },
      );

      expect(persisted).toBe(true);
      expect(mockNodeExecutionRepo.save).toHaveBeenCalledWith(nodeExec);
      expect(mockTxManagerQuery).toHaveBeenCalledWith(
        expect.stringMatching(
          /status IN \('pending', 'running', 'failed', 'waiting_for_input'\)/,
        ),
        [executionId],
      );
    });

    it('opt-in 이 없으면 DB 가 failed 일 때 잠그지 않고 save 를 건너뛴다', async () => {
      h.dbExecutionStatus = ExecutionStatus.FAILED;
      const nodeExec = {
        id: 'node-exec-retry-lock-2',
        status: NodeExecutionStatus.FAILED,
      } as unknown as NodeExecution;

      const persisted = await priv().tryLockActiveExecutionAndSaveNodeExec(
        executionId,
        nodeExec,
      );

      expect(persisted).toBe(false);
      expect(mockNodeExecutionRepo.save).not.toHaveBeenCalled();
    });

    // #26 — opt-in 이어도 진짜 동시 취소 · 완료는 잡지 않는다.
    it.each([ExecutionStatus.COMPLETED, ExecutionStatus.CANCELLED])(
      'opt-in 이어도 DB 가 %s 면 잠그지 않고 save 를 건너뛴다',
      async (terminal) => {
        h.dbExecutionStatus = terminal;
        const nodeExec = {
          id: 'node-exec-retry-lock-3',
          status: NodeExecutionStatus.FAILED,
        } as unknown as NodeExecution;

        const persisted = await priv().tryLockActiveExecutionAndSaveNodeExec(
          executionId,
          nodeExec,
          { allowRetryReentry: true },
        );

        expect(persisted).toBe(false);
        expect(mockNodeExecutionRepo.save).not.toHaveBeenCalled();
      },
    );

    it('nodeExec 가 null 이면(짝이 없는 호출) save 를 시도하지 않고 non-terminal 이면 true', async () => {
      const persisted = await priv().tryLockActiveExecutionAndSaveNodeExec(
        executionId,
        null,
      );

      expect(persisted).toBe(true);
      expect(mockNodeExecutionRepo.save).not.toHaveBeenCalled();
    });
  });
});
