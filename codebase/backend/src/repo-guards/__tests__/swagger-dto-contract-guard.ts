// Swagger DTO 선언(`@ApiProperty`/`@ApiPropertyOptional`)이 TS 타입과 같은 말을 하는지 —
// 스캔·판정 순수 로직.
//
// 소비처는 형제 파일 `swagger-dto-contract.spec.ts`. 배경·근거는 그 파일 헤더에 있다.
// 파서 순수 로직과 소비 spec 을 분리하는 규약은 형제 가드
// `production-build-devdep-guard.ts` · `masked-reject-callers-guard.ts` 와 동일하다.
import * as fs from 'node:fs';

import * as ts from 'typescript';
import { toPosixRelative } from '../../common/__test-utils__/source-scan';

/**
 * ## 왜 정규식이 아니라 AST 인가 — 정규식으로 세 번 틀렸다
 *
 * 2026-09-04 에 이 축을 정규식으로 먼저 셌고, 정본 파서로 다시 세니 **버킷 5개가
 * 달랐다**. 세 가지 형태로 틀렸다:
 *
 * 1. **객체 리터럴 타입 안의 `;`** — `lastError?: { code?: string; ... } | null` 에서
 *    `[^;=]+?` 가 첫 `;` 에 멈춰 타입이 `{ code?: string` 으로 잘렸다. 그러면 `| null` 이
 *    사라져 **일치하는 필드가 불일치로** 보고됐다.
 * 2. **데코레이터 인자 안의 `)`** — `@ApiProperty({ type: () => [Dto] })` 에서 `.*?\)` 가
 *    `() =>` 의 `)` 에 멈춰 뒤쪽 인자를 못 봤다.
 * 3. **`required` 를 인자가 아니라 데코레이터 이름으로 추론** — 저장소에는
 *    `@ApiProperty({ required: false })` 가 9곳 있고, 그 출력은 `@ApiPropertyOptional()` 과
 *    **완전히 같다**. 이름만 보면 그 9곳이 전부 오탐이 된다.
 *
 * 셋 다 "패턴을 조금 넓히면" 되는 문제가 아니다 — 중첩을 세지 않는 도구로 중첩된 문법을
 * 읽으려 한 것이 원인이다. `tsconfig` 해석을 `ts.parseJsonConfigFileContent` 에 맡기는
 * 형제 가드(`production-build-devdep-guard.ts`)와 같은 이유로 여기서도 정본 파서를 쓴다.
 */
export interface ContractMismatch {
  /** backend `src` 기준 상대 경로. */
  readonly file: string;
  readonly line: number;
  readonly field: string;
  /** `presence` = OpenAPI `required` vs TS `?`, `null` = OpenAPI `nullable` vs TS `| null`. */
  readonly axis: 'presence' | 'null';
  readonly detail: string;
}

const API_DECORATORS = new Set(['ApiProperty', 'ApiPropertyOptional']);

/** 데코레이터 호출식만 추려 이름과 함께 돌려준다. */
function callDecorators(
  node: ts.PropertyDeclaration,
  sf: ts.SourceFile,
): { name: string; call: ts.CallExpression }[] {
  return (ts.getDecorators?.(node) ?? [])
    .filter((d): d is ts.Decorator & { expression: ts.CallExpression } =>
      ts.isCallExpression(d.expression),
    )
    .map((d) => ({
      name: d.expression.expression.getText(sf),
      call: d.expression,
    }));
}

/** 데코레이터 인자 객체에서 boolean 리터럴 프로퍼티를 읽는다. 없으면 `undefined`. */
function readBooleanOption(
  call: ts.CallExpression,
  key: string,
  sf: ts.SourceFile,
): boolean | undefined {
  for (const arg of call.arguments) {
    if (!ts.isObjectLiteralExpression(arg)) continue;
    for (const prop of arg.properties) {
      if (!ts.isPropertyAssignment(prop)) continue;
      if (prop.name.getText(sf) !== key) continue;
      if (prop.initializer.kind === ts.SyntaxKind.TrueKeyword) return true;
      if (prop.initializer.kind === ts.SyntaxKind.FalseKeyword) return false;
    }
  }
  return undefined;
}

/**
 * TS 타입의 **최상위** 유니온에 `null` 항이 있는가.
 *
 * 최상위만 본다 — `{ appType: 'public' | null }` 처럼 **중첩된** `null` 은 그 필드 자신이
 * nullable 이라는 뜻이 아니다. 문자열 `.includes('null')` 이나 `split('|')` 로는 이 둘을
 * 가를 수 없다.
 */
