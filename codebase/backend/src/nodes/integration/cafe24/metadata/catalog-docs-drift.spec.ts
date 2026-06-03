import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { CAFE24_OPERATIONS_BY_RESOURCE, CAFE24_RESOURCES } from './index.js';

/**
 * G-3m — metadata ↔ field-level 카탈로그(docs SoT) 드리프트 가드.
 *
 * `catalog-sync.spec.ts` 는 metadata ↔ top-level index `<resource>.md` 만 본다.
 * 둘 다 과거 Chrome 식별 기반이라 **같은 오류를 공유하면 검출하지 못한다**
 * (실제로 translation 단/복수, order/{order_id} 잉여, salesreport namespace 등
 * 36건 드리프트가 그렇게 누락됐다 — plan G-3).
 *
 * 본 가드는 metadata 의 모든 supported operation `(method, path, scope)` 가
 * **field-level 카탈로그**(`spec/conventions/cafe24-api-catalog/<resource>/<entity>.md`,
 * Cafe24 공식 docs 전체 페이지 HTML 에서 결정적 추출 — `_overview.md §7`) 에
 * 동일하게 존재하는지 검증한다. metadata → docs 단방향: docs 에 우리보다 많은
 * operation 이 있는 것은 정상(미구현)이나, **우리가 docs 에 없는 path/method/scope 를
 * 가리키면 fail**.
 *
 * 면제: docs 에 없지만 운영상 유지 중인 op(plan G-2 — production 검증/본사 문의 전까지
 * 보류)는 `KNOWN_DOCS_ABSENT` allowlist 로 명시 제외한다. 신규 op 가 docs 와 어긋나면
 * allowlist 에 없으므로 즉시 fail → 드리프트 조기 검출.
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

const CATALOG_DIR = join(
  resolveRepoRoot(),
  'spec',
  'conventions',
  'cafe24-api-catalog',
);

/** path 정규화: `/api/v2/admin/` 접두 제거 + `{param}` → `{}` (param 명 차이 무시). */
function normPath(p: string): string {
  return p
    .replace('/api/v2/admin/', '')
    .replace(/^\//, '')
    .replace(/\{[^}]+\}/g, '{}')
    .trim();
}

/**
 * docs 부재이나 운영상 유지 중인 operation (plan G-2 — 현행 유지, JSDoc ⚠).
 * production 검증 또는 cafe24 본사 문의로 docs 등재되면 제거한다.
 * `<resource>/<id>` 형식.
 */
const KNOWN_DOCS_ABSENT = new Set<string>([
  'customer/customer_get',
  'customer/customer_update',
  'promotion/coupon_get',
  'promotion/coupon_delete',
  'application/applications_list',
  'application/webhooks_list',
  'category/mains_update',
  'category/mains_delete',
  'store/socials_apple_settings_get',
]);

interface DocsOp {
  scope: 'read' | 'write' | null;
}

/** field-level 카탈로그 전체를 파싱해 `${METHOD} ${normPath}` → {scope} 맵을 만든다. */
function loadDocsOperations(): Map<string, DocsOp> {
  const out = new Map<string, DocsOp>();
  for (const resource of CAFE24_RESOURCES) {
    const dir = join(CATALOG_DIR, resource);
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
      const raw = readFileSync(join(dir, file), 'utf-8');
      // 각 operation 섹션: `### \`METHOD /api/v2/admin/PATH\` — title` 이후 `- **Scope**: \`mall.<read|write>_..\``
      const headingRe = /^### `(GET|POST|PUT|DELETE) ([^`]+)`/gm;
      let m: RegExpExecArray | null;
      const marks: { method: string; path: string; idx: number }[] = [];
      while ((m = headingRe.exec(raw)) !== null) {
        marks.push({ method: m[1], path: m[2], idx: m.index });
      }
      marks.forEach((mark, i) => {
        const section = raw.slice(
          mark.idx,
          i + 1 < marks.length ? marks[i + 1].idx : raw.length,
        );
        const sm = section.match(/- \*\*Scope\*\*: `mall\.(read|write)_/);
        out.set(`${mark.method} ${normPath(mark.path)}`, {
          scope: sm ? (sm[1] as 'read' | 'write') : null,
        });
      });
    }
  }
  return out;
}

describe('Cafe24 metadata ↔ field-level catalog (docs) drift guard — G-3m', () => {
  const docsOps = loadDocsOperations();

  it('parses a non-trivial number of operations from the field-level catalog', () => {
    // sanity: 카탈로그 파싱이 깨지면 가드가 무력화되므로 하한선을 둔다.
    expect(docsOps.size).toBeGreaterThan(300);
  });

  it('every supported metadata operation matches a docs operation by method+path', () => {
    const drift: string[] = [];
    for (const resource of CAFE24_RESOURCES) {
      for (const op of CAFE24_OPERATIONS_BY_RESOURCE[resource] ?? []) {
        if (KNOWN_DOCS_ABSENT.has(`${resource}/${op.id}`)) continue;
        const key = `${op.method} ${normPath(op.path)}`;
        if (!docsOps.has(key)) {
          drift.push(
            `${resource}/${op.id}: ${key} — 공식 docs 카탈로그에 없음 (path/method 드리프트). ` +
              `docs 가 맞다면 metadata 정정, 운영상 의도된 docs 부재면 KNOWN_DOCS_ABSENT 에 추가(plan G-2 근거).`,
          );
        }
      }
    }
    if (drift.length > 0) {
      throw new Error(
        `metadata 가 공식 docs 와 어긋나는 operation ${drift.length}건:\n` +
          drift.join('\n'),
      );
    }
  });

  it('matched operations agree on scope (read/write) with docs', () => {
    const mismatch: string[] = [];
    for (const resource of CAFE24_RESOURCES) {
      for (const op of CAFE24_OPERATIONS_BY_RESOURCE[resource] ?? []) {
        if (KNOWN_DOCS_ABSENT.has(`${resource}/${op.id}`)) continue;
        const doc = docsOps.get(`${op.method} ${normPath(op.path)}`);
        if (doc && doc.scope && doc.scope !== op.scopeType) {
          mismatch.push(
            `${resource}/${op.id}: scope metadata='${op.scopeType}' vs docs='${doc.scope}' (${op.method} ${op.path})`,
          );
        }
      }
    }
    if (mismatch.length > 0) {
      throw new Error(
        `scope 불일치 ${mismatch.length}건:\n${mismatch.join('\n')}`,
      );
    }
  });
});
