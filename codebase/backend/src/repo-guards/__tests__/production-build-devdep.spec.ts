import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { toPosixRelative } from '../../common/__test-utils__/source-scan';
import {
  collectRuntimeModuleSpecifiers,
  findDevDepLeaks,
  packageRootOf,
  resolveBuildFileNames,
} from './production-build-devdep-guard';

/**
 * **devDependency 가 프로덕션 번들로 새지 않는다** (`04_20_10` testing W1).
 *
 * `masked-reject-callers-guard` 를 AST 로 옮기면서 `src/` 하위 파일이 `typescript` 를
 * import 하게 됐다. 그런데 `typescript` 는 **devDependency** 이고 `tsconfig.build.json` 의
 * 제외 패턴은 spec 파일만 겨냥해서 `*-guard.ts` 가 걸리지 않는다 — 즉 `dist` 의
 * repo-guards 는 **이미 나가고 있었고**(선존), 거기에 `require("typescript")` 가 얹히면
 * devDependency 를 설치하지 않는 프로덕션에서 터진다.
 *
 * repo-guards 를 빌드에서 제외해 막았지만, 그 보장의 근거는 **개발 중 클린 빌드
 * 한 번**뿐이었다. 리뷰어 지적 그대로다 — 제외 항목이 나중에 좁혀지거나 지워져도 CI 는
 * 그냥 통과한다.
 *
 * > 이 PR 이 내내 고쳐온 형태다: **문서·수동 확인은 보장을 강제하지 못한다.** 재발이 멎은
 * > 지점은 늘 산출물이었다. 이 가드가 그 산출물이다.
 *
 * 좁게 "`repo-guards` 가 빌드에서 빠졌나" 만 묻지 않고 **실제로 지키고 싶은 불변식**
 * ("빌드 대상 중 어느 파일도 devDependency 를 끌어오지 않는다")을 묻는다 — 다음에 다른
 * 파일이 다른 devDependency 를 끌어와도 같은 자리에서 잡힌다.
 */
