// Swagger DTO 선언(`@ApiProperty`/`@ApiPropertyOptional`)이 TS 타입과 같은 말을 하는지 —
// 스캔·판정 순수 로직.
//
// 소비처는 형제 파일 `swagger-dto-contract.spec.ts`. 배경·근거는 그 파일 헤더에 있다.
// 파서 순수 로직과 소비 spec 을 분리하는 규약은 형제 가드
// `production-build-devdep-guard.ts` · `masked-reject-callers-guard.ts` 와 동일하다.
import * as fs from 'node:fs';

import * as ts from 'typescript';
import {
  toPosixPath,
  toPosixRelative,
} from '../../common/__test-utils__/source-scan';

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

/** 데코레이터 인자 객체에서 문자열 리터럴 프로퍼티를 읽는다. 없으면 `undefined`. */
function readStringOption(
  call: ts.CallExpression,
  key: string,
  sf: ts.SourceFile,
): string | undefined {
  for (const arg of call.arguments) {
    if (!ts.isObjectLiteralExpression(arg)) continue;
    for (const prop of arg.properties) {
      if (!ts.isPropertyAssignment(prop)) continue;
      if (prop.name.getText(sf) !== key) continue;
      if (ts.isStringLiteralLike(prop.initializer))
        return prop.initializer.text;
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
 * `@Transform` 이 붙은 필드는 **wire 값과 인스턴스 값의 타입이 다를 수 있다** — 예컨대
 * 쿼리스트링의 빈 문자열을 `null` 로 정규화하면, 쿼리스트링은 JSON `null` 을 실을 수 없으니
 * OpenAPI 가 `nullable` 을 말하지 않는 것이 옳고 TS 타입이 `| null` 인 것도 (변환 뒤 값이
 * 므로) 옳다. 두 선언이 **서로 다른 대상**을 기술하는 자리라 이 축의 판정 자체가 성립하지
 * 않는다.
 *
 * > **현재 저장소에 이 예외가 면제하는 실사례는 0건이다** (2026-09-04 재실측: `Api*` 필드
 * > 1,095개 중 `@Transform` 동반 17개, 그중 null 축이 갈리는 것 **0개**). 종전 이 자리는
 * > `QueryExecutionDto.workflowId` 를 산 예시로 들었는데, 그 필드가 **죽은 파라미터로
 * > 판명돼 제거**됐다(경로가 이미 워크플로우를 한정하므로 쿼리 필터가 성립하지 않았다).
 * >
 * > 실사례가 0 이어도 **예외는 남긴다.** 원리가 사라진 것이 아니라 그 형태의 필드가 지금
 * > 없을 뿐이고, 지우면 다음에 그런 필드가 생길 때 오탐이 된다. 대신 분기가 죽지 않도록
 * > `swagger-dto-contract.spec.ts` 의 `[대조군] @Transform 예외` 픽스처가 **양방향으로**
 * > 고정한다(면제되는 null 축 · 면제되지 않는 presence 축).
 *
 * presence 축은 면제하지 않는다 — `@Transform` 은
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

/**
 * `numeric`/`decimal` 컬럼을 **엔티티 그대로 내보내는** 응답 DTO 가 그 필드를 `number` 라고
 * 말하는 자리.
 *
 * ## 왜 이 축이 별도인가
 *
 * TypeORM 은 `numeric`/`decimal` 을 **문자열**로 준다 — `Number` 로 받으면 정밀도가 깨지기
 * 때문이다. 그런데 응답 DTO 가 같은 필드를 `number` 로 문서화하면 **OpenAPI 가 wire 와
 * 다른 말을 한다.** 위 두 축(presence·null)은 이것을 못 본다 — 둘 다 `number` vs `string`
 * 같은 **원시 타입 차이**를 보지 않기 때문이다.
 *
 * 2026-09-04 에 실제로 그랬다: `AlertRuleDto.threshold` 가 `number` 인데 wire 는
 * `"10.0000"` 이었고, 프런트엔드는 이미 읽기 타입을 `string` 으로 손수 갈라 두고 있었다 —
 * **OpenAPI 만 거짓말을 하고 있었다.** 컨트롤러에 반환 타입이 없어 `tsc` 가 대조할 지점이
 * 없었던 것이 원인이다.
 *
 * ## 왜 DTO↔엔티티 전수 대조가 아닌가
 *
 * 같은 날 전수 대조를 해 보니 불일치 59건 중 **46건이 `Date` → `string`** 이었다 — JSON
 * 직렬화의 정상 동작이다. DTO 는 **직렬화된 wire** 를, 엔티티는 **메모리 안의 값**을
 * 기술하므로 전수 대조는 오탐 덩어리가 된다. 이 술어는 그 간극이 **정밀도 손실로 이어지는
 * 한 축**만 좁게 겨눈다.
 */
export interface NumericAsNumberOffender {
  readonly dto: string;
  readonly field: string;
  readonly entity: string;
}

/** 역할 판별용 디렉터리 표식. 경로는 **POSIX 로 정규화한 뒤** 검사한다. */
const ENTITY_DIR = '/entities/';
const RESPONSE_DTO_DIR = '/dto/responses/';

/**
 * `@Column({ type: 'numeric' | 'decimal' })` 인 필드명을 모은다.
 *
 * > **처음엔 정규식으로 썼고 리뷰가 반박했다** (`20_16_17` W1). **바로 이 파일의 위쪽
 * > docstring 이 "정규식으로 세 번 틀렸다 — 그래서 AST 로 갔다" 고 적어 둔 자리에서**
 * > 같은 실수를 했다. 리뷰어들이 재현한 위음성 네 가지 — 옵션에 중첩 객체
 * > (`transformer: {...}`)가 있으면 `[^}]*` 가 안쪽 `}` 에서 멈추고, 데코레이터와 선언이
 * > 같은 줄이면 개행 강제에 걸리고, `public` 같은 접근 제한자나 사이에 낀 다른 데코레이터
 * > (`@Index()`)에도 깨진다. 넷 다 **numeric 컬럼을 "numeric 아님" 으로 조용히 분류**해
 * > 가드의 존재 이유를 무력화한다.
 */
function collectNumericFields(sf: ts.SourceFile): Map<string, Set<string>> {
  const byClass = new Map<string, Set<string>>();
  const visit = (node: ts.Node): void => {
    if (ts.isClassDeclaration(node) && node.name) {
      const cls = node.name.getText(sf);
      const found = new Set<string>();
      for (const member of node.members) {
        if (!ts.isPropertyDeclaration(member)) continue;
        for (const { name, call } of callDecorators(member, sf)) {
          if (name !== 'Column') continue;
          const columnType = readStringOption(call, 'type', sf);
          if (columnType === 'numeric' || columnType === 'decimal')
            found.add(member.name.getText(sf));
        }
      }
      if (found.size) byClass.set(cls, found);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return byClass;
}

/** 응답 DTO 클래스의 필드명 → 선언 타입. */
function collectDtoFieldTypes(
  sf: ts.SourceFile,
): Map<string, Map<string, string>> {
  const byClass = new Map<string, Map<string, string>>();
  const visit = (node: ts.Node): void => {
    if (ts.isClassDeclaration(node) && node.name) {
      const fields = new Map<string, string>();
      for (const member of node.members)
        if (ts.isPropertyDeclaration(member) && member.type)
          fields.set(
            member.name.getText(sf),
            member.type.getText(sf).replace(/\s+/g, ' '),
          );
      byClass.set(node.name.getText(sf), fields);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return byClass;
}

/**
 * `numeric`/`decimal` 컬럼을 엔티티 그대로 내보내는 응답 DTO 가 그 필드를 `number` 라고
 * 말하는 자리.
 *
 * ## 짝짓기는 `<Entity>Dto` **이름 관례**에 의존한다 (알려진 한계)
 *
 * `AlertRuleDto` ↔ `AlertRule` 처럼 접미사만 떼어 짝짓는다. 그 관례를 벗어난 이름으로
 * 엔티티를 그대로 내보내는 DTO 는 **이 술어가 보지 못한다** (`20_16_17` W3). 저장소에
 * 실제로 그런 이름이 있다 — `StatisticsResponseDto` 가 자매 numeric 컬럼
 * (`LlmUsageLog.costUsd`)을 노출하지만, 그쪽은 서비스가 `SUM(...)::float` + `Number(...)`
 * 로 명시 변환해 무해하다. 음성 대조군으로 이 한계를 고정해 두었다.
 */
export function findNumericAsNumber(
  files: string[],
): NumericAsNumberOffender[] {
  const numericFields = new Map<string, Set<string>>();
  const dtoFields = new Map<string, Map<string, string>>();

  for (const file of files) {
    // 경로 판별 전에 POSIX 로 정규화한다 — 이 파일이 세운 관례이고, 빠뜨리면 윈도우에서
    // `\` 때문에 분류가 통째로 실패해 **가드가 조용히 "위반 0건" 이 된다** (`20_16_17` W2).
    const posix = toPosixPath(file);
    const isEntity = posix.includes(ENTITY_DIR);
    const isResponseDto = posix.includes(RESPONSE_DTO_DIR);
    if (!isEntity && !isResponseDto) continue;

    const sf = ts.createSourceFile(
      file,
      fs.readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    if (isEntity)
      for (const [cls, fields] of collectNumericFields(sf))
        numericFields.set(cls, fields);
    else
      for (const [cls, fields] of collectDtoFieldTypes(sf))
        dtoFields.set(cls, fields);
  }

  const out: NumericAsNumberOffender[] = [];
  for (const [dto, fields] of dtoFields) {
    const entity = dto.replace(/Dto$/, '');
    const numeric = numericFields.get(entity);
    if (!numeric) continue;
    for (const [field, type] of fields) {
      if (!numeric.has(field)) continue;
      if (!/\bnumber\b/.test(type)) continue;
      out.push({ dto, field, entity });
    }
  }
  return out;
}
