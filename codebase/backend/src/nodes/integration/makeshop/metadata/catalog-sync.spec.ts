import { execSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  MAKESHOP_OPERATIONS_BY_RESOURCE,
  MAKESHOP_RESOURCES,
  findMakeshopOperation,
  scopeForOperation,
} from './index.js';
import type { MakeshopResource } from './types.js';

/**
 * Catalog ↔ metadata 양방향 동기 가드.
 *
 * `spec/conventions/makeshop-api-catalog/<resource>.md` 의 REST 표가 단일 진실
 * (SoT)이며, 본 테스트는 카탈로그 표와 `MAKESHOP_OPERATIONS_BY_RESOURCE` 가
 * 어긋나면 즉시 fail 시킨다 — 정책: cafe24 catalog `_overview.md §4` 패턴을
 * makeshop 에 도입 (makeshop-api-metadata §5).
 *
 * 검증:
 * 1. `status: supported` row 는 `findMakeshopOperation` 으로 조회 가능해야 함
 * 2. 메타데이터 row 는 카탈로그에 `status: supported` 로 존재해야 함
 * 3. `method` / `path` / `scope` / `paginated` 가 일치해야 함
 * 4. catalog 파일이 7 resource 와 1:1 대응해야 함
 * 5. id 는 한 파일 안에서 unique 해야 함
 * 6. status 는 `supported` | `planned` 중 하나 (cafe24 의 `deprecated` 는 미사용)
 *
 * webhook 표(`cpik.md` 의 `event_code` 컬럼 표)는 `path`/`scope` 컬럼이 없어
 * REST 표로 인식되지 않으므로 자동으로 제외된다.
 */

