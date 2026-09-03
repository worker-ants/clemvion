// `null as unknown as X` 이중 캐스트 금지 가드 — 스캔·판정 순수 로직.
//
// 소비처는 형제 파일 `nullable-type-lie-cast.spec.ts`. 배경·근거는 그 파일 헤더에 있다.
// 파서 순수 로직과 소비 spec 을 분리하는 규약은 형제 가드 `masked-reject-callers-guard.ts`·
// `eslint-unicorn-peer-guard.ts` 와 동일하다.
//
// 세는 술어 자체는 `common/__test-utils__/source-scan.ts` 가 소유한다 — 그 모듈이
// "세 번째 가드가 생겨도 여기만 고치면 되도록" 이라고 자기 docstring 에 적어 둔 자리다.

import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  collectTsFiles,
  countNullAsUnknownAsCasts,
} from '../../common/__test-utils__/source-scan';

/** `src` 루트. 이 파일은 `src/repo-guards/__tests__/` 에 있다. */
export const SRC_ROOT = path.resolve(__dirname, '..', '..');

export interface CastOffender {
  readonly file: string;
  readonly count: number;
}

/**
 * 스캔 대상: `src` 아래 **비-spec** `.ts` 파일.
 *
 * `*.spec.ts` 는 제외한다 — 테스트 fixture 가 부분 객체를 엔티티로 캐스트하는 것은 정당하고,
 * 그쪽은 backend typecheck ratchet 이 이미 덮는다.
 *
 * > 종전 이 자리에 "실측 12건" 이라고 **개수를 박아 뒀다가 곧바로 낡았다** — 이 가드의 spec
 * > 자신이 fixture 문자열로 그 패턴을 쓰기 때문이다(같은 PR 안에서 12→24). 검증되지 않는
 * > 숫자는 적지 않는다. 지금 세고 싶으면 `grep -rn 'null as unknown as' --include='*.spec.ts'`.
 */
export function collectScanTargets(root: string = SRC_ROOT): string[] {
  return collectTsFiles(root);
}

/** 캐스트가 남아 있는 파일과 개수. 위반이 없으면 빈 배열. */
export function findCastOffenders(files: string[]): CastOffender[] {
  const offenders: CastOffender[] = [];
  for (const file of files) {
    const count = countNullAsUnknownAsCasts(fs.readFileSync(file, 'utf8'));
    if (count > 0) {
      offenders.push({ file: path.relative(SRC_ROOT, file), count });
    }
  }
  return offenders;
}

/**
 * `| null` 로 넓힌 컬럼인데 `@Column` 이 `type:` 을 명시하지 않은 자리.
 *
 * ## 왜 필요한가 — 타입만 넓히면 **런타임이 깨진다**
 *
 * TypeORM 은 `design:type` 메타데이터로 컬럼 타입을 추론한다. TS 타입이 `string` 이면
 * `String` 이 방출되지만 `string | null` 이면 **`Object`** 가 방출되고, 그러면 부팅이
 * `DataTypeNotSupportedError: Data type "Object" in "User.passwordHash" is not supported
 * by "postgres" database.` 로 죽는다.
 *
 * 2026-09-03 에 실제로 그렇게 깨뜨렸다. **lint·unit·build·`tsc` 가 전부 통과했고 오직
 * e2e 만 잡았다** — 타입 검사로는 원리적으로 못 보는 런타임 메타데이터 문제이기 때문이다.
 * 저장소가 이미 넓혀 둔 컬럼(`Execution.error`·`llm-usage-log.workflowId`·`User.pendingEmail`)
 * 은 전부 `type:` 을 명시하고 있었다 — 관례가 있었는데 내가 안 따랐다.
 *
 * 이 술어가 그 규칙을 못박는다: **`| null` 이면 `type:` 도 있어야 한다.**
 */
export interface UntypedNullableColumn {
  readonly file: string;
  readonly field: string;
}

/** `@Column(...)` 블록과 바로 뒤 필드 선언을 잡는다(한 단계 중첩 괄호까지). */
const COLUMN_DECL =
  /(@Column\((?:[^()]|\([^()]*\))*\))\s*\n\s*(\w+)\s*:\s*([^;]+);/g;

/** `@Column({ name: 'x' })` 의 `x`. */
const COLUMN_NAME = /\bname:\s*'([^']+)'/;

/** 같은 파일에서 `@JoinColumn({ name: 'x' })` 로 쓰이는 DB 컬럼명들. */
function joinColumnNames(src: string): Set<string> {
  const names = new Set<string>();
  for (const m of src.matchAll(/@JoinColumn\(\s*\{[^}]*\bname:\s*'([^']+)'/g)) {
    names.add(m[1]);
  }
  return names;
}

/**
 * 관계가 타입을 공급하는 컬럼은 제외한다 — **실측된 예외**이지 허용목록이 아니다.
 *
 * `NodeExecution.parentNodeExecutionId` 는 `string | null` 이고 `type:` 이 없는데도 앱이
 * 정상 부팅한다(이 형태로 오래 살아 있었고 e2e 가 계속 통과했다). 그 컬럼
 * (`parent_node_execution_id`)이 같은 엔티티의 `@ManyToOne` + `@JoinColumn` 이 쓰는
 * 컬럼이라, TypeORM 이 관계의 참조 키에서 타입을 얻어 `design:type` 의 `Object` 를 쓰지
 * 않기 때문이다.
 *
 * > `design:type` 자체는 판별자가 **아니다** — 실측하니 `string | null` 은 `length` 유무와
 * > 무관하게 둘 다 `Object` 를 방출한다. 차이를 만드는 것은 관계의 존재다.
 */
export function findUntypedNullableColumns(
  files: string[],
): UntypedNullableColumn[] {
  const out: UntypedNullableColumn[] = [];
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    const joined = joinColumnNames(src);
    for (const m of src.matchAll(COLUMN_DECL)) {
      const [, deco, field, tsType] = m;
      if (!tsType.includes('| null')) continue;
      if (/\btype:\s*'/.test(deco)) continue;
      const colName = COLUMN_NAME.exec(deco)?.[1];
      if (colName && joined.has(colName)) continue;
      out.push({ file: path.relative(SRC_ROOT, file), field });
    }
  }
  return out;
}