function hasTopLevelNull(type: ts.TypeNode): boolean {
  if (!ts.isUnionTypeNode(type)) return false;
  return type.types.some(
    (t) =>
      t.kind === ts.SyntaxKind.NullKeyword ||
      (ts.isLiteralTypeNode(t) && t.literal.kind === ts.SyntaxKind.NullKeyword),
  );
}

/**
 * 두 축의 불일치를 찾는다.
 *
 * - **presence**: OpenAPI 의 실효 `required` 는 TS 의 `?` 와 정확히 반대여야 한다.
 *   실효 `required` 는 인자의 `required:` 가 있으면 그것이고, 없으면 데코레이터 이름이
 *   정한다 — `@ApiPropertyOptional` 은 `ApiProperty({ required: false })` 의 별칭이다
 *   (`@nestjs/swagger` 구현). SoT: `spec/5-system/2-api-convention.md` §5.4.
 * - **null**: OpenAPI 의 `nullable: true` 는 TS 최상위 유니온의 `null` 과 일치해야 한다.
 *
 * ## `@Transform` 예외 — 허용목록이 아니라 원리
 *
 * `@Transform` 이 붙은 필드는 **wire 값과 인스턴스 값의 타입이 다르다**. 예를 들어
 * `QueryExecutionDto.workflowId` 는 `@Transform(v => v === '' ? null : v)` 로 빈 문자열을
 * `null` 로 정규화한다 — 쿼리스트링은 JSON `null` 을 실을 수 없으므로 OpenAPI 가
 * `nullable` 을 말하지 않는 것이 옳고, TS 타입이 `| null` 인 것도 (변환 뒤 값이므로) 옳다.
 * 두 문서가 **서로 다른 대상**을 기술하는 자리라 이 축의 판정 자체가 성립하지 않는다.
 *
 * 2026-09-04 실측: `Api*` 필드 1,096개 중 `@Transform` 동반은 **18개**이고, 그중 이 축에서
 * 갈리는 것은 **1개**(`workflowId`)다. presence 축은 면제하지 않는다 — `@Transform` 은
 * 키의 존재 여부를 바꾸지 않는다.
 */
export function findSwaggerContractMismatches(
  files: string[],
  srcRoot: string,
): ContractMismatch[] {
  const out: ContractMismatch[] = [];
  for (const file of files) {
    const sf = ts.createSourceFile(
      file,
      fs.readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    // 크로스플랫폼 정규화 — 형제 가드(`masked-reject-callers-guard.ts`·
    // `production-build-devdep-guard.ts`)와 동일 관례. `path.relative` 단독이면 윈도우에서
    // `\` 를 남겨 `ContractMismatch.file` 이 플랫폼별로 달라진다(리뷰 W3).
    const rel = toPosixRelative(srcRoot, file);
    const visit = (node: ts.Node): void => {
      if (ts.isPropertyDeclaration(node) && node.type) {
        const decorators = callDecorators(node, sf);
        const api = decorators.find((d) => API_DECORATORS.has(d.name));
        if (api) {
          const line =
            sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
          const field = node.name.getText(sf);
          const declaredRequired = readBooleanOption(api.call, 'required', sf);
          const effectiveRequired =
            declaredRequired ?? api.name === 'ApiProperty';
          const nullable = readBooleanOption(api.call, 'nullable', sf) === true;
          const tsOptional = !!node.questionToken;
          const tsNull = hasTopLevelNull(node.type);

          if (effectiveRequired === tsOptional) {
            out.push({
              file: rel,
              line,
              field,
              axis: 'presence',
              detail: effectiveRequired
                ? `OpenAPI 는 required 인데 TS 는 \`${field}?\` — 소비자가 없어도 되는 키로 읽는다`
                : `OpenAPI 는 required:false 인데 TS 는 \`${field}\` (상시 존재) — 생성기가 optional 로 만든다`,
            });
          }
          if (
            nullable !== tsNull &&
            !decorators.some((d) => d.name === 'Transform')
          ) {
            out.push({
              file: rel,
              line,
              field,
              axis: 'null',
              detail: nullable
                ? `OpenAPI 는 nullable 인데 TS 타입에 \`| null\` 이 없다 — null 이 도착하면 타입이 거짓말한다`
                : `TS 는 \`| null\` 인데 OpenAPI 가 nullable 을 선언하지 않는다 — 소비자가 null 이 올 수 없다고 믿는다`,
            });
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return out;
}
