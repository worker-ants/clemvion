import type { ko } from "./ko";

// Recursively widens literal string types to `string` so other locales (e.g. en.ts)
// can satisfy the structural shape of the reference dictionary (ko.ts) without
// having to match each literal exactly.
type WidenString<T> = T extends string
  ? string
  : T extends readonly (infer U)[]
    ? readonly WidenString<U>[]
    : T extends object
      ? { [K in keyof T]: WidenString<T[K]> }
      : T;

export type Dict = WidenString<typeof ko>;
