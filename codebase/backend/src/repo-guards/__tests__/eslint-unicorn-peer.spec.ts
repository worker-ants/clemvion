import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRequire } from 'node:module';
import {
  parseGteFloor,
  parseCaretFloor,
  parseVersion,
  compareTriple,
  satisfiesFloor,
  type SemverTriple,
} from './eslint-unicorn-peer-guard';

// Guard: backend 의 `unicorn/catch-error-name` 이 실제로 발화하는지, 그리고 설치된
// `eslint-plugin-unicorn` 의 peer eslint range 가 backend 선언 eslint range 와 정합하는지.
//
// 배경 — dependabot `#1049`(`a4bc9fde3`) 가 backend 전용 devDependency `eslint-plugin-unicorn` 을
// `^56.0.1` → `^72.0.0`(16 major) 로 올렸다. `eslint.config.mjs` 의 unicorn 등록 블록 주석은
// "v57+ 는 eslint peer floor 가 backend 선언 floor(`^9.18`)를 넘는다" 는 pin 근거를 이미 적어
// 뒀지만 dependabot 은 그 주석을 볼 수 없다 — 값만 바뀌고 주석은 "^56" 인 채 남아 코드-문서가
// 어긋난 상태로 머지됐다(unmet peer `eslint@>=10.4`, 설치본 9.39.4). Actions 가 repo 레벨에서
// 꺼져 있어(harness-checks.yml 런 수 0) 아무 검증 없이 통과했다 — `#1047`(typescript 5→7) 과
// 정확히 같은 사고 클래스다. `#1058`(TS 롤백) 의 TEST WORKFLOW 로그를 사람이 읽고서야 뒤늦게
// 발견되어 `d30c473df` 가 되돌렸다.
//
// 직전 동일 클래스 사고(`#1047`)는 `typescript-toolchain-guard.ts`/`.test.ts` 형태의 자동 회귀
// 가드로 재발을 막았는데, 이번 unicorn 복원(`d30c473df`)은 그 패턴 없이 사람이 읽는 주석 +
// dependabot ignore(자체 재-bump 만 차단) + plan 문서의 1회성 수동 mutation 검증(prose 증거)
// 뿐이었다 — **사람이 직접 버전을 올리는 경로는 여전히 CI 게이트 없이 무방비**였다. 본 파일이
// 그 수동 검증을 상시 게이트로 승격한다.
//
// 왜 여기(backend jest)인가 — `eslint-plugin-unicorn`·`eslint.config.mjs` 둘 다 backend 전용
// devDependency/설정이다(frontend·channel-web-chat 은 이 플러그인을 쓰지 않는다). 형제 가드
// `codebase/frontend/src/lib/repo-guards/__tests__/typescript-toolchain.test.ts` 헤더와 같은
// 근거로 — GitHub Actions 가 repo 레벨에서 꺼져 있어 `.claude/tools/run-test.sh` → `cmd_unit` →
// `pnpm --filter backend test` 가 유일하게 실제로 도는 게이트이고, jest 는 `*.spec.ts` 를
// testRegex(`jest.config.ts`)로 자동 발견하므로 이 가드에는 지워질 수 있는 호출부가 없다.
//
// 파서·비교 순수 로직은 형제 모듈 `eslint-unicorn-peer-guard.ts`. 본 파일은 실측 대조(실제
// ESLint 실행 + 설치된 package.json 실측)와 합성 fixture 회귀만 담당한다.

const BACKEND_ROOT = path.resolve(__dirname, '../../..');
const FIXTURE_RELATIVE_PATH = path.join(
  'src',
  'repo-guards',
  '__tests__',
  'eslint-unicorn-peer-fixture.ts',
);
const ESLINT_BIN = path.join(BACKEND_ROOT, 'node_modules', '.bin', 'eslint');

// `require(...)` 리터럴 호출은 `@typescript-eslint/no-require-imports` 가 차단한다(정적 import 로
// 강제) — 여기서는 실측 대상이 정적으로 알 수 없는 package.json 이라 런타임 require 가 필요하므로
// 형제 가드 `typescript-toolchain-guard.ts`(`loadTypescriptFrom`)와 동일하게 `createRequire` 로
// 우회한다(변수명이 `require` 가 아니면 규칙이 잡지 않는다).
const req = createRequire(__filename);

