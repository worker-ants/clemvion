import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * `DELETE ... RETURNING id` 결과에서 실제 삭제 행 수를 구한다. node-postgres 는
 * RETURNING 이 있는 DELETE 를 `[rows, affected]` 튜플로 돌려주는데, affected 를
 * 그대로 쓰면 항상 2 가 되어 0건 케이스를 놓친다 (AGM-13 — 부재 id 삭제가
 * NotFound 로 변환되지 않는 버그). 튜플의 `[0]` 위치 RETURNING rows 의 길이를
 * affected 로 쓴다. 방어적으로 비-튜플(rows 배열 직접) 형태도 허용한다.
 */
function deletedRowCount(
  result: [{ id: string }[], number] | { id: string }[],
): number {
  if (Array.isArray(result) && Array.isArray(result[0])) {
    return (result[0] as { id: string }[]).length;
  }
  return (result as { id: string }[]).length;
}

/**
 * AI Agent persistent 메모리의 **admin read/delete surface** (spec/5-system/17-agent-memory.md
 * §6, AGM-12/13). 런타임 저장·회수·forgetting (§3·§4, `AgentMemoryService`) 과
 * 책임을 분리한 서비스 — admin REST 컨트롤러(`AgentMemoryController`)만 의존한다
 * (SRP, A1 backlog). 임베딩/LLM 의존이 없고 `DataSource` 만 주입받는다.
 *
 * **격리 의무 (§5, AGM-07)**: 모든 쿼리가 `workspace_id = $ws` 를 강제하고
 * workspaceId 는 호출부(컨트롤러)가 인증 컨텍스트(@WorkspaceId())에서만 넘긴다 —
 * 쿼리/바디로 받지 않는다. 회수·dedup 과 동일한 raw SQL 데이터접근 스타일을 따른다.
 */
