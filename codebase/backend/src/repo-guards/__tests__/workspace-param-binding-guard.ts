// 컨트롤러가 워크스페이스 ID 를 **평범한 `@Param`** 으로 바인딩하는 자리를 찾는 가드 — 순수 로직.
//
// 소비처는 형제 파일 `workspace-param-binding.spec.ts`. 배경·근거는 그 파일 헤더에 있다.

import * as fs from 'node:fs';
import * as ts from 'typescript';

import {
  decoratorCallName,
  toPosixRelative,
} from '../../common/__test-utils__/source-scan';

/** 위반 한 건. */
export interface WorkspaceParamBindingViolation {
  /** `src` 기준 POSIX 상대경로. */
  readonly file: string;
  /** 핸들러 메서드 이름 — 줄 번호를 쓰지 않는 이유는 `source-scan.enclosingScopeName` 참조. */
  readonly method: string;
  /** 규칙에 걸린 이름 — 핸들러 파라미터 식별자이거나 `@Param('<name>')` 의 경로 이름. */
  readonly name: string;
}

/** 한 번의 스캔 결과 — 위반 목록과 **그 판정이 실제로 본 대상 수**를 함께 돌려준다. */
export interface WorkspaceParamBindingScan {
  readonly violations: readonly WorkspaceParamBindingViolation[];
  /**
   * 판정 대상이 된 `@Param` 데코레이터 총수. vacuity floor 가 본다 — 경로가 어긋나 0건을 스캔하면
   * "위반 0" 이 아무것도 검사하지 않고 참이 된다. 위반과 **같은 순회에서** 센다
   * (`param-uuid-pipe-guard.ts` 가 별 함수로 다시 세다 지적받은 자리와 같은 이유).
   */
  readonly paramBindings: number;
  /**
   * `@WorkspaceParam(...)` 데코레이터 총수. 이 가드가 금지하는 것의 **대체재**가 실제로 쓰이는지 —
   * 0 이면 스캔이 컨트롤러를 못 읽었거나 대체재가 통째로 사라진 것이다.
   */
  readonly workspaceParamBindings: number;
}

/**
 * 워크스페이스 ID 를 담는 이름으로 본다 — `workspaceId` 이거나 `WorkspaceId` 로 끝나는 이름
 * (`targetWorkspaceId` 등). `workspaceIds` 처럼 뒤에 더 붙으면 아니다.
 *
 * 이름이 규칙 밖(`id` 등)이면 못 본다 — 이 가드의 알려진 한계다(`spec/data-flow/12-workspace.md`
 * §Rationale "경로 파라미터 워크스페이스도 가드가 본다").
 */
function isWorkspaceIdName(name: string): boolean {
  return name === 'workspaceId' || name.endsWith('WorkspaceId');
}

/**
 * 파라미터가 바인딩하는 이름들 — 식별자면 그 이름, 구조분해(`@Param() { workspaceId }`)면 꺼낸
 * 프로퍼티 이름과 지역 이름 모두.
 */
function boundNames(name: ts.BindingName): string[] {
  if (ts.isIdentifier(name)) return [name.text];
  const out: string[] = [];
  for (const element of name.elements) {
    if (ts.isOmittedExpression(element)) continue;
    if (element.propertyName && ts.isIdentifier(element.propertyName)) {
      out.push(element.propertyName.text);
    }
    out.push(...boundNames(element.name));
  }
  return out;
}

/** 핸들러 **하나**를 판정한다 — 위반과 두 카운트를 같은 루프에서 낸다. */
function scanMethod(
  method: ts.MethodDeclaration,
  sf: ts.SourceFile,
  rel: string,
): {
  violations: WorkspaceParamBindingViolation[];
  paramBindings: number;
  workspaceParamBindings: number;
} {
  const methodName = method.name.getText(sf);
  const violations: WorkspaceParamBindingViolation[] = [];
  let paramBindings = 0;
  let workspaceParamBindings = 0;

  for (const parameter of method.parameters) {
    for (const d of ts.getDecorators(parameter) ?? []) {
      const callee = decoratorCallName(d, sf);
      if (callee === 'WorkspaceParam') workspaceParamBindings++;
      if (callee !== 'Param') continue;
      paramBindings++;

      const names = boundNames(parameter.name);
      const first = (d.expression as ts.CallExpression).arguments[0];
      if (first && ts.isStringLiteralLike(first)) names.push(first.text);
      for (const name of new Set(names)) {
        if (isWorkspaceIdName(name)) {
          violations.push({ file: rel, method: methodName, name });
        }
      }
    }
  }
  return { violations, paramBindings, workspaceParamBindings };
}

/**
 * `*.controller.ts` 들에서 **워크스페이스 ID 를 `@Param` 으로 받는 핸들러 파라미터**를 찾는다.
 *
 * 판정: `@Param(...)` 이 붙은 파라미터의 식별자 이름, 또는 `@Param('<name>')` 의 경로 이름이
 * `workspaceId` 이거나 `WorkspaceId` 로 끝나면 위반. **허용목록은 없다**(fail-closed) — 경로로
 * 워크스페이스를 받는 자리는 전부 `@WorkspaceParam('<name>')` 이어야 `RolesGuard` 가 그 값을 본다.
 *
 * **`@Param` 식별은 데코레이터 호출 이름의 텍스트 비교다** — 별칭 import(`Param as P`)면 미탐이다.
 * 저장소 실측상 별칭 0건이고, 형제 가드 `param-uuid-pipe-guard.ts` 가 같은 한계를 같은 이유로 둔다.
 *
 * @param files 스캔 대상 절대경로 목록. 호출자가 `collectTsFiles` 로 모은다.
 * @param srcRoot 보고 경로를 상대화할 기준.
 */
export function scanWorkspaceParamBindings(
  files: readonly string[],
  srcRoot: string,
): WorkspaceParamBindingScan {
  const violations: WorkspaceParamBindingViolation[] = [];
  let paramBindings = 0;
  let workspaceParamBindings = 0;
  for (const file of files) {
    if (!file.endsWith('.controller.ts')) continue;
    const sf = ts.createSourceFile(
      file,
      fs.readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const rel = toPosixRelative(srcRoot, file);
    const visit = (node: ts.Node): void => {
      if (ts.isMethodDeclaration(node)) {
        const found = scanMethod(node, sf, rel);
        violations.push(...found.violations);
        paramBindings += found.paramBindings;
        workspaceParamBindings += found.workspaceParamBindings;
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return {
    violations: violations.sort(
      (a, b) =>
        a.file.localeCompare(b.file) ||
        a.method.localeCompare(b.method) ||
        a.name.localeCompare(b.name),
    ),
    paramBindings,
    workspaceParamBindings,
  };
}
