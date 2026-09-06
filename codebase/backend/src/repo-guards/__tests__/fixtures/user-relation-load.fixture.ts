/**
 * `user-entity-exposure-guard` 의 **양성 대조군**.
 *
 * 이 파일은 프로덕션 스캔 범위(`src/modules`) **밖**에 있어 베이스라인을 오염시키지 않는다.
 * 가드 spec 이 이 파일만 따로 스캔해 술어가 실제로 물고 실제로 놓아 주는지를 확인한다 —
 * fixture 없는 래칫은 술어가 죽어도 그린이다(같은 저장소에서 실제로 한 라운드 그랬다).
 *
 * 컴파일만 되면 되므로 TypeORM 을 import 하지 않는다. 가드는 **구문 형태**만 본다.
 */

interface FakeRepo {
  findOne(opts: { where: unknown; relations?: string[] }): Promise<unknown>;
  find(opts: { where: unknown; relations?: string[] }): Promise<unknown>;
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

/** 위반 1 — `relations` 에 `'user'`. 엔티티 전 컬럼이 실린다. */
export async function violationRelationsUser(): Promise<unknown> {
  return repo.findOne({ where: { id: 'x' }, relations: ['user'] });
}

/** 위반 2 — 중첩 경로도 같다. 마지막 세그먼트가 `user` 면 같은 등급이다. */
export async function violationNestedRelationPath(): Promise<unknown> {
  return repo.find({ where: { id: 'x' }, relations: ['member.user'] });
}

/** 위반 3 — QueryBuilder 로 관계를 통째로 싣는 형태. 감사 로그 유출이 이 모양이었다. */
export async function violationLeftJoinAndSelect(): Promise<unknown> {
  return repo
    .createQueryBuilder('al')
    .leftJoinAndSelect('al.user', 'u')
    .getMany();
}

/** 위반 4 — `inner` 도 같다. 한쪽만 막으면 다른 쪽으로 새 나간다. */
export async function violationInnerJoinAndSelect(): Promise<unknown> {
  return repo
    .createQueryBuilder('al')
    .innerJoinAndSelect('al.user', 'u')
    .getMany();
}

/**
 * 위반 5 — **한 함수 안에서 두 번** 싣는다. 키가 `<파일>#<메서드>` 뿐이면 두 자리가 한
 * 항목으로 접혀, 하나를 지워도 베이스라인이 그대로 통과한다. 접미 번호가 그것을 막는다.
 */
export async function violationTwiceInOneFunction(): Promise<unknown[]> {
  const a = await repo.findOne({ where: { id: 'a' }, relations: ['user'] });
  const b = await repo.findOne({ where: { id: 'b' }, relations: ['user'] });
  return [a, b];
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

/** 준수 2 — `User` 가 아닌 관계는 대상이 아니다. */
export async function compliantOtherRelation(): Promise<unknown> {
  return repo.findOne({ where: { id: 'x' }, relations: ['workflow'] });
}

/** 준수 3 — 이름이 `user` 로 *시작*할 뿐인 관계도 대상이 아니다. */
export async function compliantUserPrefixedRelation(): Promise<unknown> {
  return repo.findOne({ where: { id: 'x' }, relations: ['userSettings'] });
}
