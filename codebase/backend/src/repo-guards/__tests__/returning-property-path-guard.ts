// QueryBuilder `.returning([...])` 배열에 **엔티티 속성 경로가 아닌 문자열**이 들어갔는지 세는 가드 — 순수 로직.
//
// 소비처는 형제 파일 `returning-property-path.spec.ts`. 배경·근거는 그 파일 헤더에 있다.

import * as ts from 'typescript';

/**
 * 속성 경로로 인정하는 형태. 엔티티 속성은 camelCase 이고 임베디드 속성은 `.` 으로 잇는다
 * (`findColumnsWithPropertyPath` 가 받는 형태). 밑줄이 있으면 컬럼 이름이다.
 */
const PROPERTY_PATH = /^[a-z][A-Za-z0-9]*(\.[a-z][A-Za-z0-9]*)*$/;

/** 위반 한 건. */
export interface ReturningPathViolation {
  /** 보고용 파일 이름. 호출자가 넘긴 값을 그대로 싣는다. */
  readonly file: string;
  /** 1부터 세는 줄 번호. 위반을 찾아가는 용도라 고정 참조로 쓰지 않는다. */
  readonly line: number;
  /** 문제가 된 원소의 원문. */
  readonly element: string;
  readonly reason: 'not-property-path' | 'not-string-literal';
}

/** 한 파일을 훑은 결과. `scanned` 는 판정한 `.returning([...])` 호출 수다(vacuity floor 용). */
export interface ReturningPathScan {
  readonly violations: readonly ReturningPathViolation[];
  readonly scanned: number;
}

/**
 * 소스 텍스트에서 `.returning(<배열 리터럴>)` 호출을 찾아 원소를 판정한다.
 *
 * - 문자열 인자(`.returning('id, dismissed_at')`)는 TypeORM 이 raw SQL 로 그대로 쓰므로 보지 않는다.
 * - 배열 원소가 문자열 리터럴이 아니면 정적으로 확인할 수 없어 위반으로 센다. 지금 저장소에는 그런 형태가 없다.
 *
 * 정규식이 아니라 AST 로 읽는다. 주석 · 문자열 속 `.returning([` 를 세지 않기 위해서다.
 */
export function scanReturningPropertyPaths(
  file: string,
  text: string,
): ReturningPathScan {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const violations: ReturningPathViolation[] = [];
  let scanned = 0;

  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'returning' &&
      node.arguments.length > 0 &&
      ts.isArrayLiteralExpression(node.arguments[0])
    ) {
      scanned += 1;
      for (const el of node.arguments[0].elements) {
        const line =
          source.getLineAndCharacterOfPosition(el.getStart()).line + 1;
        if (ts.isStringLiteral(el) || ts.isNoSubstitutionTemplateLiteral(el)) {
          if (!PROPERTY_PATH.test(el.text)) {
            violations.push({
              file,
              line,
              element: el.text,
              reason: 'not-property-path',
            });
          }
        } else {
          violations.push({
            file,
            line,
            element: el.getText(source),
            reason: 'not-string-literal',
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);

  return { violations, scanned };
}
