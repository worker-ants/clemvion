import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AssistantMessageView } from "./assistant-message";
import type { AssistantDisplayMessage } from "@/lib/stores/assistant-store";
import { useLocaleStore } from "@/lib/stores/locale-store";
import { assistant as koAssistant } from "@/lib/i18n/dict/ko/assistant";
import { assistant as enAssistant } from "@/lib/i18n/dict/en/assistant";

/**
 * REQ-ASSIST-048 · 010 · 041 — 에러 버블은 에러 코드로 사전 문구를 고른다.
 * 서버 `message` 가 무엇이든 사전 문구가 있는 코드에서는 화면에 싣지 않는다.
 * 사전 문구가 없는 코드만 서버의 영문 `message` 로 폴백한다.
 */

const SERVER_MESSAGE = "Server says: provider detail sk-raw-secret";

function errorMessage(code: string): AssistantDisplayMessage {
  return {
    id: "a-1",
    role: "assistant",
    content: "",
    toolCalls: [],
    plan: null,
    streaming: false,
    createdAt: "2026-10-24T00:00:00.000Z",
    error: { code, message: SERVER_MESSAGE },
  };
}

function renderError(code: string) {
  return render(
    <AssistantMessageView
      message={errorMessage(code)}
      onApprovePlan={vi.fn()}
      onContinueAfterBudget={vi.fn()}
    />,
  );
}

describe("AssistantMessageView error bubble", () => {
  beforeEach(() => {
    useLocaleStore.setState({ locale: "ko" });
  });
  afterEach(() => cleanup());

  it.each([
    ["ASSISTANT_NO_LLM_CONFIG", koAssistant.errorNoLlmConfig],
    ["ASSISTANT_STREAM_FAILED", koAssistant.errorStreamFailed],
    ["LLM_RATE_LIMIT", koAssistant.errorRateLimit],
    ["LLM_CONNECTION_ERROR", koAssistant.errorConnection],
  ])(
    "shows the dictionary text for %s instead of the server message",
    (code, text) => {
      renderError(code);
      const alert = screen.getByRole("alert");
      expect(alert.textContent).toContain(text);
      expect(alert.textContent).toContain(code);
      expect(alert.textContent).not.toContain("sk-raw-secret");
    },
  );

  it("uses the English dictionary in the en locale", () => {
    useLocaleStore.setState({ locale: "en" });
    renderError("LLM_RATE_LIMIT");
    expect(screen.getByRole("alert").textContent).toContain(
      enAssistant.errorRateLimit,
    );
  });

  it("links ASSISTANT_NO_LLM_CONFIG to the chat model settings", () => {
    renderError("ASSISTANT_NO_LLM_CONFIG");
    const link = screen.getByRole("link", {
      name: koAssistant.errorNoLlmConfigLink,
    });
    expect(link.getAttribute("href")).toBe("/models?tab=chat");
  });

  it.each(["ASSISTANT_STREAM_FAILED", "LLM_RATE_LIMIT"])(
    "does not show the settings link for %s",
    (code) => {
      renderError(code);
      expect(screen.queryByRole("link")).toBeNull();
    },
  );

  it("falls back to the server message for a code without dictionary text", () => {
    renderError("ASSISTANT_TOO_MANY_TOOL_CALLS");
    expect(screen.getByRole("alert").textContent).toContain(SERVER_MESSAGE);
    expect(
      screen.getByRole("button", {
        name: koAssistant.continueAfterBudgetButton,
      }),
    ).toBeDefined();
  });
});
