import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * dry-run 재실행 임시 가드(CLE-T-8BX1HK)의 분류 등록부.
 *
 * `AgentToolProvider` 구현체마다 `ctx.dryRun` 을 각자 해석한다. 새 provider 가 이 규약을
 * 잊어도 컴파일과 provider 단위 테스트는 통과하고, 그러면 dry-run 재실행이 외부 MCP
 * `tools/call` 이나 쇼핑몰 쓰기를 그대로 보낸다. 그래서 provider 가 늘 때 분류를 정하게
 * 이 테스트가 막는다. 가드한 provider 는 소스에 `ctx.dryRun` 분기가, 짝 spec 에 `dryRun: true`
 * 케이스가 있어야 한다. 가드하지 않는 provider 는 면제 사유를 여기에 적는다.
 *
 * 부수효과 분류를 provider 밖의 한 곳에서 판정하는 구조 개편은 후속 CLE-T-G62XJS 몫이다.
 */
const DRY_RUN_GUARDED = [
  'McpToolProvider',
  'Cafe24McpToolProvider',
  'MakeshopMcpToolProvider',
] as const;

const DRY_RUN_EXEMPT: Record<string, string> = {
  KbToolProvider:
    '지식 베이스 검색(읽기 전용). 외부 시스템에 쓰지 않고 워크스페이스 안 데이터만 읽는다.',
  RenderToolProvider:
    '프레젠테이션 노드 렌더링(UI 출력). 외부 시스템을 부르지 않는다.',
};

const PROVIDER_FILE = /-tool-provider\.ts$/;
const IMPLEMENTS_PROVIDER =
  /\bclass\s+(\w+)[^{]*\bimplements\b[^{]*\bAgentToolProvider\b/g;

function discoverProviders(): Map<string, string> {
  const found = new Map<string, string>();
  for (const file of readdirSync(__dirname).filter((f) =>
    PROVIDER_FILE.test(f),
  )) {
    const source = readFileSync(join(__dirname, file), 'utf8');
    for (const match of source.matchAll(IMPLEMENTS_PROVIDER)) {
      found.set(match[1], file);
    }
  }
  return found;
}

describe('AgentToolProvider dry-run 가드 분류', () => {
  const providers = discoverProviders();

  it('모든 provider 구현체가 가드 또는 면제로 분류돼 있다', () => {
    const classified = [
      ...DRY_RUN_GUARDED,
      ...Object.keys(DRY_RUN_EXEMPT),
    ].sort();

    // 새 provider 를 만들었다면: 외부 시스템을 부르거나 바꾸는 경우 ctx.dryRun 일 때
    // buildDryRunSkippedToolResult 로 건너뛰고(짝 spec 에 케이스를 더한다) 위 DRY_RUN_GUARDED 에
    // 올린다. 읽기 전용이면 DRY_RUN_EXEMPT 에 사유와 함께 올린다.
    expect([...providers.keys()].sort()).toEqual(classified);
  });

  it('면제 사유가 비어 있지 않다', () => {
    for (const [name, reason] of Object.entries(DRY_RUN_EXEMPT)) {
      expect({ name, hasReason: reason.trim().length > 0 }).toEqual({
        name,
        hasReason: true,
      });
    }
  });

  it.each([...DRY_RUN_GUARDED])(
    '%s 는 ctx.dryRun 분기와 dry-run 단위 테스트를 둔다',
    (name) => {
      const file = providers.get(name);
      expect(file).toBeDefined();
      const source = readFileSync(join(__dirname, file as string), 'utf8');
      const spec = readFileSync(
        join(__dirname, (file as string).replace(/\.ts$/, '.spec.ts')),
        'utf8',
      );

      expect(source).toMatch(/\bctx\.dryRun\b/);
      expect(source).toContain('buildDryRunSkippedToolResult');
      expect(spec).toMatch(/\bdryRun:\s*true\b/);
    },
  );
});
