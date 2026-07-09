import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
  endConversation: vi.fn(),
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

  it("phase=ended → Composer 자체 미렌더(입력창 없음), '새 대화 시작' 버튼 노출", () => {
    // 종료 화면에서는 Composer 를 disabled 가 아니라 아예 렌더하지 않는다(panel.tsx `!isEnded` 게이팅).
    render(
      <Panel
        state={makeState({ phase: "ended" })}
        config={BASE_CONFIG}
        actions={BASE_ACTIONS}
      />,
    );
    expect(screen.queryByLabelText("메시지 입력")).toBeNull();
    expect(screen.getByText("새 대화 시작")).not.toBeNull();
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

describe("Panel — 헤더 세션 컨트롤(새 대화/종료) + 가벼운 확인 (§3.1)", () => {
  it.each(["booting", "streaming", "awaiting_user_message"] as const)(
    "진행 중(%s) 이면 '새 대화'·'대화 종료' 컨트롤 노출",
    (phase) => {
      render(<Panel state={makeState({ phase })} config={BASE_CONFIG} actions={BASE_ACTIONS} />);
      // 헤더 컨트롤(라벨 '새 대화' / '대화 종료'). ended CTA '새 대화 시작' 과 라벨로 구분.
      expect(screen.getByRole("button", { name: "새 대화" })).not.toBeNull();
      expect(screen.getByRole("button", { name: "대화 종료" })).not.toBeNull();
    },
  );

  it("ended 면 헤더 세션 컨트롤 미노출(대화 종료 CTA 로 충분)", () => {
    render(
      <Panel
        state={makeState({ phase: "ended", messages: [{ role: "assistant", text: "끝", source: "live" }] })}
        config={BASE_CONFIG}
        actions={BASE_ACTIONS}
      />,
    );
    expect(screen.queryByRole("button", { name: "새 대화" })).toBeNull();
    expect(screen.queryByRole("button", { name: "대화 종료" })).toBeNull();
  });

  it("collapsed/panel(대화 시작 전) 이면 헤더 세션 컨트롤 미노출", () => {
    render(
      <Panel
        state={makeState({ phase: "panel" })}
        config={BASE_CONFIG}
        actions={BASE_ACTIONS}
      />,
    );
    expect(screen.queryByRole("button", { name: "새 대화" })).toBeNull();
    expect(screen.queryByRole("button", { name: "대화 종료" })).toBeNull();
  });

  it("'대화 종료' 클릭 → 확인 바 노출, 즉시 endConversation 호출 안 함", () => {
    render(
      <Panel
        state={makeState({ phase: "awaiting_user_message" })}
        config={BASE_CONFIG}
        actions={BASE_ACTIONS}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "대화 종료" }));
    expect(screen.getByRole("alertdialog")).not.toBeNull();
    expect(BASE_ACTIONS.endConversation).not.toHaveBeenCalled();
  });

  it("확인 바에서 '대화 종료 확정' → endConversation 호출", () => {
    render(
      <Panel
        state={makeState({ phase: "awaiting_user_message" })}
        config={BASE_CONFIG}
        actions={BASE_ACTIONS}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "대화 종료" }));
    // 확정 버튼은 별도 접근성 이름("대화 종료 확정") — CSS 클래스 결합 없이 role 로 구분.
    fireEvent.click(screen.getByRole("button", { name: "대화 종료 확정" }));
    expect(BASE_ACTIONS.endConversation).toHaveBeenCalledTimes(1);
    expect(BASE_ACTIONS.newChat).not.toHaveBeenCalled();
  });

  it("'대화 종료' 확인바에서 '취소' → endConversation 미호출, 확인바 닫힘", () => {
    render(
      <Panel
        state={makeState({ phase: "awaiting_user_message" })}
        config={BASE_CONFIG}
        actions={BASE_ACTIONS}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "대화 종료" }));
    fireEvent.click(screen.getByRole("button", { name: "확인 취소" }));
    expect(BASE_ACTIONS.endConversation).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("'새 대화' 확인 → newChat 호출, '취소' → 아무 액션 없음", () => {
    render(
      <Panel
        state={makeState({ phase: "awaiting_user_message" })}
        config={BASE_CONFIG}
        actions={BASE_ACTIONS}
      />,
    );
    // 취소 경로.
    fireEvent.click(screen.getByRole("button", { name: "새 대화" }));
    fireEvent.click(screen.getByRole("button", { name: "확인 취소" }));
    expect(BASE_ACTIONS.newChat).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    // 확정 경로.
    fireEvent.click(screen.getByRole("button", { name: "새 대화" }));
    fireEvent.click(screen.getByRole("button", { name: "새 대화 시작 확정" }));
    expect(BASE_ACTIONS.newChat).toHaveBeenCalledTimes(1);
  });
});
