import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, SelectQueryBuilder } from 'typeorm';
import { Execution, ExecutionStatus } from './entities/execution.entity';
import {
  NodeExecution,
  NodeExecutionStatus,
} from '../node-executions/entities/node-execution.entity';
import { ExecutionNodeLog } from '../execution-engine/entities/execution-node-log.entity';
import { resolveTerminalDurationMs } from '../../shared/utils/terminal-duration';
import { Node, NodeCategory } from '../nodes/entities/node.entity';
import { isAiResumedWaitingEnvelope } from '../execution-engine/ai-conversation-helpers';
import { ExecutionEngineService } from '../execution-engine/execution-engine.service';
import { NodeComponentRegistry } from '../../nodes/core/node-component.registry';
import { ErrorCode } from '../../nodes/core/error-codes';
import {
  NODE_TYPES,
  SUB_WORKFLOW_MAX_RECURSION_DEPTH,
} from '../../nodes/core/node-types.constants';
import { assertRowArray } from '../../common/utils/assert-row-array';
import { pickSortColumn } from '../../common/utils/list-sort';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AUDIT_ACTIONS } from '../audit-logs/audit-action.const';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { loadTriggerParameterSchema } from '../execution-engine/utils/load-trigger-parameter-schema';
import { resolveTriggerParametersRejectingMasked } from '../execution-engine/utils/reject-masked-resubmission';
import {
  TriggerParameterValidationException,
  toTriggerParameterErrorDetails,
} from '../execution-engine/types/trigger-parameter.types';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';
import { ReRunRequestDto } from './dto/re-run.dto';
import { QueryExecutionDto } from './dto/query-execution.dto';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import {
  ExecutionDetailDto,
  ExecutionDto,
  NodeExecutionSummaryDto,
} from './dto/responses/execution-response.dto';
import { toActiveRunningMsForResponse } from './utils/active-running-ms';
import { deriveExecutionTrigger } from './utils/execution-trigger';
import { loadParentWorkflowNames } from './utils/load-parent-workflow-names';
import { redactStoredFieldsForResponse } from '../../shared/utils/redact-stored-error';

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
export const SNAPSHOT_CACHE_MAX_ENTRIES = 256;

/** 실행 한 건의 노드 실행 집계 (목록 Nodes 열 · 응답의 `*NodeCount` 세 값). */
type NodeExecutionCounts = { total: number; completed: number; failed: number };

const EMPTY_NODE_EXECUTION_COUNTS: NodeExecutionCounts = {
  total: 0,
  completed: 0,
  failed: 0,
};

/**
 * {@link ExecutionsService.toResponseExecution} 이 엔티티 밖에서 받는 값.
 * 부모 워크플로 이름과 노드 집계는 경로마다 구하는 방법이 달라서(목록은 배치 조회, 상세는
 * 이미 읽은 노드 실행 배열) 호출부가 구해 넘긴다.
 */
interface ExecutionResponseContext {
  parentWorkflowName: string | null;
  counts: NodeExecutionCounts;
}

/** 재실행 응답 — 상세 응답에 체인 메타 세 값을 확정한 모양. */
export type ReRunResponse = ExecutionDetailDto & {
  reRunOf: string;
  chainId: string;
  dryRun: boolean;
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
 * AI 대화 노드(AI 에이전트 · 정보 추출기)의 재개 턴도 같은 창을 만든다. 재개 claim 이
 * 행을 `running` 으로 바꾸고, 엔진은 LLM 호출 전에 재개 스냅샷
 * (`outputData.status === 'resumed'`, `meta.interactionType === 'ai_conversation'`)을
 * 저장한다. LLM 응답이 오면 다시 대기로 park 한다. 그 사이 snapshot 이 대기로 보이지
 * 않으면 실행 상세 폴링이 대화 화면을 비우므로 이 조합도 대기로 본다(NERV
 * `CLE-NODE-AGENT-OUTPUT` 「멀티턴 재개」, `CLE-EXEC-STATE`). form · buttons 노드의
 * `resumed` 는 재개 뒤 바로 종결되는 마지막 출력이라 `interactionType` 으로 제외한다.
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
 * **동기화 의무 (의도적 중복 방어 레이어)**: 이 함수의 판정 조건
 * (`running`/`pending` + `outputData.status==='waiting_for_input'` 또는 AI 대화 재개
 * 스냅샷, terminal 제외 — {@link isWaitingEnvelope})
 * 을 변경할 때는 frontend `apply-execution-snapshot.ts: isNodeWaitingForInput`
 * 도 동일 조건으로 함께 변경해야 한다 — 두 레이어는 같은 intra-row inconsistency
 * 를 각각 backend read-side / frontend defense-in-depth 로 막는 의도적 중복이라,
 * 한쪽만 바뀌면 불일치 창이 재개방된다.
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
      isWaitingEnvelope(ne.outputData)
    ) {
      return { ...ne, status: NodeExecutionStatus.WAITING_FOR_INPUT };
    }
    return ne;
  });
}

