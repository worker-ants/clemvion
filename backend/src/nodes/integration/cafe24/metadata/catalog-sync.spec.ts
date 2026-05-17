import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  CAFE24_OPERATIONS_BY_RESOURCE,
  CAFE24_RESOURCES,
  findCafe24Operation,
} from './index.js';
import { CAFE24_PLANNED_BY_RESOURCE } from './planned.js';
import type { Cafe24Resource } from './types.js';

/**
 * Catalog ↔ metadata 양방향 동기 가드.
 *
 * `spec/conventions/cafe24-api-catalog/<resource>.md` 가 Cafe24 Admin API 의
 * 단일 진실(SoT)이며, 본 테스트는 카탈로그 표와 `CAFE24_OPERATIONS_BY_RESOURCE`
 * 가 어긋나면 즉시 fail 시킨다 — 정책: `spec/conventions/cafe24-api-catalog/_overview.md` §4.
 *
 * 검증:
 * 1. `status: supported` row 는 `findCafe24Operation` 으로 조회 가능해야 함
 * 2. 메타데이터 row 는 카탈로그에 `status: supported` 로 존재해야 함
 * 3. `method` / `path` / `scope` / `paginated` 가 일치해야 함
 * 4. catalog 파일이 18 resource 와 1:1 대응해야 함
 * 5. id 는 한 파일 안에서 unique 해야 함
 * 6. status 는 `supported` | `planned` | `deprecated` 중 하나
 * 7. `status: planned` row 는 `CAFE24_PLANNED_BY_RESOURCE` (planned.ts) 에 매칭
 *    되어야 하고 `paginated` 가 일치해야 함 (양방향)
 * 8. **`restricted` 컬럼 ↔ `restrictedApproval` 양방향 동기** — catalog `scope`/`operation` ↔ metadata `level='scope'/'operation'`.
 *    `level='program'` 인 메타데이터는 catalog 대상이 아니라 본 검증에서 제외.
 *    명단 SoT: `spec/conventions/cafe24-restricted-scopes.md`.
 */

const CATALOG_DIR = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  '..',
  '..',
  'spec',
  'conventions',
  'cafe24-api-catalog',
);

type CatalogStatus = 'supported' | 'planned' | 'deprecated';
type CatalogRestricted = 'scope' | 'operation' | '';

interface CatalogRow {
  id: string;
  labelKo: string;
  englishTitle: string;
  method: string;
  path: string;
  scope: string;
  restricted: CatalogRestricted;
  paginated: boolean;
  status: CatalogStatus;
  docsUrl: string;
}

// Header-based dynamic column indexing — supports catalog files with or without
// the optional `restricted` column. See `_overview.md` §2 for canonical order:
// `id | 라벨 (한) | English title | method | path | scope | restricted? | paginated | status | docs`.
const CANONICAL_HEADERS = [
  'id',
  '라벨 (한)',
  'english title',
  'method',
  'path',
  'scope',
  'restricted',
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
  for (const name of CANONICAL_HEADERS) {
    const found = headerCells.indexOf(name);
    if (found >= 0) idx[name] = found;
  }
  return idx;
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
  let columnIndex: Record<string, number> = {};

  for (const line of lines) {
    if (!line.trim().startsWith('|')) {
      if (inTable) inTable = false;
      headerSeen = false;
      columnIndex = {};
      continue;
    }
    if (!inTable) {
      inTable = true;
      headerSeen = false;
      // First row is the header
      const headerCells = parseHeaderCells(line);
      columnIndex = buildColumnIndex(headerCells);
      continue;
    }
    if (!headerSeen) {
      // Second row is the separator `|---|---|...|`
      if (/^\s*\|[\s-:|]+\|\s*$/.test(line)) {
        headerSeen = true;
      }
      continue;
    }
    // data row
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim());
    if (cells.length < 9) continue;

    const idCell = cellOr(cells, columnIndex.id);
    const id = idCell.replace(/^`|`$/g, '').trim();
    if (!id) continue;

    const pathCell = cellOr(cells, columnIndex.path);
    const docsCell = cellOr(cells, columnIndex.docs);
    const docsMatch = docsCell.match(/\((https?:\/\/[^)]+)\)/);
    const restrictedRaw = cellOr(cells, columnIndex.restricted);
    const restricted: CatalogRestricted =
      restrictedRaw === 'scope' || restrictedRaw === 'operation'
        ? restrictedRaw
        : '';

    rows.push({
      id,
      labelKo: cellOr(cells, columnIndex['라벨 (한)']),
      englishTitle: cellOr(cells, columnIndex['english title']),
      method: cellOr(cells, columnIndex.method),
      path: pathCell.replace(/^`|`$/g, '').trim(),
      scope: cellOr(cells, columnIndex.scope),
      restricted,
      paginated: cellOr(cells, columnIndex.paginated) === '✓',
      status: cellOr(cells, columnIndex.status) as CatalogStatus,
      docsUrl: docsMatch?.[1] ?? docsCell,
    });
  }
  return rows;
}