@Injectable()
export class AgentMemoryAdminService {
  private readonly logger = new Logger(AgentMemoryAdminService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * 워크스페이스의 distinct scope_key 목록 조회 (AGM-12). 각 항목은 해당 scope 의
   * 메모리 건수(COUNT(*))와 최신 갱신 시각(MAX(updated_at)) 을 포함한다. `q` 가
   * 주어지면 scope_key 부분일치(ILIKE) 필터. 총 distinct scope 수도 반환한다.
   * workspace_id 격리 강제 (§5).
   */
  async listScopes(
    workspaceId: string,
    opts: { limit?: number; offset?: number; q?: string },
  ): Promise<{
    items: { scopeKey: string; count: number; latestUpdatedAt: string }[];
    total: number;
  }> {
    const limit = opts.limit ?? 30;
    const offset = opts.offset ?? 0;
    const q = opts.q?.trim();

    // q 있으면 ILIKE 부분일치 — '%'||$q||'%' 를 파라미터 바인딩으로 (C1: 리터럴
    // 보간 금지, % 는 SQL 측에서 연결).
    const filterSql = q ? `AND am.scope_key ILIKE '%' || $2 || '%'` : '';
    const limitParam = q ? '$3' : '$2';
    const offsetParam = q ? '$4' : '$3';

    // 단일 쿼리 통합 (perf): GROUP BY 집계 패스를 1회만 돈다. CTE `grouped` 가
    // (scope_key, count, latest_updated_at) 를 한 번 집계하고, 바깥 SELECT 가
    // `COUNT(*) OVER()` 로 **LIMIT/OFFSET 적용 전 전체 그룹 수**(=distinct scope
    // 총 개수)를 각 행에 부착한 뒤 페이지네이션한다. 윈도우는 LIMIT 전에 평가되어
    // total 이 기존 별도 COUNT 서브쿼리와 동일하다. workspace_id 격리·q ILIKE·
    // embedding 제외 모두 유지. (NOTE: OFFSET 이 전체 그룹 수를 넘어 0행이 반환되면
    // total 행이 없어지나, 그 페이지엔 표시할 아이템도 없고 호출부 page 파생도
    // 영향받지 않는다 — total 0 으로 처리.)
    const rows = await this.dataSource.query<
      {
        scope_key: string;
        count: string;
        latest_updated_at: Date;
        total: string;
      }[]
    >(
      `WITH grouped AS (
         SELECT
           am.scope_key AS scope_key,
           COUNT(*) AS count,
           MAX(am.updated_at) AS latest_updated_at
         FROM agent_memory am
         WHERE am.workspace_id = $1
         ${filterSql}
         GROUP BY am.scope_key
       )
       SELECT
         grouped.scope_key AS scope_key,
         grouped.count AS count,
         grouped.latest_updated_at AS latest_updated_at,
         COUNT(*) OVER() AS total
       FROM grouped
       ORDER BY grouped.latest_updated_at DESC
       LIMIT ${limitParam} OFFSET ${offsetParam}`,
      q ? [workspaceId, q, limit, offset] : [workspaceId, limit, offset],
    );

    return {
      items: rows.map((r) => ({
        scopeKey: r.scope_key,
        count: Number(r.count),
        latestUpdatedAt: new Date(r.latest_updated_at).toISOString(),
      })),
      // COUNT(*) OVER() 는 반환된 모든 행에 동일 total 을 싣는다 — 첫 행에서 읽는다.
      // 0행(빈 결과/offset 초과)이면 total 0.
      total: Number(rows[0]?.total ?? 0),
    };
  }

  /**
   * 단일 scope 의 메모리 행 조회 (AGM-12). **embedding 은 절대 SELECT 하지 않는다**
   * (명시 컬럼만 — id/content/metadata/scope_key/created_at/updated_at/expires_at).
   * `kind` 가 주어지면 `metadata->>'kind' = $kind` 로 필터. created_at 내림차순.
   * kind 표기는 응답 매핑에서 `metadata.kind ?? 'fact'` fallback (AGM-11).
   * 총 개수도 반환. workspace_id + scope_key 격리 강제 (§5).
   */
  async listMemories(
    workspaceId: string,
    scopeKey: string,
    opts: { kind?: string; limit?: number; offset?: number },
  ): Promise<{
    items: {
      id: string;
      content: string;
      kind: string;
      scopeKey: string;
      createdAt: string;
      updatedAt: string;
      expiresAt: string | null;
    }[];
    total: number;
  }> {
    const limit = opts.limit ?? 30;
    const offset = opts.offset ?? 0;
    const kind = opts.kind;

    const kindSql = kind ? `AND am.metadata->>'kind' = $3` : '';
    const limitParam = kind ? '$4' : '$3';
    const offsetParam = kind ? '$5' : '$4';

    const rows = await this.dataSource.query<
      {
        id: string;
        content: string;
        kind: string | null;
        scope_key: string;
        created_at: Date;
        updated_at: Date;
        expires_at: Date | null;
      }[]
    >(
      `SELECT
         am.id AS id,
         am.content AS content,
         am.metadata->>'kind' AS kind,
         am.scope_key AS scope_key,
         am.created_at AS created_at,
         am.updated_at AS updated_at,
         am.expires_at AS expires_at
       FROM agent_memory am
       WHERE am.workspace_id = $1
         AND am.scope_key = $2
         ${kindSql}
       ORDER BY am.created_at DESC
       LIMIT ${limitParam} OFFSET ${offsetParam}`,
      kind
        ? [workspaceId, scopeKey, kind, limit, offset]
        : [workspaceId, scopeKey, limit, offset],
    );

    const countRows = await this.dataSource.query<{ total: string }[]>(
      `SELECT COUNT(*) AS total
       FROM agent_memory am
       WHERE am.workspace_id = $1
         AND am.scope_key = $2
         ${kind ? `AND am.metadata->>'kind' = $3` : ''}`,
      kind ? [workspaceId, scopeKey, kind] : [workspaceId, scopeKey],
    );

    return {
      items: rows.map((r) => ({
        id: r.id,
        content: r.content,
        // AGM-11 fallback: metadata.kind 결손 시 'fact' 표기.
        kind: r.kind ?? 'fact',
        scopeKey: r.scope_key,
        createdAt: new Date(r.created_at).toISOString(),
        updatedAt: new Date(r.updated_at).toISOString(),
        expiresAt: r.expires_at ? new Date(r.expires_at).toISOString() : null,
      })),
      total: Number(countRows[0]?.total ?? 0),
    };
  }

  /**
   * 단건 hard delete (AGM-13). `WHERE id = $1 AND workspace_id = $2` 로 워크스페이스
   * 교차 삭제를 차단한다 — 다른 워크스페이스의 id 를 알아도 affected=0 → 호출부가
   * NotFound 로 변환. 영향받은 row 수를 반환한다.
   */
  async deleteMemory(workspaceId: string, id: string): Promise<number> {
    const result = await this.dataSource.query<[{ id: string }[], number]>(
      `DELETE FROM agent_memory
       WHERE id = $1 AND workspace_id = $2
       RETURNING id`,
      [id, workspaceId],
    );
    return deletedRowCount(result);
  }

  /**
   * 한 scope 전체 hard delete (AGM-13). `WHERE workspace_id = $1 AND scope_key = $2`.
   * 삭제된 row 수를 반환한다 (호출부가 X-Deleted-Count echo 용으로 사용). workspace_id 격리 강제.
   */
  async clearScope(workspaceId: string, scopeKey: string): Promise<number> {
    const result = await this.dataSource.query<[{ id: string }[], number]>(
      `DELETE FROM agent_memory
       WHERE workspace_id = $1 AND scope_key = $2
       RETURNING id`,
      [workspaceId, scopeKey],
    );
    return deletedRowCount(result);
  }
}
