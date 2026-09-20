import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SchedulesService } from './schedules.service';
import { Schedule } from './entities/schedule.entity';
import { Trigger } from '../triggers/entities/trigger.entity';
import { withTransactionMock } from '../triggers/__test-utils__/trigger-transaction-mock';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { ExecutionEngineService } from '../execution-engine/execution-engine.service';
import { ScheduleRunnerService } from './schedule-runner.service';
import { SecretResolverService } from '../secret-store/secret-resolver.service';

describe('SchedulesService.runNow', () => {
  let service: SchedulesService;
  let auditLogs: { record: jest.Mock };
  let scheduleRepo: jest.Mocked<Repository<Schedule>>;
  let triggerRepo: jest.Mocked<Repository<Trigger>>;
  /**
   * schedule 삭제가 trigger 행을 지우기까지의 **순서**: 상한 → 락 → 삭제.
   *
   * 키 하나만 담았을 땐 «상한을 둔다» 가 단언되지 않아, `timeoutMs` 인자를 통째로 지우는
   * 뮤턴트가 25건 전건 GREEN 으로 살아남았다. 형제 경로
   * (`triggers.service.spec.ts` — `remove() 도 같은 config 락을 잡는다`)는 이미 순서 배열을
   * 쓰고 있었다 (`review/code/2026/09/15/01_09_53` testing W1).
   */
  const triggerLockEvents: string[] = [];
  let workspacesService: jest.Mocked<
    Pick<WorkspacesService, 'getWorkspaceTimezone'>
  >;
  let engine: jest.Mocked<ExecutionEngineService>;
  let runner: jest.Mocked<
    Pick<ScheduleRunnerService, 'resolveScheduleParameters'>
  >;

  beforeEach(async () => {
    auditLogs = { record: jest.fn().mockResolvedValue(undefined) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        // 감사 로깅은 부수 효과 — 대상 동작의 단언을 흐리지 않도록 mock 한다.
        // 실제 기록 여부는 audit 전용 describe 가 따로 단언한다.
        { provide: AuditLogsService, useValue: auditLogs },
        SchedulesService,
        {
          provide: getRepositoryToken(Schedule),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
            remove: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Trigger),
          // `update` — schedule 편집의 trigger 동기화는 **컬럼 한정** 갱신이다.
          // `save(entity)` 로 쓰면 읽은 시점의 `config` 까지 되써서 동시 PATCH 가 확립한
          // `chatChannel.inboundSigningRef` 를 되돌린다(인입 서명 fail-open).
          //
          // `withTransactionMock` — schedule 삭제가 trigger 행을 **config 락 안에서** 지운다.
          // 감싸지 않으면 `manager` 가 없어 런타임에 깨진다.
          useValue: withTransactionMock(
            {
              create: jest.fn(),
              save: jest.fn(),
              update: jest.fn().mockResolvedValue(undefined),
              delete: jest.fn((criteria: unknown) => {
                triggerLockEvents.push(`delete:${String(criteria)}`);
                return undefined;
              }),
            },
            {
              onLock: (key) => triggerLockEvents.push(`lock:${key}`),
              onLockTimeout: (statement) =>
                triggerLockEvents.push(`timeout:${statement}`),
            },
          ),
        },
        {
          provide: WorkspacesService,
          useValue: { getWorkspaceTimezone: jest.fn() },
        },
        {
          provide: ExecutionEngineService,
          useValue: { execute: jest.fn() },
        },
        {
          provide: ScheduleRunnerService,
          useValue: {
            resolveScheduleParameters: jest.fn(),
            registerJob: jest.fn(),
            removeJob: jest.fn(),
          },
        },
        {
          provide: SecretResolverService,
          // 비밀 삭제도 락·행 삭제와 **같은 배열**에 넣는다 — 커밋 뒤라는 순서가 보증이다.
          useValue: {
            deleteByPrefix: jest.fn((prefix: string) => {
              triggerLockEvents.push(`deleteByPrefix:${prefix}`);
              return Promise.resolve(0);
            }),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(SchedulesService);
    scheduleRepo = moduleRef.get(getRepositoryToken(Schedule));
    triggerRepo = moduleRef.get(getRepositoryToken(Trigger));
    workspacesService = moduleRef.get(WorkspacesService);
    engine = moduleRef.get(ExecutionEngineService);
    runner = moduleRef.get(ScheduleRunnerService);
  });

  it('resolves parameterValues via runner before executing', async () => {
    scheduleRepo.findOne.mockResolvedValue({
      id: 's1',
      workspaceId: 'ws',
      triggerId: 't1',
      cronExpression: '0 9 * * *',
      timezone: 'Asia/Seoul',
      isActive: true,
      parameterValues: { region: 'kr' },
      trigger: { workflowId: 'wf1' },
    } as unknown as Schedule);

    runner.resolveScheduleParameters.mockResolvedValue({ region: 'kr' });
    engine.execute.mockResolvedValue('exec-42');

    const res = await service.runNow('s1', 'ws', 'user-1');

    expect(res).toEqual({ executionId: 'exec-42' });
    const resolveMock = runner.resolveScheduleParameters;
    expect(resolveMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 's1' }),
      'wf1',
    );
    const executeMock = engine.execute;
    expect(executeMock).toHaveBeenCalledWith(
      'wf1',
      { __triggerSource: 'schedule', parameters: { region: 'kr' } },
      { executedBy: 'user-1' },
    );
  });

  // C-10: findAll 이 PaginationQueryDto 의 sort/order 를 무시하고 created_at DESC 로
  // 고정 정렬하던 회귀 가드. 화이트리스트 매핑(alias 포함) + injection 폴백 검증.
  describe('findAll sort/order', () => {
    function makeQb() {
      const orderBy = jest.fn().mockReturnThis();
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy,
        getCount: jest.fn().mockResolvedValue(0),
        offset: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      return { qb, orderBy };
    }

    it('기본값은 s.created_at DESC', async () => {
      const { qb, orderBy } = makeQb();
      scheduleRepo.createQueryBuilder.mockReturnValue(qb as never);
      await service.findAll('ws-1', {});
      expect(orderBy).toHaveBeenCalledWith('s.created_at', 'DESC');
    });

    it('sort=updated_at&order=asc 를 반영', async () => {
      const { qb, orderBy } = makeQb();
      scheduleRepo.createQueryBuilder.mockReturnValue(qb as never);
      await service.findAll('ws-1', { sort: 'updated_at', order: 'asc' });
      expect(orderBy).toHaveBeenCalledWith('s.updated_at', 'ASC');
    });

    // V110 이 `(workspace_id, next_run_at)` 인덱스로 최적화한 바로 그 축인데, 정작 이
    // 파라미터화 목록에서만 빠져 있었다 (`23_26_09` INFO#9). e2e 로는 닫혀 있으나
    // 빠른 회귀 방어선에 구멍을 남길 이유가 없다.
    it('sort=next_run_at&order=desc 를 반영 (V110 최적화 축)', async () => {
      const { qb, orderBy } = makeQb();
      scheduleRepo.createQueryBuilder.mockReturnValue(qb as never);
      await service.findAll('ws-1', { sort: 'next_run_at', order: 'desc' });
      expect(orderBy).toHaveBeenCalledWith('s.next_run_at', 'DESC');
    });

    it('sort=name 은 trigger 명(t.name)으로 매핑', async () => {
      const { qb, orderBy } = makeQb();
      scheduleRepo.createQueryBuilder.mockReturnValue(qb as never);
      await service.findAll('ws-1', { sort: 'name', order: 'desc' });
      expect(orderBy).toHaveBeenCalledWith('t.name', 'DESC');
    });

    it('미허용 sort 값은 s.created_at 로 폴백 (injection 차단)', async () => {
      const { qb, orderBy } = makeQb();
      scheduleRepo.createQueryBuilder.mockReturnValue(qb as never);
      await service.findAll('ws-1', {
        sort: 's.created_at; DROP TABLE schedule;--',
        order: 'desc',
      });
      expect(orderBy).toHaveBeenCalledWith('s.created_at', 'DESC');
    });
  });

  // 트리거→스케줄 딥링크(cross-page)용 triggerId 필터.
  describe('findAll triggerId filter', () => {
    function makeQb() {
      const andWhere = jest.fn().mockReturnThis();
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere,
        orderBy: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        offset: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      return { qb, andWhere };
    }

    it('triggerId 지정 시 t.id = :triggerId 로 필터', async () => {
      const { qb, andWhere } = makeQb();
      scheduleRepo.createQueryBuilder.mockReturnValue(qb as never);
      await service.findAll('ws-1', { triggerId: 'trg-1' });
      expect(andWhere).toHaveBeenCalledWith('t.id = :triggerId', {
        triggerId: 'trg-1',
      });
    });

    it('triggerId 미지정 시 트리거 필터를 적용하지 않는다', async () => {
      const { qb, andWhere } = makeQb();
      scheduleRepo.createQueryBuilder.mockReturnValue(qb as never);
      await service.findAll('ws-1', {});
      const triggerCall = andWhere.mock.calls.find(
        ([clause]) =>
          typeof clause === 'string' && clause.includes('t.id = :triggerId'),
      );
      expect(triggerCall).toBeUndefined();
    });
  });

  describe('create — timezone fallback (§2.2)', () => {
    const baseDto = {
      workflowId: 'wf-1',
      name: 'S',
      cronExpression: '0 9 * * *',
    };
    beforeEach(() => {
      triggerRepo.create.mockReturnValue({} as unknown as Trigger);
      triggerRepo.save.mockResolvedValue({
        id: 'trig-1',
      } as unknown as Trigger);
      scheduleRepo.create.mockImplementation((x) => x as unknown as Schedule);
      scheduleRepo.save.mockImplementation(
        async (x) => x as unknown as Schedule,
      );
    });

    it('dto.timezone 명시(유효) 시 우선 (workspace 미조회)', async () => {
      const s = await service.create(
        'ws-1',
        {
          ...baseDto,
          timezone: 'America/New_York',
        } as unknown as CreateScheduleDto,
        'u-spec',
      );
      expect(s.timezone).toBe('America/New_York');
      expect(workspacesService.getWorkspaceTimezone).not.toHaveBeenCalled();
    });

    it('dto.timezone 무효 → INVALID_TIMEZONE BadRequest', async () => {
      await expect(
        service.create(
          'ws-1',
          {
            ...baseDto,
            timezone: 'Not/AZone',
          } as unknown as CreateScheduleDto,
          'u-spec',
        ),
      ).rejects.toMatchObject({ response: { code: 'INVALID_TIMEZONE' } });
    });

    it('dto.timezone 없으면 workspace 설정 timezone fallback', async () => {
      workspacesService.getWorkspaceTimezone.mockResolvedValue('Europe/London');
      const s = await service.create(
        'ws-1',
        {
          ...baseDto,
        } as unknown as CreateScheduleDto,
        'u-spec',
      );
      expect(s.timezone).toBe('Europe/London');
    });

    it('dto·workspace 둘 다 없으면(undefined) Asia/Seoul', async () => {
      workspacesService.getWorkspaceTimezone.mockResolvedValue(undefined);
      const s = await service.create(
        'ws-1',
        {
          ...baseDto,
        } as unknown as CreateScheduleDto,
        'u-spec',
      );
      expect(s.timezone).toBe('Asia/Seoul');
    });

    it('감사 로깅 — schedule.created 를 행위자·대상과 함께 남긴다', async () => {
      const saved = await service.create(
        'ws-1',
        { ...baseDto, timezone: 'Asia/Seoul' } as unknown as CreateScheduleDto,
        'u-1',
      );

      expect(auditLogs.record).toHaveBeenCalledWith({
        workspaceId: 'ws-1',
        userId: 'u-1',
        action: 'schedule.created',
        resourceType: 'schedule',
        resourceId: saved.id,
      });
    });

    it('감사 로깅 — 생성이 실패하면 남기지 않는다', async () => {
      await expect(
        service.create(
          'ws-1',
          { ...baseDto, timezone: 'Not/AZone' } as unknown as CreateScheduleDto,
          'u-1',
        ),
      ).rejects.toMatchObject({ response: { code: 'INVALID_TIMEZONE' } });
      expect(auditLogs.record).not.toHaveBeenCalled();
    });

    it('감사 로깅 — create 는 BullMQ 등록 **전에** 기록한다 (W6 순서 고정)', async () => {
      // 순서가 뒤집히면 registerJob 실패 시 스케줄은 생겼는데 감사가 안 남는다.
      // 코드로만 맞춰두면 리팩터링이 조용히 되돌려도 테스트는 GREEN 이다.
      const order: string[] = [];
      scheduleRepo.save.mockImplementation(async (x) => {
        order.push('commit');
        return x as unknown as Schedule;
      });
      auditLogs.record.mockImplementation(async () => {
        order.push('audit');
      });
      (
        runner as unknown as { registerJob: jest.Mock }
      ).registerJob.mockImplementation(async () => {
        order.push('bullmq');
      });

      await service.create(
        'ws-1',
        {
          ...baseDto,
          timezone: 'Asia/Seoul',
          isActive: true,
        } as unknown as CreateScheduleDto,
        'u-o',
      );

      expect(order).toEqual(['commit', 'audit', 'bullmq']);
    });

    /**
     * cron/timezone 을 바꾸면 `nextRunAt` 을 재계산하는 분기. 계산이 비면 **`null` 로 명시
     * 대입**한다 — 2026-09-03 에 그 자리의 `null as unknown as Date` 캐스트를 걷어냈는데
     * 이 분기에 도달하는 테스트가 없었다(리뷰 W4).
     *
     * `undefined` 로 회귀하면 TypeORM 이 SET 절에서 생략해 **옛 시각이 남는다.**
     *
     * **현재 구현상 도달 불가능한 방어 분기다** — `computeNextRuns` 는 `Math.max(count, 1)`
     * 로 하한을 고정하고 파싱 실패 시 throw 하므로 빈 배열을 반환할 수 없다. 그래서 private
     * 메서드를 mock 해 **강제로** 그 분기를 실행한다. 실사용 시나리오가 아니라 **방어 분기의
     * 계약**(비면 `null`)을 고정하는 테스트다.
     */
    it('[방어 분기] 다음 실행 계산이 비면 nextRunAt 을 null 로 명시 대입한다', async () => {
      const saved: Schedule[] = [];
      scheduleRepo.findOne.mockResolvedValue({
        id: 'sch-1',
        workspaceId: 'ws-1',
        isActive: false,
        cronExpression: '0 9 * * *',
        timezone: 'Asia/Seoul',
        triggerId: 'trig-1',
        nextRunAt: new Date('2020-01-01T00:00:00Z'),
      } as unknown as Schedule);
      scheduleRepo.save.mockImplementation((sch) => {
        saved.push(sch as Schedule);
        return Promise.resolve(sch as Schedule);
      });
      // 다음 실행이 계산되지 않는 상황을 만든다.
      jest
        .spyOn(
          service as unknown as { computeNextRuns: () => string[] },
          'computeNextRuns',
        )
        .mockReturnValue([]);

      await service.update(
        'sch-1',
        'ws-1',
        { cronExpression: '0 10 * * *' } as unknown as UpdateScheduleDto,
        'u-upd',
      );

      expect(saved).toHaveLength(1);
      // `toBeNull()` 이어야 한다 — `toBeFalsy()` 면 `undefined` 회귀를 통과시킨다.
      expect(saved[0].nextRunAt).toBeNull();
    });

    /**
     * 위 방어 분기의 **정상 쪽**. 종전에는 이 경로를 e2e 한 케이스(`schedule-trigger.e2e-spec.ts` 「D. PATCH cron」)만
     * 고정했는데, 그 e2e 는 서버 실시각을 쓰기 때문에 **연말 ~2분**(12/31 23:58:30 ~ 01/01 00:00:30 KST)에는 재계산이
     * 없어도 통과한다 — 생성 cron 의 값 자체가 판정창 안으로 들어오기 때문이다(실측·등재:
     * `plan/complete/schedule-cron-flake.md`, `review/code/2026/09/20/12_45_31` W1). 시각에 기대지 않는 이 테스트가 그 구멍을 닫는다.
     *
     * **무엇으로 불렸는지**까지 본다 — 결과 값만 보면 «갱신 전 cron 으로 계산했다» 를 가르지 못한다.
     */
    function scheduleRow(overrides: Partial<Schedule> = {}): Schedule {
      return {
        id: 'sch-1',
        workspaceId: 'ws-1',
        isActive: false,
        cronExpression: '0 9 * * *',
        timezone: 'Asia/Seoul',
        triggerId: 'trig-1',
        nextRunAt: new Date('2020-01-01T00:00:00Z'),
        ...overrides,
      } as unknown as Schedule;
    }

    it('cron 을 바꾸면 새 cron 으로 다시 계산해 nextRunAt 에 넣는다', async () => {
      const saved: Schedule[] = [];
      scheduleRepo.findOne.mockResolvedValue(scheduleRow());
      scheduleRepo.save.mockImplementation((sch) => {
        saved.push(sch as Schedule);
        return Promise.resolve(sch as Schedule);
      });
      const computeNextRuns = jest
        .spyOn(
          service as unknown as { computeNextRuns: () => string[] },
          'computeNextRuns',
        )
        .mockReturnValue(['2030-03-04T05:06:00.000Z']);

      await service.update(
        'sch-1',
        'ws-1',
        { cronExpression: '30 7 * * *' } as unknown as UpdateScheduleDto,
        'u-upd',
      );

      // 갱신 **후** cron · 기존 timezone 으로 한 건을 계산한다.
      expect(computeNextRuns).toHaveBeenCalledWith(
        '30 7 * * *',
        'Asia/Seoul',
        1,
      );
      expect(saved).toHaveLength(1);
      expect(saved[0].nextRunAt).toEqual(new Date('2030-03-04T05:06:00.000Z'));
    });

    /**
     * 재계산 조건은 `dto.cronExpression || dto.timezone` 이라 **두 항이 각각 표면**이다 — cron 쪽만 보면
     * timezone 항을 지워도 반쪽이 살아남는다.
     */
    it('timezone 만 바꿔도 새 timezone 으로 다시 계산한다', async () => {
      const saved: Schedule[] = [];
      scheduleRepo.findOne.mockResolvedValue(scheduleRow());
      scheduleRepo.save.mockImplementation((sch) => {
        saved.push(sch as Schedule);
        return Promise.resolve(sch as Schedule);
      });
      const computeNextRuns = jest
        .spyOn(
          service as unknown as { computeNextRuns: () => string[] },
          'computeNextRuns',
        )
        .mockReturnValue(['2030-03-04T20:06:00.000Z']);

      await service.update(
        'sch-1',
        'ws-1',
        { timezone: 'America/New_York' } as unknown as UpdateScheduleDto,
        'u-upd',
      );

      expect(computeNextRuns).toHaveBeenCalledWith(
        '0 9 * * *',
        'America/New_York',
        1,
      );
      expect(saved).toHaveLength(1);
      expect(saved[0].nextRunAt).toEqual(new Date('2030-03-04T20:06:00.000Z'));
    });

    it('감사 로깅 — update 는 schedule.updated 를 남긴다', async () => {
      scheduleRepo.findOne.mockResolvedValue({
        id: 'sch-1',
        workspaceId: 'ws-1',
        isActive: false,
        cronExpression: '0 9 * * *',
        timezone: 'Asia/Seoul',
        triggerId: 'trig-1',
      } as unknown as Schedule);

      await service.update(
        'sch-1',
        'ws-1',
        { name: 'S2' } as unknown as UpdateScheduleDto,
        'u-upd',
      );

      expect(auditLogs.record).toHaveBeenCalledWith({
        workspaceId: 'ws-1',
        userId: 'u-upd',
        action: 'schedule.updated',
        resourceType: 'schedule',
        resourceId: 'sch-1',
      });
    });

    it('감사 로깅 — update 도 BullMQ 재등록 **전에** 기록한다 (W2)', async () => {
      const order: string[] = [];
      scheduleRepo.findOne.mockResolvedValue({
        id: 'sch-9',
        workspaceId: 'ws-1',
        isActive: true,
        cronExpression: '0 9 * * *',
        timezone: 'Asia/Seoul',
        triggerId: 'trig-9',
      } as unknown as Schedule);
      scheduleRepo.save.mockImplementation(async (x) => {
        order.push('commit');
        return x as unknown as Schedule;
      });
      auditLogs.record.mockImplementation(async () => {
        order.push('audit');
      });
      (
        runner as unknown as { registerJob: jest.Mock }
      ).registerJob.mockImplementation(async () => {
        order.push('bullmq');
      });

      await service.update(
        'sch-9',
        'ws-1',
        { name: 'S9' } as unknown as UpdateScheduleDto,
        'u-o2',
      );

      expect(order).toEqual(['commit', 'audit', 'bullmq']);
    });

    /**
     * `saved.trigger` 대입이 `if (isActive)` 안으로 되돌아가면 **비활성 경로에서만**
     * 응답의 `trigger` 가 사라진다. 같은 버그가 `create()` → `update()` 순으로 **두 번**
     * 났으므로(`review/code/2026/09/05/20_45_37` W2,
     * `review/code/2026/09/05/23_30_00` INFO#6) e2e C-3 에 더해
     * unit 으로도 두 자매를 각각 문다 — e2e 는 느리고 이 분기는 한 줄의 위치 문제다.
     */
    it('생성 — isActive:false 여도 응답에 trigger 가 실린다', async () => {
      const saved = await service.create(
        'ws-1',
        {
          ...baseDto,
          timezone: 'Asia/Seoul',
          isActive: false,
        } as unknown as CreateScheduleDto,
        'u-tr',
      );

      // `scheduleRepo.save` 는 인자를 그대로 돌려주므로, 여기 `trigger` 가 있다는 것은
      // **`saved.trigger = savedTrigger` 한 줄이 실행됐다**는 뜻이다.
      expect(saved.trigger).toEqual({ id: 'trig-1' });
    });

    it('수정 — isActive:false 로 비활성화해도 응답에 trigger 가 실린다', async () => {
      const persisted = {
        id: 'sch-tr',
        workspaceId: 'ws-1',
        isActive: true,
        cronExpression: '0 9 * * *',
        timezone: 'Asia/Seoul',
        triggerId: 'trig-tr',
        trigger: { id: 'trig-tr', name: 'T' },
      } as unknown as Schedule;
      scheduleRepo.findOne.mockResolvedValue(persisted);
      // **저장 결과에서 관계를 떨어뜨린다.** 인자를 그대로 돌려주면 `schedule.trigger` 가
      // 이미 붙어 있어 대입 한 줄을 지워도 단언이 통과한다(vacuous). 관계를 뺀 사본을
      // 돌려줘야 그 한 줄만이 `trigger` 를 채우는 유일한 경로가 된다.
      scheduleRepo.save.mockImplementation(async (sch) => {
        const copy = { ...(sch as Schedule) } as Record<string, unknown>;
        delete copy.trigger;
        return copy as unknown as Schedule;
      });

      const saved = await service.update(
        'sch-tr',
        'ws-1',
        { isActive: false } as unknown as UpdateScheduleDto,
        'u-tr',
      );

      expect(saved.trigger).toEqual({
        id: 'trig-tr',
        name: 'T',
        isActive: false,
      });
      // **DB 쓰기 방식도 단언한다.** 위 단언은 in-memory 재부착만 보므로,
      // `update` 를 `save(trigger)` 로 되돌려도 통과한다(뮤테이션 실측: 21건 전부 GREEN —
      // `review/code/2026/09/14/22_24_35` testing CRITICAL#3). `save` 는 엔티티를 통째로
      // 저장해 읽은 시점의 `config` 까지 되쓰고, 그러면 동시 PATCH 가 확립한
      // `chatChannel.inboundSigningRef` 가 되돌려져 인입 서명이 fail-open 이 된다.
      expect(triggerRepo.update).toHaveBeenCalledWith(
        { id: 'trig-tr' },
        { isActive: false },
      );
      expect(triggerRepo.save).not.toHaveBeenCalled();
    });

    it('수정 — name·isActive 를 함께 바꾸면 둘 다 한 patch 에 실린다', async () => {
      // 단독 분기만 있으면 «둘 중 하나만 담는» 구현으로 퇴행해도 통과한다.
      scheduleRepo.findOne.mockResolvedValue({
        id: 'sch-both',
        workspaceId: 'ws-1',
        isActive: true,
        cronExpression: '0 9 * * *',
        timezone: 'Asia/Seoul',
        triggerId: 'trig-both',
        trigger: { id: 'trig-both', name: 'old' },
      } as unknown as Schedule);
      scheduleRepo.save.mockImplementation(async (sch) => sch as Schedule);

      await service.update(
        'sch-both',
        'ws-1',
        { name: 'new', isActive: false } as unknown as UpdateScheduleDto,
        'u-both',
      );

      expect(triggerRepo.update).toHaveBeenCalledWith(
        { id: 'trig-both' },
        { name: 'new', isActive: false },
      );
    });

    it('수정 — trigger 필드를 하나도 안 바꾸면 patch 를 쓰지 않는다', async () => {
      // 빈 patch 가드 대조군 — 가드를 지우면 `update({id}, {})` 가 나가 여기서 갈린다.
      scheduleRepo.findOne.mockResolvedValue({
        id: 'sch-none',
        workspaceId: 'ws-1',
        isActive: true,
        cronExpression: '0 9 * * *',
        timezone: 'Asia/Seoul',
        triggerId: 'trig-none',
        trigger: { id: 'trig-none', name: 'keep' },
      } as unknown as Schedule);
      scheduleRepo.save.mockImplementation(async (sch) => sch as Schedule);

      await service.update(
        'sch-none',
        'ws-1',
        { cronExpression: '0 10 * * *' } as unknown as UpdateScheduleDto,
        'u-none',
      );

      expect(triggerRepo.update).not.toHaveBeenCalled();
    });

    it('수정 — name 만 바꾸면 trigger patch 에 name 만 실린다', async () => {
      // 분기 대조군 — patch 를 «바뀐 필드만» 으로 좁히는 술어가 느슨해지면 여기서 갈린다.
      scheduleRepo.findOne.mockResolvedValue({
        id: 'sch-nm',
        workspaceId: 'ws-1',
        isActive: true,
        cronExpression: '0 9 * * *',
        timezone: 'Asia/Seoul',
        triggerId: 'trig-nm',
        trigger: { id: 'trig-nm', name: 'old' },
      } as unknown as Schedule);
      scheduleRepo.save.mockImplementation(async (sch) => sch as Schedule);

      await service.update(
        'sch-nm',
        'ws-1',
        { name: 'new' } as unknown as UpdateScheduleDto,
        'u-nm',
      );

      expect(triggerRepo.update).toHaveBeenCalledWith(
        { id: 'trig-nm' },
        { name: 'new' },
      );
    });

    it('삭제 — trigger 행을 config 락 안에서 지운다', async () => {
      // 삭제 경로는 **둘**이다. `TriggersService.remove()` 만 락을 잡게 했더니 이쪽이 밖에
      // 남았고, 창 1 의 `save(entity)` 가 행이 없으면 INSERT 하므로 삭제된 트리거가 고아로
      // 되살아날 수 있었다 (`review/code/2026/09/15/00_38_16` database W1).
      triggerLockEvents.length = 0;
      scheduleRepo.findOne.mockResolvedValue({
        id: 'sch-del',
        workspaceId: 'ws-1',
        triggerId: 'trig-del',
      } as unknown as Schedule);

      await service.remove('sch-del', 'ws-1', 'u-del');

      // **존재가 아니라 순서를 단언한다.** 「락 키가 들어 있다」만 보면 상한(`SET LOCAL
      // lock_timeout`)이 사라져도 통과한다 — 실측으로 25건 전건 GREEN 이었다. 삭제는 락을
      // 잡기 **전에** BullMQ 해제를 끝내므로, 무한 대기는 «job 은 해제됐는데 행은 남은»
      // 상태로 굳는다. 그래서 상한을 순서와 함께 고정한다.
      //
      // 비밀은 행 삭제가 **커밋된 뒤에** 지운다(spec 트리거 목록 §4.3) — 스케줄 트리거도
      // `notification` 서명 비밀을 가질 수 있다. 종전엔 이 경로가 비밀을 아예 지우지 않았다.
      expect(triggerLockEvents).toEqual([
        "timeout:SET LOCAL lock_timeout = '5000ms'",
        'lock:trigger-config:trig-del',
        'delete:trig-del',
        'deleteByPrefix:secret://triggers/trig-del/',
      ]);
      expect(triggerRepo.delete).toHaveBeenCalledWith('trig-del');
    });

    it('삭제 실패는 조용히 지나가지 않는다 — 반쯤 삭제된 상태를 로그로 드러낸다', async () => {
      // `removeJob` 은 **이미 끝났고 되돌릴 수 없다**. 그러니 여기서 trigger 행 삭제가
      // 실패하면 «BullMQ 는 해제됐는데 행은 남은» 상태다. 형제 `TriggersService.remove()`
      // 는 이 사실을 로그로 남기는데 이쪽만 없었다
      // (`review/code/2026/09/15/01_09_53` side_effect W2).
      //
      // spy 누출을 막으려고 try/finally 로 원복을 보장한다.
      const error = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      try {
        triggerLockEvents.length = 0;
        scheduleRepo.findOne.mockResolvedValue({
          id: 'sch-halt',
          workspaceId: 'ws-1',
          triggerId: 'trig-halt',
        } as unknown as Schedule);
        triggerRepo.delete.mockImplementationOnce(() => {
          throw new Error('lock timeout');
        });

        await expect(
          service.remove('sch-halt', 'ws-1', 'u-halt'),
        ).rejects.toThrow('lock timeout');

        const logged = error.mock.calls.map(([m]) => String(m)).join('\n');
        expect(logged).toContain('trig-halt');
        expect(logged).toContain('반쯤 삭제된 상태');
        // 행이 남았으니 비밀도 남아야 한다 — 지우면 살아 있는 트리거의 서명이 깨진다.
        expect(
          triggerLockEvents.filter((e) => e.startsWith('deleteByPrefix:')),
        ).toEqual([]);

        // 실패했으면 schedule 행도 «삭제됨» 감사도 남기지 않는다 — 남기면 거짓 기록이다.
        expect(scheduleRepo.remove).not.toHaveBeenCalled();
        const actions = auditLogs.record.mock.calls.map(
          ([arg]) => (arg as { action?: string }).action,
        );
        expect(actions).not.toContain('schedule.deleted');
      } finally {
        error.mockRestore();
      }
    });

    it('삭제 — triggerId 가 없으면 락도 잡지 않고 trigger 도 지우지 않는다', async () => {
      // `if (schedule.triggerId)` 가드는 선재 코드인데 `remove` 케이스 넷이 전부
      // `triggerId` 를 채우고 있어 **한 번도 실행된 적이 없었다**
      // (`/ai-review` `review/code/2026/09/15/01_42_04` testing INFO#16).
      //
      // 가드를 지우는 편집이 이 분기에서만 깨지므로, 대조군으로서 의미가 있다.
      triggerLockEvents.length = 0;
      scheduleRepo.findOne.mockResolvedValue({
        id: 'sch-notrig',
        workspaceId: 'ws-1',
        triggerId: null,
      } as unknown as Schedule);

      await service.remove('sch-notrig', 'ws-1', 'u-notrig');

      expect(triggerLockEvents).toEqual([]);
      expect(triggerRepo.delete).not.toHaveBeenCalled();
      // schedule 행 삭제와 감사는 **그대로 일어난다** — 가드는 trigger 쪽만 건너뛴다.
      expect(scheduleRepo.remove).toHaveBeenCalled();
    });

    it('감사 로깅 — remove 는 schedule.deleted 를 남긴다', async () => {
      scheduleRepo.findOne.mockResolvedValue({
        id: 'sch-2',
        workspaceId: 'ws-1',
        triggerId: 'trig-2',
      } as unknown as Schedule);

      await service.remove('sch-2', 'ws-1', 'u-del');

      expect(auditLogs.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'u-del',
          action: 'schedule.deleted',
          resourceId: 'sch-2',
        }),
      );
    });
  });
});
