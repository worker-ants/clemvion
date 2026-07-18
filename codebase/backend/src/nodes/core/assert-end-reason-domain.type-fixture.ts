import type { ConversationEndReason } from '@workflow/ai-end-reason';

import type { AssertEndReasonDomain } from './node-handler.interface';

/**
 * Compile-time regression fixture for {@link AssertEndReasonDomain} — this is
 * **not** a runtime test and contains no `describe`/`it`.
 *
 * Why this file has to exist outside the `*.spec.ts` suite (code review
 * 2026-07-17 testing WARNING #1, `review/code/2026/07/17/22_58_45`):
 *  - backend `ts-jest` runs with `isolatedModules` — it strips types and does
 *    **not** type-check (verified: `const n: number = '문자열'` compiles
 *    clean under this test suite). A negative `@ts-expect-error` case placed
 *    in a `*.spec.ts` file would therefore never actually gate anything.
 *  - `tsconfig.build.json` (`nest build`) excludes `**\/*spec.ts`.
 *  - This file is plain `*.ts` under `src/**`, which `tsconfig.build.json`'s
 *    `"include": ["src/**\/*"]` picks up as a compilation root regardless of
 *    whether anything imports it — so `nest build` (tsc) type-checks it on
 *    every run. If `AssertEndReasonDomain` is ever accidentally weakened
 *    (e.g. the bidirectional `extends` check collapsed to one direction),
 *    the `@ts-expect-error` comments below stop matching a real error and
 *    `tsc` fails the build with "Unused '@ts-expect-error' directive".
 *
 * Not imported by any production module. The **type-level** parts (the
 * `AssertEndReasonDomain<…>` references and type aliases) are erased by tsc,
 * but the three dummy classes and three `const` declarations below ARE real
 * value declarations — tsc compiles them to JS under `dist/` like any other
 * `src/**` file. That emitted JS has zero runtime effect only because nothing
 * imports this module, so it is never loaded or executed. (The regression
 * guard is purely compile-time; the emitted JS is inert dead code.)
 *
 * Reverse-verified when added: commenting out either `@ts-expect-error` line
 * below reproduces a real `nest build` TS2322 failure ("Type 'true' is not
 * assignable to type 'never'") — i.e. these directives are not vacuous.
 */

/** Domain the (fake) call site declares via the `TDeclared` type argument. */
type DeclaredDomain = 'user_ended' | 'max_turns';

/**
 * Dummy handler whose **actual** accepted `endReason` domain is NARROWER
 * than `DeclaredDomain` — the exact bug `AssertEndReasonDomain` exists to
 * catch: method-parameter bivariance lets `implements
 * ResumableNodeHandler<DeclaredDomain>` pass even though the concrete method
 * only accepts a subset. `AssertEndReasonDomain` must reject this pairing.
 */
class NarrowingViolationHandler {
  endMultiTurnConversation(
    _state: Record<string, unknown>,
    _endReason: 'user_ended',
  ): unknown {
    return undefined;
  }
}

/**
 * Dummy handler whose **actual** accepted `endReason` domain is WIDER than
 * `DeclaredDomain` (accepts the full cross-node union). `AssertEndReasonDomain`
 * must reject this pairing too — narrowing is not the only violation shape.
 */
class WideningViolationHandler {
  endMultiTurnConversation(
    _state: Record<string, unknown>,
    _endReason: ConversationEndReason,
  ): unknown {
    return undefined;
  }
}

/** Dummy handler whose domain matches `DeclaredDomain` exactly — must pass. */
class ExactMatchHandler {
  endMultiTurnConversation(
    _state: Record<string, unknown>,
    _endReason: DeclaredDomain,
  ): unknown {
    return undefined;
  }
}

// NEGATIVE #1 (narrowing): AssertEndReasonDomain<NarrowingViolationHandler,
// DeclaredDomain> must resolve to `never` — assigning `true` must fail.
// @ts-expect-error — AssertEndReasonDomain must be `never`: actual domain ('user_ended') is narrower than declared (DeclaredDomain)
const _narrowingViolationIsRejected: AssertEndReasonDomain<
  NarrowingViolationHandler,
  DeclaredDomain
> = true;
void _narrowingViolationIsRejected;

// NEGATIVE #2 (widening): AssertEndReasonDomain<WideningViolationHandler,
// DeclaredDomain> must resolve to `never` — assigning `true` must fail.
// @ts-expect-error — AssertEndReasonDomain must be `never`: actual domain (ConversationEndReason) is wider than declared (DeclaredDomain)
const _wideningViolationIsRejected: AssertEndReasonDomain<
  WideningViolationHandler,
  DeclaredDomain
> = true;
void _wideningViolationIsRejected;

// SANITY: an exact-match pairing must still resolve to `true` — guards
// against this fixture being wrong in a way that makes both negatives above
// "pass" for the wrong reason (e.g. if AssertEndReasonDomain always resolved
// to `never`, the two `@ts-expect-error` lines above would still fire, but
// so would this one; this line must compile clean).
const _exactMatchIsAccepted: AssertEndReasonDomain<
  ExactMatchHandler,
  DeclaredDomain
> = true;
void _exactMatchIsAccepted;
