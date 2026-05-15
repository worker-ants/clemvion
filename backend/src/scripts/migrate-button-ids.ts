/**
 * F-2 button id backfill 마이그레이션 스크립트.
 *
 * 배경: shadow-workflow 가 buttons[*].id 를 자동 부여하기 시작하면 (F-2 의
 * label-slug 정책), 기존 워크플로 중 id 가 비어있던 button entry 는 후속
 * update_node 에서 새 slug 를 받게 된다. canvas 에 이미 `btn_0` 같은
 * resolver-fallback 포트로 연결된 edge 가 있다면 button.id 와 edge.target_port
 * 가 어긋나 edge 가 dangling 상태가 된다.
 *
 * 본 스크립트는 shadow auto-generate 를 활성화하기 전에 실행해, 모든 워크플로의
 * 빈 button id 를 resolver fallback 패턴 (`btn_${i}` / `itemBtn_${i}` /
 * `items_${i}_btn_${j}`) 으로 채워 넣는다. 이후 shadow 가 update_node 를
 * 처리해도 id 가 살아있으므로 그대로 보존되어 edge 가 끊기지 않는다.
 *
 * Usage (run from repo root OR backend/ — `backend/.env` is auto-loaded):
 *
 *   # dry-run — prints planned changes, no DB write
 *   npx ts-node backend/src/scripts/migrate-button-ids.ts --dry-run
 *
 *   # apply — requires workspace/user ids for the audit_log row
 *   npx ts-node backend/src/scripts/migrate-button-ids.ts --apply \
 *     --workspace-id <uuid> --user-id <uuid>
 *
 * 대상 노드 타입: carousel / chart / table / template.
 * 대상 위치: config.buttons[*], config.itemButtons[*], config.items[*].buttons[*].
 */

import * as path from 'path';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { isValidStablePortId } from '../nodes/core/port-id.util';

/**
 * `.env` 로드는 main() 진입 시에만 수행 — module import 만으로 process.env 가
 * 오염되면 단위 테스트가 통제 불가능해진다 (review W-9).
 */
function loadDotenv(): void {
  const envPath = path.resolve(__dirname, '..', '..', '.env');
  const result = dotenv.config({ path: envPath });
  if (result.error) {
    console.warn(
      `[migrate-button-ids] .env not loaded at ${envPath} (${result.error.message}) — relying on process.env only.`,
    );
  }
}

const DRY_RUN =
  process.argv.includes('--dry-run') || !process.argv.includes('--apply');

function parseCliFlag(name: string): string | undefined {
  const eqIdx = process.argv.findIndex((a) => a.startsWith(`${name}=`));
  if (eqIdx >= 0) return process.argv[eqIdx].split('=', 2)[1];
  const flagIdx = process.argv.indexOf(name);
  if (flagIdx >= 0 && flagIdx < process.argv.length - 1) {
    return process.argv[flagIdx + 1];
  }
  return undefined;
}

const CLI_WORKSPACE_ID = parseCliFlag('--workspace-id');
const CLI_USER_ID = parseCliFlag('--user-id');

const BUTTON_NODE_TYPES = new Set(['carousel', 'chart', 'table', 'template']);

interface ButtonLike {
  id?: unknown;
  [key: string]: unknown;
}

interface CarouselItemLike {
  buttons?: unknown;
  [key: string]: unknown;
}

interface NodeConfigLike {
  buttons?: unknown;
  itemButtons?: unknown;
  items?: unknown;
  [key: string]: unknown;
}

// 단일 출처: port-id.util.isValidStablePortId — runtime helper 와 마이그레이션
// 스크립트가 동일 검사를 공유해 drift 방지 (review W-10).
const isValidExistingId = isValidStablePortId;

export interface BackfillHit {
  workflowId: string;
  nodeId: string;
  location: string; // e.g. "buttons[0]" / "items[1].buttons[2]"
  newId: string;
}

/**
 * config 의 모든 button 위치를 backfill. 변경이 일어나면 새 config 객체를
 * 반환하고 hits 에 항목을 누적. 변경이 없으면 input 을 그대로 반환.
 */
