import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { CAFE24_OPERATIONS_BY_RESOURCE, CAFE24_RESOURCES } from './index.js';
import { normPath } from './catalog-docs-drift.spec.js';
import type { Cafe24Resource } from './types.js';

/**
 * G-1-remaining 회귀 가드 — docs 필수(✓) ⊆ requiredFields.
 *
 * `catalog-docs-drift.spec.ts` 는 (method, path, scope) 만, `metadata.spec.ts` 는
 * requiredFields ⊆ fields (subset) 만 검증한다. **어느 가드도 "docs 가 필수로 표기한
 * 파라미터가 실제 requiredFields 에 있는지"를 검증하지 않는다** — field-set 미러 시
 * requiredFields 가 docs 필수 표기보다 느슨해지는 계약 결함을 놓친다 (ai-review CRITICAL,
 * review/code/2026/07/05/23_26_29).
 *
 * 본 가드: 각 supported operation 에 대해 공식 docs 카탈로그 Request 표의 `필수(✓)`
 * 컬럼이 표시한 파라미터 중 **해당 op 의 fields 에 실재하는 것**은 모두 requiredFields
 * 에 있어야 한다. (fields 에 없는 docs-필수 = 우리가 미노출한 필드이므로 제외 — 노출한
 * 필드에 한해 requiredness 를 강제.)
 *
 * docs 에 해당 (method, path) op 이 없으면 검증 스킵 (drift 가드가 별도 담당).
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

/**
 * 단일 카탈로그 markdown 에서 op 별 docs-필수(✓) 파라미터 집합을 파싱한다.
 * op heading `### \`METHOD PATH\`` 아래 `#### 요청 파라미터 (Request)` 표만 본다
 * (Response 표는 `| Parameter | 제약 | 설명 |` 3-컬럼이라 필수 컬럼이 없음).
 */
export function parseRequiredParamsFromMarkdown(
  raw: string,
): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  const headingRe = /^### `(GET|POST|PUT|DELETE) ([^`]+)`/gm;
  const marks: { method: string; path: string; idx: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = headingRe.exec(raw)) !== null) {
    marks.push({ method: m[1], path: m[2], idx: m.index });
  }
  marks.forEach((mark, i) => {
    const section = raw.slice(
      mark.idx,
      i + 1 < marks.length ? marks[i + 1].idx : raw.length,
    );
    // Request 표 구간만 절취: `#### 요청 파라미터` ~ 다음 `####`.
    const reqStart = section.search(/^####\s+요청\s*파라미터/m);
    if (reqStart === -1) return;
    const after = section.slice(reqStart + 1);
    const nextHead = after.search(/^####\s/m);
    const reqBlock = nextHead === -1 ? after : after.slice(0, nextHead);
    const required = new Set<string>();
    // 행: `| `name` | <필수> | ...` — 필수 셀에 ✓ 있으면 required.
    const rowRe = /^\|\s*`([^`]+)`\s*\|([^|]*)\|/gm;
    let r: RegExpExecArray | null;
    while ((r = rowRe.exec(reqBlock)) !== null) {
      if (r[2].includes('✓')) required.add(r[1].trim());
    }
    out.set(`${mark.method} ${normPath(mark.path)}`, required);
  });
  return out;
}

function loadDocsRequired(): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const resource of CAFE24_RESOURCES) {
    const dir = join(CATALOG_DIR, resource);
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
      const raw = readFileSync(join(dir, file), 'utf-8');
      for (const [k, v] of parseRequiredParamsFromMarkdown(raw)) out.set(k, v);
    }
  }
  return out;
}

describe('Cafe24 metadata — docs 필수(✓) ⊆ requiredFields (G-1-remaining guard)', () => {
  let docsRequired: Map<string, Set<string>>;

  beforeAll(() => {
    docsRequired = loadDocsRequired();
  });

  it('parses a non-trivial number of required-param sets (fail-loud)', () => {
    const withReq = Array.from(docsRequired.values()).filter(
      (s) => s.size > 0,
    ).length;
    expect(withReq).toBeGreaterThan(80);
  });

  it('every docs-required param present in fields is declared in requiredFields', () => {
    const violations: string[] = [];
    for (const resource of CAFE24_RESOURCES) {
      for (const op of CAFE24_OPERATIONS_BY_RESOURCE[
        resource as Cafe24Resource
      ] ?? []) {
        const docReq = docsRequired.get(`${op.method} ${normPath(op.path)}`);
        if (!docReq || docReq.size === 0) continue;
        const fieldKeys = new Set(Object.keys(op.fields));
        const req = new Set(op.requiredFields);
        for (const f of docReq) {
          if (fieldKeys.has(f) && !req.has(f)) {
            violations.push(`${resource}/${op.id}: docs-필수 '${f}' 미포함`);
          }
        }
      }
    }
    if (violations.length > 0) {
      throw new Error(
        `docs 필수(✓) 인데 requiredFields 누락 ${violations.length}건:\n` +
          violations.join('\n'),
      );
    }
  });
});
