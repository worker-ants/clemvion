import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AssistantMessageView, ERROR_MESSAGE_KEYS } from "./assistant-message";
import type { AssistantDisplayMessage } from "@/lib/stores/assistant-store";
import { useLocaleStore } from "@/lib/stores/locale-store";
import { assistant as koAssistant } from "@/lib/i18n/dict/ko/assistant";
import { assistant as enAssistant } from "@/lib/i18n/dict/en/assistant";

/**
 * REQ-ASSIST-048 · 010 · 041 — 에러 버블은 에러 코드로 사전 문구를 고른다.
 * 서버 `message` 가 무엇이든 사전 문구가 있는 코드에서는 화면에 싣지 않는다.
 * 사전 문구가 없는 코드만 서버의 영문 `message` 로 폴백한다.
 */

/**
 * 사전 문구를 고르는 모든 에러 코드. 백엔드 표(`workflow-assistant-stream-errors.ts`)가
 * 문구를 정하는 코드와 같은 집합이어야 한다. 백엔드 테스트
 * (`workflow-assistant-stream-errors.spec.ts`)가 같은 목록을 따로 들고 있어서,
 * 코드를 더하거나 빼면 양쪽 목록을 함께 고쳐야 두 테스트가 모두 통과한다.
 */
const MAPPED_ERROR_CODES = [
  "ASSISTANT_NO_LLM_CONFIG",
  "ASSISTANT_STREAM_FAILED",
  "ASSISTANT_TOO_MANY_TOOL_CALLS",
  "LLM_CONNECTION_ERROR",
  "LLM_OUTPUT_MALFORMED",
  "LLM_RATE_LIMIT",
];

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

  it("maps exactly the codes the backend table fixes a message for", () => {
    expect([...ERROR_MESSAGE_KEYS.keys()].sort()).toEqual(MAPPED_ERROR_CODES);
  });

  it.each([
    ["ASSISTANT_NO_LLM_CONFIG", koAssistant.errorNoLlmConfig],
    ["ASSISTANT_STREAM_FAILED", koAssistant.errorStreamFailed],
    ["ASSISTANT_TOO_MANY_TOOL_CALLS", koAssistant.errorTooManyToolCalls],
    ["LLM_RATE_LIMIT", koAssistant.errorRateLimit],
    ["LLM_CONNECTION_ERROR", koAssistant.errorConnection],
    ["LLM_OUTPUT_MALFORMED", koAssistant.errorOutputMalformed],
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

  it.each([
    ["ASSISTANT_NO_LLM_CONFIG", enAssistant.errorNoLlmConfig],
    ["ASSISTANT_STREAM_FAILED", enAssistant.errorStreamFailed],
    ["ASSISTANT_TOO_MANY_TOOL_CALLS", enAssistant.errorTooManyToolCalls],
    ["LLM_RATE_LIMIT", enAssistant.errorRateLimit],
    ["LLM_CONNECTION_ERROR", enAssistant.errorConnection],
    ["LLM_OUTPUT_MALFORMED", enAssistant.errorOutputMalformed],
  ])("uses the English dictionary for %s in the en locale", (code, text) => {
    useLocaleStore.setState({ locale: "en" });
    renderError(code);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain(text);
    expect(alert.textContent).not.toContain("sk-raw-secret");
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
    renderError("LLM_SOMETHING_NEW");
    expect(screen.getByRole("alert").textContent).toContain(SERVER_MESSAGE);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows the dictionary text and the continue button for ASSISTANT_TOO_MANY_TOOL_CALLS", () => {
    renderError("ASSISTANT_TOO_MANY_TOOL_CALLS");
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain(koAssistant.errorTooManyToolCalls);
    expect(alert.textContent).not.toContain(SERVER_MESSAGE);
    expect(
      screen.getByRole("button", {
        name: koAssistant.continueAfterBudgetButton,
      }),
    ).toBeDefined();
  });

  // 사전 문구가 가리키는 버튼 이름이 바뀌면 문구가 낡는다.
  it.each([
    ["ko", koAssistant],
    ["en", enAssistant],
  ] as const)(
    "names the continue button in the %s ASSISTANT_TOO_MANY_TOOL_CALLS text",
    (_locale, dict) => {
      expect(dict.errorTooManyToolCalls).toContain(
        dict.continueAfterBudgetButton,
      );
    },
  );
});
