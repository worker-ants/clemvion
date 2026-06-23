import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import { useLocaleStore } from "@/lib/stores/locale-store";
import { LivePreview } from "../live-preview";
import { DEFAULT_DRAFT } from "../use-appearance-draft";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  usePathname: () => "/web-chat",
  useSearchParams: () => new URLSearchParams(),
}));

const ORIGIN = window.location.origin;

beforeEach(() => {
  useLocaleStore.setState({ locale: "en" });
  cleanup();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("LivePreview", () => {
  it("iframe src 가 동봉 위젯 app 경로 + apiBase/trigger/locale query 를 포함", () => {
    render(<LivePreview endpointPath="ep-123" draft={{ ...DEFAULT_DRAFT, locale: "ko" }} />);
    const iframe = screen.getByTitle("Live preview") as HTMLIFrameElement;
    expect(iframe.src).toContain("/_widget/web-chat/v1/app/");
    expect(iframe.src).toContain("trigger=ep-123");
    expect(iframe.src).toContain("apiBase=");
    expect(iframe.src).toContain("locale=ko");
  });

  it("위젯 wc:ready 수신 시 wc:boot 으로 boot config 를 전달", async () => {
    render(<LivePreview endpointPath="ep-123" draft={{ ...DEFAULT_DRAFT, headerTitle: "Hi bot" }} />);
    const iframe = screen.getByTitle("Live preview") as HTMLIFrameElement;
    const cw = iframe.contentWindow;
    expect(cw).toBeTruthy();
    const postSpy = vi.spyOn(cw as Window, "postMessage");

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent("message", { source: cw, origin: ORIGIN, data: { type: "wc:ready" } }),
      );
    });

    expect(postSpy).toHaveBeenCalledTimes(1);
    const [payload] = postSpy.mock.calls[0];
    expect(payload).toMatchObject({
      type: "wc:boot",
      payload: { triggerEndpointPath: "ep-123", headerTitle: "Hi bot" },
    });
  });

  it("다른 origin 의 메시지는 무시한다", async () => {
    render(<LivePreview endpointPath="ep-1" draft={DEFAULT_DRAFT} />);
    const iframe = screen.getByTitle("Live preview") as HTMLIFrameElement;
    const cw = iframe.contentWindow;
    const postSpy = vi.spyOn(cw as Window, "postMessage");
    await act(async () => {
      window.dispatchEvent(
        new MessageEvent("message", {
          source: cw,
          origin: "https://evil.example.com",
          data: { type: "wc:ready" },
        }),
      );
    });
    expect(postSpy).not.toHaveBeenCalled();
  });

  it("ready 후 외형 폼이 바뀌면 재마운트 없이 wc:boot 을 재전송", async () => {
    const { rerender } = render(
      <LivePreview endpointPath="ep-1" draft={{ ...DEFAULT_DRAFT, headerTitle: "A" }} />,
    );
    const iframe = screen.getByTitle("Live preview") as HTMLIFrameElement;
    const cw = iframe.contentWindow;
    const postSpy = vi.spyOn(cw as Window, "postMessage");

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent("message", { source: cw, origin: ORIGIN, data: { type: "wc:ready" } }),
      );
    });
    expect(postSpy).toHaveBeenCalledTimes(1); // 초기 boot

    // 외형(headerTitle)만 변경 → 재마운트 없이 boot 재전송
    await act(async () => {
      rerender(<LivePreview endpointPath="ep-1" draft={{ ...DEFAULT_DRAFT, headerTitle: "B" }} />);
    });
    expect(postSpy).toHaveBeenCalledTimes(2);
    expect(postSpy.mock.calls[1][0]).toMatchObject({ payload: { headerTitle: "B" } });
    // iframe 은 재마운트되지 않았다(같은 contentWindow).
    expect((screen.getByTitle("Live preview") as HTMLIFrameElement).contentWindow).toBe(cw);
  });

  it("wc:ready 가 타임아웃까지 안 오면 안내 메시지를 노출", async () => {
    vi.useFakeTimers();
    render(<LivePreview endpointPath="ep-1" draft={DEFAULT_DRAFT} />);
    await act(async () => {
      vi.advanceTimersByTime(8000);
    });
    expect(
      screen.getByText("Live preview becomes available once the widget bundle is co-deployed"),
    ).toBeInTheDocument();
  });
});
