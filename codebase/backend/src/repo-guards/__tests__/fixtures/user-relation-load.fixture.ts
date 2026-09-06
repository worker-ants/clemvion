/**
 * `user-entity-exposure-guard` 의 **양성 대조군**.
 *
 * 이 파일은 프로덕션 스캔 범위(`src/modules`) **밖**에 있어 베이스라인을 오염시키지 않는다.
 * 가드 spec 이 이 파일만 따로 스캔해 술어가 실제로 물고 실제로 놓아 주는지를 확인한다 —
 * fixture 없는 래칫은 술어가 죽어도 그린이다(같은 저장소에서 실제로 한 라운드 그랬다).
 *
 * 컴파일만 되면 되므로 TypeORM 을 import 하지 않는다. 가드는 **구문 형태**만 본다.
 */

interface FakeOpts {
  where: unknown;
  relations?: string[] | Record<string, unknown>;
  select?: Record<string, unknown>;
}

interface FakeRepo {
  findOne(opts: FakeOpts): Promise<unknown>;
  find(opts: FakeOpts): Promise<unknown>;
  createQueryBuilder(alias: string): FakeQb;
}

interface FakeQb {
  leftJoinAndSelect(rel: string, alias: string): FakeQb;
  innerJoinAndSelect(rel: string, alias: string): FakeQb;
  leftJoin(rel: string, alias: string): FakeQb;
  addSelect(cols: string[]): FakeQb;
  getMany(): Promise<unknown[]>;
}

declare const repo: FakeRepo;

// ── 위반 형태 ───────────────────────────────────────────────────────────────

/** 위반 1 — `relations` 배열에 `'user'`. 엔티티 전 컬럼이 실린다. */
export async function violationRelationsUser(): Promise<unknown> {
  return repo.findOne({ where: { id: 'x' }, relations: ['user'] });
}

/** 위반 2 — 중첩 경로도 같다. 마지막 세그먼트가 `User` 관계면 같은 등급이다. */
export async function violationNestedRelationPath(): Promise<unknown> {
  return repo.find({ where: { id: 'x' }, relations: ['member.user'] });
}

/**
 * 위반 3 — **이름이 `user` 가 아닌 `User` 관계**. 첫 판이 이 형태를 놓쳐
 * `WorkflowVersion.creator` 유출이 검출망 밖에 살아 있었다.
 */
export async function violationCreatorRelation(): Promise<unknown> {
  return repo.findOne({ where: { id: 'x' }, relations: ['creator'] });
}

/**
 * 위반 4 — **TypeORM 0.3 객체 형태.** 첫 판은 배열 리터럴만 순회해서 이 형태를 통째로
 * 놓쳤다. 하필 실제 유출 지점의 자매 메서드가 이 형태를 쓰고 있었다.
 */
export async function violationObjectRelations(): Promise<unknown> {
  return repo.findOne({ where: { id: 'x' }, relations: { owner: true } });
}

/**
 * 위반 5 — 대소문자. `.toLowerCase()` 분기를 **관측 가능**하게 만든다 — 그 분기를 지워도
 * 통과하던 상태를 뮤테이션이 잡아냈다 (`review/code/2026/09/06/10_13_22` W4).
 */
export async function violationUppercaseRelation(): Promise<unknown> {
  return repo.findOne({ where: { id: 'x' }, relations: ['User'] });
}

/** 위반 6 — QueryBuilder 로 관계를 통째로 싣는 형태. 감사 로그 유출이 이 모양이었다. */
export async function violationLeftJoinAndSelect(): Promise<unknown> {
  return repo
    .createQueryBuilder('al')
    .leftJoinAndSelect('al.user', 'u')
    .getMany();
}

/** 위반 7 — `inner` 도, 이름이 `creator` 인 것도 같다. 한쪽만 막으면 다른 쪽으로 샌다. */
export async function violationInnerJoinAndSelect(): Promise<unknown> {
  return repo
    .createQueryBuilder('al')
    .innerJoinAndSelect('al.creator', 'u')
    .getMany();
}

