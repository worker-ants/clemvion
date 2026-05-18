import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Execution, ExecutionStatus } from './entities/execution.entity';
import { NodeExecution } from '../node-executions/entities/node-execution.entity';
import { ExecutionNodeLog } from '../execution-engine/entities/execution-node-log.entity';
import { ExecutionEngineService } from '../execution-engine/execution-engine.service';
import { QueryExecutionDto } from './dto/query-execution.dto';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { ExecutionDto } from './dto/responses/execution-response.dto';
import {
  deriveExecutionTrigger,
  type ExecutionTriggerSource,
} from './utils/execution-trigger';
import { loadParentWorkflowNames } from './utils/load-parent-workflow-names';

// execution_node_log 행 수 상한. ForEach 같은 컨테이너에서 행 수가 폭증하는 경우
// 메모리 적재량을 묶어두기 위한 안전망 — UI timeline 은 정렬된 nodeId prefix 만
// 필요하므로 상한을 초과한 경우는 잘려도 표시 흐름은 유지된다.
// 테스트에서도 동일 상수를 참조하도록 export.
export const MAX_EXECUTION_PATH_ROWS = 10_000;

/**
 * 종결 상태 (`completed` / `failed` / `cancelled`) 실행의 findById 응답은 불변이다.
 * WS 구독자 다수가 동시에 동일 execution 채널에 구독해 반복 fetch 가 발생하면
 * REPEATABLE READ 트랜잭션 + 3개 SELECT 가 매번 실행돼 DB 부하가 누적된다.
 * 본 인스턴스 메모리 LRU 로 1차 캐시 — 종결 상태 진입 후의 모든 fetch 는 O(1).
 *
 * 캐시 제외: PENDING / RUNNING / WAITING_FOR_INPUT — 진행 중에는 nodeExecutions 가
 * 증가하므로 stale 우려.
 *
 * 인스턴스 수직 캐시이므로 멀티 인스턴스 hit ratio 는 sticky session WS 배포에서
 * 자연스럽게 보장된다. 멀티 인스턴스 cross-hit 이 필요하면 Redis 로 승격 가능.
 */
const SNAPSHOT_CACHE_MAX_ENTRIES = 256;

/**
 * `findById` 응답 — 기존 entity 형태(websocket snapshot/frontend 호환)에
 * triggerSource/triggerLabel 두 필드를 추가한 shape. `executionPath` 는
 * `execution_node_log` 의 (execution_id, id) 정렬 결과로 채워진다 — entity
 * 컬럼이 사라졌으므로 service 가 외부 API 호환성을 위해 별도 채움.
 *
 * `executionPathTruncated` 는 `executionPath.length === MAX_EXECUTION_PATH_ROWS`
 * 인 상황에서 추가 행이 잘렸을 수 있음을 알린다 — 프론트엔드 UI 가 "이 이후 일부
 * 로그가 표시되지 않습니다" 배너를 띄울 수 있도록.
 */
export type ExecutionDetailWithTrigger = Execution & {
  nodeExecutions: NodeExecution[];
  triggerSource: ExecutionTriggerSource;
  triggerLabel: string | null;
  executionPath: string[];
  executionPathTruncated: boolean;
};

@Injectable()
export class ExecutionsService {
  // 종결 상태 execution detail 의 인스턴스 LRU 캐시 (W-27).
  // 삽입 순서 = LRU — Map iteration 이 삽입 순서를 보장하므로 별도 자료구조 없이
  // size 초과 시 첫 키 (가장 오래된 진입) 를 evict.
  private readonly snapshotCache = new Map<
    string,
    ExecutionDetailWithTrigger
  >();

  constructor(
    @InjectRepository(Execution)
    private readonly executionRepository: Repository<Execution>,
    @InjectRepository(NodeExecution)
    private readonly nodeExecutionRepository: Repository<NodeExecution>,
    @InjectRepository(ExecutionNodeLog)
    private readonly executionNodeLogRepository: Repository<ExecutionNodeLog>,
    private readonly executionEngineService: ExecutionEngineService,
  ) {}

