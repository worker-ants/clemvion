// `jest-axe` 의 `toHaveNoViolations` 를 vitest `expect` 에 등록하는 **타입** 선언.
// 런타임 등록은 `setup.ts` 의 `expect.extend(toHaveNoViolations)` 가 한다.
//
// **왜 별도 파일인가** — 이 선언은 반드시 *모듈* 파일에 있어야 한다. 종전에는
// `jest-axe.d.ts` 안에 있었는데 그 파일은 top-level import/export 가 없어 **global
// script** 였고, 그 문맥의 `declare module "vitest"` 는 augmentation 이 아니라
// **shadowing** 이다 — vitest 의 실제 타입을 통째로 덮어 `import { describe } from
// "vitest"` 가 전부 깨진다.
//
// 아무도 못 본 이유: `tsconfig.json` 이 `src/test/**` 와 테스트 파일을 exclude 하고
// vitest 는 타입을 strip 한다. **이 선언이 의도대로 동작한 적이 한 번도 없다** —
// `toHaveNoViolations()` 의 타입 보장은 죽어 있었고, 런타임 matcher 만 살아 있었다.
// 2026-09-02 실측: 이 파일을 프로그램에 넣으면 TS2305 가 **1,128건** 쏟아졌다.
//
// 아래 `import "vitest"` 가 이 파일을 모듈로 만든다 — 지우면 조용히 shadowing 으로
// 되돌아간다.
import "vitest";

declare module "vitest" {
  interface Assertion {
    toHaveNoViolations(): void;
  }
  interface AsymmetricMatchersContaining {
    toHaveNoViolations(): void;
  }
}
