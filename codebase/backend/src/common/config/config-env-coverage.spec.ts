import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * refactor M-6 — `.env.example` ↔ ConfigService namespace 키 전수 대조 가드.
 *
 * `.env.example` 헤더가 "the single reference for every variable the backend reads" 를
 * 약속하므로, `common/config/*.config.ts` 가 참조하는 모든 `process.env.<NAME>` 가
 * `.env.example` 에 (활성 또는 주석으로) 문서화돼 있는지 강제한다. 신규 config 키를
 * 추가하면서 `.env.example` 갱신을 빠뜨리는 회귀를 빌드 단계에서 차단한다.
 *
 * NODE_ENV 등 런타임/배포 표준 변수는 framework-level 이라 예외 목록으로 둔다.
 */
const ENV_EXAMPLE_PATH = join(__dirname, '..', '..', '..', '.env.example');
const CONFIG_DIR = __dirname;

/** framework/런타임 표준 — `.env.example` 문서화 의무 면제. */
const EXEMPT_ENV_VARS = new Set(['NODE_ENV', 'TZ']);

function collectConfigEnvVars(): Map<string, string[]> {
  const byVar = new Map<string, string[]>();
  const files = readdirSync(CONFIG_DIR).filter(
    (f) => f.endsWith('.config.ts') && !f.endsWith('.spec.ts'),
  );
  for (const file of files) {
    const src = readFileSync(join(CONFIG_DIR, file), 'utf8');
    // process.env.NAME  /  process.env['NAME']  /  process.env["NAME"]
    const re = /process\.env(?:\.([A-Z0-9_]+)|\[['"]([A-Z0-9_]+)['"]\])/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      const name = m[1] ?? m[2];
      if (!name || EXEMPT_ENV_VARS.has(name)) continue;
      const list = byVar.get(name) ?? [];
      if (!list.includes(file)) list.push(file);
      byVar.set(name, list);
    }
  }
  return byVar;
}

describe('config ↔ .env.example coverage (refactor M-6)', () => {
  const envExample = readFileSync(ENV_EXAMPLE_PATH, 'utf8');
  const configEnvVars = collectConfigEnvVars();

  it('collects at least the M-6 namespaces 의 키 (sanity)', () => {
    for (const expected of [
      'CAFE24_CLIENT_ID',
      'GOOGLE_CLIENT_ID',
      'GITHUB_CLIENT_SECRET',
      'OAUTH_STUB_MODE',
      'MCP_MAX_CONCURRENT_CONNECTIONS',
      'MCP_ALLOW_INSECURE_URL',
      'INTERACTION_JWT_SECRET',
      'LLM_STUB_MODE',
    ]) {
      expect(configEnvVars.has(expected)).toBe(true);
    }
  });

  it('모든 config `process.env.<NAME>` 가 .env.example 에 문서화돼 있다', () => {
    const missing: string[] = [];
    for (const [name, files] of configEnvVars) {
      // 활성(`NAME=`) 또는 주석(`# NAME=` / `# NAME `) 어떤 형태든 whole-word 로 언급되면 통과.
      const wordRe = new RegExp(`(^|[^A-Z0-9_])${name}([^A-Z0-9_]|$)`, 'm');
      if (!wordRe.test(envExample)) {
        missing.push(`${name} (in ${files.join(', ')})`);
      }
    }
    expect(missing).toEqual([]);
  });
});
