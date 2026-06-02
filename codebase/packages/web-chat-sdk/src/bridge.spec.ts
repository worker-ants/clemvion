/**
 * @jest-environment jsdom
 */
import { WidgetBridge } from "./bridge";

const WIDGET_ORIGIN = "https://cdn.example.com";
const IFRAME_SRC = "https://cdn.example.com/web-chat/v1/app/?trigger=x";

function makeBridge() {
  return new WidgetBridge({ iframeSrc: IFRAME_SRC, widgetOrigin: WIDGET_ORIGIN });
}

/** iframe → host 메시지 시뮬레이션. */
function postFromIframe(bridge: WidgetBridge, data: unknown, origin = WIDGET_ORIGIN) {
  window.dispatchEvent(
    new MessageEvent("message", {
      data,
      origin,
      source: bridge.element.contentWindow,
    }),
  );
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("WidgetBridge — iframe 생성", () => {
  it("body 에 sandbox iframe 주입", () => {
    const b = makeBridge();
    expect(b.element.tagName).toBe("IFRAME");
    expect(b.element.src).toBe(IFRAME_SRC);
    expect(b.element.getAttribute("sandbox")).toBe("allow-scripts allow-forms allow-same-origin");
    expect(document.body.contains(b.element)).toBe(true);
  });
});

describe("명령 큐 — wc:ready 전 버퍼링", () => {
  it("ready 전 명령은 버퍼링, ready 후 flush 순서대로 전송", () => {
    const b = makeBridge();
    const spy = jest.spyOn(b.element.contentWindow as Window, "postMessage");
    spy.mockClear(); // 생성 시 wc:boot 호출 분리

    b.post("wc:command", { action: "open" });
    b.post("wc:command", { action: "close" });
    expect(spy).not.toHaveBeenCalled(); // 아직 ready 아님 → 버퍼링

    postFromIframe(b, { type: "wc:ready" });
    expect(b.isReady).toBe(true);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy.mock.calls[0][0]).toMatchObject({ type: "wc:command", payload: { action: "open" } });
    expect(spy.mock.calls[1][0]).toMatchObject({ type: "wc:command", payload: { action: "close" } });
    // targetOrigin 은 위젯 origin
    expect(spy.mock.calls[0][1]).toBe(WIDGET_ORIGIN);
  });

  it("prefix 없는 type 은 throw", () => {
    const b = makeBridge();
    // @ts-expect-error 잘못된 type
    expect(() => b.post("open")).toThrow(/prefix/);
  });
});

describe("origin 검증", () => {
  it("다른 origin 메시지는 무시 (ready 안 됨)", () => {
    const b = makeBridge();
    postFromIframe(b, { type: "wc:ready" }, "https://evil.example.com");
    expect(b.isReady).toBe(false);
  });

  it("wc: prefix 없는 메시지는 무시", () => {
    const b = makeBridge();
    postFromIframe(b, { type: "ready" });
    expect(b.isReady).toBe(false);
  });
});

describe("이벤트 구독 — wc:event", () => {
  it("on(event) 리스너가 호출", () => {
    const b = makeBridge();
    const cb = jest.fn();
    b.on("message", cb);
    postFromIframe(b, { type: "wc:event", payload: { name: "message", data: { text: "hi" } } });
    expect(cb).toHaveBeenCalledWith({ text: "hi" });
  });

  it("구독하지 않은 이벤트는 무시", () => {
    const b = makeBridge();
    const cb = jest.fn();
    b.on("unread", cb);
    postFromIframe(b, { type: "wc:event", payload: { name: "message" } });
    expect(cb).not.toHaveBeenCalled();
  });

  it("on() 이 반환한 해제 함수 호출 시 더 이상 호출 안 됨", () => {
    const b = makeBridge();
    const cb = jest.fn();
    const unsubscribe = b.on("message", cb);
    unsubscribe();
    postFromIframe(b, { type: "wc:event", payload: { name: "message", data: 1 } });
    expect(cb).not.toHaveBeenCalled();
  });

  it("off(event, cb) 는 해당 핸들러만, off(event) 는 이벤트 전체 해제", () => {
    const b = makeBridge();
    const a = jest.fn();
    const c = jest.fn();
    b.on("message", a);
    b.on("message", c);
    b.off("message", a); // a 만 해제
    postFromIframe(b, { type: "wc:event", payload: { name: "message", data: 1 } });
    expect(a).not.toHaveBeenCalled();
    expect(c).toHaveBeenCalledTimes(1);

    b.off("message"); // 전체 해제
    postFromIframe(b, { type: "wc:event", payload: { name: "message", data: 2 } });
    expect(c).toHaveBeenCalledTimes(1);
  });
});

describe("wc:resize — host 가 iframe 박스를 위젯 요청 크기에 맞춤", () => {
  it("width/height 숫자는 px, 문자열은 그대로 적용 + state 기록", () => {
    const b = makeBridge();
    postFromIframe(b, {
      type: "wc:resize",
      payload: { width: 380, height: "100%", state: "expanded" },
    });
    expect(b.element.style.width).toBe("380px");
    expect(b.element.style.height).toBe("100%");
    expect(b.element.dataset.wcState).toBe("expanded");
  });

  it("누락된 축은 기존 값 유지", () => {
    const b = makeBridge();
    b.element.style.width = "64px";
    postFromIframe(b, { type: "wc:resize", payload: { height: 600 } });
    expect(b.element.style.width).toBe("64px"); // 유지
    expect(b.element.style.height).toBe("600px");
  });

  it("payload 누락 시 무시(throw 없음)", () => {
    const b = makeBridge();
    expect(() => postFromIframe(b, { type: "wc:resize" })).not.toThrow();
  });
});

describe("destroy", () => {
  it("iframe 제거 + 이후 메시지 무시", () => {
    const b = makeBridge();
    const cb = jest.fn();
    b.on("message", cb);
    b.destroy();
    expect(document.querySelector("iframe")).toBeNull();
    postFromIframe(b, { type: "wc:event", payload: { name: "message" } });
    expect(cb).not.toHaveBeenCalled();
  });
});

describe("wc:resize — state 필드 누락 시 dataset.wcState 미변경 (Info#15)", () => {
  it("state 없는 resize payload → dataset.wcState 변경 안 됨", () => {
    const b = makeBridge();
    b.element.dataset.wcState = "collapsed";
    postFromIframe(b, { type: "wc:resize", payload: { width: 200 } });
    expect(b.element.dataset.wcState).toBe("collapsed"); // 변경 안 됨
    expect(b.element.style.width).toBe("200px");
  });
});