  private readSnapshotCache(
    id: string,
  ): ExecutionDetailWithTrigger | undefined {
    const cached = this.snapshotCache.get(id);
    if (cached !== undefined) {
      // LRU: 최근 사용으로 갱신.
      this.snapshotCache.delete(id);
      this.snapshotCache.set(id, cached);
    }
    return cached;
  }

  private writeSnapshotCache(
    id: string,
    snapshot: ExecutionDetailWithTrigger,
  ): void {
    // 진행 중 상태는 절대 캐시 금지 (stale 위험).
    if (
      snapshot.status !== ExecutionStatus.COMPLETED &&
      snapshot.status !== ExecutionStatus.FAILED &&
      snapshot.status !== ExecutionStatus.CANCELLED
    ) {
      return;
    }
    if (this.snapshotCache.has(id)) {
      this.snapshotCache.delete(id);
    } else if (this.snapshotCache.size >= SNAPSHOT_CACHE_MAX_ENTRIES) {
      // 가장 오래된 키 evict.
      const oldest = this.snapshotCache.keys().next().value;
      if (oldest !== undefined) this.snapshotCache.delete(oldest);
    }
    this.snapshotCache.set(id, snapshot);
  }

  /**
   * 외부에서 execution 상태가 변경됐을 가능성을 알리는 hook (예: cancel · 재실행).
   * 캐시 stale 방지용 — 호출자는 mutation 후 호출.
   */
  invalidateSnapshotCache(id: string): void {
    this.snapshotCache.delete(id);
  }