function loadCatalog(): Record<Cafe24Resource, CatalogRow[]> {
  const out = {} as Record<Cafe24Resource, CatalogRow[]>;
  for (const resource of CAFE24_RESOURCES) {
    const filePath = join(CATALOG_DIR, `${resource}.md`);
    out[resource] = parseCatalogFile(filePath);
  }
  return out;
}

describe('Cafe24 API catalog ↔ metadata sync', () => {
  const VALID_STATUSES: CatalogStatus[] = [
    'supported',
    'planned',
    'deprecated',
  ];
  const catalog = loadCatalog();

  describe('catalog file structure', () => {
    it('has one .md file per Cafe24Resource (plus _overview.md)', () => {
      const files = readdirSync(CATALOG_DIR)
        .filter((f) => f.endsWith('.md'))
        .sort();
      const expected = [
        '_overview.md',
        ...CAFE24_RESOURCES.map((r) => `${r}.md`),
      ].sort();
      expect(files).toEqual(expected);
    });

    it('every resource catalog has at least 1 row', () => {
      for (const resource of CAFE24_RESOURCES) {
        const rows = catalog[resource];
        if (rows.length === 0) {
          throw new Error(`${resource}.md has no operation rows`);
        }
      }
    });
  });

  describe('row well-formedness', () => {
    it('id is unique within each resource file', () => {
      for (const resource of CAFE24_RESOURCES) {
        const ids = catalog[resource].map((r) => r.id);
        const seen = new Set<string>();
        for (const id of ids) {
          if (seen.has(id)) {
            throw new Error(`${resource}.md: duplicate id "${id}"`);
          }
          seen.add(id);
        }
      }
    });

    it('status is one of supported|planned|deprecated', () => {
      for (const resource of CAFE24_RESOURCES) {
        for (const row of catalog[resource]) {
          if (!VALID_STATUSES.includes(row.status)) {
            throw new Error(
              `${resource}.md: row "${row.id}" has invalid status "${row.status}"`,
            );
          }
        }
      }
    });

    it('supported rows have concrete method/path/scope (no "?" placeholders)', () => {
      for (const resource of CAFE24_RESOURCES) {
        for (const row of catalog[resource]) {
          if (row.status !== 'supported') continue;
          if (row.method === '?' || row.path === '?' || row.scope === '?') {
            throw new Error(
              `${resource}.md: supported row "${row.id}" must declare concrete method/path/scope`,
            );
          }
          if (!['GET', 'POST', 'PUT', 'DELETE'].includes(row.method)) {
            throw new Error(
              `${resource}.md: supported row "${row.id}" has invalid method "${row.method}"`,
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
    it('every supported row exists in CAFE24_OPERATIONS_BY_RESOURCE', () => {
      for (const resource of CAFE24_RESOURCES) {
        for (const row of catalog[resource]) {
          if (row.status !== 'supported') continue;
          const op = findCafe24Operation(resource, row.id);
          if (!op) {
            throw new Error(
              `${resource}.md: supported row "${row.id}" has no matching metadata entry`,
            );
          }
        }
      }
    });

    it('supported row method/path/scope/paginated matches metadata', () => {
      for (const resource of CAFE24_RESOURCES) {
        for (const row of catalog[resource]) {
          if (row.status !== 'supported') continue;
          const op = findCafe24Operation(resource, row.id)!;
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
          if (op.scopeType !== row.scope) {
            throw new Error(
              `${ctx}: scope mismatch (catalog=${row.scope}, metadata=${op.scopeType})`,
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
      for (const resource of CAFE24_RESOURCES) {
        const ops = CAFE24_OPERATIONS_BY_RESOURCE[resource];
        const supportedIds = new Set(
          catalog[resource]
            .filter((r) => r.status === 'supported')
            .map((r) => r.id),
        );
        for (const op of ops) {
          if (!supportedIds.has(op.id)) {
            throw new Error(
              `${resource}.md: metadata operation "${op.id}" is not registered as a supported row`,
            );
          }
        }
      }
    });
  });

  describe('catalog ↔ planned.ts', () => {
    it('every planned row in catalog exists in CAFE24_PLANNED_BY_RESOURCE', () => {
      for (const resource of CAFE24_RESOURCES) {
        const plannedIds = new Set(
          CAFE24_PLANNED_BY_RESOURCE[resource].map((p) => p.id),
        );
        for (const row of catalog[resource]) {
          if (row.status !== 'planned') continue;
          if (!plannedIds.has(row.id)) {
            throw new Error(
              `${resource}.md: planned row "${row.id}" missing from CAFE24_PLANNED_BY_RESOURCE — add it to backend/src/nodes/integration/cafe24/metadata/planned.ts`,
            );
          }
        }
      }
    });

    it('every CAFE24_PLANNED_BY_RESOURCE entry exists as a planned row in catalog', () => {
      for (const resource of CAFE24_RESOURCES) {
        const plannedRows = new Set(
          catalog[resource]
            .filter((r) => r.status === 'planned')
            .map((r) => r.id),
        );
        for (const op of CAFE24_PLANNED_BY_RESOURCE[resource]) {
          if (!plannedRows.has(op.id)) {
            throw new Error(
              `planned.ts ${resource}: "${op.id}" has no matching planned row in ${resource}.md`,
            );
          }
        }
      }
    });

    it('planned row paginated flag matches planned.ts', () => {
      for (const resource of CAFE24_RESOURCES) {
        const plannedById = new Map(
          CAFE24_PLANNED_BY_RESOURCE[resource].map((p) => [p.id, p]),
        );
        for (const row of catalog[resource]) {
          if (row.status !== 'planned') continue;
          const planned = plannedById.get(row.id);
          if (!planned) continue; // covered by previous test
          const expectedPag = planned.paginated === true;
          if (expectedPag !== row.paginated) {
            throw new Error(
              `${resource}.md row "${row.id}": paginated mismatch (catalog=${row.paginated}, planned.ts=${expectedPag})`,
            );
          }
        }
      }
    });

    it('planned ids do not collide with supported ids within a resource', () => {
      for (const resource of CAFE24_RESOURCES) {
        const supportedIds = new Set(
          CAFE24_OPERATIONS_BY_RESOURCE[resource].map((op) => op.id),
        );
        for (const planned of CAFE24_PLANNED_BY_RESOURCE[resource]) {
          if (supportedIds.has(planned.id)) {
            throw new Error(
              `planned.ts ${resource}: id "${planned.id}" collides with a supported operation`,
            );
          }
        }
      }
    });
  });

  // Rule 8 — restrictedApproval ↔ catalog `restricted` two-way sync.
  // SoT: spec/conventions/cafe24-restricted-scopes.md.
  describe('catalog `restricted` ↔ metadata `restrictedApproval`', () => {
    it('supported row with restricted=scope|operation has metadata.restrictedApproval', () => {
      for (const resource of CAFE24_RESOURCES) {
        for (const row of catalog[resource]) {
          if (row.status !== 'supported') continue;
          if (row.restricted === '') continue;
          const op = findCafe24Operation(resource, row.id)!;
          if (!op.restrictedApproval) {
            throw new Error(
              `${resource}.md row "${row.id}": catalog restricted="${row.restricted}" but metadata.restrictedApproval is undefined`,
            );
          }
        }
      }
    });

    it('supported row restricted column matches metadata.restrictedApproval.level', () => {
      for (const resource of CAFE24_RESOURCES) {
        for (const row of catalog[resource]) {
          if (row.status !== 'supported') continue;
          const op = findCafe24Operation(resource, row.id)!;
          const expected = op.restrictedApproval?.level;
          if (expected === undefined) {
            if (row.restricted !== '') {
              throw new Error(
                `${resource}.md row "${row.id}": catalog restricted="${row.restricted}" but metadata has no restrictedApproval`,
              );
            }
            continue;
          }
          // `program` level rows are not catalog-tracked
          if (expected === 'program') continue;
          if (expected !== row.restricted) {
            throw new Error(
              `${resource}.md row "${row.id}": restricted mismatch (catalog="${row.restricted}", metadata.level="${expected}")`,
            );
          }
        }
      }
    });

    it('metadata operations with restrictedApproval (excluding program level) are flagged in catalog', () => {
      for (const resource of CAFE24_RESOURCES) {
        const supportedRowsById = new Map(
          catalog[resource]
            .filter((r) => r.status === 'supported')
            .map((r) => [r.id, r] as const),
        );
        for (const op of CAFE24_OPERATIONS_BY_RESOURCE[resource]) {
          if (!op.restrictedApproval) continue;
          if (op.restrictedApproval.level === 'program') continue;
          const row = supportedRowsById.get(op.id);
          if (!row) continue; // caught by metadata→catalog test above
          if (row.restricted === '') {
            throw new Error(
              `${resource}.md row "${op.id}": metadata.restrictedApproval set but catalog restricted column is empty`,
            );
          }
        }
      }
    });

    it('restrictedApproval.inquiryUrl is non-empty when set', () => {
      for (const resource of CAFE24_RESOURCES) {
        for (const op of CAFE24_OPERATIONS_BY_RESOURCE[resource]) {
          if (!op.restrictedApproval) continue;
          if (!op.restrictedApproval.inquiryUrl) {
            throw new Error(
              `${resource} ${op.id}: restrictedApproval.inquiryUrl must be non-empty`,
            );
          }
        }
      }
    });
  });
});
