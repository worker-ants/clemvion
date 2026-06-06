import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Execution, ExecutionStatus } from './entities/execution.entity';
import {
  NodeExecution,
  NodeExecutionStatus,
} from '../node-executions/entities/node-execution.entity';
import { ExecutionNodeLog } from '../execution-engine/entities/execution-node-log.entity';
import { Node, NodeCategory } from '../nodes/entities/node.entity';
import { ExecutionEngineService } from '../execution-engine/execution-engine.service';
import { NodeComponentRegistry } from '../../nodes/core/node-component.registry';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { loadTriggerParameterSchema } from '../execution-engine/utils/load-trigger-parameter-schema';
import { resolveTriggerParameters } from '../execution-engine/utils/resolve-trigger-parameters';
import { TriggerParameterValidationException } from '../execution-engine/types/trigger-parameter.types';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';
import { ReRunRequestDto } from './dto/re-run.dto';
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

// Re-run chain 깊이 한도 (RR-PL-05, spec §9.1). 새 re-run 포함 시 초과면 거부.
export const RERUN_CHAIN_DEPTH_LIMIT = 32;
// re_run_of walk 의 안전 상한 — 사이클은 구조상 불가(부모는 항상 더 이른 행)하나
// 무한 루프 방어로 한도의 2배에서 중단.
const RERUN_CHAIN_WALK_MAX = RERUN_CHAIN_DEPTH_LIMIT * 2;

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

/**
 * Carousel/Form/AI blocking 노드 waiting 진입의 intra-row inconsistency 정규화.
 *
 * 엔진의 `executeNode` blocking 분기는 핸들러가 반환한 봉투
 * (`output.status === 'waiting_for_input'`)를 **`NodeExecution.status` 컬럼은
 * `running` 인 채 `outputData` 에만** 먼저 저장하고, 직후 메인 루프가
 * `waitForButtonInteraction` / `waitForFormSubmission` / `waitForAiConversation`
 * 을 호출해야 비로소 status 컬럼을 `waiting_for_input` 으로 **atomic 전이**한다
 * (spec/5-system/4-execution-engine.md §전이 표 "원자성 보장" — Execution↔
 * NodeExecution 짝 전이). 그 두 save 사이에 snapshot 이 읽히면 같은 row 가
 * `status='running'` + `outputData.status='waiting_for_input'` 인 inconsistent
 * 상태가 된다.
 *
 * 기존 Phase 3 fix(REPEATABLE READ 트랜잭션)는 Execution.status vs
 * NodeExecution.status 의 **cross-query straddle** 만 막는다 — 이 **intra-row**
 * (status 컬럼 vs outputData.status) 불일치는 잡지 못한다. frontend
 * `applyExecutionSnapshot` 은 `ne.status` 를 waiting 판정의 진실로 신뢰하므로,
 * inconsistent snapshot 이 도착하면 waiting UI 가 hydrate 되지 않거나, 먼저 도착한
 * WS `waiting_for_input` 이벤트가 set 한 waiting 상태가 resume 으로 오인돼 wipe 된다
 * (Carousel 버튼이 콜백 없이 disabled 로 stuck).
 *
 * snapshot 단계에서 봉투 status 를 surface 해 일관성을 복원한다 — DB write/원자성은
 * 불변(순수 read-side normalization)이고, 모든 snapshot 소비자(웹 앱·channel-web-chat
 * ·external-interaction-api)에 일관 적용된다. terminal row 의 stale 봉투 문자열이
 * 재트리거하지 않도록 `running`/`pending` 인 row 만 채택한다.
 *
 * **Pure function**: 원본 TypeORM 엔티티를 변이하지 않고 정규화가 필요한 row 만
 * `{ ...ne, status: WAITING_FOR_INPUT }` 으로 교체한 새 배열을 반환한다.
 * `snapshotCache` 에 저장될 때 변이된 참조가 공유되는 캐시 오염을 방지한다.
 *
 * @param nodeExecutions — `findById` 트랜잭션에서 조회한 NodeExecution 배열.
 * @returns 정규화가 적용된 새 배열 (변이 없음).
 */
function reconcilePreParkWaitingStatus(
  nodeExecutions: NodeExecution[],
): NodeExecution[] {
  return nodeExecutions.map((ne) => {
    if (
      (ne.status === NodeExecutionStatus.RUNNING ||
        ne.status === NodeExecutionStatus.PENDING) &&
      (ne.outputData as { status?: unknown } | null)?.status ===
        NodeExecutionStatus.WAITING_FOR_INPUT
    ) {
      return { ...ne, status: NodeExecutionStatus.WAITING_FOR_INPUT };
    }
    return ne;
  });
}

