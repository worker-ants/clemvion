// 대조군 fixture — 컨트롤러 메서드 JSDoc 은 swagger 플러그인이 operation 설명으로 싣는다.
// 프로덕션 스캔은 `repo-guards/__tests__/fixtures/` 를 뺀다.

export class InternalRefFixtureController {
  /** 메서드 JSDoc 은 operation 설명이 된다 — spec/5-system/demo. */
  list(): void {}

  /** 정상 메서드. */
  get(): void {}
}