function resolveRepoRoot(): string {
  try {
    return execSync('git rev-parse --show-toplevel', {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return join(__dirname, '..', '..', '..', '..', '..', '..', '..');
  }
}
const REPO_ROOT = resolveRepoRoot();
const CATALOG_DIR = join(
  REPO_ROOT,
  'spec',
  'conventions',
  'makeshop-api-catalog',
);

type CatalogStatus = 'supported' | 'planned';

interface CatalogRow {
  id: string;
  labelKo: string;
  method: string;
  path: string;
  scope: string;
  paginated: boolean;
  status: CatalogStatus;
  docsUrl: string;
}

// REST table canonical header order (makeshop-api-catalog `_overview.md §3·§6`):
// `id | 라벨 (한) | method | path | scope | paginated | status | docs`.
// The webhook table header (`id | 라벨 (한) | event_code | docs`) lacks the
// `path`/`scope` columns, so `buildColumnIndex` yields no `path`/`scope` index
// and the table is skipped as non-REST.
const REST_HEADERS = [
  'id',
  '라벨 (한)',
  'method',
  'path',
  'scope',
  'paginated',
  'status',
  'docs',
];

function parseHeaderCells(line: string): string[] {
  return line
    .split('|')
    .slice(1, -1)
    .map((c) => c.trim().toLowerCase().replace(/`/g, ''));
}

function buildColumnIndex(headerCells: string[]): Record<string, number> {
  const idx: Record<string, number> = {};
  for (const name of REST_HEADERS) {
    const found = headerCells.indexOf(name);
    if (found >= 0) idx[name] = found;
  }
  return idx;
}

function isRestHeader(idx: Record<string, number>): boolean {
  // A REST table must have id + method + path + scope columns. Webhook tables
  // (id | 라벨 | event_code | docs) do not, so they are excluded.
  return (
    idx.id !== undefined &&
    idx.method !== undefined &&
    idx.path !== undefined &&
    idx.scope !== undefined
  );
}

function cellOr(
  cells: string[],
  idx: number | undefined,
  fallback = '',
): string {
  if (idx === undefined || idx < 0 || idx >= cells.length) return fallback;
  return cells[idx];
}

function parseCatalogFile(filePath: string): CatalogRow[] {
  const raw = readFileSync(filePath, 'utf-8');
  const lines = raw.split('\n');
  const rows: CatalogRow[] = [];
  let inTable = false;
  let headerSeen = false;
  let isRest = false;
  let columnIndex: Record<string, number> = {};

  for (const line of lines) {
    if (!line.trim().startsWith('|')) {
      inTable = false;
      headerSeen = false;
      isRest = false;
      columnIndex = {};
      continue;
    }
    if (!inTable) {
      inTable = true;
      headerSeen = false;
      const headerCells = parseHeaderCells(line);
      columnIndex = buildColumnIndex(headerCells);
      isRest = isRestHeader(columnIndex);
      continue;
    }
    if (!headerSeen) {
      if (/^\s*\|[\s-:|]+\|\s*$/.test(line)) {
        headerSeen = true;
      }
      continue;
    }
    if (!isRest) continue; // webhook / non-REST table — skip data rows

    const cells = line
      .split('|')
      .slice(1, -1)
      .map((c) =>
        c
          .trim()
          .replace(/\s*\[\^[^\]]+\]/g, '')
          .trim(),
      );
    if (cells.length < REST_HEADERS.length) continue;

    const id = cellOr(cells, columnIndex.id).replace(/^`|`$/g, '').trim();
    if (!id) continue;

    const docsCell = cellOr(cells, columnIndex.docs);
    const docsMatch = docsCell.match(/\((https?:\/\/[^)]+)\)/);

    rows.push({
      id,
      labelKo: cellOr(cells, columnIndex['라벨 (한)']),
      method: cellOr(cells, columnIndex.method),
      path: cellOr(cells, columnIndex.path).replace(/^`|`$/g, '').trim(),
      scope: cellOr(cells, columnIndex.scope),
      paginated: cellOr(cells, columnIndex.paginated) === '✓',
      status: cellOr(cells, columnIndex.status) as CatalogStatus,
      docsUrl: docsMatch?.[1] ?? docsCell,
    });
  }
  return rows;
}

function loadCatalog(): Record<MakeshopResource, CatalogRow[]> {
  const out = {} as Record<MakeshopResource, CatalogRow[]>;
  for (const resource of MAKESHOP_RESOURCES) {
    const filePath = join(CATALOG_DIR, `${resource}.md`);
    out[resource] = parseCatalogFile(filePath);
  }
  return out;
}

describe('Makeshop API catalog ↔ metadata sync', () => {
  const VALID_STATUSES: CatalogStatus[] = ['supported', 'planned'];
  const catalog = loadCatalog();

  describe('catalog file structure', () => {
    it('has one .md file per MakeshopResource (plus _overview.md)', () => {
      const files = readdirSync(CATALOG_DIR)
        .filter((f) => f.endsWith('.md'))
        .sort();
      const expected = [
        '_overview.md',
        ...MAKESHOP_RESOURCES.map((r) => `${r}.md`),
      ].sort();
      expect(files).toEqual(expected);
    });

    it('every resource catalog has at least 1 REST row', () => {
      for (const resource of MAKESHOP_RESOURCES) {
        if (catalog[resource].length === 0) {
          throw new Error(`${resource}.md has no REST rows`);
        }
      }
    });
  });

  describe('row well-formedness', () => {
    it('id is unique within each resource file', () => {
      for (const resource of MAKESHOP_RESOURCES) {
        const seen = new Set<string>();
        for (const row of catalog[resource]) {
          if (seen.has(row.id)) {
            throw new Error(`${resource}.md: duplicate id "${row.id}"`);
          }
          seen.add(row.id);
        }
      }
    });

    it('status is one of supported|planned', () => {
      for (const resource of MAKESHOP_RESOURCES) {
        for (const row of catalog[resource]) {
          if (!VALID_STATUSES.includes(row.status)) {
            throw new Error(
              `${resource}.md: row "${row.id}" has invalid status "${row.status}"`,
            );
          }
        }
      }
    });

    it('supported rows have concrete GET/POST method, path, and read/write scope', () => {
      for (const resource of MAKESHOP_RESOURCES) {
        for (const row of catalog[resource]) {
          if (row.status !== 'supported') continue;
          if (!['GET', 'POST'].includes(row.method)) {
            throw new Error(
              `${resource}.md: supported row "${row.id}" has invalid method "${row.method}"`,
            );
          }
          if (!row.path || row.path === '?') {
            throw new Error(
              `${resource}.md: supported row "${row.id}" must declare a concrete path`,
            );
          }
          if (!['read', 'write'].includes(row.scope)) {
            throw new Error(
              `${resource}.md: supported row "${row.id}" has invalid scope "${row.scope}"`,
            );
          }
        }
      }
    });
  });

  describe('catalog → metadata', () => {
    it('every supported row exists in MAKESHOP_OPERATIONS_BY_RESOURCE', () => {
      for (const resource of MAKESHOP_RESOURCES) {
        for (const row of catalog[resource]) {
          if (row.status !== 'supported') continue;
          if (!findMakeshopOperation(resource, row.id)) {
            throw new Error(
              `${resource}.md: supported row "${row.id}" has no matching metadata entry`,
            );
          }
        }
      }
    });

    it('supported row method/path/scope/paginated matches metadata', () => {
      for (const resource of MAKESHOP_RESOURCES) {
        for (const row of catalog[resource]) {
          if (row.status !== 'supported') continue;
          const op = findMakeshopOperation(resource, row.id)!;
          const ctx = `${resource}.md row "${row.id}"`;
          if (op.method !== row.method) {
            throw new Error(
              `${ctx}: method mismatch (catalog=${row.method}, metadata=${op.method})`,
            );
          }
          if (op.path !== row.path) {
            throw new Error(
              `${ctx}: path mismatch (catalog=${row.path}, metadata=${op.path})`,
            );
          }
          // catalog `scope` column holds the `read`/`write` token = scopeType.
          if (op.scopeType !== row.scope) {
            throw new Error(
              `${ctx}: scope mismatch (catalog=${row.scope}, metadata=${op.scopeType})`,
            );
          }
          // and `scopeForOperation` must build a `<group>.<scope>` wire scope
          // whose trailing token equals the catalog scope.
          const wire = scopeForOperation(resource, op);
          if (!wire.endsWith(`.${row.scope}`)) {
            throw new Error(
              `${ctx}: wire scope "${wire}" does not end with ".${row.scope}"`,
            );
          }
          const expectedPaginated = op.paginated === true;
          if (expectedPaginated !== row.paginated) {
            throw new Error(
              `${ctx}: paginated mismatch (catalog=${row.paginated}, metadata=${expectedPaginated})`,
            );
          }
        }
      }
    });
  });

  describe('metadata → catalog', () => {
    it('every metadata operation appears as a supported row in the catalog', () => {
      for (const resource of MAKESHOP_RESOURCES) {
        const supportedIds = new Set(
          catalog[resource]
            .filter((r) => r.status === 'supported')
            .map((r) => r.id),
        );
        for (const op of MAKESHOP_OPERATIONS_BY_RESOURCE[resource]) {
          if (!supportedIds.has(op.id)) {
            throw new Error(
              `${resource}.md: metadata operation "${op.id}" is not registered as a supported row`,
            );
          }
        }
      }
    });
  });
});
