import { describe, it, expect } from "vitest";
import {
  EXECUTION_INTERACTION_ERROR_CODE_TO_I18N,
  RETRY_LAST_TURN_ERROR_CODE_TO_I18N,
  getExecutionInteractionErrorI18nKey,
  getRetryLastTurnErrorI18nKey,
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

describe("getRetryLastTurnErrorI18nKey (CLE-API-WS-EVENTS 「마지막 턴 재시도」)", () => {
  it("마지막 턴 재시도 표의 코드를 모두 재시도 실패 문구로 매핑한다", () => {
    expect(RETRY_LAST_TURN_ERROR_CODE_TO_I18N).toEqual({
      UNAUTHENTICATED: "editor.conversation.systemErrorRetryFailedUnauthenticated",
      NOT_FOUND: "editor.conversation.systemErrorRetryFailedExecutionNotFound",
      RETRY_STATE_NOT_FOUND: "editor.conversation.systemErrorRetryFailedStateExpired",
      NODE_NOT_RETRYABLE:
        "editor.conversation.systemErrorRetryFailedNodeNotRetryable",
      RETRY_TOO_EARLY: "editor.conversation.systemErrorRetryFailedTooEarly",
      INVALID_EXECUTION_STATE:
        "editor.conversation.systemErrorRetryFailedInvalidState",
      INTERNAL_ERROR: "editor.conversation.systemErrorRetryFailedInternal",
    });
    expect(getRetryLastTurnErrorI18nKey("RETRY_TOO_EARLY")).toBe(
      "editor.conversation.systemErrorRetryFailedTooEarly",
    );
  });

  it("같은 INVALID_EXECUTION_STATE 라도 재개 명령과 다른 문구다(기대 상태가 다르다)", () => {
    expect(getRetryLastTurnErrorI18nKey("INVALID_EXECUTION_STATE")).not.toBe(
      getExecutionInteractionErrorI18nKey("INVALID_EXECUTION_STATE"),
    );
  });

  it("재개 명령 전용 코드는 재시도 맵에 없고 재시도 코드는 재개 맵에 없다", () => {
    expect(getRetryLastTurnErrorI18nKey("EXECUTION_INTERNAL_ERROR")).toBeNull();
    expect(getRetryLastTurnErrorI18nKey("EXECUTION_MESSAGE_TOO_LONG")).toBeNull();
    expect(getExecutionInteractionErrorI18nKey("RETRY_TOO_EARLY")).toBeNull();
    expect(getExecutionInteractionErrorI18nKey("INTERNAL_ERROR")).toBeNull();
  });

  it("매핑 없는 코드 · 빈 값 · 문자열이 아닌 값 · 프로토타입 키는 null", () => {
    expect(getRetryLastTurnErrorI18nKey("SOMETHING_ELSE")).toBeNull();
    expect(getRetryLastTurnErrorI18nKey(undefined)).toBeNull();
    expect(getRetryLastTurnErrorI18nKey(null)).toBeNull();
    expect(getRetryLastTurnErrorI18nKey("")).toBeNull();
    expect(getRetryLastTurnErrorI18nKey(42 as unknown as string)).toBeNull();
    expect(getRetryLastTurnErrorI18nKey("toString")).toBeNull();
    expect(getRetryLastTurnErrorI18nKey("constructor")).toBeNull();
  });
});