/**
 * 설치된 패키지의 `package.json` 을 **파일 경로로** 읽는다.
 *
 * `req('<pkg>/package.json')` 을 쓰지 않는 이유(실측) — `eslint-plugin-unicorn@73` 은
 * `exports` 맵이 `{".": …}` 하나뿐이라 `./package.json` 서브패스가 **차단**된다
 * (`Cannot find module 'eslint-plugin-unicorn/package.json'`). 56.x 에는 그 제약이 없었고,
 * eslint 10 상향과 함께 56→73 으로 올리면서 드러났다. 즉 이 가드가 재는 대상(설치본의
 * peer range)은 그대로인데 **접근 경로만** 막힌 것이므로, 모듈 해소 대신 node_modules 경로를
 * 직접 읽어 계약을 유지한다. pnpm 은 `node_modules/<pkg>` 를 symlink 로 두므로 경로 접근이
 * 설치 실물을 가리킨다.
 */
function readInstalledPackageJson(pkgName: string): {
  version?: string;
  peerDependencies?: Record<string, string>;
} {
  const pkgPath = path.join(
    BACKEND_ROOT,
    'node_modules',
    pkgName,
    'package.json',
  );
  return JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as {
    version?: string;
    peerDependencies?: Record<string, string>;
  };
}

type LintMessage = { ruleId: string | null; messageId?: string };

/**
 * 실제 backend `eslint.config.mjs`(flat config) 로 `text` 를 린트해 메시지 배열을 돌려준다.
 *
 * `ESLint` API 대신 CLI 서브프로세스를 쓰는 이유(실측 확인됨) — flat config 는 ESM(`.mjs`)이라
 * ESLint 내부가 동적 `import()` 로 로드하는데, Jest 의 VM 샌드박스 안에서 이 동적 import 가
 * `--experimental-vm-modules` 없이는 "A dynamic import callback was invoked without
 * --experimental-vm-modules" 로 죽는다. 실제 게이트(`pnpm --filter backend lint`)는 평범한
 * Node 프로세스에서 CLI 로 돈다 — 서브프로세스로 그 경로를 그대로 재현하면 Jest VM 제약을
 * 완전히 벗어나면서 실제 게이트와 동일한 코드 경로(같은 바이너리·같은 config 탐색)를 검증한다.
 *
 * `--stdin-filename` 은 디스크에 실재하는 `eslint-unicorn-peer-fixture.ts` 를 가리켜야 한다 —
 * typescript-eslint 의 `projectService` 가 tsconfig 프로그램에 이미 포함된 파일만 해석하기
 * 때문이다(가상/미기록 경로는 "was not found by the project service" 로 거부됨, 실측 확인).
 * 실제로 린트되는 내용은 그 파일의 디스크 내용이 아니라 이 함수의 `text` 인자다.
 */
function lintFixtureText(text: string): LintMessage[] {
  let stdout: string;
  try {
    stdout = execFileSync(
      ESLINT_BIN,
      [
        '--stdin',
        '--stdin-filename',
        FIXTURE_RELATIVE_PATH,
        '--format',
        'json',
      ],
      { cwd: BACKEND_ROOT, input: text, encoding: 'utf8' },
    );
  } catch (err_) {
    // ESLint CLI 는 lint 에러가 있으면 비영(非零) exit code 를 낸다 — 이건 "실행 실패"가 아니라
    // "위반이 있다"는 정상 신호다(execFileSync 는 비영 exit 를 throw 로 표면화한다). stdout 은
    // 여전히 유효한 JSON. 바이너리 부재 등 진짜 실행 실패는 stdout 이 없으므로 그대로 던진다.
    const err = err_ as { stdout?: unknown };
    if (typeof err.stdout !== 'string') throw err_;
    stdout = err.stdout;
  }
  const parsed = JSON.parse(stdout) as { messages: LintMessage[] }[];
  return parsed[0]?.messages ?? [];
}

function unicornMessages(text: string): LintMessage[] {
  return lintFixtureText(text).filter(
    (m) => m.ruleId === 'unicorn/catch-error-name',
  );
}

describe('unicorn/catch-error-name 이 실제로 발화한다 (실측, eslint CLI 서브프로세스)', () => {
  it('catch 파라미터명이 `err` 가 아니면 위반 1건을 발화한다', () => {
    const bad = [
      'function useIt(): void {',
      '  try {',
      '    doSomething();',
      '  } catch (error) {',
      '    handle(error);',
      '  }',
      '}',
      '',
    ].join('\n');
    const messages = unicornMessages(bad);

    // vacuity 방지 — 룰이 조용히 꺼지면(preset 미등록·off 회귀) 이 배열이 비어 통과해 버린다.
    // 정확히 1건, 정확한 messageId 로 잡는다.
    expect(messages).toHaveLength(1);
    expect(messages[0]?.messageId).toBe('catch-error-name');
  });

  it('규약(`err`)을 지키면 위반 0건이다', () => {
    const good = [
      'function useIt(): void {',
      '  try {',
      '    doSomething();',
      '  } catch (err) {',
      '    handle(err);',
      '  }',
      '}',
      '',
    ].join('\n');
    expect(unicornMessages(good)).toEqual([]);
  });

  it('`^_` prefix 는 의도적 미사용 표식으로 면제된다', () => {
    const ignored = [
      'function useIt(): void {',
      '  try {',
      '    doSomething();',
      '  } catch (_error) {',
      '    // intentionally unused',
      '  }',
      '}',
      '',
    ].join('\n');
    expect(unicornMessages(ignored)).toEqual([]);
  });
});

