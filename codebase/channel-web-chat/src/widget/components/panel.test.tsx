import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Panel } from "./panel";
import type { WidgetState } from "@/lib/widget-state";

// W6: panel.tsx Composer disabled 게이팅 + AI 처리 중 로딩 표시(§R6) 테스트.
// phase/pending 조합별 Composer enabled/disabled 검증 (eager 시작 핵심 UX).

beforeEach(() => {
  // 공유 BASE_ACTIONS vi.fn() 누적 호출 격리(향후 호출 검증 추가 대비).
  vi.clearAllMocks();
});

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

describe("Panel — AI 처리 중 전송 버튼 로딩 표시 (§R6)", () => {
  it("phase=streaming → 전송 버튼이 로딩(aria-busy)·스피너, 입력은 여전히 비활성", () => {
    render(
      <Panel
        state={makeState({ phase: "streaming" })}
        config={BASE_CONFIG}
        actions={BASE_ACTIONS}
      />,
    );
    const btn = screen.getByLabelText("AI 응답 중");
    expect(btn).toHaveAttribute("aria-busy", "true");
    expect(btn).toBeDisabled();
    expect(btn.querySelector(".wc-composer-spinner")).not.toBeNull();
    // R6: AI 처리 중 자유 텍스트 입력은 계속 차단.
    expect(screen.getByLabelText("메시지 입력")).toBeDisabled();
  });

  it("phase=booting → 전송 버튼 로딩 표시(streaming 과 동등)", () => {
    render(
      <Panel
        state={makeState({ phase: "booting" })}
        config={BASE_CONFIG}
        actions={BASE_ACTIONS}
      />,
    );
    const btn = screen.getByLabelText("AI 응답 중");
    expect(btn).toHaveAttribute("aria-busy", "true");
    expect(btn).toBeDisabled();
    expect(btn.querySelector(".wc-composer-spinner")).not.toBeNull();
    expect(screen.getByLabelText("메시지 입력")).toBeDisabled();
  });

  it("phase=awaiting_user_message → 로딩 아님(전송 라벨, aria-busy 없음)", () => {
    render(
      <Panel
        state={makeState({ phase: "awaiting_user_message", pending: null })}
        config={BASE_CONFIG}
        actions={BASE_ACTIONS}
      />,
    );
    expect(screen.queryByLabelText("AI 응답 중")).toBeNull();
    expect(screen.getByLabelText("전송")).not.toHaveAttribute("aria-busy");
  });
});