  /**
   * IDOR 차단용 helper — execution 이 사용자의 workspace 에 속하는지 검증.
   * 호출부 (controller / WS gateway) 가 사용자 인증 컨텍스트에서 workspaceId 를
   * 추출해 전달한다. 일치하지 않으면 NotFound 로 통일하여 ID enumeration 도 방지.
   *
   * 사용 예: stop·continue·resume·cancel 같은 mutating endpoint 에서 호출.
   */
  async verifyOwnership(
    executionId: string,
    userWorkspaceId: string,
  ): Promise<void> {
    const row = await this.executionRepository
      .createQueryBuilder('e')
      .leftJoin('e.workflow', 'workflow')
      .select(['e.id', 'workflow.workspaceId'])
      .where('e.id = :id', { id: executionId })
      .getOne();
    if (!row) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Execution not found',
      });
    }
    const ownerWorkspaceId = row.workflow?.workspaceId;
    if (!ownerWorkspaceId || ownerWorkspaceId !== userWorkspaceId) {
      // 의도적으로 NotFound — Forbidden 으로 응답하면 attacker 가 ID 의 존재
      // 여부를 추론할 수 있다 (CRIT #1).
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Execution not found',
      });
    }
  }

  /**
   * Workflow 가 사용자의 workspace 에 속하는지 검증 — `findByWorkflow` 같이
   * workflowId 만 받는 list 엔드포인트에서 사용 (W-44 IDOR 차단).
   * verifyOwnership 와 동일하게 NotFound 로 통일해 ID enumeration 차단.
   */
  async verifyWorkflowOwnership(
    workflowId: string,
    userWorkspaceId: string,
  ): Promise<void> {
    const row = await this.executionRepository.manager
      .createQueryBuilder()
      .select('w.workspace_id', 'workspaceId')
      .from('workflow', 'w')
      .where('w.id = :id', { id: workflowId })
      .getRawOne<{ workspaceId: string | null }>();
    if (!row || !row.workspaceId || row.workspaceId !== userWorkspaceId) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Workflow not found',
      });
    }
  }

  async findById(id: string): Promise<ExecutionDetailWithTrigger> {
    // W-27 — 종결 상태 execution snapshot 은 불변. 인스턴스 LRU 캐시에서 즉시 회신.
    const cached = this.readSnapshotCache(id);
    if (cached) return cached;

    // Carousel disabled stuck (Phase 3 fix) — Execution + NodeExecution 두 개의
    // SELECT 가 trxn 외부에서 별도로 실행되면, 그 사이에 엔진의
    // `waitForButtonInteraction` 트랜잭션이 commit 할 때 snapshot 이
    // **internally inconsistent** 해진다 (`Execution.status='running'` 인데
    // `NodeExecution.status='waiting_for_input'`). frontend 의
    // `applyExecutionSnapshot` 가 그 불일치를 resume 으로 오인해 waiting UI
    // 를 wipe — Carousel 버튼이 콜백 없이 disabled 로 stuck.
    //
    // `REPEATABLE READ` 트랜잭션 안에서 두 SELECT 를 묶어, 동일 snapshot 시점
    // 의 일관된 데이터만 응답한다. 단순 read 라 deadlock 위험 없음.
    const snapshot = await this.executionRepository.manager.transaction(
      'REPEATABLE READ',
      async (manager): Promise<ExecutionDetailWithTrigger> => {
        // 안전 컬럼만 선택적으로 join — User.passwordHash 등 민감 필드 노출
        // 방지. executor.email 도 라벨 산출에 불필요하므로 제외 (PII 최소화).
        const execution = await manager
          .createQueryBuilder(Execution, 'e')
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

        // nodeExecutions 와 executionPath 조회는 서로 독립적이므로 RTT 단축을
        // 위해 병렬로 실행한다.
        const [nodeExecutions, pathRows] = await Promise.all([
          manager.find(NodeExecution, {
            where: { executionId: id },
            relations: ['node'],
            order: { startedAt: 'ASC' },
          }),
          // executionPath 는 execution_node_log 의 (execution_id, id) 순서로
          // 채운다. BIGSERIAL `id` 가 단조증가이므로 다중 인스턴스 환경에서도
          // 단일 source of truth 를 유지한다.
          // 대규모 ForEach 실행에서 로그 행이 수만 건에 달할 수 있어 안전 상한을
          // 둔다 — UI 가 timeline 을 그리는 데 필요한 prefix 만 필요하므로
          // MAX_EXECUTION_PATH_ROWS 까지만 가져온다.
          manager.find(ExecutionNodeLog, {
            where: { executionId: id },
            order: { id: 'ASC' },
            select: { nodeId: true },
            take: MAX_EXECUTION_PATH_ROWS,
          }),
        ]);
        const executionPath = pathRows.map((r) => r.nodeId);
        // `take` 상한과 동일 길이로 돌아오면 그 이후의 로그가 잘렸을 수 있다.
        // UI 는 이 플래그로 배너를 띄우거나 후속 페이지 요청을 결정한다.
        const executionPathTruncated =
          pathRows.length >= MAX_EXECUTION_PATH_ROWS;

        const parentName = execution.parentExecutionId
          ? (
              await loadParentWorkflowNames(this.executionRepository, [
                execution,
              ])
            ).get(execution.parentExecutionId)
          : null;
        const trigger = deriveExecutionTrigger(execution, parentName);

        // 응답 직전 trigger/executor 관계 객체를 제거 (User 등 민감 정보 누출
        // 방지).
        return {
          ...this.stripPrivateRelations(execution),
          nodeExecutions,
          triggerSource: trigger.source,
          triggerLabel: trigger.label,
          executionPath,
          executionPathTruncated,
        };
      },
    );
    this.writeSnapshotCache(id, snapshot);
    return snapshot;
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
      // cancelWaitingExecution 은 ContinuationBusService.publish 로 fan-out
      // 한다 — 호스팅 인스턴스가 reject 핸들러를 비동기 수행하므로 여기서
      // 즉시 re-fetch 한 결과는 아직 PENDING/RUNNING 일 수 있다. 클라이언트는
      // websocket 으로 후속 CANCELLED 이벤트를 수신해 화면을 갱신한다 (PR-B).
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
      this.invalidateSnapshotCache(id);
      return refreshed ?? execution;
    }
    // 상태 전이가 일어난 이상 캐시된 snapshot 은 stale.
    this.invalidateSnapshotCache(id);

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
      // list 응답에서는 N+1 회피를 위해 빈 배열로 유지. 단건 조회 (`findById`)
      // 는 별도 경로로 execution_node_log 를 채워서 응답한다.
      executionPath: [],
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
