import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Execution, ExecutionStatus } from './entities/execution.entity';
import { NodeExecution } from '../node-executions/entities/node-execution.entity';
import { ExecutionEngineService } from '../execution-engine/execution-engine.service';
import { QueryExecutionDto } from './dto/query-execution.dto';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { ExecutionDto } from './dto/responses/execution-response.dto';
import {
  deriveExecutionTrigger,
  type ExecutionTriggerSource,
} from './utils/execution-trigger';
import { loadParentWorkflowNames } from './utils/load-parent-workflow-names';

/**
 * `findById` 응답 — 기존 entity 형태(websocket snapshot/frontend 호환)에
 * triggerSource/triggerLabel 두 필드를 추가한 shape.
 */
export type ExecutionDetailWithTrigger = Execution & {
  nodeExecutions: NodeExecution[];
  triggerSource: ExecutionTriggerSource;
  triggerLabel: string | null;
};

@Injectable()
export class ExecutionsService {
  constructor(
    @InjectRepository(Execution)
    private readonly executionRepository: Repository<Execution>,
    @InjectRepository(NodeExecution)
    private readonly nodeExecutionRepository: Repository<NodeExecution>,
    private readonly executionEngineService: ExecutionEngineService,
  ) {}

  async findById(id: string): Promise<ExecutionDetailWithTrigger> {
    // 안전 컬럼만 선택적으로 join — User.passwordHash 등 민감 필드 노출 방지.
    // executor.email 도 라벨 산출에 불필요하므로 제외 (PII 최소화).
    const execution = await this.executionRepository
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.workflow', 'workflow')
      .leftJoin('e.trigger', 'trigger')
      .addSelect(['trigger.id', 'trigger.type', 'trigger.name'])
      .leftJoin('e.executor', 'executor')
      .addSelect(['executor.id', 'executor.name'])
      .where('e.id = :id', { id })
      .getOne();
    if (!execution) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Execution not found',
      });
    }

    const nodeExecutions = await this.nodeExecutionRepository.find({
      where: { executionId: id },
      relations: ['node'],
      order: { startedAt: 'ASC' },
    });

    const parentName = execution.parentExecutionId
      ? (
          await loadParentWorkflowNames(this.executionRepository, [execution])
        ).get(execution.parentExecutionId)
      : null;
    const trigger = deriveExecutionTrigger(execution, parentName);

    // 응답 직전 trigger/executor 관계 객체를 제거 (User 등 민감 정보 누출 방지).
    return {
      ...this.stripPrivateRelations(execution),
      nodeExecutions,
      triggerSource: trigger.source,
      triggerLabel: trigger.label,
    };
  }

  /**
   * 워크스페이스 권한 검증은 컨트롤러의 가드/미들웨어에서 수행한다.
   * 이 서비스는 호출자가 이미 해당 workflowId 에 대한 접근 권한을 검증했다고 전제한다.
   */
  async findByWorkflow(
    workflowId: string,
    query: QueryExecutionDto,
  ): Promise<PaginatedResponseDto<ExecutionDto>> {
    const {
      page = 1,
      limit = 20,
      sort = 'started_at',
      order = 'desc',
      status,
    } = query;

    const qb = this.executionRepository
      .createQueryBuilder('e')
      .leftJoin('e.trigger', 'trigger')
      .addSelect(['trigger.id', 'trigger.type', 'trigger.name'])
      .leftJoin('e.executor', 'executor')
      .addSelect(['executor.id', 'executor.name'])
      .where('e.workflow_id = :workflowId', { workflowId });

    if (status) {
      qb.andWhere('e.status = :status', { status });
    }

    const sortColumn = this.getSortColumn(sort);
    qb.orderBy(`e.${sortColumn}`, order.toUpperCase() as 'ASC' | 'DESC');

    const [data, totalItems] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const parentNameMap = await loadParentWorkflowNames(
      this.executionRepository,
      data,
    );
    const dtoList = data.map((e) => this.toExecutionDto(e, parentNameMap));
    return PaginatedResponseDto.create(dtoList, totalItems, page, limit);
  }

  /**
   * 동시 stop 요청에 대한 TOCTOU 경쟁을 막기 위해, 최종 상태 전환은 단일 원자 UPDATE
   * (status WHERE status IN [전이 가능 상태]) 로 수행한다.
   */
  async stop(id: string): Promise<Execution> {
    const execution = await this.executionRepository.findOne({ where: { id } });
    if (!execution) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Execution not found',
      });
    }

    if (
      execution.status !== ExecutionStatus.RUNNING &&
      execution.status !== ExecutionStatus.PENDING &&
      execution.status !== ExecutionStatus.WAITING_FOR_INPUT
    ) {
      throw new BadRequestException({
        code: 'INVALID_STATE',
        message: `Cannot stop execution with status '${execution.status}'`,
      });
    }

    if (execution.status === ExecutionStatus.WAITING_FOR_INPUT) {
      // cancelWaitingExecution 은 동기 함수로 pendingContinuation.reject() 만 트리거한다.
      // 실제 DB 상태 전환은 reject 핸들러가 비동기로 수행하므로, 여기서 즉시 re-fetch 한
      // 결과는 아직 PENDING/RUNNING 일 수 있다. 클라이언트는 websocket 으로 후속
      // CANCELLED 이벤트를 수신해 화면을 갱신한다.
      this.executionEngineService.cancelWaitingExecution(id);
      const updated = await this.executionRepository.findOne({ where: { id } });
      return updated ?? execution;
    }

    const finishedAt = new Date();
    const startedAtMs = execution.startedAt
      ? new Date(execution.startedAt).getTime()
      : finishedAt.getTime();
    const durationMs = finishedAt.getTime() - startedAtMs;

    const updateResult = await this.executionRepository
      .createQueryBuilder()
      .update(Execution)
      .set({
        status: ExecutionStatus.CANCELLED,
        finishedAt,
        durationMs,
      })
      .where('id = :id', { id })
      .andWhere('status IN (:...stoppable)', {
        stoppable: [ExecutionStatus.RUNNING, ExecutionStatus.PENDING],
      })
      .execute();

    if (updateResult.affected === 0) {
      // 다른 요청이 먼저 상태를 바꿨을 가능성. 최신 상태로 재조회 후 반환한다.
      const refreshed = await this.executionRepository.findOne({
        where: { id },
      });
      return refreshed ?? execution;
    }

    const refreshed = await this.executionRepository.findOne({ where: { id } });
    return refreshed ?? execution;
  }

  private toExecutionDto(
    execution: Execution,
    parentNameMap: Map<string, string | null>,
  ): ExecutionDto {
    const parentName = execution.parentExecutionId
      ? (parentNameMap.get(execution.parentExecutionId) ?? null)
      : null;
    const trigger = deriveExecutionTrigger(execution, parentName);
    return {
      id: execution.id,
      workflowId: execution.workflowId,
      triggerId: execution.triggerId ?? null,
      triggerSource: trigger.source,
      triggerLabel: trigger.label,
      status: execution.status,
      startedAt: this.toIso(execution.startedAt),
      finishedAt: execution.finishedAt
        ? this.toIso(execution.finishedAt)
        : null,
      durationMs: execution.durationMs ?? null,
      inputData: execution.inputData ?? null,
      outputData: execution.outputData ?? null,
      error: execution.error ?? null,
      executedBy: execution.executedBy ?? null,
      parentExecutionId: execution.parentExecutionId ?? null,
      recursionDepth: execution.recursionDepth ?? 0,
      executionPath: execution.executionPath ?? [],
    };
  }

  /**
   * findById 응답 직전, 응답으로 노출하면 안 되는 관계 객체를 제거한다.
   * (deriveExecutionTrigger 산출 후에는 더 이상 필요하지 않음)
   */
  private stripPrivateRelations(execution: Execution): Execution {
    const { trigger: _t, executor: _e, ...rest } = execution;
    return rest as Execution;
  }

  /**
   * TypeORM postgres 드라이버는 timestamptz 컬럼을 Date 인스턴스로 매핑한다.
   * 다만 `repository.save()` 직후처럼 in-memory 값이 string 인 경로도 대비해 통합 변환.
   */
  private toIso(d: Date | string): string {
    return d instanceof Date ? d.toISOString() : d;
  }

  /**
   * QueryDto 의 snake_case 정렬 키를 TypeORM 엔티티 property 명으로 매핑한다.
   *
   * createQueryBuilder 의 `orderBy` 는 alias-path 를 entity property path 로 해석한다.
   * 여기에 DB 컬럼명(snake_case)을 넘기면 leftJoin + skip/take 조합에서 TypeORM 이
   * ORDER BY 를 inner SELECT 와 결합할 때 메타데이터 lookup 이 실패해
   * `Cannot read properties of undefined (reading 'databaseName')` 가 발생한다.
   */
  private getSortColumn(sort: string): string {
    const allowed: Record<string, string> = {
      started_at: 'startedAt',
      finished_at: 'finishedAt',
      status: 'status',
      duration_ms: 'durationMs',
    };
    return allowed[sort] || 'startedAt';
  }
}
