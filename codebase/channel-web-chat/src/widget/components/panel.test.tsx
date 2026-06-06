import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Panel } from "./panel";
import type { WidgetState } from "@/lib/widget-state";

// W6: panel.tsx Composer disabled 게이팅 테스트.
// phase/pending 조합별 Composer enabled/disabled 검증 (eager 시작 핵심 UX).

const BASE_CONFIG = {
  apiBase: "https://api.test",
  triggerEndpointPath: "t1",
};

const BASE_ACTIONS = {
  close: vi.fn(),
  submitMessage: vi.fn(),
  clickButton: vi.fn(),
  submitForm: vi.fn(),
  newChat: vi.fn(),
};

function makeState(overrides: Partial<WidgetState>): WidgetState {
  return {
    phase: "awaiting_user_message",
    open: true,
    hidden: false,
    messages: [],
    pending: null,
    unread: 0,
    ...overrides,
  };
}

describe("Panel — Composer disabled 게이팅 (W6, §R6)", () => {
  it("phase=booting → Composer disabled", () => {
    render(
      <Panel
        state={makeState({ phase: "booting" })}
        config={BASE_CONFIG}
        actions={BASE_ACTIONS}
      />,
    );
    expect(screen.getByLabelText("메시지 입력")).toBeDisabled();
  });

  it("phase=streaming → Composer disabled", () => {
    render(
      <Panel
        state={makeState({ phase: "streaming" })}
        config={BASE_CONFIG}
        actions={BASE_ACTIONS}
      />,
    );
    expect(screen.getByLabelText("메시지 입력")).toBeDisabled();
  });

  it("phase=awaiting_user_message + pending=buttons → Composer disabled", () => {
    render(
      <Panel
        state={makeState({
          phase: "awaiting_user_message",
          pending: { type: "buttons", config: { buttons: [{ buttonId: "b1", label: "예" }] } },
        })}
        config={BASE_CONFIG}
        actions={BASE_ACTIONS}
      />,
    );
    expect(screen.getByLabelText("메시지 입력")).toBeDisabled();
  });

  it("phase=awaiting_user_message + pending=form → Composer disabled", () => {
    render(
      <Panel
        state={makeState({
          phase: "awaiting_user_message",
          pending: { type: "form", config: { fields: [] } },
        })}
        config={BASE_CONFIG}
        actions={BASE_ACTIONS}
      />,
    );
    expect(screen.getByLabelText("메시지 입력")).toBeDisabled();
  });

  it("phase=awaiting_user_message + pending.type=ai_conversation → Composer enabled", () => {
    render(
      <Panel
        state={makeState({
          phase: "awaiting_user_message",
          pending: { type: "ai_conversation", nodeId: "n1" },
        })}
        config={BASE_CONFIG}
        actions={BASE_ACTIONS}
      />,
    );
    expect(screen.getByLabelText("메시지 입력")).not.toBeDisabled();
  });

  it("phase=awaiting_user_message + pending=null → Composer enabled (ai_conversation 이전 상태)", () => {
    render(
      <Panel
        state={makeState({ phase: "awaiting_user_message", pending: null })}
        config={BASE_CONFIG}
        actions={BASE_ACTIONS}
      />,
    );
    expect(screen.getByLabelText("메시지 입력")).not.toBeDisabled();
  });
});
