import type { EntityManager } from 'typeorm';
import type { Logger } from '@nestjs/common';
import { isUuidShaped } from '../../common/utils/uuid';
import type {
  PersonalIntegrationUsePath,
  PersonalIntegrationUseRejection,
} from './personal-integration-use';

/*
 * 개인 통합 사용 판정({@link judgePersonalIntegrationUse})에 넘길 사실을 읽는다. 실행 경로(`IntegrationsService`)와 저장 경로
 * (`WorkflowsService` · `NodesService`)가 같은 사실을 다른 코드로 모으지 않도록 여기 한 곳에 둔다.
 *
 * 함수는 `query` 하나만 받는다. 저장 경로는 워크플로우 행을 잠근 트랜잭션의 EntityManager 를 넘기고 실행 경로는 DataSource 를
 * 넘긴다. 잠금 안에서 커넥션을 따로 열면 동시 저장이 풀을 다 잡은 채 두 번째 커넥션을 기다린다(CLE-WF-DATA 저장 3단계).
 * SQL 로 읽으므로 부르는 모듈은 `workspace_member` 같은 남의 엔티티를 등록하거나 다른 기능 모듈을 import 하지 않는다.
 *
 * id 는 쿼리 전에 Postgres 가 받는 UUID 모양인지 거른다. 모양이 틀린 값을 `uuid` 컬럼과 비교하면 22P02 로 500 이 난다.
 * 근거는 `common/utils/uuid.ts` 의 `isUuidShaped` 가 정본이다.
 */

export type SqlRunner = Pick<EntityManager, 'query'>;

export interface ExecutionUseFacts {
  /** 노드가 속한 워크플로우의 `created_by`. 노드가 없거나 그 워크플로우가 실행의 워크스페이스에 없으면 `null`. */
  workflowAuthorId: string | null;
  /** 통합 소유자가 지금 실행의 워크스페이스 멤버인가. */
  ownerIsMember: boolean;
}

/**
 * 실행 시점 판정의 사실을 한 쿼리로 읽는다. 워크플로우 작성자는 노드 행에서 구한다. 인라인 서브 워크플로우 안에서도
 * `context.workflowId` 는 부모 워크플로우라서 그것으로는 구하지 않는다(CLE-NODE-INT-COMMON).
 */
export async function loadExecutionUseFacts(
  runner: SqlRunner,
  args: {
    nodeId: string | null;
    workspaceId: string;
    integrationOwnerId: string;
  },
): Promise<ExecutionUseFacts> {
  const nodeId =
    args.nodeId !== null && isUuidShaped(args.nodeId) ? args.nodeId : null;
  const rows: Array<{
    workflow_author_id: string | null;
    owner_is_member: boolean;
  }> = await runner.query(
    `SELECT
       (SELECT w.created_by
          FROM node n
          JOIN workflow w ON w.id = n.workflow_id
         WHERE n.id = $1 AND w.workspace_id = $2) AS workflow_author_id,
       EXISTS (SELECT 1
                 FROM workspace_member m
                WHERE m.workspace_id = $2 AND m.user_id = $3) AS owner_is_member`,
    [nodeId, args.workspaceId, args.integrationOwnerId],
  );
  const row = rows[0];
  return {
    workflowAuthorId: row?.workflow_author_id ?? null,
    ownerIsMember: row?.owner_is_member === true,
  };
}

/** 저장 · 복제 · 복원 검사가 보는 통합 열. 자격 증명은 읽지 않는다. */
export interface IntegrationRefRow {
  id: string;
  scope: string;
  createdBy: string;
}

/**
 * 워크스페이스에 있는 통합을 id 로 한 번에 읽는다. UUID 모양이 아닌 값은 쿼리에 넣지 않고 결과에도 없다. 부르는 쪽은 결과에 없는
 * id 를 없는 통합으로 다룬다.
 */
export async function loadIntegrationRefRows(
  runner: SqlRunner,
  workspaceId: string,
  ids: Iterable<string>,
): Promise<Map<string, IntegrationRefRow>> {
  const valid = [...new Set(ids)].filter(isUuidShaped);
  if (valid.length === 0) return new Map();
  const rows: Array<{ id: string; scope: string; created_by: string }> =
    await runner.query(
      `SELECT id, scope, created_by
         FROM integration
        WHERE id = ANY($1::uuid[]) AND workspace_id = $2`,
      [valid, workspaceId],
    );
  return new Map(
    rows.map((r) => [
      r.id,
      { id: r.id, scope: r.scope, createdBy: r.created_by },
    ]),
  );
}

/** 주어진 사용자 가운데 지금 워크스페이스 멤버인 사람. */
export async function loadWorkspaceMemberIds(
  runner: SqlRunner,
  workspaceId: string,
  userIds: Iterable<string>,
): Promise<Set<string>> {
  const valid = [...new Set(userIds)].filter(isUuidShaped);
  if (valid.length === 0) return new Set();
  const rows: Array<{ user_id: string }> = await runner.query(
    `SELECT user_id
       FROM workspace_member
      WHERE workspace_id = $1 AND user_id = ANY($2::uuid[])`,
    [workspaceId, valid],
  );
  return new Set(rows.map((r) => r.user_id));
}

/**
 * 판정을 통과하지 못한 참조를 서버 로그에 WARN 으로 남긴다(CLE-INT-MANAGE 「개인 통합 사용 판정」, CLE-OBS-LOGGING 「로그 형식」).
 * `workspaceId` 는 최상위, 노드 · 통합 · 이유 · 경로 종류는 `context` 다. 이유는 응답에 싣지 않으므로 여기에만 남는다.
 */
export function logPersonalIntegrationUseRejection(
  logger: Pick<Logger, 'warn'>,
  entry: {
    path: PersonalIntegrationUsePath;
    workspaceId: string;
    nodeId: string | null;
    integrationId: string;
    reason: PersonalIntegrationUseRejection;
  },
): void {
  logger.warn({
    message: 'Personal integration use rejected',
    workspaceId: entry.workspaceId,
    context: {
      path: entry.path,
      nodeId: entry.nodeId,
      integrationId: entry.integrationId,
      reason: entry.reason,
    },
  });
}
