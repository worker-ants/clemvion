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