@Injectable()
export class ExecutionsService {
  // 종결 상태 execution detail 의 인스턴스 LRU 캐시 (W-27).
  // 삽입 순서 = LRU — Map iteration 이 삽입 순서를 보장하므로 별도 자료구조 없이
  // size 초과 시 첫 키 (가장 오래된 진입) 를 evict.
  private readonly snapshotCache = new Map<
    string,
    ExecutionDetailWithTrigger
  >();

  private readonly logger = new Logger(ExecutionsService.name);

  constructor(
    @InjectRepository(Execution)
    private readonly executionRepository: Repository<Execution>,
    @InjectRepository(NodeExecution)
    private readonly nodeExecutionRepository: Repository<NodeExecution>,
    @InjectRepository(ExecutionNodeLog)
    private readonly executionNodeLogRepository: Repository<ExecutionNodeLog>,
    @InjectRepository(Node)
    private readonly nodeRepository: Repository<Node>,
    private readonly executionEngineService: ExecutionEngineService,
    private readonly nodeComponentRegistry: NodeComponentRegistry,
    private readonly auditLogsService: AuditLogsService,
    private readonly workspacesService: WorkspacesService,
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

  // ─── Replay/Re-run (decision F2, spec/5-system/13-replay-rerun.md §8) ───

  /**
   * RR-PL-06 — 사용자가 **대상 워크스페이스**에서 owner/admin 인지 여부.
   *
   * 주의: `JwtPayload.role` 을 쓰면 안 된다 — `JwtStrategy` 가 role 을 사용자의
   * **개인(personal) 워크스페이스** 멤버십에서 도출하므로 모든 사용자가 항상
   * 'owner' 다. 그 값으로 분기하면 owner/admin 게이트가 무력화돼 동일 워크스페이스
   * 내 타인 실행을 editor 가 re-run 할 수 있는 IDOR 가 된다. 따라서 RolesGuard 와
   * 동일하게 `WorkspacesService.getMemberRole(workspaceId, userId)` 로 대상
   * 워크스페이스의 실제 role 을 조회한다.
   */
  private async isOwnerOrAdmin(
    workspaceId: string,
    userId: string,
  ): Promise<boolean> {
    const role = await this.workspacesService.getMemberRole(
      workspaceId,
      userId,
    );
    return role === 'owner' || role === 'admin';
  }

  /** chain 깊이 = 본 실행에서 re_run_of 를 따라 root 까지의 조상 수(+자기 1). */
  private async computeChainDepth(executionId: string): Promise<number> {
    let depth = 1;
    let cursor: string | null = executionId;
    for (let i = 0; i < RERUN_CHAIN_WALK_MAX && cursor; i++) {
      const row: { reRunOf: string | null } | undefined =
        await this.executionRepository
          .createQueryBuilder('e')
          .select('e.reRunOf', 'reRunOf')
          .where('e.id = :id', { id: cursor })
          .getRawOne<{ reRunOf: string | null }>();
      cursor = row?.reRunOf ?? null;
      if (cursor) depth += 1;
    }
    return depth;
  }

  /**
   * 원본 실행을 기반으로 새 Execution 을 시작한다 (spec §8.1).
   * 권한: RBAC editor+ 는 controller `@Roles('editor')` 가 강제. 본 메서드는
   * 워크스페이스 격리(RERUN_EXECUTION_NOT_FOUND) + 타인 실행 owner/admin 한정
   * (RERUN_PERMISSION_DENIED, RR-PL-06) 을 추가 검증한다.
   */
  async reRun(
    executionId: string,
    workspaceId: string,
    user: JwtPayload,
    dto: ReRunRequestDto,
  ): Promise<
    ExecutionDetailWithTrigger & {
      reRunOf: string;
      chainId: string;
      dryRun: boolean;
    }
  > {
    const original = await this.executionRepository
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.workflow', 'workflow')
      .where('e.id = :id', { id: executionId })
      .getOne();
    if (!original || original.workflow?.workspaceId !== workspaceId) {
      // ID enumeration 차단 — 존재/타 워크스페이스 모두 동일 404.
      throw new NotFoundException({
        code: 'RERUN_EXECUTION_NOT_FOUND',
        message: 'Execution not found',
      });
    }
    // 방어적 — execution.workflow 는 FK CASCADE 라 정상적으로 항상 존재한다.
    if (!original.workflow) {
      throw new NotFoundException({
        code: 'RERUN_WORKFLOW_DELETED',
        message: 'Original execution workflow has been deleted',
      });
    }

    // RR-PL-06 — 타인의 실행이면 대상 워크스페이스 owner/admin 만 re-run 가능.
    if (
      original.executedBy &&
      original.executedBy !== user.sub &&
      !(await this.isOwnerOrAdmin(workspaceId, user.sub))
    ) {
      throw new ForbiddenException({
        code: 'RERUN_PERMISSION_DENIED',
        message: 'You do not have permission to re-run this execution',
      });
    }

    // dry-run pre-flight (spec §7.2) — 워크플로에 외부 부수효과 노드인데
    // dry-run mock 미구현(`supportsDryRun !== true`)인 노드가 있으면 진입 전에
    // 전체 Re-run 을 거부한다. 모든 v1 외부 부수효과 노드는 supportsDryRun:true
    // 라 정상 워크플로는 통과 — 미래에 mock 없는 부수효과 노드가 추가될 때의
    // 안전 가드.
    const dryRun = dto.dryRun ?? false;
    if (dryRun) {
      await this.assertDryRunSupported(original.workflowId);
    }

    // RR-PL-05 — chain 깊이 32 제한 (새 실행 포함 시 초과면 거부).
    const depth = await this.computeChainDepth(executionId);
    if (depth >= RERUN_CHAIN_DEPTH_LIMIT) {
      throw new ConflictException({
        code: 'RERUN_CHAIN_DEPTH_EXCEEDED',
        message: `Re-run chain depth limit (${RERUN_CHAIN_DEPTH_LIMIT}) exceeded`,
      });
    }

    // 입력 — 원본 그대로 / inputOverride (Manual Trigger 스키마 검증).
    const useOriginal = dto.useOriginalInput ?? true;
    let executionInput: Record<string, unknown>;
    if (useOriginal) {
      executionInput = original.inputData ?? {};
    } else {
      const schema = await loadTriggerParameterSchema(
        this.nodeRepository,
        original.workflowId,
        this.logger,
      );
      let parameters: Record<string, unknown>;
      try {
        parameters = resolveTriggerParameters(schema, dto.inputOverride ?? {});
      } catch (err) {
        if (err instanceof TriggerParameterValidationException) {
          throw new BadRequestException({
            code: 'INVALID_INPUT',
            message: 'Invalid input override',
            errors: err.errors,
          });
        }
        throw err;
      }
      executionInput = { __triggerSource: 'manual' as const, parameters };
    }

    // chain root = 원본의 chain_id (있으면) 아니면 원본 자신의 id.
    const chainId = original.chainId ?? original.id;

    const newExecutionId = await this.executionEngineService.execute(
      original.workflowId,
      executionInput,
      { executedBy: user.sub, reRunOf: executionId, chainId, dryRun },
    );

    // 감사 로그 (spec §11) — 실패는 swallow (audit 가 주 동작을 깨지 않음).
    // inputModified: 사용자 입력 수정 모드이고 resolved 입력이 원본과 다를 때.
    const inputModified =
      !useOriginal &&
      JSON.stringify(
        (executionInput as { parameters?: unknown }).parameters ?? null,
      ) !==
        JSON.stringify(
          (original.inputData as { parameters?: unknown } | null)?.parameters ??
            null,
        );
    await this.auditLogsService.record({
      workspaceId,
      userId: user.sub,
      action: 're_run_initiated',
      resourceType: 'execution',
      resourceId: newExecutionId,
      details: {
        originalExecutionId: executionId,
        chainId,
        dryRun,
        inputModified,
      },
    });

    const detail = await this.findById(newExecutionId);
    return { ...detail, reRunOf: executionId, chainId, dryRun };
  }

  /**
   * dry-run pre-flight (spec §7.2). 워크플로의 노드 중 외부 부수효과
   * (Integration category) 인데 `supportsDryRun !== true` 인 노드가 하나라도
   * 있으면 `RERUN_DRY_RUN_NOT_APPLICABLE` 로 거부한다. mock 출력을 보장할 수
   * 없는 노드가 dry-run 으로 실행돼 실제 외부 호출이 일어나는 것을 차단.
   *
   * @throws {BadRequestException} RERUN_DRY_RUN_NOT_APPLICABLE — 워크플로에
   *   `supportsDryRun !== true` 인 Integration 노드가 존재할 때.
   */
  private async assertDryRunSupported(workflowId: string): Promise<void> {
    const nodes = await this.nodeRepository.find({
      where: { workflowId },
      select: { id: true, type: true, category: true },
    });
    const offending = nodes.find((node) => {
      if (node.category !== NodeCategory.INTEGRATION) return false;
      const meta = this.nodeComponentRegistry.getComponent(node.type)?.metadata;
      return meta?.supportsDryRun !== true;
    });
    if (offending) {
      throw new BadRequestException({
        code: 'RERUN_DRY_RUN_NOT_APPLICABLE',
        message: `Workflow contains a node (type='${offending.type}') that does not support dry-run`,
      });
    }
  }

  /**
   * 같은 chain 의 모든 실행을 started_at ASC 로 반환 (spec §8.2). nodeExecutions
   * 는 생략(목록 용).
   * @param user 인증 사용자 — RR-PL-06 권한 판정용 (타인 실행은 owner/admin 한정).
   * @throws NotFoundException RERUN_EXECUTION_NOT_FOUND (미존재/타 워크스페이스)
   * @throws ForbiddenException RERUN_PERMISSION_DENIED (RR-PL-06)
   */
  async getChain(
    executionId: string,
    workspaceId: string,
    user: JwtPayload,
  ): Promise<Execution[]> {
    const exec = await this.executionRepository
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.workflow', 'workflow')
      .where('e.id = :id', { id: executionId })
      .getOne();
    if (!exec || exec.workflow?.workspaceId !== workspaceId) {
      throw new NotFoundException({
        code: 'RERUN_EXECUTION_NOT_FOUND',
        message: 'Execution not found',
      });
    }
    // RR-PL-06 — chain 조회 권한은 re-run 과 동일: 타인 실행은 대상 워크스페이스 owner/admin 만.
    if (
      exec.executedBy &&
      exec.executedBy !== user.sub &&
      !(await this.isOwnerOrAdmin(workspaceId, user.sub))
    ) {
      throw new ForbiddenException({
        code: 'RERUN_PERMISSION_DENIED',
        message: 'You do not have permission to view this execution chain',
      });
    }
    const rootId = exec.chainId ?? exec.id;
    const rows = await this.executionRepository
      .createQueryBuilder('e')
      .where('e.id = :rootId OR e.chainId = :rootId', { rootId })
      .orderBy('e.startedAt', 'ASC')
      .getMany();
    return rows.map((e) => this.stripPrivateRelations(e));
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
        const reconciledNodeExecutions =
          reconcilePreParkWaitingStatus(nodeExecutions);
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
          nodeExecutions: reconciledNodeExecutions,
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
    const nodeCountMap = await this.loadNodeExecutionCounts(
      data.map((e) => e.id),
    );
    const dtoList = data.map((e) =>
      this.toExecutionDto(e, parentNameMap, nodeCountMap),
    );
    return PaginatedResponseDto.create(dtoList, totalItems, page, limit);
  }

  /**
   * 실행 목록의 Nodes 열(완료/전체, 실패 수)을 위해 node_execution 을
   * execution_id 로 묶어 단일 그룹 쿼리로 집계한다 (N+1 회피). 관계 로드 없이
   * status 별 COUNT 만 구한다. spec/2-navigation/14-execution-history.md §2.4.
   */
  private async loadNodeExecutionCounts(
    executionIds: string[],
  ): Promise<
    Map<string, { total: number; completed: number; failed: number }>
  > {
    const map = new Map<
      string,
      { total: number; completed: number; failed: number }
    >();
    if (executionIds.length === 0) return map;

    const rows = await this.nodeExecutionRepository
      .createQueryBuilder('ne')
      .select('ne.execution_id', 'executionId')
      .addSelect('COUNT(*)', 'total')
      .addSelect("COUNT(*) FILTER (WHERE ne.status = 'completed')", 'completed')
      .addSelect("COUNT(*) FILTER (WHERE ne.status = 'failed')", 'failed')
      .where('ne.execution_id IN (:...executionIds)', { executionIds })
      .groupBy('ne.execution_id')
      .getRawMany<{
        executionId: string;
        total: string;
        completed: string;
        failed: string;
      }>();

    for (const r of rows) {
      map.set(r.executionId, {
        total: Number(r.total),
        completed: Number(r.completed),
        failed: Number(r.failed),
      });
    }
    return map;
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
    nodeCountMap?: Map<
      string,
      { total: number; completed: number; failed: number }
    >,
  ): ExecutionDto {
    const parentName = execution.parentExecutionId
      ? (parentNameMap.get(execution.parentExecutionId) ?? null)
      : null;
    const trigger = deriveExecutionTrigger(execution, parentName);
    const counts = nodeCountMap?.get(execution.id) ?? {
      total: 0,
      completed: 0,
      failed: 0,
    };
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
      // Re-run chain 메타 — chain badge / View chain (spec §10.3) 가 사용.
      reRunOf: execution.reRunOf ?? null,
      chainId: execution.chainId ?? null,
      dryRun: execution.dryRun ?? false,
      totalNodeCount: counts.total,
      completedNodeCount: counts.completed,
      failedNodeCount: counts.failed,
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
