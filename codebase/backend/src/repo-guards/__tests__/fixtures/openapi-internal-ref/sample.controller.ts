// 대조군 fixture — 컨트롤러 메서드 JSDoc 은 swagger 플러그인이 operation 설명으로 싣는다.
// 프로덕션 스캔은 `repo-guards/__tests__/fixtures/` 를 뺀다.

/** `summary` 를 받는 메서드 데코레이터 대조군. 이름이 `@Api*` 가 아니라 다른 가드에 걸리지 않는다. */
const Published =
  (_options: { summary: string }): MethodDecorator =>
  () =>
    undefined;

export class InternalRefFixtureController {
  /** 메서드 JSDoc 은 operation 설명이 된다 — spec/5-system/demo. */
  list(): void {}

  /** 정상 메서드. */
  get(): void {}

  /** JSDoc 은 정상이다. 메서드 데코레이터의 `summary` 에 적은 참조는 공개 문장이다. */
  @Published({ summary: '메서드 데코레이터 안 요약에 CLE-API-CONV 를 적었다' })
  decorated(): void {}
}