describe('설치된 eslint-plugin-unicorn 의 peer eslint range 가 backend 선언과 정합한다 (실측)', () => {
  it('unicorn peerDependencies.eslint 가 backend 선언 eslint floor 를 넘지 않는다', () => {
    // 읽는 대상은 실제 node_modules 실측 — 값을 하드코딩하지 않는다(#1049 는 정확히 "값이
    // 바뀌었는데 주석/가드는 옛 값을 가정한다"는 사고였다).
    const unicornPkg = readInstalledPackageJson('eslint-plugin-unicorn');
    const unicornPeerRange = unicornPkg.peerDependencies?.eslint;
    // vacuity 방지 — peerDependencies.eslint 자체가 사라지면(패키지 구조 변경) 아래 비교가
    // 전부 통과해 버린다. 부재/파싱 불가는 fail-closed.
    expect(typeof unicornPeerRange).toBe('string');
    const unicornFloor = parseGteFloor(unicornPeerRange as string);
    // parseGteFloor 가 이 값을 해석하지 못하면(registry 표기가 '>=X.Y.Z' 형태에서 바뀌었다면)
    // 이 가드도 함께 갱신해야 한다 — null 을 다음 단언에 그대로 흘려 vacuous 하게 통과시키지
    // 않도록 여기서 먼저 끊는다.
    expect(unicornFloor).not.toBeNull();

    const backendPkg = req('../../../package.json') as {
      devDependencies?: Record<string, string>;
    };
    const backendEslintRange = backendPkg.devDependencies?.eslint;
    expect(typeof backendEslintRange).toBe('string');
    const backendFloor = parseCaretFloor(backendEslintRange as string);
    expect(backendFloor).not.toBeNull();

    // 핵심 단언 — backend 가 *선언한* eslint 최소 버전이 unicorn 의 peer 최소 요구를 만족해야
    // 한다. 이게 깨지면 "설치본은 우연히 통과하지만 다른 lockfile 조건에서는 unmet peer 가 될
    // 수 있는" 상태다 — plan 문서가 65.0.1(`>=9.38.0`) 대신 56.0.1 을 고른 바로 그 근거.
    expect(
      satisfiesFloor(
        backendFloor as SemverTriple,
        unicornFloor as SemverTriple,
      ),
    ).toBe(true);
  });

  it('설치된 eslint 실측 버전이 unicorn peer 요구를 실제로 만족한다 (unmet peer 재발 차단)', () => {
    const unicornPkg = readInstalledPackageJson('eslint-plugin-unicorn');
    const unicornFloor = parseGteFloor(
      unicornPkg.peerDependencies?.eslint ?? '',
    );
    expect(unicornFloor).not.toBeNull();

    // `#1049` 사고에서 실제로 깨진 지점 — `pnpm install` 이 unmet peer 를 경고로만 흘려서
    // 사람이 로그를 직접 읽어야만 발견됐다. 설치된 eslint 버전을 직접 실측해 그 사고를
    // 재현·차단한다.
    //
    // 2026-08-10 부터 `--strict-peer-dependencies` 가 CI install 에 들어갔다
    // (`.github/actions/pnpm-workspace/action.yml`). 이 테스트는 그래도 남긴다 —
    // 그쪽은 **설치 시점**의 미충족을, 이 테스트는 **매니페스트 floor 대 설치본**의
    // 어긋남을 본다. 축이 달라서 한쪽이 다른 쪽을 대체하지 않는다.
    const installedEslintVersion = (
      req('eslint/package.json') as { version: string }
    ).version;
    const installedTriple = parseVersion(installedEslintVersion);
    expect(installedTriple).not.toBeNull();

    expect(
      satisfiesFloor(
        installedTriple as SemverTriple,
        unicornFloor as SemverTriple,
      ),
    ).toBe(true);
  });
});

