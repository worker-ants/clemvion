import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SchedulesService } from './schedules.service';
import { Schedule } from './entities/schedule.entity';
import { Trigger } from '../triggers/entities/trigger.entity';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { ExecutionEngineService } from '../execution-engine/execution-engine.service';
import { ScheduleRunnerService } from './schedule-runner.service';

describe('SchedulesService.runNow', () => {
  let service: SchedulesService;
  let auditLogs: { record: jest.Mock };
  let scheduleRepo: jest.Mocked<Repository<Schedule>>;
  let triggerRepo: jest.Mocked<Repository<Trigger>>;
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
          useValue: { create: jest.fn(), save: jest.fn(), delete: jest.fn() },
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
