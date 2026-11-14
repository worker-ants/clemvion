/**
 * 저장된 Presentation 버튼 id `error` 를 한 번 옮기는 이전 스크립트.
 *
 * 배경: 2026-11-14 에 사용자 정의 동적 포트 ID 에서 `error` 를 예약했다
 * (NERV Task CLE-T-P9RBFD, REQ-NODEUI-042). 엔진은 포트를 문자열로 고른다
 * (`_selectedPort === 'error'`, 연결선 `sourcePort === 'error'`). 그래서 버튼 id
 * `error` 는 에러 포트와 구분되지 않고, 이제 노드 설정 검증(`validateConfig`)이
 * 그 설정을 거부한다. 이미 저장된 버튼은 이 스크립트로 새 id 를 받는다.
 *
 * 규칙(근거: [노드 출력 규약 — 포트 · 흐름 상태 · 에러 「Principle 6. 동적 포트 ID
 * 이름」](CLE-NODE-OUTPUT-FLOW#principle-6-동적-포트-id-이름) 의 4번):
 *   - 새 id 는 `error_1` 부터 시작하고 같은 노드에 이미 있으면 번호를 올린다.
 *     번호는 노드의 모든 버튼 위치(`buttons` · `itemButtons` · `items[*].buttons`)를
 *     함께 보고 고른다. 캔버스 포트는 노드 단위로 모이기 때문이다.
 *   - 한 노드 안의 `error` 버튼은 모두 같은 새 id 를 받는다. 지금 그 버튼들은
 *     포트 `error` 하나를 함께 쓰므로 연결선도 하나의 새 포트로 옮긴다.
 *   - 그 노드에서 나가는 연결선 중 `source_port = 'error'` 인 것의 `source_port`
 *     도 새 id 로 바꾼다.
 *   - 노드의 에러 처리 정책이 「에러 포트로 라우팅」이면 `error` 연결선이 버튼
 *     연결선인지 에러 연결선인지 알 수 없다. 이 경우에도 버튼 id 와 함께 옮기되
 *     경고 줄을 찍어 운영자가 확인하게 한다.
 *
 * 범위 밖: 워크플로우 버전 스냅샷(`workflow_version.snapshot`)은 바꾸지 않는다.
 * 옛 버전을 복원하면 `error` 버튼이 돌아오고 실행 직전 검증이 거부한다.
 *
 * Usage (run from repo root OR codebase/backend/ — `codebase/backend/.env` is auto-loaded):
 *
 *   # 대상 확인 SQL (운영 DB 에서 먼저 센다)
 *   #   SELECT type, count(*) FROM node
 *   #    WHERE jsonb_path_exists(config, 'strict $.**.id ? (@ == "error")')
 *   #    GROUP BY type;
 *
 *   # dry-run — 바꿀 버튼과 연결선을 찍기만 하고 DB 에 쓰지 않는다
 *   npx ts-node codebase/backend/src/scripts/migrate-reserved-error-button-ids.ts --dry-run
 *
 *   # apply — audit_log 행에 남길 workspace/user id 가 필요하다
 *   npx ts-node codebase/backend/src/scripts/migrate-reserved-error-button-ids.ts --apply \
 *     --workspace-id <uuid> --user-id <uuid>
 *
 * 다시 돌려도 안전하다. 옮긴 뒤에는 `error` id 가 없어서 대상이 0건이다.
 */

import * as path from 'path';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import {
  BUTTON_NODE_TYPES,
  isButtonNodeType,
  nextErrorReplacementId,
  RESERVED_ERROR_PORT_ID,
} from '../nodes/core/button-slug.util';
import { parseCliFlag } from './cli-utils';

const LOG_PREFIX = '[migrate-reserved-error-button-ids]';

