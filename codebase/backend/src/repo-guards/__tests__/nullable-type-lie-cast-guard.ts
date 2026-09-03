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
  stripComments,
  stripLiterals,
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

export interface StaleSpecCast {
  readonly file: string;
  readonly field: string;
}

/**
 * 엔티티 선언에서 `| null` 로 **넓혀진** 필드명 — **단, 어느 엔티티에서도 non-null 이
 * 아닌 것만.**
 *
 * `@Column` 뿐 아니라 `@ManyToOne`·`@OneToOne` 도 본다 — 관계도 `| null` 로 넓혀졌고,
 * 그 필드를 겨눈 fixture 캐스트 역시 불필요해진다.
 *
 * ## 이름 충돌을 빼는 이유 — 안 빼면 정당한 캐스트를 오탐한다
 *
 * 판정 단위가 **필드 이름**이지 `(엔티티, 필드)` 쌍이 아니다. 그래서 한 엔티티는 nullable
 * 이고 다른 엔티티는 non-null 인 동명 필드가 있으면, **non-null 쪽 fixture 의 정당한
 * 캐스트**를 "불필요" 로 잡는다 — 처방대로 지우면 `tsc` 가 깨진다.
 *
 * 저장소 실측 **20건**이 그런 충돌이다 (`userId` 는 `login_history` 에서 nullable,
 * `audit_log` 에서 non-null · `workflowId` 는 `llm_usage_log`/`alert_rule` 에서 nullable,
 * `edge`/`execution` 에서 non-null · `trigger`·`triggerId`·`resourceType` 등).
 *
 * 그래서 **한 곳이라도 non-null 이면 그 이름은 판정에서 뺀다.** 재현율을 잃는 대신
 * **오탐을 0으로 유지**한다 — 가드의 처방이 "이 캐스트를 지워라" 이므로, 틀리면 사람이
 * 코드를 깨뜨리는 방향이다. 지금까지 실제로 제거한 캐스트 4건(`lastRunAt`·
 * `lastTriggeredAt`·`parentId`·`lockedUntil`)은 모두 충돌 목록 밖이라 그대로 잡힌다.
 *
 * > **이건 내가 바로 앞 PR 에서 반증한 실패 모드다.** 자매 축("응답 DTO 가 nullable 필드를
 * > non-null 로 문서화")에서 필드 이름 매칭이 48건 중 44건을 오탐으로 만든 것을 확인해 놓고,
 * > 같은 판정을 여기에 그대로 썼다. 초판 docstring 은 "왜 오탐이 없나" 라는 절을 두고
 * > "예외 없이 제거 가능" 이라 단언했는데 **반례가 재현됐다**(리뷰 2R W1).
 *
 * > **한계 — 추가 데코레이터는 1개까지만 본다** (리뷰 INFO#1, reviewer 3명 공통 지적).
 * > 관계 뒤의 `@JoinColumn` 처럼 데코레이터가 하나 더 붙는 형태까지가 이 패턴의 범위다
 * > (`?` 이지 `*` 가 아니다). 두 개 이상 스택되면 그 필드를 **조용히 누락**한다 —
 * > **위음성** 방향이라 가드가 약해지는 쪽이다. 저장소 전수에 그런 조합은 **없다**(실측).
 * > 넓히는 것은 검증 없이 표면만 키우는 일이라, 그 형태가 실재하는 날 이 주석을 근거로
 * > `(?:...)*` 로 옮긴다.
 */
const WIDENED_DECL =
  /@(?:Column|ManyToOne|OneToOne)\((?:[^()]|\([^()]*\))*\)\s*\n(?:\s*@\w+\((?:[^()]|\([^()]*\))*\)\s*\n)?\s*(\w+)\s*:\s*([^;]+);/g;

export function widenedEntityFields(entityFiles: string[]): Set<string> {
  const widened = new Set<string>();
  const nonNull = new Set<string>();
  for (const file of entityFiles) {
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(WIDENED_DECL)) {
      const [, field, tsType] = m;
      (tsType.includes('| null') ? widened : nonNull).add(field);
    }
  }
  // 동명 충돌 제거 — 아래 docstring §"이름 충돌" 참조.
  for (const f of nonNull) widened.delete(f);
  return widened;
}

/** `foo: null as unknown as Bar` 의 `foo`. `undefined` 형태도 같은 잔재다. */
const SPEC_CAST = /(\w+)\s*:\s*(?:null|undefined)\s+as\s+unknown\s+as\b/g;

/**
 * **넓혀진 필드를 겨눈 `.spec.ts` 의 낡은 캐스트.**
 *
 * ## 왜 별도 술어인가 — {@link findCastOffenders} 는 이 자리를 구조적으로 못 본다
 *
 * 그 가드는 `.spec.ts` 를 **의도적으로 제외**한다. fixture 가 부분 객체를 엔티티로
 * 캐스트하는 것은 정당하기 때문이다. 그런데 필드가 `| null` 로 넓혀지면 **그 필드에 대한
 * 캐스트만은 불필요해지는데**, spec 을 아예 안 보므로 영원히 안 잡힌다.
 *
 * 배치 1~3 에서 이 잔재를 세 번 **손으로** 찾았다(`lastRunAt`·`lastTriggeredAt`·`parentId`·
 * `lockedUntil`). 세 번째에는 훑는 대상 집합을 *그 배치가 넓힌 필드*로만 잡아서 앞 배치가
 * 남긴 것을 놓쳤다 — 사람이 매번 다시 정할 일이 아니라 술어로 고정할 일이다.
 *
 * ## 오탐 없음은 {@link widenedEntityFields} 가 이름 충돌을 뺀 덕이다
 *
 * 그 함수가 **어느 엔티티에서도 non-null 이 아닌 이름만** 넘겨주므로, 여기 걸린 자리는
 * 캐스트를 지워도 `tsc` 가 통과한다. 충돌을 안 뺐을 때 **오탐이 재현된다** — 그 근거와
 * 실측 20건은 그쪽 docstring 에 있다.
 *
 * 대신 **재현율을 잃는다**: 충돌 이름(`userId`·`workflowId` 등)에 낡은 캐스트가 생기면
 * 이 가드는 못 잡는다. 처방이 "지워라" 라서 틀리면 사람이 코드를 깨뜨리는 방향이므로,
 * 재현율보다 건전성을 택했다.
 *
 * 주석은 {@link stripComments} 로 지운다. 이 저장소에는 정리 이력을 설명하며 옛 캐스트를
 * **인용한** 주석이 실재한다 — 그걸 세면 고칠 것이 없는 파일이 영구히 RED 가 된다.
 */
export function findStaleSpecCasts(
  specFiles: string[],
  widened: ReadonlySet<string>,
): StaleSpecCast[] {
  const out: StaleSpecCast[] = [];
  for (const file of specFiles) {
    const src = stripLiterals(stripComments(fs.readFileSync(file, 'utf8')));
    for (const m of src.matchAll(SPEC_CAST)) {
      const field = m[1];
      if (!widened.has(field)) continue;
      out.push({ file: path.relative(SRC_ROOT, file), field });
    }
  }
  return out;
}
