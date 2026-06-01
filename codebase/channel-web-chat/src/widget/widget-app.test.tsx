import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";
import WidgetApp from "./widget-app";

// boot 은 임베드 soft 검증(embed-config fetch)을 거치므로 비동기 — microtask flush 까지 await.
async function boot(payload: Record<string, unknown>, origin = "https://host.example.com") {
  await act(async () => {
    window.dispatchEvent(
      new MessageEvent("message", { data: { type: "wc:boot", payload }, origin, source: window.parent }),
    );
    // applyConfig → isEmbedAllowed(fetch) → setConfig 의 microtask 체인 flush.
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  // 임베드 설정 fetch 기본 stub — allow-all(enforce=false). TransformInterceptor `{ data }` 래핑형.
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { allowlist: [], enforce: false } }),
    }),
  );
  document.body.innerHTML = "";
});

describe("WidgetApp", () => {
  it("초기에는 런처만 렌더(패널 없음)", () => {
    render(<WidgetApp />);
    expect(screen.getByLabelText("채팅 열기")).toBeInTheDocument();
    expect(screen.queryByLabelText("채팅 패널")).toBeNull();
  });

  it("boot 후 open → 패널(헤더/환영/추천/입력/면책) 렌더", async () => {
    render(<WidgetApp />);
    await boot({
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

  it("닫기 → 런처로 복귀(대화 유지)", async () => {
    render(<WidgetApp />);
    await boot({ apiBase: "https://api.example.com", triggerEndpointPath: "t1", headerTitle: "B" });
    fireEvent.click(screen.getByLabelText("채팅 열기"));
    expect(screen.getByLabelText("채팅 패널")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("닫기"));
    expect(screen.queryByLabelText("채팅 패널")).toBeNull();
    expect(screen.getByLabelText("채팅 열기")).toBeInTheDocument();
  });

  it("임베드 불허 host → 위젯 렌더 거부(런처도 없음)", async () => {
    // detectHostOrigin 은 document.referrer 폴백을 사용(jsdom 엔 ancestorOrigins 없음).
    Object.defineProperty(document, "referrer", {
      value: "https://evil.example.com/page",
      configurable: true,
    });
    // enforce=true + host origin 이 allowlist 에 없음 → BLOCKED.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: { allowlist: ["https://allowed.example.com"], enforce: true },
        }),
      }),
    );
    render(<WidgetApp />);
    await boot({
      apiBase: "https://api.example.com",
      triggerEndpointPath: "t1",
      headerTitle: "B",
    });
    // 차단된 호스트 — 런처/패널 모두 미렌더.
    expect(screen.queryByLabelText("채팅 열기")).toBeNull();
    expect(screen.queryByLabelText("채팅 패널")).toBeNull();
    Object.defineProperty(document, "referrer", { value: "", configurable: true });
  });
});
