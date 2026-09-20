import {
  AUDIT_ACTIONS,
  AuditActionFor,
} from '../audit-logs/audit-action.const';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Schedule } from './entities/schedule.entity';
import { Trigger } from '../triggers/entities/trigger.entity';
import {
  acquireTriggerConfigLock,
  TRIGGER_DELETE_LOCK_TIMEOUT_MS,
} from '../triggers/trigger-config-lock';
import { deleteTriggerSecretsAfterCommit } from '../triggers/trigger-resource-release';
import { SecretResolverService } from '../secret-store/secret-resolver.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { isValidIanaTimezone } from '../../common/utils/timezone';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { QueryScheduleDto } from './dto/query-schedule.dto';
import { CronExpressionParser } from 'cron-parser';
import { ExecutionEngineService } from '../execution-engine/execution-engine.service';
import { ScheduleRunnerService } from './schedule-runner.service';

/** `audit_log.resource_type` 값 — 액션 prefix 와 동일 어휘. */
const SCHEDULE_RESOURCE_TYPE = 'schedule';

@Injectable()
export class SchedulesService {
  private readonly logger = new Logger(SchedulesService.name);

  constructor(
    @InjectRepository(Schedule)
    private readonly scheduleRepository: Repository<Schedule>,
    @InjectRepository(Trigger)
    private readonly triggerRepository: Repository<Trigger>,
    private readonly workspacesService: WorkspacesService,
    private readonly executionEngineService: ExecutionEngineService,
    private readonly auditLogsService: AuditLogsService,
    private readonly scheduleRunnerService: ScheduleRunnerService,
    private readonly secrets: SecretResolverService,
  ) {}

  /**
   * §2.2 — 스케줄 타임존 결정: 명시값 > 워크스페이스 설정(`settings.timezone`) > `'Asia/Seoul'`.
   *
   * `'Asia/Seoul'` 은 Schedule 도메인 전용 제품 기본값이다 (서버 `process.env.TZ`/UTC 가 아니라 — 본
   * 제품의 1차 타겟 사용자 기준). 명시값과 워크스페이스 값 모두 IANA 유효성을 검증해 무효면 다음 단계로
   * 폴백한다 (DTO/저장 검증을 우회한 레거시·직접 호출 방어). 모듈 경계상 Workspace 엔티티를 직접
   * 읽지 않고 `WorkspacesService.getWorkspaceTimezone` 위임 호출을 쓴다.
   */
  private async resolveTimezone(
    workspaceId: string,
    requestedTimezone: string | undefined,
  ): Promise<string> {
    // 명시값이 있으면 IANA 검증 — 무효면 silent fallback 대신 즉시 거부(사용자 입력 오류 명확화).
    if (requestedTimezone) {
      if (!isValidIanaTimezone(requestedTimezone)) {
        throw new BadRequestException({
          code: 'INVALID_TIMEZONE',
          message: `유효하지 않은 타임존입니다: ${requestedTimezone}`,
        });
      }
      return requestedTimezone;
    }
    const wsTz = await this.workspacesService.getWorkspaceTimezone(workspaceId);
    return wsTz ?? 'Asia/Seoul';
  }

  async findAll(
    workspaceId: string,
    query: QueryScheduleDto,
  ): Promise<PaginatedResponseDto<Schedule>> {
    const {
      page = 1,
      limit = 20,
      search,
      triggerId,
      sort = 'created_at',
      order = 'desc',
    } = query;

    const qb = this.scheduleRepository
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.trigger', 't')
      .leftJoinAndSelect('t.workflow', 'w')
      .where('s.workspace_id = :workspaceId', { workspaceId });

    if (search) {
      qb.andWhere('t.name ILIKE :search', { search: `%${search}%` });
    }

    // 트리거 단일 필터 (딥링크 cross-page 포커스). 연결 트리거가 없는 스케줄은
    // t.id 가 null 이라 자연히 제외된다.
    if (triggerId) {
      qb.andWhere('t.id = :triggerId', { triggerId });
    }

    qb.orderBy(
      this.resolveOrderBy(sort),
      order.toUpperCase() as 'ASC' | 'DESC',
    );

    const totalItems = await qb.getCount();
    const data = await qb
      .offset((page - 1) * limit)
      .limit(limit)
      .getMany();

    return PaginatedResponseDto.create(data, totalItems, page, limit);
  }