/**
 * `outputData` 봉투가 사용자 입력 대기를 뜻하는지 본다. 대기 봉투
 * (`status === 'waiting_for_input'`)와 AI 대화 재개 턴의 스냅샷
 * (`status === 'resumed'` + `meta.interactionType === 'ai_conversation'`)이다.
 * 프런트 `isNodeWaitingForInput` 과 같은 조건이어야 한다.
 */
function isWaitingEnvelope(outputData: unknown): boolean {
  const status = (outputData as { status?: unknown } | null)?.status;
  if (status === NodeExecutionStatus.WAITING_FOR_INPUT) return true;
  return isAiResumedWaitingEnvelope(outputData);
}

/**
 * 이미 읽은 노드 실행 행으로 집계 세 값을 센다. 목록 경로의
 * `loadNodeExecutionCounts`(SQL `COUNT … FILTER`)와 같은 기준이다.
 */
function countNodeExecutions(
  nodeExecutions: readonly NodeExecution[],
): NodeExecutionCounts {
  let completed = 0;
  let failed = 0;
  for (const ne of nodeExecutions) {
    if (ne.status === NodeExecutionStatus.COMPLETED) completed += 1;
    else if (ne.status === NodeExecutionStatus.FAILED) failed += 1;
  }
  return { total: nodeExecutions.length, completed, failed };
}

@Injectable()
export class ExecutionsService {
  // 종결 상태 execution detail 의 인스턴스 LRU 캐시 (W-27).
  // 삽입 순서 = LRU — Map iteration 이 삽입 순서를 보장하므로 별도 자료구조 없이
  // size 초과 시 첫 키 (가장 오래된 진입) 를 evict.
  private readonly snapshotCache = new Map<string, ExecutionDetailDto>();

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

  private readSnapshotCache(id: string): ExecutionDetailDto | undefined {
    const cached = this.snapshotCache.get(id);
    if (cached !== undefined) {
      // LRU: 최근 사용으로 갱신.
      this.snapshotCache.delete(id);
      this.snapshotCache.set(id, cached);
    }
    return cached;
  }

