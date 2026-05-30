import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";
import WidgetApp from "./widget-app";

function boot(payload: Record<string, unknown>, origin = "https://host.example.com") {
  act(() => {
    window.dispatchEvent(
      new MessageEvent("message", { data: { type: "wc:boot", payload }, origin, source: window.parent }),
    );
  });
}

beforeEach(() => {
  // suggestion 클릭이 네트워크로 새지 않도록 fetch 차단(미사용 테스트지만 안전).
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 202, json: async () => ({ executionId: "e1" }) }));
  document.body.innerHTML = "";
});

describe("WidgetApp", () => {
  it("초기에는 런처만 렌더(패널 없음)", () => {
    render(<WidgetApp />);
    expect(screen.getByLabelText("채팅 열기")).toBeInTheDocument();
    expect(screen.queryByLabelText("채팅 패널")).toBeNull();
  });

  it("boot 후 open → 패널(헤더/환영/추천/입력/면책) 렌더", () => {
    render(<WidgetApp />);
    boot({
      apiBase: "https://api.example.com",
      triggerEndpointPath: "t1",
      headerTitle: "ALF",
      welcome: { text: "안녕하세요!", suggestions: ["제품 소개"] },
      disclaimer: "AI는 한정된 데이터로 동작합니다.",
    });
    fireEvent.click(screen.getByLabelText("채팅 열기"));

    expect(screen.getByLabelText("채팅 패널")).toBeInTheDocument();
    expect(screen.getByText("ALF")).toBeInTheDocument();
    expect(screen.getByText("안녕하세요!")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "제품 소개" })).toBeInTheDocument();
    expect(screen.getByLabelText("메시지 입력")).toBeInTheDocument();
    expect(screen.getByText("AI는 한정된 데이터로 동작합니다.")).toBeInTheDocument();
  });

  it("닫기 → 런처로 복귀(대화 유지)", () => {
    render(<WidgetApp />);
    boot({ apiBase: "https://api.example.com", triggerEndpointPath: "t1", headerTitle: "B" });
    fireEvent.click(screen.getByLabelText("채팅 열기"));
    expect(screen.getByLabelText("채팅 패널")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("닫기"));
    expect(screen.queryByLabelText("채팅 패널")).toBeNull();
    expect(screen.getByLabelText("채팅 열기")).toBeInTheDocument();
  });
});
