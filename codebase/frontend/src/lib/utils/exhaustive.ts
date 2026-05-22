/**
 * TypeScript exhaustive switch helper.
 *
 * Usage:
 *
 *     switch (interactionType) {
 *       case "form": return handleForm();
 *       case "buttons": return handleButtons();
 *       case "ai_conversation": return handleConversation();
 *       case "ai_form_render": return handleFormRender();
 *       default:
 *         return assertNever(
 *           interactionType,
 *           "WaitingInteractionType",
 *         );
 *     }
 *
 * The compiler errors with `Argument of type 'X' is not assignable to type
 * 'never'` when a new enum value is added but the switch isn't updated.
 * The runtime arm preserves the unhandled value as a `console.warn` so
 * production builds degrade gracefully instead of crashing.
 *
 * SoT for cross-cutting enums: `spec/conventions/interaction-type-registry.md`.
 * AST guard: `codebase/frontend/src/lib/__tests__/exhaustive-switch.test.ts`.
 */
export function assertNever(value: never, enumName: string): never {
  // The compile-time guarantee prevents reaching here when the switch is
  // exhaustive. At runtime, log + throw so a bad message rather than silent
  // wrong behaviour surfaces during incident triage.
  const tag = `[assertNever:${enumName}]`;
  const repr =
    typeof value === "string"
      ? JSON.stringify(value)
      : String(value);
  if (typeof console !== "undefined") {
    console.error(`${tag} unhandled enum value: ${repr}`);
  }
  throw new Error(`${tag} unhandled enum value: ${repr}`);
}