describe('parseGteFloor (합성)', () => {
  it('registry 가 실제로 쓰는 형태를 읽는다', () => {
    expect(parseGteFloor('>=8.56.0')).toEqual([8, 56, 0]);
    expect(parseGteFloor('>=10.4.0')).toEqual([10, 4, 0]);
    expect(parseGteFloor(' >=9.20.0 ')).toEqual([9, 20, 0]);
  });

  it('생략된 자리는 semver 관례대로 0 — `>=10.4` 는 `eslint-plugin-unicorn@66+` 의 실제 표기다', () => {
    // 회귀 고정: 이 케이스가 없던 동안 파서는 `>=10.4` 를 null 로 떨궜고, 56→73 상향에서
    // 가드 2건이 fail-closed 로 멈췄다. 형태(자릿수)가 커버리지의 축이다.
    expect(parseGteFloor('>=10.4')).toEqual([10, 4, 0]);
    expect(parseGteFloor('>=9.18')).toEqual([9, 18, 0]);
    expect(parseGteFloor('>=9')).toEqual([9, 0, 0]);
    expect(parseGteFloor(' >=10 ')).toEqual([10, 0, 0]);
  });

  it.each([
    '^9.18.0',
    '~9.18.0',
    '9.18.0',
    '',
    '>=9.18.0 <10.0.0',
    '>=',
    '>=x',
  ])('해석하지 않는 형태 %j 는 null (→ 호출부 fail-closed)', (bad) => {
    expect(parseGteFloor(bad)).toBeNull();
  });
});

describe('parseCaretFloor (합성)', () => {
  it('backend package.json 이 쓰는 caret range 형태를 읽는다', () => {
    expect(parseCaretFloor('^9.18.0')).toEqual([9, 18, 0]);
    expect(parseCaretFloor('^56.0.1')).toEqual([56, 0, 1]);
  });

  it.each(['9.18.0', '>=9.18.0', '~9.18.0', '^9', '^9.18', ''])(
    'caret 이 아닌 형태 %j 는 null',
    (bad) => {
      expect(parseCaretFloor(bad)).toBeNull();
    },
  );
});

describe('parseVersion (합성)', () => {
  it('설치본 실측 버전 문자열을 읽는다', () => {
    expect(parseVersion('9.39.4')).toEqual([9, 39, 4]);
  });

  it.each(['^9.39.4', '>=9.39.4', '9.39', '', 'latest'])(
    'range 표기 %j 는 거부한다 — 실측 버전만 받는다',
    (bad) => {
      expect(parseVersion(bad)).toBeNull();
    },
  );
});

describe('compareTriple / satisfiesFloor (합성)', () => {
  it('사전식으로 비교한다', () => {
    expect(compareTriple([9, 39, 4], [9, 18, 0])).toBeGreaterThan(0);
    expect(compareTriple([8, 56, 0], [9, 18, 0])).toBeLessThan(0);
    expect(compareTriple([9, 18, 0], [9, 18, 0])).toBe(0);
    // 자릿수가 다른 값이 사전식으로 뒤집히지 않는다(major 우선 비교).
    expect(compareTriple([10, 0, 0], [9, 99, 99])).toBeGreaterThan(0);
  });

  it('#1049 시나리오를 합성 값으로 재현 — 56.x 는 통과, 66+(72.x) 는 실패', () => {
    // 합성 fixture — **사고 당시(eslint ^9.18.0)** 의 선언값이다. 지금 backend 선언은
    // `^10.9.1` 이지만, 이 케이스가 고정하는 것은 "그때 왜 66+ 가 막혔는가" 라는 과거
    // 시나리오이므로 현재값으로 갱신하지 않는다(갱신하면 재현이 사라진다).
    const backendFloor: SemverTriple = [9, 18, 0];
    const unicorn56Peer: SemverTriple = [8, 56, 0]; // eslint-plugin-unicorn 56.x 의 실제 peer
    const unicorn72Peer: SemverTriple = [10, 4, 0]; // eslint-plugin-unicorn 66+ 의 실제 peer(#1049)

    expect(satisfiesFloor(backendFloor, unicorn56Peer)).toBe(true);
    expect(satisfiesFloor(backendFloor, unicorn72Peer)).toBe(false);
  });

  it('eslint 10 상향 후 상태 — 선언 ^10.9.1 은 unicorn 66+ 의 `>=10.4` 를 만족한다', () => {
    // 위 케이스의 짝. eslint 10 상향이 정확히 무엇을 풀었는지를 고정한다 — 선언 floor 가
    // 10.4 를 넘어서면서 66+ 가 처음으로 허용된다. 10.0.0 이 여전히 막히는 것도 함께 고정해
    // "major 만 올리면 된다" 는 오해를 차단한다(unicorn floor 는 minor 까지 본다).
    const unicorn73Peer: SemverTriple = [10, 4, 0];

    expect(satisfiesFloor([10, 9, 1], unicorn73Peer)).toBe(true);
    expect(satisfiesFloor([10, 0, 0], unicorn73Peer)).toBe(false);
  });
});