/** `.env` 는 main() 에서만 읽는다. import 만으로 process.env 를 바꾸지 않는다. */
function loadDotenv(): void {
  const envPath = path.resolve(__dirname, '..', '..', '.env');
  const result = dotenv.config({ path: envPath });
  if (result.error) {
    console.warn(
      `${LOG_PREFIX} .env not loaded at ${envPath} (${result.error.message}) — relying on process.env only.`,
    );
  }
}

interface ButtonLike {
  id?: unknown;
  [key: string]: unknown;
}

interface NodeConfigLike {
  buttons?: unknown;
  itemButtons?: unknown;
  items?: unknown;
  errorHandling?: unknown;
  errorPolicy?: unknown;
  [key: string]: unknown;
}

export interface ReservedIdRename {
  /** 새 config. 바꿀 것이 없으면 입력과 같은 참조다. */
  config: NodeConfigLike;
  /** 새 버튼 id. 바꿀 것이 없으면 `null`. */
  newId: string | null;
  /** 바꾼 위치(`buttons[0]` · `itemButtons[1]` · `items[2].buttons[0]`). */
  locations: string[];
}

function asButtons(value: unknown): ButtonLike[] | null {
  return Array.isArray(value) ? (value as ButtonLike[]) : null;
}

function itemButtonsOf(config: NodeConfigLike): Array<ButtonLike[] | null> {
  if (!Array.isArray(config.items)) return [];
  return (config.items as unknown[]).map((item) =>
    item && typeof item === 'object'
      ? asButtons((item as { buttons?: unknown }).buttons)
      : null,
  );
}

/** 노드의 모든 버튼 위치에서 문자열 id 를 모은다. */
function collectButtonIds(config: NodeConfigLike): Set<string> {
  const ids = new Set<string>();
  const add = (buttons: ButtonLike[] | null): void => {
    for (const b of buttons ?? []) {
      if (b && typeof b === 'object' && typeof b.id === 'string') ids.add(b.id);
    }
  };
  add(asButtons(config.buttons));
  add(asButtons(config.itemButtons));
  for (const buttons of itemButtonsOf(config)) add(buttons);
  return ids;
}

/**
 * 버튼 배열에서 id 가 정확히 `error` 인 항목을 `newId` 로 바꾼 사본을 돌려준다.
 * 바꿀 것이 없으면 `null`.
 */
function renameInArray(
  buttons: ButtonLike[] | null,
  newId: string,
  locationOf: (index: number) => string,
  locations: string[],
): ButtonLike[] | null {
  if (!buttons) return null;
  let changed = false;
  const next = buttons.map((b, i) => {
    if (b && typeof b === 'object' && b.id === RESERVED_ERROR_PORT_ID) {
      changed = true;
      locations.push(locationOf(i));
      return { ...b, id: newId };
    }
    return b;
  });
  return changed ? next : null;
}

/**
 * 노드 config 의 버튼 id `error` 를 새 id 로 바꾼다. 원본은 바꾸지 않는다.
 * 정확 일치만 바꾼다(`Error` · `error_1` 은 그대로. 엔진 비교가 정확 일치라서).
 */
export function renameReservedErrorButtonIds(
  config: NodeConfigLike,
): ReservedIdRename {
  const unchanged: ReservedIdRename = { config, newId: null, locations: [] };
  if (!config || typeof config !== 'object') return unchanged;

  const ids = collectButtonIds(config);
  if (!ids.has(RESERVED_ERROR_PORT_ID)) return unchanged;

  const newId = nextErrorReplacementId(ids);
  const locations: string[] = [];
  const next: NodeConfigLike = { ...config };

  const buttons = renameInArray(
    asButtons(config.buttons),
    newId,
    (i) => `buttons[${i}]`,
    locations,
  );
  if (buttons) next.buttons = buttons;

  const itemButtons = renameInArray(
    asButtons(config.itemButtons),
    newId,
    (i) => `itemButtons[${i}]`,
    locations,
  );
  if (itemButtons) next.itemButtons = itemButtons;

  const perItem = itemButtonsOf(config);
  if (perItem.some((b) => b !== null)) {
    let itemsChanged = false;
    const items = (config.items as unknown[]).map((item, i) => {
      const renamed = renameInArray(
        perItem[i],
        newId,
        (j) => `items[${i}].buttons[${j}]`,
        locations,
      );
      if (!renamed) return item;
      itemsChanged = true;
      return { ...(item as Record<string, unknown>), buttons: renamed };
    });
    if (itemsChanged) next.items = items;
  }

  return { config: next, newId, locations };
}

