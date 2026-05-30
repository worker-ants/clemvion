import { describe, it, expect, vi, beforeEach } from "vitest";
import { createIframeBridge } from "./host-bridge";

// jsdom 에서 window.parent === window. parent.postMessage 를 스파이.
let postSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  postSpy = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {});
});

function messageFromHost(data: unknown, origin = "https://host.example.com") {
  window.dispatchEvent(new MessageEvent("message", { data, origin, source: window.parent }));
}

describe("createIframeBridge — 핸드셰이크", () => {
  it("생성 시 wc:ready 를 parent 로(targetOrigin '*') 송신", () => {
    createIframeBridge();
    expect(postSpy).toHaveBeenCalledWith({ type: "wc:ready", payload: undefined }, "*");
  });
});

describe("wc:boot 수신", () => {
  it("boot 콜백 호출 + host origin 핀", () => {
    const b = createIframeBridge();
    const onBoot = vi.fn();
    b.onBoot(onBoot);
    messageFromHost({ type: "wc:boot", payload: { apiBase: "https://api", triggerEndpointPath: "t" } });
    expect(onBoot).toHaveBeenCalledWith({ apiBase: "https://api", triggerEndpointPath: "t" });
    expect(b.hostOrigin).toBe("https://host.example.com");
  });

  it("핀 이후 다른 origin 의 명령은 무시", () => {
    const b = createIframeBridge();
    const onCommand = vi.fn();
    b.onCommand(onCommand);
    messageFromHost({ type: "wc:boot", payload: { apiBase: "a", triggerEndpointPath: "t" } });
    // 다른 origin 에서 온 명령
    messageFromHost({ type: "wc:command", payload: { action: "open" } }, "https://evil.example.com");
    expect(onCommand).not.toHaveBeenCalled();
  });
});

describe("wc:command 수신 + wc:event 송신", () => {
  it("command 콜백 호출", () => {
    const b = createIframeBridge();
    const onCommand = vi.fn();
    b.onCommand(onCommand);
    messageFromHost({ type: "wc:boot", payload: { apiBase: "a", triggerEndpointPath: "t" } });
    messageFromHost({ type: "wc:command", payload: { action: "sendMessage", text: "hi" } });
    expect(onCommand).toHaveBeenCalledWith({ action: "sendMessage", text: "hi" });
  });

  it("sendEvent 는 핀된 host origin 으로 송신", () => {
    const b = createIframeBridge();
    messageFromHost({ type: "wc:boot", payload: { apiBase: "a", triggerEndpointPath: "t" } });
    postSpy.mockClear();
    b.sendEvent("message", { text: "응답" });
    expect(postSpy).toHaveBeenCalledWith(
      { type: "wc:event", payload: { name: "message", data: { text: "응답" } } },
      "https://host.example.com",
    );
  });
});

describe("wc: prefix 검증", () => {
  it("prefix 없는 메시지는 무시", () => {
    const b = createIframeBridge();
    const onBoot = vi.fn();
    b.onBoot(onBoot);
    messageFromHost({ type: "boot", payload: {} });
    expect(onBoot).not.toHaveBeenCalled();
  });
});
