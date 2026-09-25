import { describe, it, expect } from '@jest/globals';
import * as path from 'node:path';

import { collectTsFiles } from '../../common/__test-utils__/source-scan';
import { scanWorkspaceParamBindings } from './workspace-param-binding-guard';

/**
 * 컨트롤러가 워크스페이스 ID 를 **평범한 `@Param`** 으로 바인딩하지 못하게 한다.
 *
 * ## 왜 이 가드인가 — 데코레이터만으로는 74번째 라우트가 안 닫힌다
 *
 * `RolesGuard` 는 경로로 받은 워크스페이스를 `@WorkspaceParam('<name>')` 으로만 알아본다
 * (`ROUTE_ARGS_METADATA` 의 팩토리 identity). 그런데 그것도 라우트마다 쓰는 데코레이터라, 다음 경로
 * 라우트가 평범한 `@Param('id') workspaceId` 로 받으면 가드는 그 값을 보지 못하고 — 2026-09-25 전
 * 15곳이 그랬듯 — 인가가 서비스 계층 검사에만 남는다. 그 모양을 CI 에서 막는 것이 이 가드다.
 * 근거: `spec/data-flow/12-workspace.md` §Rationale "경로 파라미터 워크스페이스도 가드가 본다".
 *
 * ## 판정 — 이름으로 가른다, 허용목록은 없다
 *
 * `@Param(...)` 이 붙은 파라미터의 식별자 이름이나 `@Param('<name>')` 의 경로 이름이 `workspaceId`
 * 이거나 `WorkspaceId` 로 끝나면 실패다. 예외를 둘 자리가 없다 — 경로로 워크스페이스를 받는 곳은
 * 전부 `@WorkspaceParam` 이어야 한다. **이름이 규칙 밖(`id` 등)이면 못 본다** — 이 가드의 한계이고,
 * spec 이 같은 문장으로 적어 두었다.
 *
 * ## 이웃 가드와의 경계
 *
 * - `workspace-roles-attachment.spec.ts` — **특정 핸들러**에 `@Roles()` 메타데이터가 붙어 있는지를
 *   reflection 으로 고정한다(목록형). 이 가드는 **모든 컨트롤러**의 바인딩 **이름 패턴**을 금지한다.
 * - `param-uuid-pipe.spec.ts` — id-형 경로 파라미터가 `ParseUUIDPipe` · `@ApiParam({format:'uuid'})`
 *   두 축을 갖췄는지 센다. `@WorkspaceParam` 은 파이프를 내장해 그쪽의 파이프 축을 구조적으로 만족한다.
 */
describe('워크스페이스 경로 파라미터 바인딩 가드', () => {
  const SRC_ROOT = path.resolve(__dirname, '..', '..');
  // `param-uuid-pipe.spec.ts` 와 같은 스캔 루트 — `*.controller.ts` 는 전부 `modules/` 아래에 있고,
  // 이 파일의 대조군 fixture 는 `repo-guards/` 아래에 있다.
  const SCAN_ROOT = path.join(SRC_ROOT, 'modules');
  const files = collectTsFiles(SCAN_ROOT);
  const scan = scanWorkspaceParamBindings(files, SRC_ROOT);

  it('스캔 대상이 비어 있지 않다 (vacuous 방지)', () => {
    const controllers = files.filter((f) => f.endsWith('.controller.ts'));
    expect(controllers.length).toBeGreaterThan(30);
    // 파일은 있는데 `@Param` 을 하나도 못 읽는 경우(파서 오작동)도 같은 공허함이다.
    expect(scan.paramBindings).toBeGreaterThan(100);
  });

  it('대체재 @WorkspaceParam 이 실제로 쓰인다 — 0 이면 금지만 남고 경로가 사라진 것이다', () => {
    expect(scan.workspaceParamBindings).toBeGreaterThan(0);
  });

  it('워크스페이스 ID 를 @Param 으로 받는 핸들러가 없다 — @WorkspaceParam 을 쓸 것', () => {
    // jest 의 `expect` 는 메시지 인자를 받지 않으므로 무엇을 고칠지는 비교 대상 자체가 말하게 한다.
    expect(
      scan.violations.map(
        (v) =>
          `${v.file} ${v.method}() — '${v.name}' 을 @Param 으로 받는다. @WorkspaceParam('<경로 이름>') 으로 바꿀 것`,
      ),
    ).toEqual([]);
  });

  describe('[대조군] 판정 함수가 실제로 가른다', () => {
    const FIXTURE_DIR = path.join(
      __dirname,
      'fixtures',
      'workspace-param-binding',
    );
    const fixtureScan = scanWorkspaceParamBindings(
      collectTsFiles(FIXTURE_DIR),
      FIXTURE_DIR,
    );
    const found = fixtureScan.violations.map((v) => `${v.method}:${v.name}`);

    it('네 형태의 바인딩을 각각 잡는다 — 식별자 · 접미 · 경로 이름 · 구조분해', () => {
      expect(found.sort()).toEqual([
        'destructured:workspaceId',
        'plainId:workspaceId',
        'routeNamed:workspaceId',
        'suffixed:targetWorkspaceId',
      ]);
    });

    it('대체재 · 헤더 컨텍스트 · 다른 id · 복수형 · 데코레이터 없는 파라미터는 안 잡는다', () => {
      const clean = [
        'bound',
        'headerContext',
        'otherId',
        'plural',
        'undecorated',
      ];
      expect(
        fixtureScan.violations.filter((v) => clean.includes(v.method)),
      ).toEqual([]);
    });

    it('AST 로 읽는다 — 주석 · 문자열 속 선언 모양은 안 센다', () => {
      expect(
        fixtureScan.violations.filter((v) => v.name.startsWith('decoy')),
      ).toEqual([]);
    });

    it('두 카운트가 fixture 의 데코레이터 수와 일치한다', () => {
      // `@Param` 여섯(plainId · suffixed · routeNamed · destructured · otherId · plural) ·
      // `@WorkspaceParam` 하나(bound). 카운터가 판정과 같은 루프에서 나온다는 것의 관측.
      expect(fixtureScan.paramBindings).toBe(6);
      expect(fixtureScan.workspaceParamBindings).toBe(1);
    });
  });
});