/**
 * 노드의 에러 처리 정책이 「에러 포트로 라우팅」인지. 이 경우 `error` 연결선이
 * 버튼 연결선인지 에러 연결선인지 데이터만으로는 가를 수 없다.
 * 레거시 평면 키(`errorPolicy: 'error_port'`)도 같은 정책으로 본다.
 */
export function routesToErrorPort(config: NodeConfigLike): boolean {
  const handling = config?.errorHandling as { policy?: unknown } | undefined;
  if (handling && typeof handling === 'object') {
    return handling.policy === 'route_to_error_port';
  }
  return config?.errorPolicy === 'error_port';
}

interface NodeRow {
  workflow_id: string;
  id: string;
  type: string;
  config: NodeConfigLike;
}

interface PlannedNode {
  workflowId: string;
  nodeId: string;
  type: string;
  newId: string;
  locations: string[];
  newConfig: NodeConfigLike;
  routesToErrorPort: boolean;
}

/** 노드 행 목록에서 바꿀 노드를 고른다. 버튼 노드 타입만 본다. */
export function planReservedErrorButtonRenames(rows: NodeRow[]): PlannedNode[] {
  const planned: PlannedNode[] = [];
  for (const row of rows) {
    if (!isButtonNodeType(row.type)) continue;
    const result = renameReservedErrorButtonIds(row.config);
    if (!result.newId) continue;
    planned.push({
      workflowId: row.workflow_id,
      nodeId: row.id,
      type: row.type,
      newId: result.newId,
      locations: result.locations,
      newConfig: result.config,
      routesToErrorPort: routesToErrorPort(row.config),
    });
  }
  return planned;
}

/**
 * 이전을 실행한다. `dryRun` 이면 계획만 찍고 DB 에 쓰지 않는다.
 * apply 는 노드 config · 연결선 · audit_log 를 한 트랜잭션으로 쓴다.
 */