export function backfillButtonIds(
  workflowId: string,
  nodeId: string,
  config: NodeConfigLike,
  hits: BackfillHit[],
): NodeConfigLike {
  let changed = false;
  let next: NodeConfigLike | null = null;
  const ensureCopy = (): NodeConfigLike => {
    if (!next) next = { ...config };
    return next;
  };

  if (Array.isArray(config.buttons)) {
    const buttons = config.buttons as ButtonLike[];
    const newButtons = buttons.map((b, i) => {
      // null/undefined entry 방어 (review W-13). 빈 entry 는 fallback id 만 가진
      // 새 객체로 대체.
      if (b == null || typeof b !== 'object') {
        const newId = `btn_${i}`;
        hits.push({ workflowId, nodeId, location: `buttons[${i}]`, newId });
        changed = true;
        return { id: newId };
      }
      if (isValidExistingId(b.id)) return b;
      const newId = `btn_${i}`;
      hits.push({ workflowId, nodeId, location: `buttons[${i}]`, newId });
      changed = true;
      return { ...b, id: newId };
    });
    if (changed) ensureCopy().buttons = newButtons;
  }

  if (Array.isArray(config.itemButtons)) {
    let itemBtnChanged = false;
    const buttons = config.itemButtons as ButtonLike[];
    const newButtons = buttons.map((b, i) => {
      if (b == null || typeof b !== 'object') {
        const newId = `itemBtn_${i}`;
        hits.push({ workflowId, nodeId, location: `itemButtons[${i}]`, newId });
        itemBtnChanged = true;
        return { id: newId };
      }
      if (isValidExistingId(b.id)) return b;
      const newId = `itemBtn_${i}`;
      hits.push({ workflowId, nodeId, location: `itemButtons[${i}]`, newId });
      itemBtnChanged = true;
      return { ...b, id: newId };
    });
    if (itemBtnChanged) {
      ensureCopy().itemButtons = newButtons;
      changed = true;
    }
  }

  if (Array.isArray(config.items)) {
    let itemsChanged = false;
    const items = config.items as CarouselItemLike[];
    const newItems = items.map((item, i) => {
      if (!item || typeof item !== 'object' || !Array.isArray(item.buttons)) {
        return item;
      }
      let buttonsChanged = false;
      const buttons = item.buttons as ButtonLike[];
      const newButtons = buttons.map((b, j) => {
        if (b == null || typeof b !== 'object') {
          const newId = `items_${i}_btn_${j}`;
          hits.push({
            workflowId,
            nodeId,
            location: `items[${i}].buttons[${j}]`,
            newId,
          });
          buttonsChanged = true;
          return { id: newId };
        }
        if (isValidExistingId(b.id)) return b;
        const newId = `items_${i}_btn_${j}`;
        hits.push({
          workflowId,
          nodeId,
          location: `items[${i}].buttons[${j}]`,
          newId,
        });
        buttonsChanged = true;
        return { ...b, id: newId };
      });
      if (buttonsChanged) {
        itemsChanged = true;
        return { ...item, buttons: newButtons };
      }
      return item;
    });
    if (itemsChanged) {
      ensureCopy().items = newItems;
      changed = true;
    }
  }

  return changed && next ? next : config;
}

async function main(): Promise<void> {
  loadDotenv();
  // DB_PASSWORD 는 fallback 두지 않는다 — 운영 환경에 dev 패스워드가 새는
  // 사고 방지 (review W-3). 로컬 dev 는 backend/.env 에 명시.
  const password = process.env.DB_PASSWORD;
  if (!password) {
    throw new Error(
      'DB_PASSWORD is required — set it in backend/.env or as an env var before running this migration.',
    );
  }
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USERNAME ?? 'workflow',
    password,
    database: process.env.DB_DATABASE ?? 'workflow',
  });
  await ds.initialize();
  try {
    await runMigration(ds);
  } finally {
    // ds.destroy() 누수 방지 (review W-8) — 예외가 나도 connection pool 종료.
    await ds.destroy();
  }
}

async function runMigration(ds: DataSource): Promise<void> {
  const rows = (await ds.query<
    Array<{
      workflow_id: string;
      id: string;
      type: string;
      config: Record<string, unknown>;
    }>
  >(
    `SELECT w.id AS workflow_id, n.id, n.type, n.config
       FROM workflow w
       JOIN node n ON n.workflow_id = w.id
      WHERE n.type = ANY($1)
      ORDER BY w.created_at, n.id`,
    [Array.from(BUTTON_NODE_TYPES)],
  )) as Array<{
    workflow_id: string;
    id: string;
    type: string;
    config: Record<string, unknown>;
  }>;

  const hits: BackfillHit[] = [];
  const pendingUpdates: Array<{ nodeId: string; newConfig: unknown }> = [];

  for (const row of rows) {
    const newConfig = backfillButtonIds(
      row.workflow_id,
      row.id,
      row.config,
      hits,
    );
    if (newConfig !== row.config) {
      pendingUpdates.push({ nodeId: row.id, newConfig });
    }
  }

  console.log(
    `\nScanned ${rows.length} button-node rows across all workspaces.`,
  );
  console.log(
    `Backfills planned: ${hits.length} (across ${pendingUpdates.length} nodes).`,
  );
  for (const hit of hits) {
    console.log(
      `  [${DRY_RUN ? 'DRY' : 'APPLY'}] wf=${hit.workflowId} node=${hit.nodeId} ${hit.location} ← id="${hit.newId}"`,
    );
  }

  if (!DRY_RUN && pendingUpdates.length > 0) {
    if (!CLI_WORKSPACE_ID || !CLI_USER_ID) {
      throw new Error(
        '--apply requires --workspace-id <uuid> and --user-id <uuid> so the audit_log row is attributable. Re-run with both flags.',
      );
    }
    await ds.transaction(async (manager) => {
      for (const update of pendingUpdates) {
        await manager.query(`UPDATE node SET config = $1 WHERE id = $2`, [
          JSON.stringify(update.newConfig),
          update.nodeId,
        ]);
      }
      await manager.query(
        `INSERT INTO audit_log (workspace_id, user_id, action, resource_type, resource_id, metadata, created_at)
         VALUES ($1, $2, 'migrate-button-ids', 'workflow', NULL, $3, NOW())`,
        [
          CLI_WORKSPACE_ID,
          CLI_USER_ID,
          JSON.stringify({
            nodes_updated: pendingUpdates.length,
            backfill_count: hits.length,
            timestamp_utc: new Date().toISOString(),
          }),
        ],
      );
    });
    console.log(
      `\nAPPLIED: ${pendingUpdates.length} nodes updated, ${hits.length} button ids backfilled.`,
    );
  } else if (DRY_RUN) {
    console.log('\nDRY-RUN — no DB writes. Re-run with --apply to persist.');
  }
}

if (require.main === module) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}
