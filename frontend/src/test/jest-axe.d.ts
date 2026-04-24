// Local ambient types for jest-axe@10.x.
// The DefinitelyTyped package `@types/jest-axe` is stuck at `3.5.9` (targeting
// jest-axe 3.x) and has not caught up with the v10 release. Since only the
// two stable APIs are used here (`axe(container)` and the
// `toHaveNoViolations` matcher), declare them locally rather than pin to an
// outdated `@types/jest-axe`.
declare module "jest-axe" {
  import type { AxeResults } from "axe-core";

  export function axe(
    element: Element | Document | string,
    options?: Record<string, unknown>,
  ): Promise<AxeResults>;

  export const toHaveNoViolations: {
    toHaveNoViolations(received: AxeResults): {
      pass: boolean;
      message: () => string;
    };
  };
}

declare namespace Vi {
  interface Assertion {
    toHaveNoViolations(): void;
  }
  interface AsymmetricMatchersContaining {
    toHaveNoViolations(): void;
  }
}

// jest-dom / vitest matcher registration
declare module "vitest" {
  interface Assertion {
    toHaveNoViolations(): void;
  }
  interface AsymmetricMatchersContaining {
    toHaveNoViolations(): void;
  }
}