describe('프로덕션 빌드 devDependency 누출', () => {
  const backendDir = path.resolve(__dirname, '../../..');

  /**
   * **먼저 vacuous 방지.** `tsconfig.build.json` 경로가 틀리거나 파싱이 실패해 파일 목록이
   * 비면 아래 두 단언은 **무엇도 검사하지 않고 통과**한다. 이 저장소가 반복해 겪은 형태라
   * 하한을 먼저 못박는다.
   */
  it('[캐너리] 빌드 대상 파일 목록이 비어 있지 않다', () => {
    const files = resolveBuildFileNames(backendDir);
    // 하한 500 의 근거: 도입 시점 실측 **805 파일**. 정확값을 박으면 파일이 하나 늘 때마다
    // 깨지므로 여유를 두되, "설정이 깨져 목록이 비었다" 와는 확실히 갈리는 값이어야 한다.
    // 실측이 이 아래로 떨어지면 파일이 준 게 아니라 **설정 해석이 고장난 것**을 의심할 것.
    expect(files.length).toBeGreaterThan(500);
    expect(files.some((f) => f.endsWith('/src/main.ts'))).toBe(true);
  });

  it('빌드 대상 중 devDependency 를 끌어오는 파일이 없다', () => {
    // 어느 파일이 어느 패키지를 끌어오는지 단언 메시지에 드러나야 진단이 된다.
    expect(findDevDepLeaks(backendDir)).toEqual([]);
  });

  /**
   * 위 불변식이 성립하는 **이유** 중 하나를 따로 고정한다 — repo-guards 는 테스트 전용이라
   * 애초에 빌드 대상이 아니어야 한다. 이게 깨지면 위 단언도 곧 깨지지만, 원인이 여기라는
   * 것이 실패 메시지에 바로 드러난다.
   */
  it('repo-guards 는 빌드 대상이 아니다', () => {
    const inBuild = resolveBuildFileNames(backendDir)
      .filter((f) => f.includes(`${path.sep}repo-guards${path.sep}`))
      .map((f) => toPosixRelative(backendDir, f));
    expect(inBuild).toEqual([]);
  });

  /**
   * **`findDevDepLeaks` 가 진짜 누출을 지목하는가** — 배선 전체(설정 해석 → 파일 순회 →
   * package.json 분류)를 한 번에 건다. 아래 단위 캐너리들은 스캐너와 분류기를 각각 재지만,
   * 그 둘을 잇는 함수가 조용히 `[]` 를 뱉어도 잡지 못한다. 형제 가드가 정확히 이 갭에
   * 당했다(`02_04_38` W2: 제외 필터를 무력화해도 전부 GREEN).
   *
   * 임시 디렉터리에 **최소 backend** 를 세워 실제 누출과 대조군을 함께 넣는다.
   */
  it('[캐너리] 실제 누출을 지목한다 (합성 fixture)', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'devdep-guard-'));
    try {
      fs.writeFileSync(
        path.join(tmp, 'package.json'),
        JSON.stringify({
          dependencies: { '@nestjs/common': '1.0.0' },
          devDependencies: { typescript: '5.9.3', jest: '29.0.0' },
        }),
        'utf8',
      );
      fs.writeFileSync(
        path.join(tmp, 'tsconfig.build.json'),
        JSON.stringify({ include: ['src/**/*'], exclude: ['excluded'] }),
        'utf8',
      );
      fs.mkdirSync(path.join(tmp, 'src'));
      fs.writeFileSync(
        path.join(tmp, 'src', 'leaky.ts'),
        "import * as ts from 'typescript';\nexport const a = ts;\n",
        'utf8',
      );
      // 대조군 셋 — prod 의존 · 타입 전용 · 상대 경로. 어느 것도 누출이 아니다.
      fs.writeFileSync(
        path.join(tmp, 'src', 'clean.ts'),
        [
          "import { Injectable } from '@nestjs/common';",
          "import type { Node } from 'typescript';",
          "import { x } from './leaky';",
          'export const b = [Injectable, x] as unknown as Node;',
        ].join('\n'),
        'utf8',
      );

      expect(findDevDepLeaks(tmp)).toEqual([
        { file: 'src/leaky.ts', pkg: 'typescript' },
      ]);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  /**
   * **가드가 실제로 탐지하는가.** 앞의 단언들은 *"누출이 없다"* 만 확인하므로, 스캐너가
   * 조용히 아무것도 못 보게 돼도 전부 GREEN 이다 — 형제 가드에서 실제로 겪은 실패다.
   *
   * 모듈 해석이 일어나는 네 자리를 각각 고정한다. 형태를 하나씩 덧대다 네 라운드를 쓴
   * 전례가 있어(정규식 → AST 전환) 처음부터 전수로 세운다.
   */
  it.each([
    ['import from', "import * as ts from 'typescript';", ['typescript']],
    ['export from', "export { x } from 'typescript';", ['typescript']],
    ['require', "const ts = require('typescript');", ['typescript']],
    ['import =', "import ts = require('typescript');", ['typescript']],
    ['동적 import', "const ts = await import('typescript');", ['typescript']],
    ['scoped', "import x from '@nestjs/common';", ['@nestjs/common']],
    ['서브경로', "import x from 'typescript/lib/tsc';", ['typescript/lib/tsc']],
  ])('[캐너리] %s 형태의 모듈 참조를 수집한다', (_form, source, expected) => {
    expect(collectRuntimeModuleSpecifiers(source)).toEqual(expected);
  });

  /**
   * **타입 전용 import 는 세지 않는다** — 컴파일 시 완전히 지워져 산출물에 `require` 를
   * 남기지 않는다. 세면 오탐이고, 오탐이 나면 다음 사람이 가드를 약화시킨다.
   */
  it.each([
    ['import type', "import type { Node } from 'typescript';"],
    ['export type', "export type { Node } from 'typescript';"],
  ])('[캐너리] %s 는 런타임 참조로 세지 않는다', (_form, source) => {
    expect(collectRuntimeModuleSpecifiers(source)).toEqual([]);
  });

  it.each([
    ['상대 경로', './x', null],
    ['상위 상대 경로', '../utils/y', null],
    ['node 내장', 'node:fs', null],
    ['일반 패키지', 'typescript', 'typescript'],
    ['서브경로', 'typescript/lib/tsc', 'typescript'],
    ['scoped', '@nestjs/common', '@nestjs/common'],
    ['scoped 서브경로', '@nestjs/common/pipes', '@nestjs/common'],
  ])('[캐너리] packageRootOf(%s)', (_kind, specifier, expected) => {
    expect(packageRootOf(specifier)).toBe(expected);
  });
});
