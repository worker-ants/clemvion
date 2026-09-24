import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { v4 as uuidv4 } from 'uuid';

// Guard: jest 가 ESM-only 의존성을 **네이티브로** 로드하는 상태가 유지되는지.
//
// 배경 — 이 저장소는 한때 `transformIgnorePatterns` 에 손으로 유지하는 허용목록을 두고
// ESM 패키지를 ts-jest 로 CJS 변환해 먹였다. 그 레버로는 `@nestjs/typeorm@12` 를 넘지
// 못한다 — `dist/common/typeorm-compat.js` 가 `import.meta.url` 을 쓰는데 그것은 CJS 로
// downlevel 이 **원리적으로 불가**하기 때문이다. 대신 jest 를
// `node --experimental-vm-modules` 아래에서 돌리고 허용목록을 걷었다.
//
// **그 둘은 한 쌍이고, 어느 쪽을 되돌려도 깨진다** — 실측한 두 방향:
//   - 플래그만 제거  → `Must use import to load ES Module: …/uuid@13.0.2/…`
//   - 허용목록 복원  → `ReferenceError: exports is not defined`
//     (`type: module` 인 패키지를 ts-jest 가 CJS 로 바꿔 놓는데 vm-modules 모드의 jest 는
//      그 파일을 ESM 으로 평가한다)
//
// 그래서 **아래 파일 맨 위의 `import … from 'uuid'` 자체가 트립와이어다.** 두 방향 어느
// 쪽이든 이 스펙은 로드 단계에서 죽는다. 종전에는 이 불변식을 `uuid`·`otplib`·`p-limit` 를
// 쓰는 비즈니스 스펙들이 **우연히** 지키고 있었고, 리팩터로 그 사용이 사라지면 아무도
// 지키지 않게 된다(`review/code/2026/09/24/14_24_10` INFO 12). 여기서 이름을 붙여 고정한다.
describe('repo-guard: ESM-only 의존성 네이티브 로드', () => {
  const requireFromHere = createRequire(__filename);

  // 공허성 가드. canary 가 언젠가 CJS 로 돌아가면 아래 로드 테스트는 **아무것도 지키지
  // 않으면서 초록**이 된다. 그 순간을 침묵시키지 않고 여기서 실패시켜, 다음 사람이
  // 다른 ESM-only 패키지로 canary 를 갈아 끼우게 한다.
  it('canary(`uuid`)가 여전히 ESM-only 다', () => {
    const pkg = requireFromHere('uuid/package.json') as { type?: string };
    expect(pkg.type).toBe('module');
  });

  it('그 패키지를 변환 없이 로드해 실제로 호출할 수 있다', () => {
    expect(uuidv4()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  // 위 두 테스트는 **단위 설정**(`jest.config.ts`)만 행사한다 — 이 스펙이 그 설정으로
  // 돌기 때문이다. e2e 설정은 별도 파일이고 한때 **서로 어긋난** 허용목록을 갖고 있었다
  // (단위: uuid|p-limit|yocto-queue|otplib|@otplib|@scure|@noble / e2e: uuid|p-limit|
  // yocto-queue). 그 발산이 재발하는 것만 여기서 정적으로 막는다 — 행동 검증이 아니라
  // **설정 대조**라는 점을 분명히 해 둔다.
  // 플래그는 `jest.config.ts` 가 아니라 **npm script 문자열**에만 산다 — 즉 jest 를 띄우는
  // script 가 다섯 갈래로 갈려 있고 각자가 접두어를 복제한다. 그 텍스트를 지키는 것이
  // 아무것도 없어서 `test:debug` 는 2026-03-30 scaffold 이후 **깨진 채로 방치**됐다:
  // `node_modules/.bin/jest`(= `#!/bin/sh` 셸 shim)를 `node` 에 넘겨 즉시
  // `SyntaxError: missing ) after argument list` 였다.
  //
  // 왜 아무도 몰랐나 — `test:cov` · `test:watch` · `test:debug` 는 **CI · Makefile ·
  // `.claude/test-stages.sh` · docker-compose 어디서도 실행되지 않는다**(실측 grep 0건).
  // 자동화가 밟지 않는 자리라 사람이 우연히 부딪칠 때까지 조용하다. 그래서 행동 검증이
  // 아니라 **텍스트 정합**으로 막는다.
  //
  // **이 가드가 덮지 못하는 것**: 플래그는 CLI 인자라 이 다섯 문자열에만 존재한다. 그래서
  // script 를 우회하는 호출(IDE 테스트 러너, `npx jest` 직접 실행)은 불변식 **밖**이고
  // 거기서는 여전히 `Must use import to load ES Module` 을 만난다. CI·e2e 진입점은 전부
  // script 를 경유하므로 실측상 안전하다 — 보증의 경계를 여기 적어 둔다.
  it('jest 를 띄우는 script 전부가 같은 플래그·진입점을 쓴다', () => {
    const pkgPath = path.resolve(__dirname, '../../../package.json');
    const scripts = (
      JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as {
        scripts: Record<string, string>;
      }
    ).scripts;

    const jestScripts = Object.entries(scripts).filter(([, cmd]) =>
      cmd.includes('jest'),
    );

    // 명단을 못 박는다. script 가 늘거나 줄면 **이 가드가 무엇을 덮는지** 다시 보게 한다 —
    // 새 script 가 조용히 접두어 없이 추가되는 것이 정확히 이 가드가 막으려는 것이다.
    expect(jestScripts.map(([name]) => name).sort()).toEqual([
      'test',
      'test:cov',
      'test:debug',
      'test:e2e',
      'test:watch',
    ]);

    for (const [name, cmd] of jestScripts) {
      expect(`${name}: ${cmd}`).toContain('--experimental-vm-modules');
      expect(`${name}: ${cmd}`).toContain('./node_modules/jest/bin/jest.js');
    }
  });

  it('e2e 설정도 `transformIgnorePatterns` 를 기본값으로 둔다', () => {
    const e2eConfigPath = path.resolve(
      __dirname,
      '../../../test/jest-e2e.json',
    );
    const e2eConfig = JSON.parse(fs.readFileSync(e2eConfigPath, 'utf8')) as {
      transformIgnorePatterns?: unknown;
    };
    expect(e2eConfig.transformIgnorePatterns).toEqual(['/node_modules/']);
  });
});
