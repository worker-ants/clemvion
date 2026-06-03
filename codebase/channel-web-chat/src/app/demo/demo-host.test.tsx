import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import DemoHost from "./demo-host";

afterEach(cleanup);

const BOOT_NAME = "부팅 (wc:boot 전송)";

function fillTrigger(value: string) {
  fireEvent.change(screen.getByPlaceholderText(/a1b2c3/), { target: { value } });
}

function bootMessage(type: string, init: Partial<MessageEventInit>) {
  return new MessageEvent("message", { data: { type }, ...init });
}

describe("DemoHost", () => {
  it("keeps boot disabled until apiBase & trigger are both set", () => {
    render(<DemoHost />);
    const btn = screen.getByRole("button", { name: BOOT_NAME });
    expect(btn).toBeDisabled(); // 기본 apiBase 는 있으나 trigger 가 비어 있음
    fillTrigger("my-trigger");
    expect(btn).toBeEnabled();
  });

  it("sends wc:boot to the iframe once the widget posts wc:ready", () => {
    const { container } = render(<DemoHost />);
    fillTrigger("my-trigger");
    fireEvent.click(screen.getByRole("button", { name: BOOT_NAME }));

    const cw = container.querySelector("iframe")!.contentWindow!;
    const postSpy = vi.spyOn(cw, "postMessage");

    act(() => {
      window.dispatchEvent(
        bootMessage("wc:ready", { origin: window.location.origin, source: cw }),
      );
    });

    const bootCall = postSpy.mock.calls.find(
      (c) => (c[0] as { type?: string })?.type === "wc:boot",
    );
    expect(bootCall).toBeTruthy();
    expect((bootCall![0] as { payload: { triggerEndpointPath: string } }).payload.triggerEndpointPath).toBe(
      "my-trigger",
    );
    // boot 후 명령 버튼 활성화
    expect(screen.getByRole("button", { name: "open" })).toBeEnabled();
  });

  it("ignores wc:ready from a foreign source or origin (I6 검증)", () => {
    const { container } = render(<DemoHost />);
    fillTrigger("my-trigger");
    fireEvent.click(screen.getByRole("button", { name: BOOT_NAME }));

    const cw = container.querySelector("iframe")!.contentWindow!;
    const postSpy = vi.spyOn(cw, "postMessage");

    act(() => {
      // 잘못된 source(부모 window) — 위젯 iframe 이 아님
      window.dispatchEvent(bootMessage("wc:ready", { origin: window.location.origin, source: window }));
      // 잘못된 origin
      window.dispatchEvent(bootMessage("wc:ready", { origin: "http://evil.example", source: cw }));
    });

    expect(
      postSpy.mock.calls.find((c) => (c[0] as { type?: string })?.type === "wc:boot"),
    ).toBeUndefined();
    expect(screen.getByRole("button", { name: "open" })).toBeDisabled();
  });

  it("forwards open command as a wc:command after boot", () => {
    const { container } = render(<DemoHost />);
    fillTrigger("my-trigger");
    fireEvent.click(screen.getByRole("button", { name: BOOT_NAME }));

    const cw = container.querySelector("iframe")!.contentWindow!;
    const postSpy = vi.spyOn(cw, "postMessage");
    act(() => {
      window.dispatchEvent(bootMessage("wc:ready", { origin: window.location.origin, source: cw }));
    });
    fireEvent.click(screen.getByRole("button", { name: "open" }));

    const cmd = postSpy.mock.calls.find((c) => (c[0] as { type?: string })?.type === "wc:command");
    expect((cmd![0] as { payload: { action: string } }).payload.action).toBe("open");
  });
});
