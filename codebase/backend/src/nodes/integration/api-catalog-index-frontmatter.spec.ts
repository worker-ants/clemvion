import { execSync } from 'child_process';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * Cafe24 · MakeShop 카탈로그 색인(`codebase/api-catalogs/<vendor>/<resource>.md`)의
 * frontmatter 가드.
 *
 * 카탈로그가 `spec/conventions/<vendor>-api-catalog/` 에 있을 때는 frontend 의 spec 가드
 * (`spec-frontmatter` · `spec-code-paths`)가 색인 25개의 `id` · `status` · `code:` 를 봤다.
 * NERV 정본 전환 단계 4a(Task `CLE-T-BD48J3`)에서 카탈로그를 codebase 데이터로 옮기면서
 * 그 가드의 스캔 루트(`spec/`) 밖으로 나갔다. 이 테스트가 같은 계약을 새 자리에서 맡는다.
 *
 * - `id` 는 파일 이름과 맞는다(Cafe24 `<resource>`, MakeShop `makeshop-<section>`).
 * - `status: implemented` 이면 `code:` 가 하나 이상 있고, 적힌 경로가 모두 있다.
 *
 * 필드 단위 파일(`<resource>/<entity>.md`)은 생성기 산출물이라 대상이 아니다(옛 가드와 같다).
 */

// 다른 catalog 테스트와 같은 방식으로 저장소 루트를 찾는다(linked worktree 에서도 맞다).
function resolveRepoRoot(): string {
  try {
    return execSync('git rev-parse --show-toplevel', {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    // backend/src/nodes/integration/ → repo root 까지 5 단계 상위.
    return join(__dirname, '..', '..', '..', '..', '..');
  }
}

const REPO_ROOT = resolveRepoRoot();

interface VendorCatalog {
  vendor: string;
  idFor: (resource: string) => string;
  minIndexes: number;
}

const VENDORS: readonly VendorCatalog[] = [
  { vendor: 'cafe24', idFor: (r) => r, minIndexes: 18 },
  { vendor: 'makeshop', idFor: (r) => `makeshop-${r}`, minIndexes: 7 },
];

interface IndexFrontmatter {
  id?: string;
  status?: string;
  code: string[];
}

// 색인 frontmatter 는 `id` · `status` 스칼라와 `code:` 목록뿐이다. 그 모양만 읽는다.
export function parseIndexFrontmatter(raw: string): IndexFrontmatter | null {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(raw);
  if (!m) return null;
  const out: IndexFrontmatter = { code: [] };
  let inCode = false;
  for (const line of m[1].split('\n')) {
    const item = /^\s+-\s+(.+?)\s*$/.exec(line);
    if (inCode && item) {
      out.code.push(item[1]);
      continue;
    }
    inCode = false;
    const kv = /^([a-z_]+):\s*(.*?)\s*$/.exec(line);
    if (!kv) continue;
    if (kv[1] === 'code') inCode = kv[2] === '';
    else if (kv[1] === 'id') out.id = kv[2];
    else if (kv[1] === 'status') out.status = kv[2];
  }
  return out;
}

describe('parseIndexFrontmatter', () => {
  it('reads id, status and the code list', () => {
    const fm = parseIndexFrontmatter(
      '---\nid: store\nstatus: implemented\ncode:\n  - a/b.ts\n  - c/d.ts\n---\n# Title\n',
    );
    expect(fm).toEqual({
      id: 'store',
      status: 'implemented',
      code: ['a/b.ts', 'c/d.ts'],
    });
  });

  it('returns null without a frontmatter block', () => {
    expect(parseIndexFrontmatter('# Title\n')).toBeNull();
  });

  it('stops the code list at the next key', () => {
    const fm = parseIndexFrontmatter('---\ncode:\n  - a.ts\nid: x\n---\n');
    expect(fm).toEqual({ id: 'x', code: ['a.ts'] });
  });
});

describe.each(VENDORS)(
  'api catalog index frontmatter — $vendor',
  ({ vendor, idFor, minIndexes }) => {
    const dir = join(REPO_ROOT, 'codebase', 'api-catalogs', vendor);
    const indexes = existsSync(dir)
      ? readdirSync(dir)
          .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
          .filter((f) => f !== 'README.md')
          .sort()
      : [];

    it('finds the catalog indexes (fail-loud, not silent-empty)', () => {
      expect(indexes.length).toBeGreaterThanOrEqual(minIndexes);
    });

    it.each(indexes)('%s has id, status and existing code paths', (file) => {
      const resource = file.replace(/\.md$/, '');
      const fm = parseIndexFrontmatter(readFileSync(join(dir, file), 'utf-8'));
      expect(fm).not.toBeNull();
      expect(fm?.id).toBe(idFor(resource));
      expect(fm?.status).toBeTruthy();
      if (fm?.status === 'implemented') {
        expect(fm.code.length).toBeGreaterThan(0);
      }
      const missing = (fm?.code ?? []).filter(
        (p) => !existsSync(join(REPO_ROOT, p)),
      );
      expect(missing).toEqual([]);
    });
  },
);