  /**
   * PaginationQueryDto.sort 를 화이트리스트 컬럼(alias 포함)으로 매핑한다.
   * `name` 은 schedule 자체 컬럼이 아니라 연결된 trigger 명(t.name)으로 정렬한다.
   * 미허용 값은 기본 정렬(s.created_at)로 폴백 — SQL injection 차단.
   */
  private resolveOrderBy(sort: string): string {
    const allowed: Record<string, string> = {
      created_at: 's.created_at',
      updated_at: 's.updated_at',
      next_run_at: 's.next_run_at',
      last_run_at: 's.last_run_at',
      name: 't.name',
    };
    return allowed[sort] || 's.created_at';
  }

  async findById(id: string, workspaceId: string): Promise<Schedule> {
    const schedule = await this.scheduleRepository.findOne({
      where: { id, workspaceId },
      relations: ['trigger', 'trigger.workflow'],
    });
    if (!schedule) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Schedule not found',
      });
    }
    return schedule;
  }

  /**
   * `schedule.*` 감사 기록. named 필드 — positional 이면 동일 타입(string) 인자 순서 스왑을
   * 컴파일러가 못 잡아 감사 주체·대상이 조용히 뒤바뀐다 (auth-configs W-1 과 동일 근거).
   */
  private recordAudit(params: {
    workspaceId: string;
    userId: string;
    action: AuditActionFor<typeof SCHEDULE_RESOURCE_TYPE>;
    resourceId: string;
  }): Promise<void> {
    return this.auditLogsService.record({
      workspaceId: params.workspaceId,
      userId: params.userId,
      action: params.action,
      resourceType: SCHEDULE_RESOURCE_TYPE,
      resourceId: params.resourceId,
    });
  }

  async create(
    workspaceId: string,
    dto: CreateScheduleDto,
    userId: string,
  ): Promise<Schedule> {
    // Auto-create linked trigger (type=schedule)
    const trigger = this.triggerRepository.create({
      workspaceId,
      workflowId: dto.workflowId,
      type: 'schedule',
      name: dto.name,
      isActive: dto.isActive ?? true,
      config: {},
    });
    const savedTrigger = await this.triggerRepository.save(trigger);

    const timezone = await this.resolveTimezone(workspaceId, dto.timezone);
    const isActive = dto.isActive ?? true;
    const [nextRun] = this.computeNextRuns(dto.cronExpression, timezone, 1);

    const schedule = this.scheduleRepository.create({
      workspaceId,
      triggerId: savedTrigger.id,
      cronExpression: dto.cronExpression,
      timezone,
      isActive,
      nextRunAt: nextRun ? new Date(nextRun) : undefined,
      parameterValues: dto.parameterValues ?? {},
    });
    const saved = await this.scheduleRepository.save(schedule);
    // **커밋 직후** 기록한다. 아래 BullMQ 등록은 실패할 수 있는 외부 호출이라, 그 뒤로
    // 미루면 등록이 터졌을 때 리소스는 생겼는데 감사는 안 남는다 (리뷰 W6).
    await this.recordAudit({
      workspaceId,
      userId,
      action: AUDIT_ACTIONS.SCHEDULE_CREATED,
      resourceId: saved.id,
    });

    // 트리거는 `isActive` 와 무관하게 **항상** 생성·연결됐다. 종전에는 이 대입이 아래
    // `if (isActive)` 안에 **함께 들어 있었을 뿐**이고, `isActive: false` 로 만들면 트리거
    // 행은 존재하는데 응답에서 `trigger` 키가 사라졌다 — 응답 형태가 요청 값에 따라
    // 갈리는데 그 사실이 어디에도 적혀 있지 않았다 (`review/code/2026/09/05/19_08_18` W1).
    //
    // 종전 이 주석은 그 자리를 *"`registerJob` 이 필요로 하므로"* 라고 설명했는데
    // **틀렸다** — `registerJob` 은 `id`·`cronExpression`·`timezone`·`workspaceId` 넷만
    // 읽고 `trigger` 를 보지 않는다 (`schedule-runner.service.ts`).
    saved.trigger = savedTrigger;

    // Register BullMQ repeatable job
    if (isActive) {
      await this.scheduleRunnerService.registerJob(saved);
    }

    return saved;
  }

  async update(
    id: string,
    workspaceId: string,
    dto: UpdateScheduleDto,
    userId: string,
  ): Promise<Schedule> {
    const schedule = await this.findById(id, workspaceId);
    const trigger = schedule.trigger;

    // Sync name
    if (dto.name && trigger) {
      trigger.name = dto.name;
    }
    // Sync is_active bidirectionally
    if (dto.isActive !== undefined && trigger) {
      trigger.isActive = dto.isActive;
    }
    if (trigger) {
      // **컬럼만 쓴다 — `save(trigger)` 를 쓰지 않는다.** `save` 는 엔티티를 통째로 저장해
      // 읽은 시점의 `config` 까지 되쓴다. 그 사이 동시 PATCH 가 확립한
      // `chatChannel.inboundSigningRef` 를 되돌리면 인입 서명 검증이 fail-open 으로 돌아간다
      // (`triggers.service.ts` 의 config 락과 같은 결함 클래스 —
      // `/ai-review` `review/code/2026/09/14/21_50_09` concurrency CRITICAL#1).
      //
      // 이 경로가 바꾸는 것은 `name`·`isActive` 둘뿐이므로 컬럼 한정 갱신으로 족하다.
      const patch: Partial<Pick<Trigger, 'name' | 'isActive'>> = {};
      if (dto.name) patch.name = trigger.name;
      if (dto.isActive !== undefined) patch.isActive = trigger.isActive;
      if (Object.keys(patch).length > 0) {
        await this.triggerRepository.update({ id: trigger.id }, patch);
      }
    }

    if (dto.cronExpression) schedule.cronExpression = dto.cronExpression;
    if (dto.timezone) schedule.timezone = dto.timezone;
    if (dto.isActive !== undefined) schedule.isActive = dto.isActive;
    if (dto.parameterValues !== undefined)
      schedule.parameterValues = dto.parameterValues;

    // Recalculate nextRunAt if cron or timezone changed
    if (dto.cronExpression || dto.timezone) {
      const [nextRun] = this.computeNextRuns(
        schedule.cronExpression,
        schedule.timezone,
        1,
      );
      schedule.nextRunAt = nextRun ? new Date(nextRun) : null;
    }

    const saved = await this.scheduleRepository.save(schedule);

    // 커밋 직후 기록 — 아래 BullMQ 재등록이 실패해도 감사는 남는다 (리뷰 W6).
    await this.recordAudit({
      workspaceId,
      userId,
      action: AUDIT_ACTIONS.SCHEDULE_UPDATED,
      resourceId: id,
    });

    // `create()` 와 같은 이유로 조건 밖에 둔다 — 트리거는 `isActive` 와 무관하게 존재하며,
    // 대입이 `if` 안에 있으면 **비활성화 PATCH 응답에서만** `trigger` 키가 사라진다.
    // `create()` 만 고치고 이 자매를 두었던 것을 `review/code/2026/09/05/20_45_37` W2 가 잡았다.
    saved.trigger = trigger ?? schedule.trigger;

    // Update BullMQ job
    if (schedule.isActive) {
      await this.scheduleRunnerService.registerJob(saved);
    } else {
      await this.scheduleRunnerService.removeJob(saved.id);
    }

    return saved;
  }

  async remove(id: string, workspaceId: string, userId: string): Promise<void> {
    const schedule = await this.findById(id, workspaceId);
    // Remove BullMQ job
    await this.scheduleRunnerService.removeJob(schedule.id);
    // Cascade delete trigger — **삭제 경로는 둘이다.**
    //
    // `TriggersService.remove()` 만 config 락을 잡게 했더니, 스케줄 삭제라는 **두 번째 경로**가
    // 락 밖에 남았다. 창 1 은 `save(entity)` 를 쓰고 그것은 행이 없으면 INSERT 하므로,
    // 「읽었을 땐 있었는데 저장 직전에 삭제」가 겹치면 삭제된 트리거가 고아로 되살아난다
    // (`/ai-review` `review/code/2026/09/15/00_38_16` database W1).
    //
    // schedule 타입 트리거는 `chatChannel` 을 가질 수 없어 인입 서명 fail-open 으로는 이어지지
    // 않지만, 정합성 결함은 같은 클래스다. 그리고 «삭제도 같은 락을 잡는다» 는 내 CHANGELOG
    // 문장이 경로 하나만 덮고 있었다.
    if (schedule.triggerId) {
      const triggerId = schedule.triggerId;
      await this.triggerRepository.manager
        .transaction(async (m) => {
          await acquireTriggerConfigLock(m, triggerId, {
            timeoutMs: TRIGGER_DELETE_LOCK_TIMEOUT_MS,
          });
          // **`affected` 를 본다.** 위 `findById` 는 잠금 없는 선조회라 동시 DELETE 두 건이 모두
          // 통과하고, advisory lock 은 둘을 줄 세우기만 한다 — 진 쪽이 그대로 진행하면 아래
          // `scheduleRepository.remove` 와 `recordAudit` 까지 가서 `schedule.deleted` 가 두 번 남는다
          // (e2e 로 재현: 둘 다 204 · 감사 2건). 형제 세 경로(#1369·#1370)와 같은 결함 클래스다.
          //
          // **판정자가 트리거인 이유**: `schedule.trigger_id → trigger` 는 `onDelete: CASCADE` 라
          // 트리거를 지우면 스케줄 행도 DB 가 함께 지운다. 그래서 «스케줄 행을 몇 행 지웠나» 로
          // 판정하면 **이긴 쪽도 0행**이라 둘 다 404 가 된다 — 락이 보호하는 이 쓰기만이 판별자다.
          const { affected } = await m.delete(Trigger, triggerId);
          if (!affected) {
            throw new NotFoundException({
              code: 'RESOURCE_NOT_FOUND',
              message: 'Schedule not found',
            });
          }
        })
        .catch((err: unknown) => {
          // 동시 삭제로 행이 이미 사라진 경우는 **반쯤 삭제된 상태가 아니다** — 먼저 커밋한 요청이
          // 행도 BullMQ job 도 정리했다. 아래 로그는 «수동 정리가 필요하다» 고 말하므로 이 경우까지
          // 실으면 거짓 경보가 된다(형제 세 경로와 같은 처리).
          if (err instanceof NotFoundException) throw err;
          // `TriggersService.remove()` 와 **대칭**이어야 한다. 위 `removeJob` 은 이미
          // 끝났으므로(되돌릴 수 없다) 여기서 실패하면 «BullMQ 는 해제됐는데 행은 남은»
          // 반쯤 삭제된 상태다 — 조용한 실패로 두면 아무도 모른다
          // (`/ai-review` `review/code/2026/09/15/01_09_53` side_effect W2).
          this.logger.error(
            `SchedulesService.remove: trigger=${triggerId} 행 삭제 실패 — BullMQ job 해제는 ` +
              `**이미 끝났으므로** 반쯤 삭제된 상태다. 수동 정리가 필요하다: ` +
              `${err instanceof Error ? err.message : String(err)}`,
          );
          throw err;
        });
      // **커밋된 뒤에** 그 트리거의 비밀을 지운다(spec 트리거 목록 §4.3). 스케줄 트리거도
      // `notification` 서명 비밀을 가질 수 있다 — DTO 에 타입 제한이 없다. `TriggerResourceReleaserService`
      // 를 쓰지 않는 이유는 모듈 순환(`TriggersModule → SchedulesModule`)이라 정책 함수를 직접 부른다.
      await deleteTriggerSecretsAfterCommit(
        this.secrets,
        this.logger,
        [triggerId],
        'SchedulesService.remove',
      );
      // 스케줄 행은 위 트리거 삭제의 FK CASCADE(`schedule.trigger_id`, `onDelete: 'CASCADE'`)가 이미
      // 지웠다 — 이 호출은 0행 no-op 이다. 그래도 남겨 둔다: CASCADE 가 없어지면 이 줄이 유일한 삭제다.
      await this.scheduleRepository.remove(schedule);
    } else {
      // `triggerId` 가 없는 방어 분기(엔티티상 NOT NULL 이라 현재 도달 불가). 여기는 CASCADE 가
      // 개입하지 않으므로 **스케줄 행 자체가 판별자**다 — 위 트리거 경로와 판정 대상이 다르다.
      const { affected } = await this.scheduleRepository.delete({
        id,
        workspaceId,
      });
      if (!affected) {
        throw new NotFoundException({
          code: 'RESOURCE_NOT_FOUND',
          message: 'Schedule not found',
        });
      }
    }
    await this.recordAudit({
      workspaceId,
      userId,
      action: AUDIT_ACTIONS.SCHEDULE_DELETED,
      resourceId: id,
    });
  }

  async getPreview(
    id: string,
    workspaceId: string,
    count: number = 5,
  ): Promise<{ nextRuns: string[] }> {
    const schedule = await this.findById(id, workspaceId);
    const nextRuns = this.computeNextRuns(
      schedule.cronExpression,
      schedule.timezone,
      count,
    );
    return { nextRuns };
  }

  getPreviewFromExpression(
    cronExpression: string,
    timezone: string = 'Asia/Seoul',
    count: number = 5,
  ): { nextRuns: string[] } {
    const nextRuns = this.computeNextRuns(cronExpression, timezone, count);
    return { nextRuns };
  }

  async runNow(
    id: string,
    workspaceId: string,
    userId: string,
  ): Promise<{ executionId: string }> {
    const schedule = await this.findById(id, workspaceId);
    const workflowId = this.getWorkflowIdForSchedule(schedule);
    if (!workflowId) {
      throw new BadRequestException('Schedule has no associated workflow');
    }
    const parameters =
      await this.scheduleRunnerService.resolveScheduleParameters(
        schedule,
        workflowId,
      );
    // `runNow` runs a Schedule definition on demand — the input still carries
    // schedule-resolved parameters (`$schedule`/`$now` evaluated), so the
    // trigger source is `'schedule'` even though the executor is a user.
    const executionId = await this.executionEngineService.execute(
      workflowId,
      { __triggerSource: 'schedule', parameters },
      { executedBy: userId },
    );
    return { executionId };
  }

  getWorkflowIdForSchedule(schedule: Schedule): string | null {
    return schedule.trigger?.workflowId ?? null;
  }

  private computeNextRuns(
    cronExpression: string,
    timezone: string,
    count: number,
  ): string[] {
    const safeCount = Math.min(Math.max(count, 1), 20);
    try {
      const interval = CronExpressionParser.parse(cronExpression, {
        tz: timezone,
        currentDate: new Date(),
      });
      const runs: string[] = [];
      for (let i = 0; i < safeCount; i++) {
        const next = interval.next();
        runs.push(next.toISOString() ?? new Date().toISOString());
      }
      return runs;
    } catch {
      throw new BadRequestException(
        `Invalid cron expression: "${cronExpression}"`,
      );
    }
  }
}