  private writeSnapshotCache(id: string, snapshot: ExecutionDetailDto): void {
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
      // `.next().value` 는 `BuiltinIteratorReturn`(= `any`; `strictBuiltinIteratorReturn`
      // 미설정) 탓에 `any` 다. 이 Map 의 키는 `string` 이라 단언으로 되돌린다 —
      // 단언은 소거되므로 emit 은 종전 그대로다.
      const oldest = this.snapshotCache.keys().next().value as
        string | undefined;
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

  /**
   * chain 깊이 = 본 실행에서 re_run_of 를 따라 root 까지의 조상 수(+자기 1).
   *
   * C-2 — 직렬 SELECT walk(조상마다 1 DB 왕복) → 재귀 CTE 단일 쿼리. `depth <
   * RERUN_CHAIN_WALK_MAX` 가드로 사이클 시 무한 재귀를 차단하며 옛 walk 상한(64)과
   * 동일 의미를 보존한다. spec/5-system/13-replay-rerun.md §9.1 의 "애플리케이션
   * 레벨 enforce"(=앱이 거부) 본질은 그대로 — 깊이 비교는 호출부(:reRun)가 수행.
   * PK · V067(re_run_of) 인덱스로 커버 — 마이그레이션 불요.
   * (#12 — spec Rationale 과의 분기 계약은 spec/5-system/13-replay-rerun.md §9.1
   * Rationale 에서 명시 예정)
   */
  private async computeChainDepth(executionId: string): Promise<number> {
    const rows: Array<{ depth: number | null }> =
      await this.executionRepository.query(
        `WITH RECURSIVE chain AS (
           SELECT id, re_run_of, 1 AS depth
             FROM execution
            WHERE id = $1
           UNION ALL
           SELECT e.id, e.re_run_of, c.depth + 1
             FROM execution e
             JOIN chain c ON e.id = c.re_run_of
            WHERE c.depth < $2
         )
         SELECT max(depth) AS depth FROM chain`,
        [executionId, RERUN_CHAIN_WALK_MAX],
      );
    // `.query()` 반환은 `Promise<any>` 라 위 타입 단언이 런타임을 검증하지 않는다.
    // 배열이 아니면 `rows[0]` 가 undefined → `?? 1` 로 **depth 1** 을 반환하고,
    // 호출부 `depth >= RERUN_CHAIN_DEPTH_LIMIT` 가 통과해 **RR-PL-05 체인 깊이 제한이
    // 조용히 우회된다**(fail-open). 세 자매 `.query()` 지점 중 유일하게 방향이 열려 있어
    // 여기서는 진단이 아니라 **정확성** 문제다 — ai-review `17_15_21` WARNING 1.
    assertRowArray(
      rows,
      `computeChainDepth 재귀 CTE, execution ${executionId}. ` +
        `depth 1 로 넘기면 RR-PL-05 제한이 무력화된다.`,
    );
    // 조상 미존재(=base 1행)면 depth 1. id 부재 시 base 0행 → max NULL → 1 로 방어.
    return Number(rows[0]?.depth ?? 1);
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
  ): Promise<ReRunResponse> {
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
      await this.assertDryRunSupported(original.workflowId, workspaceId);
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
    const executionInput: Record<string, unknown> = useOriginal
      ? (original.inputData ?? {})
      : await this.resolveManualOverrideInput(
          original.workflowId,
          workspaceId,
          dto.inputOverride ?? {},
        );

    // chain root = 원본의 chain_id (있으면) 아니면 원본 자신의 id.
    const chainId = original.chainId ?? original.id;

    const newExecutionId = await this.executionEngineService.execute(
      original.workflowId,
      executionInput,
      {
        executedBy: user.sub,
        workspaceId,
        reRunOf: executionId,
        chainId,
        dryRun,
      },
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
      action: AUDIT_ACTIONS.EXECUTION_RE_RUN,
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
   * `useOriginalInput: false` 일 때 쓸 입력을 만든다 — 스키마 로드 → 마커 거부 resolve →
   * 검증 실패를 응답 봉투로 매핑까지.
   *
   * ## 왜 이 덩어리만 뽑았나
   *
   * {@link reRun} 의 여섯 책임(조회+인가 · dry-run pre-flight · chain 깊이 · **입력 해석** ·
   * execute · 감사로그) 중 나머지는 각각 5~10줄인데 입력 해석만 40줄이었다. 가장 크고,
   * 세 층(로드·검증·에러 매핑)이 한 블록에 얽혀 있어 읽는 비용도 가장 컸다.
   *
   * > **`useOriginal` 판정은 여기 없다.** 호출부의 `inputModified` 계산이 같은 값을 쓰므로,
   * > 기본값 `?? true` 를 이 안에도 두면 두 곳이 되고 한쪽만 바뀔 때 조용히 갈린다.
   *
   * > **`__triggerSource` 봉투까지 여기서 만든다.** 파라미터만 돌려주면 *"manual override
   * > 입력은 이렇게 생겼다"* 는 계약이 호출부와 두 군데로 쪼개진다.
   */
  private async resolveManualOverrideInput(
    workflowId: string,
    workspaceId: string,
    inputOverride: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const schema = await loadTriggerParameterSchema(
      this.nodeRepository,
      workflowId,
      workspaceId,
      this.logger,
    );
    let parameters: Record<string, unknown>;
    try {
      // 마스킹된 값이 그대로 되돌아왔는가 — 프런트 가드(EIA §R17)의 서버측 2층.
      // UI 를 거치지 않는 클라이언트(curl 등)는 프런트 차단을 우회하므로 여기서 막는다.
      // 검사 시점(raw 우선)은 그 wrapper 가 소유한다 — 호출부가 순서를 다시 정하지 않는다.
      parameters = resolveTriggerParametersRejectingMasked(
        schema,
        inputOverride,
      );
    } catch (err) {
      if (err instanceof TriggerParameterValidationException) {
        throw new BadRequestException({
          // **자매 호출부(`workflows.controller.ts`)와 같은 코드다** — 셋 다
          // `resolveTriggerParameters` 의 같은 검증 실패를 감싸므로 최상위 코드도 같아야
          // 한다. 2026-08-22 이전엔 이 자리만 `INVALID_INPUT` 이었다(선존 drift).
          // rename 근거·잔여 위험: `spec/conventions/error-codes.md` §5.
          code: 'INVALID_TRIGGER_PARAMETERS',
          message: 'Invalid input override',
          // **`errors` 가 아니라 `details` 다** — `GlobalExceptionFilter` 는 `details`
          // 만 읽으므로 종전 `errors: err.errors` 는 필드별 내역이 봉투에 실리지 않고
          // 조용히 버려졌다(선존 버그). 자매 호출부(`workflows.controller.ts`)는 처음부터
          // 이 형태였다 — 이제 둘이 같아진다. spec: manual-trigger §6 "응답 봉투".
          details: toTriggerParameterErrorDetails(err.errors),
        });
      }
      throw err;
    }
    return { __triggerSource: 'manual' as const, parameters };
  }

  /**
   * dry-run pre-flight (spec §7.2). 워크플로의 노드 중 외부 부수효과
   * (Integration category) 인데 `supportsDryRun !== true` 인 노드가 하나라도
   * 있으면 `RERUN_DRY_RUN_NOT_APPLICABLE` 로 거부한다. mock 출력을 보장할 수
   * 없는 노드가 dry-run 으로 실행돼 실제 외부 호출이 일어나는 것을 차단.
   *
   * 서브 워크플로우 노드(`workflow`)가 부르는 워크플로우도 같은 규칙으로 본다
   * (CLE-T-Y2F1NG). 동기 자식은 부모 context 를, 비동기 자식은 실행 행의 `dry_run` 을
   * 이어받아 dry-run 으로 돌기 때문이다. 탐색은 너비 우선이고 이미 본 워크플로우는
   * 다시 보지 않는다(순환 가드). 깊이는 서브 워크플로우 재귀 한도
   * ({@link SUB_WORKFLOW_MAX_RECURSION_DEPTH})까지만 본다. 그보다 깊은 호출은 실행 때
   * 재귀 한도로 실패한다. 대상 ID 가 표현식(`{{ … }}`)이면 실행 전에는 알 수 없어
   * 보지 않고, 같은 워크스페이스 밖의 워크플로우는 엔진이 실행 때 막으므로 보지 않는다.
   *
   * @throws {BadRequestException} RERUN_DRY_RUN_NOT_APPLICABLE — 워크플로나 그
   *   서브 워크플로에 `supportsDryRun !== true` 인 Integration 노드가 존재할 때.
   */
  private async assertDryRunSupported(
    workflowId: string,
    workspaceId: string,
  ): Promise<void> {
    const visited = new Set<string>([workflowId]);
    let frontier = [workflowId];
    for (
      let depth = 0;
      frontier.length > 0 && depth <= SUB_WORKFLOW_MAX_RECURSION_DEPTH;
      depth++
    ) {
      const nodes = await this.nodeRepository.find({
        where: { workflowId: In(frontier), workflow: { workspaceId } },
        select: { id: true, type: true, category: true, config: true },
      });
      const offending = this.findDryRunUnsupportedNode(nodes);
      if (offending) {
        throw new BadRequestException({
          code: 'RERUN_DRY_RUN_NOT_APPLICABLE',
          message: `Workflow contains a node (type='${offending.type}') that does not support dry-run`,
        });
      }
      frontier = this.collectSubWorkflowTargets(nodes, visited);
    }
  }

  /** Integration 노드 중 `supportsDryRun !== true` 인 첫 노드. 없으면 undefined. */
  private findDryRunUnsupportedNode(nodes: Node[]): Node | undefined {
    return nodes.find((node) => {
      if (node.category !== NodeCategory.INTEGRATION) return false;
      const meta = this.nodeComponentRegistry.getComponent(node.type)?.metadata;
      return meta?.supportsDryRun !== true;
    });
  }

  /**
   * 서브 워크플로우 노드가 부르는 대상 워크플로우 ID 를 모은다. 표현식(`{{ … }}`)이거나
   * 이미 본 ID(`visited`)는 뺀다. 새로 모은 ID 는 `visited` 에 넣는다.
   */
  private collectSubWorkflowTargets(
    nodes: Node[],
    visited: Set<string>,
  ): string[] {
    const next: string[] = [];
    for (const node of nodes) {
      if (node.type !== NODE_TYPES.WORKFLOW) continue;
      const target = (node.config as { workflowId?: unknown } | null)
        ?.workflowId;
      if (typeof target !== 'string') continue;
      const id = target.trim();
      if (id === '' || id.includes('{{') || visited.has(id)) continue;
      visited.add(id);
      next.push(id);
    }
    return next;
  }

  /**
   * 같은 chain 의 모든 실행을 started_at ASC 로 반환 (spec §8.2). nodeExecutions
   * 는 생략(목록 용). 조회 권한은 실행 상세 조회와 같아서 워크스페이스 멤버면
   * 역할 · 실행자와 무관하게 받는다. 재실행 권한(RR-PL-06)은 reRun 만 본다.
   * @throws NotFoundException RERUN_EXECUTION_NOT_FOUND (미존재/타 워크스페이스)
   */
  async getChain(
    executionId: string,
    workspaceId: string,
  ): Promise<ExecutionDto[]> {
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
    const rootId = exec.chainId ?? exec.id;
    const rows = await this.withTriggerSourceRelations(
      this.executionRepository.createQueryBuilder('e'),
    )
      .where('e.id = :rootId OR e.chainId = :rootId', { rootId })
      .orderBy('e.startedAt', 'ASC')
      .getMany();
    return this.toExecutionDtos(rows);
  }

  async findById(id: string): Promise<ExecutionDetailDto> {
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
      async (manager): Promise<ExecutionDetailDto> => {
        const execution = await this.withTriggerSourceRelations(
          manager.createQueryBuilder(Execution, 'e'),
        )
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
            relations: { node: true },
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
        // 노드 실행 행도 DTO 로 조립한다. 세 컬럼 마스킹은 `toNodeExecutionSummary` 가
        // `redactStoredFieldsForResponse` 로 건다(상위 실행과 같은 헬퍼다).
        // `Execution.error` 는 최초 실패 노드 실행의 에러를 복사한 값이라 노드 수준을 빼면
        // 같은 문자열이 원문으로 남는다(`16_32_42` cross_spec CRITICAL).
        const nodeExecutionDtos = reconcilePreParkWaitingStatus(
          nodeExecutions,
        ).map((ne) => this.toNodeExecutionSummary(ne));
        const executionPath = pathRows.map((r) => r.nodeId);
        // `take` 상한과 동일 길이로 돌아오면 그 이후의 로그가 잘렸을 수 있다.
        // UI 는 이 플래그로 배너를 띄우거나 후속 페이지 요청을 결정한다.
        const executionPathTruncated =
          pathRows.length >= MAX_EXECUTION_PATH_ROWS;

        const parentWorkflowName = execution.parentExecutionId
          ? ((
              await loadParentWorkflowNames(this.executionRepository, [
                execution,
              ])
            ).get(execution.parentExecutionId) ?? null)
          : null;

        return {
          ...this.toResponseExecution(execution, {
            parentWorkflowName,
            // 목록의 집계 쿼리와 같은 기준이다. 대기 보정(`reconcilePreParkWaitingStatus`)은
            // running · pending 만 바꾸므로 completed · failed 수에 영향이 없다.
            counts: countNodeExecutions(nodeExecutions),
          }),
          executionPath,
          nodeExecutions: nodeExecutionDtos,
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

    const qb = this.withTriggerSourceRelations(
      this.executionRepository.createQueryBuilder('e'),
    ).where('e.workflow_id = :workflowId', { workflowId });

    if (status) {
      qb.andWhere('e.status = :status', { status });
    }

    const sortColumn = this.getSortColumn(sort);
    qb.orderBy(`e.${sortColumn}`, order.toUpperCase() as 'ASC' | 'DESC');

    const [data, totalItems] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const dtoList = await this.toExecutionDtos(data);
    return PaginatedResponseDto.create(dtoList, totalItems, page, limit);
  }

  /**
   * 실행 목록의 Nodes 열(완료/전체, 실패 수)을 위해 node_execution 을
   * execution_id 로 묶어 단일 그룹 쿼리로 집계한다 (N+1 회피). 관계 로드 없이
   * status 별 COUNT 만 구한다. spec/2-navigation/14-execution-history.md §2.4.
   */
  private async loadNodeExecutionCounts(
    executionIds: string[],
  ): Promise<Map<string, NodeExecutionCounts>> {
    const map = new Map<string, NodeExecutionCounts>();
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
   * Execution 의 현재 status 만 조회한다 (미존재 시 null). 가벼운 status 조회 전용 —
   * HooksService 의 chat-channel 활성 execution 판정(CCH-CV-03) 등이 사용한다.
   * 과거 소비처의 `executionsService['executionRepository']` private 브래킷 접근을
   * 공개 API 로 캡슐화한다.
   *
   * @remarks 조회 실패(DB 장애 등)는 `null` 로 흡수하며 **throw 하지 않는다** — 호출부 분기를
   *   단순화한다. 단 silent 누락(중복 실행 등 fail-open 부작용)을 운영이 인지하도록 실패는
   *   `logger.warn` 으로 남긴다.
   */
  async getStatusById(executionId: string): Promise<ExecutionStatus | null> {
    const row = await this.executionRepository
      .findOne({
        where: { id: executionId },
        select: { id: true, status: true },
      })
      .catch((err: unknown) => {
        this.logger.warn(
          `getStatusById(${executionId}) 조회 실패 — null 로 흡수: ${err instanceof Error ? err.message : String(err)}`,
        );
        return null;
      });
    return row?.status ?? null;
  }

  /**
   * 실행 중지 — **응답 마스킹 관문**.
   *
   * > 동시성 계약(TOCTOU 방지 원자 UPDATE)은 본체 {@link ExecutionsService.stopInternal}
   * > 의 JSDoc 에 있다. 리팩터로 로직이 그쪽으로 내려갔으므로 설명도 함께 옮겼다 —
   * > 얇은 wrapper 에 남겨 두면 *"불변식이 여기 있다"* 로 잘못 읽힌다
   * > (`17_35_49` documentation W2).
   *
   * **응답 마스킹은 여기 한 자리에서 건다.** `stopInternal` 은 `return` 문이 **셋**이고
   * (waiting 경로 · `affected=0` 재조회 · 정상 재조회) 각각 `?? execution` 폴백을 가져
   * 실제로 나갈 수 있는 객체는 **여섯 가지**다. 호출부마다 마스킹을 걸면 네 번째 반환이
   * 추가될 때 조용히 빠진다. 함수를 하나 더 두어 **모든 반환이 같은 문을 통과**하게 한다.
   *
   * > 읽기 표면 전체 목록과 그 근거는 {@link ExecutionsService.toResponseExecution} 의
   * > 표가 정본이다 — 여기에 개수를 다시 적지 않는다(적으면 표면이 늘 때 갈린다).
   *
   * **반환 계약**: 목록 · 체인과 같은 {@link ExecutionDto} 다(2026-11-14). 종전에는 재조회한
   * 엔티티를 펼쳐 돌려줘서 선언한 `triggerSource` · `triggerLabel` · 노드 집계가 빠지고
   * 선언하지 않은 컬럼이 실렸다. 내부 소비자(`interaction.service.ts` · `hooks.service.ts`)는
   * 반환값을 버리므로 영향은 HTTP 응답 표면 하나뿐이다.
   */
  async stop(id: string): Promise<ExecutionDto> {
    const [dto] = await this.toExecutionDtos([await this.stopInternal(id)]);
    return dto;
  }

  /**
   * {@link ExecutionsService.stop} 의 본체. 반환은 **마스킹 전** 엔티티다 — 감싸는 쪽이 관문이다.
   *
   * **동시성 계약**: 동시 stop 요청에 대한 TOCTOU 경쟁을 막기 위해, 최종 상태 전환은
   * 단일 원자 UPDATE(`status WHERE status IN [전이 가능 상태]`)로 수행한다. `affected=0`
   * 은 다른 요청이 먼저 전이시켰다는 뜻이라 최신 상태로 재조회해 돌려준다.
   * `WAITING_FOR_INPUT` 은 별도 경로로, 엔진의 `cancelWaitingExecution` 이 continuation
   * bus 로 fan-out 하며 enqueue 실패(`queued=false`)는 503 으로 surface 한다.
   */
  private async stopInternal(id: string): Promise<Execution> {
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
      // cancelWaitingExecution 은 ContinuationBusService.publish 로 fan-out 한다.
      // C-1 (06-concurrency) — publish 결과를 동기 surface 한다 (옛 fire-and-forget
      // 의 에러 유실 제거). queued=false 는 Redis 장애로 enqueue 자체가 실패한
      // 케이스 → 503 으로 클라이언트 재시도를 유도한다 (Redis 의존성 장애 = upstream
      // 불가용 → 502 아닌 503; SERVER_SHUTTING_DOWN(§11) 503 선례 준용). 성공(queued=true) 시:
      // 호스팅 인스턴스가 reject 핸들러를 비동기 수행하므로 즉시 re-fetch 결과는
      // 아직 PENDING/RUNNING 일 수 있다 — 클라이언트는 websocket 후속 CANCELLED
      // 이벤트로 화면을 갱신한다 (PR-B).
      const result =
        await this.executionEngineService.cancelWaitingExecution(id);
      if (!result.queued) {
        throw new ServiceUnavailableException({
          code: ErrorCode.EXECUTION_ENQUEUE_FAILED,
          message:
            'Cancel could not be queued (continuation bus unavailable). Please retry.',
        });
      }
      const updated = await this.findOneForResponse(id);
      return updated ?? execution;
    }

    const finishedAt = new Date();
    // 무가드 뺄셈이던 자리다. `duration_ms` 는 INTEGER(int4, ≈24.8일)라 상한을
    // 넘으면 UPDATE 전체가 `integer out of range` 로 실패하고 **stop 이 먹지 않는다** —
    // 종결 이벤트 경로에서 CRITICAL 로 두 번 잡힌 것과 글자 그대로 같은 연산이라
    // 같은 헬퍼를 쓴다. `?? 0` 은 startedAt 부재 시 0 이던 종전 동작을 보존한다
    // (시계 역행도 음수 대신 0 으로 흡수된다).
    const durationMs =
      resolveTerminalDurationMs({
        startedAt: execution.startedAt ? new Date(execution.startedAt) : null,
        finishedAt,
      }) ?? 0;

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
      const refreshed = await this.findOneForResponse(id);
      this.invalidateSnapshotCache(id);
      return refreshed ?? execution;
    }
    // 상태 전이가 일어난 이상 캐시된 snapshot 은 stale.
    this.invalidateSnapshotCache(id);

    const refreshed = await this.findOneForResponse(id);
    return refreshed ?? execution;
  }
  // 위 세 곳의 `?? execution` 은 재조회 직전에 행이 지워진 경우(동시 삭제)에만 탄다. 이때
  // `execution` 은 관계를 읽지 않은 첫 조회 행이라 trigger · executor 이름이 비어
  // 출처 라벨이 `null` 로 나가고(`source` 는 id 컬럼으로 정해지는 만큼만 채워진다), 응답은
  // 그대로 조립된다. 지워진 실행의 라벨을 다시 읽을 방법이 없으므로 이를 허용한다.

  /**
   * 응답 조립용 단건 재조회 — 실행 출처 판정에 쓰는 관계 두 개를 함께 읽는다.
   * 행이 없으면(동시 삭제) `null`.
   */
  private findOneForResponse(id: string): Promise<Execution | null> {
    return this.withTriggerSourceRelations(
      this.executionRepository.createQueryBuilder('e'),
    )
      .where('e.id = :id', { id })
      .getOne();
  }

  /**
   * 실행 출처 판정(`deriveExecutionTrigger`)에 필요한 관계를 안전 컬럼만 골라 join 한다.
   * `User.passwordHash` 같은 민감 컬럼은 읽지 않고, 라벨 산출에 쓰지 않는 `executor.email`
   * 도 뺀다(PII 최소화). 별칭은 `e` 여야 한다.
   */
  private withTriggerSourceRelations(
    qb: SelectQueryBuilder<Execution>,
  ): SelectQueryBuilder<Execution> {
    return qb
      .leftJoin('e.trigger', 'trigger')
      .addSelect(['trigger.id', 'trigger.type', 'trigger.name'])
      .leftJoin('e.executor', 'executor')
      .addSelect(['executor.id', 'executor.name']);
  }

  /**
   * 실행 행 여러 개를 {@link ExecutionDto} 로 조립한다 — 목록 · 체인 · 중지 경로.
   *
   * 부모 워크플로 이름과 노드 집계를 행마다 묻지 않고 한 번씩 묶어 읽는다(N+1 회피).
   * 행은 {@link withTriggerSourceRelations} 로 읽은 것이어야 실행 출처 라벨이 채워진다.
   */
  private async toExecutionDtos(rows: Execution[]): Promise<ExecutionDto[]> {
    if (rows.length === 0) return [];
    const [parentNameMap, nodeCountMap] = await Promise.all([
      loadParentWorkflowNames(this.executionRepository, rows),
      this.loadNodeExecutionCounts(rows.map((e) => e.id)),
    ]);
    return rows.map((e) =>
      this.toResponseExecution(e, {
        parentWorkflowName: e.parentExecutionId
          ? (parentNameMap.get(e.parentExecutionId) ?? null)
          : null,
        counts: nodeCountMap.get(e.id) ?? EMPTY_NODE_EXECUTION_COUNTS,
      }),
    );
  }

  /**
   * 실행 응답의 **유일한 조립 함수이자 마스킹 관문**이다. 목록 · 상세 · 중지 · 체인 · 재실행이
   * 모두 여기서 {@link ExecutionDto} 를 받는다.
   *
   * 1. 키를 하나씩 채운다. 엔티티를 펼치지 않으므로 선언하지 않은 컬럼(`sourceIp` ·
   *    `resumeCallStack` · `userVariables` 등)과 관계 객체(`workflow` · `trigger` ·
   *    `executor`)는 나가지 않는다. 값이 없는 필드도 키는 늘 있고 값이 `null` 이다.
   * 2. 세 컬럼(`inputData` · `outputData` · `error`)은 `redactStoredFieldsForResponse` 로
   *    가린다.
   *
   * ## 읽기 표면 목록 — **이 주석이 정본이다** (수치를 여기 한 곳에만 둔다)
   *
   * 마스킹을 호출부마다 손으로 걸면 **한 곳씩 빠진다** — 이 저장소의 반복 실패 형태다.
   * 그래서 표면을 이름으로 열거하고 어느 관문을 지나는지 적는다.
   *
   * | # | 표면 | 관문 |
   * |---|---|---|
   * | 1 | `findById` (`GET /executions/:id` · WS `execution.snapshot` · 재실행 응답) | 이 함수 |
   * | 2 | `getChain` | {@link toExecutionDtos} → 이 함수 |
   * | 3 | `stop` | {@link toExecutionDtos} → 이 함수 |
   * | 4 | `findByWorkflow` (목록) | {@link toExecutionDtos} → 이 함수 |
   * | 5 | `findById` 의 `nodeExecutions[]` | 행 단위 {@link toNodeExecutionSummary} |
   * | 6 | `BackgroundRunsService.toNodeExecutionDto` (본문 노드) | 다른 서비스의 자매 |
   *
   * > 2026-11-14 전에는 목록만 `toExecutionDto` 로 조립하고 나머지는 엔티티를 펼쳤다. 그래서
   * > 체인 · 중지 응답에 선언한 `triggerSource` 가 빠지고 상세 응답에 부모 `workflow` 전
   * > 컬럼과 노드 설정 원문이 실렸다. 지금은 한 함수가 모두 조립한다.
   */
  private toResponseExecution(
    execution: Execution,
    context: ExecutionResponseContext,
  ): ExecutionDto {
    const trigger = deriveExecutionTrigger(
      execution,
      context.parentWorkflowName,
    );
    // 마스킹 결과를 먼저 받아 아래에서 키를 하나씩 둔다(spread 로 섞지 않는다).
    const { inputData, outputData, error } =
      redactStoredFieldsForResponse(execution);
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
      activeRunningMs: toActiveRunningMsForResponse(execution),
      inputData,
      outputData,
      error,
      executedBy: execution.executedBy ?? null,
      parentExecutionId: execution.parentExecutionId ?? null,
      recursionDepth: execution.recursionDepth ?? 0,
      // 목록 · 체인 · 중지는 빈 배열이다(N+1 회피). 상세 · 재실행은 `findById` 가
      // execution_node_log 로 채워 덮어쓴다.
      executionPath: [],
      // Re-run chain 메타 — chain badge / View chain 이 쓴다.
      reRunOf: execution.reRunOf ?? null,
      chainId: execution.chainId ?? null,
      dryRun: execution.dryRun ?? false,
      totalNodeCount: context.counts.total,
      completedNodeCount: context.counts.completed,
      failedNodeCount: context.counts.failed,
    };
  }

  /**
   * 노드 실행 행 하나를 {@link NodeExecutionSummaryDto} 로 조립한다.
   *
   * 세 컬럼 마스킹은 상위 실행과 같은 `redactStoredFieldsForResponse` 가 맡는다(부재는
   * `null` 로 맞춘다). `node` 는 참조 세 필드만 싣고 노드 설정(`config`) 원문은 싣지
   * 않는다. 사용자 행동 기록(`interactionData`)도 싣지 않는다.
   */
  private toNodeExecutionSummary(ne: NodeExecution): NodeExecutionSummaryDto {
    const { inputData, outputData, error } = redactStoredFieldsForResponse(ne);
    return {
      id: ne.id,
      executionId: ne.executionId,
      nodeId: ne.nodeId,
      node: { id: ne.node.id, type: ne.node.type, label: ne.node.label },
      status: ne.status,
      startedAt: this.toIso(ne.startedAt),
      finishedAt: ne.finishedAt ? this.toIso(ne.finishedAt) : null,
      durationMs: ne.durationMs ?? null,
      inputData,
      outputData,
      error,
      retryCount: ne.retryCount ?? 0,
      parentNodeExecutionId: ne.parentNodeExecutionId ?? null,
    };
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
      active_running_ms: 'activeRunningMs',
    };
    return pickSortColumn(allowed, sort, 'startedAt');
  }
}