export async function runReservedErrorButtonMigration(
  ds: DataSource,
  options: { dryRun: boolean; workspaceId?: string; userId?: string },
  log: (line: string) => void = console.log,
): Promise<{ nodesUpdated: number; edgesUpdated: number }> {
  if (!options.dryRun && (!options.workspaceId || !options.userId)) {
    throw new Error(
      '--apply requires --workspace-id <uuid> and --user-id <uuid> so the audit_log row is attributable. Re-run with both flags.',
    );
  }

  // `config::text LIKE` 로 먼저 좁혀 버튼 노드 전체를 읽지 않는다. 정확한
  // 판정은 renameReservedErrorButtonIds 가 한다.
  const rows = await ds.query<NodeRow[]>(
    `SELECT n.workflow_id, n.id, n.type, n.config
       FROM node n
      WHERE n.type = ANY($1)
        AND n.config::text LIKE '%"error"%'
      ORDER BY n.workflow_id, n.id`,
    [[...BUTTON_NODE_TYPES]],
  );

  const planned = planReservedErrorButtonRenames(rows);
  const nodeIds = planned.map((p) => p.nodeId);
  const edgeCounts = new Map<string, number>();
  if (nodeIds.length > 0) {
    const counts = await ds.query<Array<{ source_node_id: string; n: number }>>(
      `SELECT source_node_id, count(*)::int AS n
         FROM edge
        WHERE source_port = $1 AND source_node_id = ANY($2)
        GROUP BY source_node_id`,
      [RESERVED_ERROR_PORT_ID, nodeIds],
    );
    for (const c of counts) edgeCounts.set(c.source_node_id, Number(c.n));
  }

  const mode = options.dryRun ? 'DRY' : 'APPLY';
  log(`${LOG_PREFIX} scanned ${rows.length} candidate button-node rows.`);
  log(`${LOG_PREFIX} nodes to update: ${planned.length}.`);
  for (const p of planned) {
    const edges = edgeCounts.get(p.nodeId) ?? 0;
    log(
      `  [${mode}] wf=${p.workflowId} node=${p.nodeId} (${p.type}) ${p.locations.join(', ')} → id="${p.newId}", edges=${edges}`,
    );
    if (p.routesToErrorPort && edges > 0) {
      log(
        `  [WARN] node=${p.nodeId} uses route_to_error_port — its "error" edges may have been error-port edges; they are moved to "${p.newId}" too. Check this workflow by hand.`,
      );
    }
  }

  const edgesPlanned = planned.reduce(
    (sum, p) => sum + (edgeCounts.get(p.nodeId) ?? 0),
    0,
  );
  if (options.dryRun || planned.length === 0) {
    if (options.dryRun) {
      log(`${LOG_PREFIX} DRY-RUN — no DB writes. Re-run with --apply.`);
    }
    return { nodesUpdated: 0, edgesUpdated: 0 };
  }

  let edgesUpdated = 0;
  await ds.transaction(async (manager) => {
    for (const p of planned) {
      await manager.query(
        'UPDATE node SET config = $1::jsonb, updated_at = NOW() WHERE id = $2',
        [JSON.stringify(p.newConfig), p.nodeId],
      );
      const result = (await manager.query(
        `UPDATE edge SET source_port = $1
          WHERE source_node_id = $2 AND source_port = $3
          RETURNING id`,
        [p.newId, p.nodeId, RESERVED_ERROR_PORT_ID],
      )) as unknown;
      edgesUpdated += countUpdatedRows(result);
    }
    await manager.query(
      `INSERT INTO audit_log (workspace_id, user_id, action, resource_type, resource_id, details)
       VALUES ($1, $2, 'reserved_error_button_ids_migrated', 'workflow', gen_random_uuid(), $3::jsonb)`,
      [
        options.workspaceId,
        options.userId,
        JSON.stringify({
          nodesUpdated: planned.length,
          edgesPlanned,
          edgesUpdated,
          appliedAt: new Date().toISOString(),
        }),
      ],
    );
  });
  log(
    `${LOG_PREFIX} APPLIED: ${planned.length} nodes, ${edgesUpdated} edges updated.`,
  );
  return { nodesUpdated: planned.length, edgesUpdated };
}

/**
 * `UPDATE … RETURNING` 결과에서 바뀐 행 수를 센다. TypeORM postgres 드라이버는
 * `[rows, affected]` 를 돌려주고, 행 배열만 돌려주는 드라이버도 있다.
 */
function countUpdatedRows(result: unknown): number {
  if (!Array.isArray(result)) return 0;
  if (
    result.length === 2 &&
    Array.isArray(result[0]) &&
    typeof result[1] === 'number'
  ) {
    return result[1];
  }
  return result.length;
}

async function main(): Promise<void> {
  loadDotenv();
  const password = process.env.DB_PASSWORD;
  if (!password) {
    throw new Error(
      'DB_PASSWORD is required — set it in codebase/backend/.env or as an env var before running this migration.',
    );
  }
  const dryRun =
    process.argv.includes('--dry-run') || !process.argv.includes('--apply');
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
    await runReservedErrorButtonMigration(ds, {
      dryRun,
      workspaceId: parseCliFlag('--workspace-id'),
      userId: parseCliFlag('--user-id'),
    });
  } finally {
    await ds.destroy();
  }
}

if (require.main === module) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}
