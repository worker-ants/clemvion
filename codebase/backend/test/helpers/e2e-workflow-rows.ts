import { randomUUID } from 'crypto';
import type { Client } from 'pg';

/** 워크플로우에 수동 트리거 노드를 하나 단다. 이 노드가 있어야 DM 의 `start` 가 실행을 만든다. */
export async function addManualTriggerNode(
  db: Client,
  workflowId: string,
): Promise<void> {
  await db.query(
    `INSERT INTO node (id, workflow_id, type, category, label, config, position_x, position_y, created_at, updated_at)
     VALUES ($1, $2, 'manual_trigger', 'trigger', 'trg', $3, 0, 0, NOW(), NOW())`,
    [randomUUID(), workflowId, JSON.stringify({ parameters: [] })],
  );
}

export async function countExecutions(
  db: Client,
  workflowId: string,
): Promise<string> {
  const rows = await db.query<{ n: string }>(
    'SELECT count(*)::text AS n FROM execution WHERE workflow_id = $1',
    [workflowId],
  );
  return rows.rows[0]?.n ?? '';
}
