import { describe, it, expect } from "vitest";
import {
  EXECUTION_INTERACTION_ERROR_CODE_TO_I18N,
  getExecutionInteractionErrorI18nKey,
} from "../execution-error-codes";

describe("getExecutionInteractionErrorI18nKey (§7.5.2)", () => {
  it("maps the 3 client-safe continuation codes to i18n keys", () => {
    expect(getExecutionInteractionErrorI18nKey("INVALID_EXECUTION_STATE")).toBe(
      "executions.interactionError.invalidState",
    );
    expect(
      getExecutionInteractionErrorI18nKey("EXECUTION_MESSAGE_TOO_LONG"),
    ).toBe("executions.interactionError.messageTooLong");
    expect(getExecutionInteractionErrorI18nKey("EXECUTION_INTERNAL_ERROR")).toBe(
      "executions.interactionError.internalError",
    );
  });

  it("returns null for unmapped / empty codes (caller falls back to backend message)", () => {
    expect(getExecutionInteractionErrorI18nKey("SOMETHING_ELSE")).toBeNull();
    expect(getExecutionInteractionErrorI18nKey(undefined)).toBeNull();
    expect(getExecutionInteractionErrorI18nKey(null)).toBeNull();
    expect(getExecutionInteractionErrorI18nKey("")).toBeNull();
  });

  it("does not inherit from Object.prototype (hasOwnProperty guard)", () => {
    expect(getExecutionInteractionErrorI18nKey("toString")).toBeNull();
    expect(getExecutionInteractionErrorI18nKey("constructor")).toBeNull();
  });

  it("map is non-empty and every value is an executions.interactionError.* key", () => {
    const entries = Object.entries(EXECUTION_INTERACTION_ERROR_CODE_TO_I18N);
    expect(entries.length).toBeGreaterThan(0);
    for (const [, key] of entries) {
      expect(key).toMatch(/^executions\.interactionError\./);
    }
  });
});