/**
 * 위반 8 — **한 함수 안에서 두 번** 싣는다. 키가 `<파일>#<메서드>` 뿐이면 두 자리가 한
 * 항목으로 접혀, 하나를 지워도 베이스라인이 그대로 통과한다. 접미 번호가 그것을 막는다.
 */
export async function violationTwiceInOneFunction(): Promise<unknown[]> {
  const a = await repo.findOne({ where: { id: 'a' }, relations: ['user'] });
  const b = await repo.findOne({ where: { id: 'b' }, relations: ['user'] });
  return [a, b];
}

/**
 * 위반 9 — **중첩 객체 형태.** 배열 쪽은 `'member.user'` 로 중첩을 잡으면서 객체 쪽은
 * 최상위만 보던 사각지대 (`review/code/2026/09/06/10_53_48` W2).
 */
export async function violationNestedObjectRelations(): Promise<unknown> {
  return repo.findOne({
    where: { id: 'x' },
    relations: { workflow: { creator: true } },
  });
}

/**
 * 위반 10 — 감싸는 **변수**가 있어도 키가 메서드/함수 이름으로 잡히는가.
 * `enclosingName` 의 "메서드가 변수보다 우선" 설계를 관측 가능하게 만든다 — 그 우선순위를
 * 뒤집어도 스위트가 초록이던 상태를 리뷰가 잡았다 (`10_53_48` INFO#4).
 */
export async function violationViaIntermediateVariable(): Promise<unknown> {
  const stored = await repo.findOne({
    where: { id: 'x' },
    relations: ['owner'],
  });
  return stored;
}

/**
 * 위반 11 — **타입 연산을 한 겹 씌운** 형태. 객체 리터럴이 `as`/`satisfies`/괄호로 감싸이면
 * `ts.isObjectLiteralExpression` 이 거짓이 되어 술어가 눈을 감는다 — 이 fixture 를 처음 쓸
 * 때 `as unknown as …` 로 실제로 그랬다.
 *
 * 여기서는 `satisfies` 를 쓴다. `as` 로 쓰면 저장소 lint
 * (`@typescript-eslint/no-unnecessary-type-assertion`)가 **중복 단언**으로 막는다 — 즉
 * 이 저장소의 프로덕션 코드에 남을 수 있는 형태는 `satisfies` 쪽이다. 가드는 두 형태를
 * 같은 `unwrap` 으로 벗기므로 이 하나가 두 경로를 함께 태운다.
 */
export async function violationSatisfiesRelations(): Promise<unknown> {
  return repo.findOne({
    where: { id: 'x' },
    relations: { creator: true } satisfies Record<string, unknown>,
  });
}

// ── 준수 형태 (대조군) ──────────────────────────────────────────────────────

/**
 * 준수 1 — `leftJoin` + 필요한 컬럼만 `addSelect`. **이것이 정상 형태**이고
 * `audit-logs.service.ts` 가 실제로 쓰는 모양이다. 가드가 이것까지 물면 오탐이다.
 */
export async function compliantProjectedJoin(): Promise<unknown> {
  return repo
    .createQueryBuilder('al')
    .leftJoin('al.user', 'user')
    .addSelect(['user.id', 'user.name', 'user.email'])
    .getMany();
}

/**
 * 준수 2 — `relations` + **같은 옵션의 `select` 투영**. `findByWorkflow` 가 처음부터
 * 이렇게 짜여 있었다. 이것을 세면 옳게 짜인 자리가 베이스라인을 채워 래칫이 흐려진다.
 */
export async function compliantProjectedRelations(): Promise<unknown> {
  return repo.findOne({
    where: { id: 'x' },
    relations: { creator: true },
    select: { id: true, creator: { id: true, name: true, email: true } },
  });
}

/** 준수 3 — `User` 가 아닌 관계는 대상이 아니다. */
export async function compliantOtherRelation(): Promise<unknown> {
  return repo.findOne({ where: { id: 'x' }, relations: ['workflow'] });
}

/** 준수 4 — 이름이 `user` 로 *시작*할 뿐인 관계도 대상이 아니다. */
export async function compliantUserPrefixedRelation(): Promise<unknown> {
  return repo.findOne({ where: { id: 'x' }, relations: ['userSettings'] });
}
