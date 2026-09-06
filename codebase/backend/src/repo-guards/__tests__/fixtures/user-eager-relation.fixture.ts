/**
 * `findEagerUserRelations` 의 **양성/음성 대조군**.
 *
 * ## 왜 필요한가 — 없을 때 검출력이 0이었다
 *
 * 첫 판은 프로덕션 엔티티에 eager 관계가 **0건**이라는 사실만 단언했다. 그런데
 * *"현재 0건이다"* 와 *"이 함수가 실제로 잡는다"* 는 **다른 주장**이다 — 리뷰어가
 * `hasEagerDecorator` 를 `return false` 로 무력화하고 돌려 보니 스위트가 **15/15 초록**
 * 이었다 (`review/code/2026/09/06/11_55_36` W1). 술어가 죽어 있어도 0건은 0건이다.
 *
 * 이 파일은 프로덕션 스캔 범위(`src/modules`) **밖**이라 베이스라인을 오염시키지 않는다.
 *
 * TypeORM 을 import 하지 않는다 — 가드는 **구문 형태**만 보므로 같은 이름의 로컬
 * 데코레이터로 충분하다.
 */

type Deco = (target: object, key: string) => void;

/** `@ManyToOne`/`@OneToOne` 자리를 채우는 no-op. 가드는 이름과 인자 형태만 본다. */
function relation(_type: () => unknown, _opts?: Record<string, unknown>): Deco {
  return () => {};
}
const ManyToOne = relation;
const OneToOne = relation;

/** 가드가 타입 주석으로 `User` 를 알아보게 하는 최소 선언. */
declare class User {
  id: string;
}

export class EagerFixtureEntity {
  /** **위반** — eager 로 항상 로드되므로 호출부에 아무 텍스트도 안 남는다. */
  @ManyToOne(() => User, { eager: true })
  eagerCreator: User;

  /** **위반** — 다른 데코레이터·다른 이름이어도 같다. */
  @OneToOne(() => User, { eager: true, nullable: true })
  eagerOwner: User | null;

  /** 준수 — 옵션 자체가 없다. */
  @ManyToOne(() => User)
  lazyUser: User;

  /** 준수 — `eager: false` 는 명시적으로 끈 것이다. */
  @ManyToOne(() => User, { eager: false })
  explicitlyLazy: User;

  /** 준수 — eager 지만 `User` 타입이 아니다. 이 축의 대상이 아니다. */
  @ManyToOne(() => Object, { eager: true })
  eagerButNotUser: { id: string };
}
