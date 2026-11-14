/**
 * 부팅 스캔의 「종결된 실행 아래 남은 노드 실행 행」 정리 단계가 `parent_node_execution_id` 를
 * 따라 올라가는 깊이 한도. 부모 체인은 서브 워크플로우 호출(재귀 한도
 * `SUB_WORKFLOW_MAX_RECURSION_DEPTH`, `nodes/core/node-types.constants`)과 컨테이너 · Background 중첩으로 길어지므로
 * 넉넉히 잡는다. 체인이 깨져 순환하더라도 재귀가 끝나게 한다. 이 한도 안에서 최상위 행에 닿지
 * 못한 후보는 닫지 않는다(CLE-T-EC9VFJ).
 */
export const ORPHAN_NODE_PARENT_CHAIN_MAX_DEPTH = 64;

/**
 * 「종결된 실행 아래 남은 노드 실행 행」 정리 단계가 닫을 노드 실행 행의 id 를 고르는 하위 질의.
 * 외부 UPDATE 의 `id IN (…)` 에 들어간다.
 *
 * - `candidate`: 종결된 실행(`:...orphanTerminalStatuses`) 아래 `running` 이고 `started_at` 이
 *   임계보다 오래된 행. `status IN ('waiting_for_input','running')` 부분 인덱스
 *   (`idx_node_execution_exec_status_active`)를 탄다.
 * - `ancestor`: 후보마다 부모 체인을 위로 따라간다. 후보 수만큼만 걷는다.
 * - Background 노드 행이 체인에 있는 후보는 뺀다. 본문은 부모 실행이 끝난 뒤에도 같은
 *   executionId 로 돈다.
 * - 최상위 행(부모가 없는 행)에 닿은 후보만 닫는다. 후보 자신이 최상위이거나, 걸은 조상
 *   가운데 부모가 없는 행이 있어야 한다. 체인이 깊이 한도보다 길거나 순환하거나 없는 행을
 *   가리키면 Background 조상이 없다고 확인할 수 없으므로 닫지 않는다(CLE-T-EC9VFJ). 부모 행이
 *   지워져 포인터가 NULL 이 된 체인(`ON DELETE SET NULL`)은 최상위 행과 구별할 수 없다. 그 경우의
 *   판단은 스펙 Rationale 에 있다.
 *
 * 테이블 이름은 큰따옴표로 감싼다. UpdateQueryBuilder 는 별칭 접두사 없이 쓴 낱말 가운데
 * `NodeExecution` 의 속성 이름과 같은 것을 컬럼 이름으로 바꿔 쓴다. 그래서 따옴표 없이 쓰면
 * `execution` 이 `execution_id` 로, `node` 가 `node_id` 로 바뀌어 질의가 실패한다.
 *
 * 테이블 · 컬럼 이름은 엔티티 메타데이터에서 끼워 넣지 않고 그대로 적는다(CLE-T-S03WEV).
 * 열 개 남짓한 이름을 모두 보간하면 SQL 을 읽기 어려워진다. 대신 이름이 엔티티 정의와
 * 맞는지는 `orphan-running-node-executions.sql.spec.ts` 가 TypeORM 메타데이터와 대조하고,
 * 질의 의미는 실제 DB 로 도는 `test/execution-crash-redrive.e2e-spec.ts` 가 확인한다.
 */
export const ORPHAN_RUNNING_NODE_EXECUTION_IDS_SQL = `
    WITH RECURSIVE candidate AS (
      SELECT ne.id, ne.parent_node_execution_id AS parent_id
        FROM "node_execution" ne
        JOIN "execution" e ON e.id = ne.execution_id
       WHERE ne.status = :running
         AND ne.started_at < :orphanThreshold
         AND e.status IN (:...orphanTerminalStatuses)
    ),
    ancestor (candidate_id, ancestor_id, depth) AS (
      SELECT c.id, c.parent_id, 1
        FROM candidate c
       WHERE c.parent_id IS NOT NULL
      UNION ALL
      SELECT a.candidate_id, p.parent_node_execution_id, a.depth + 1
        FROM ancestor a
        JOIN "node_execution" p ON p.id = a.ancestor_id
       WHERE p.parent_node_execution_id IS NOT NULL
         AND a.depth < :orphanMaxDepth
    )
    SELECT c.id
      FROM candidate c
     WHERE NOT EXISTS (
       SELECT 1
         FROM ancestor a
         JOIN "node_execution" pn ON pn.id = a.ancestor_id
         JOIN "node" n ON n.id = pn.node_id
        WHERE a.candidate_id = c.id
          AND n.type = :orphanBackgroundType
     )
       AND (
         c.parent_id IS NULL
         OR EXISTS (
           SELECT 1
             FROM ancestor a
             JOIN "node_execution" r ON r.id = a.ancestor_id
            WHERE a.candidate_id = c.id
              AND r.parent_node_execution_id IS NULL
         )
       )`;
