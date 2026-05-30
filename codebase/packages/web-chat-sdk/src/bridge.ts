// host ↔ iframe postMessage bridge — spec/7-channel-web-chat/2-sdk §3.
// - 메시지 type 은 wc:* namespace prefix.
// - origin 검증 필수(양방향). host 는 위젯 origin 만, iframe 은 boot 시 host origin 만 수용.
// - 명령 큐: wc:ready 이전 host→iframe 명령은 버퍼링 후 ready 시 flush.

import type { BootConfig, WcMessageType, WidgetEvent } from "./types";
import { WC_MESSAGE_PREFIX } from "./types";

export interface BridgeDeps {
  /** iframe 이 로드할 위젯 SPA URL (정적 CDN 문서). */
  iframeSrc: string;
  /** host 가 수신 검증할 위젯 iframe origin. */
  widgetOrigin: string;
  /** 테스트/SSR 회피용 DOM 주입 (기본 전역 document/window). */
  doc?: Document;
  win?: Window;
}

type Listener = (payload: unknown) => void;

function originOf(url: string): string {
  // URL 파서로 origin 추출 (상대경로/비정상 입력은 throw → boot 단계에서 검증됨).
  return new URL(url).origin;
}

export class WidgetBridge {
  private readonly doc: Document;
  private readonly win: Window;
  private readonly widgetOrigin: string;
  private readonly iframe: HTMLIFrameElement;
  private ready = false;
  private readonly outbox: Array<{ type: WcMessageType; payload?: unknown }> = [];
  private readonly listeners = new Map<WidgetEvent, Set<Listener>>();
  private readonly onMessage: (e: MessageEvent) => void;

  constructor(deps: BridgeDeps) {
    this.doc = deps.doc ?? document;
    this.win = deps.win ?? window;
    this.widgetOrigin = deps.widgetOrigin;

    const iframe = this.doc.createElement("iframe");
    iframe.src = deps.iframeSrc;
    iframe.setAttribute("title", "Channel Web Chat");
    iframe.setAttribute("sandbox", "allow-scripts allow-forms allow-same-origin");
    iframe.style.border = "0";
    iframe.style.position = "fixed";
    this.iframe = iframe;
    this.doc.body.appendChild(iframe);

    this.onMessage = (e: MessageEvent) => this.handleMessage(e);
    this.win.addEventListener("message", this.onMessage);
  }

  /** host → iframe 명령 전송. wc:ready 전이면 버퍼링. */
  post(type: WcMessageType, payload?: unknown): void {
    if (!type.startsWith(WC_MESSAGE_PREFIX)) {
      throw new Error(`[web-chat] 잘못된 메시지 type(prefix 누락): ${type}`);
    }
    if (!this.ready && type !== "wc:boot") {
      this.outbox.push({ type, payload });
      return;
    }
    this.send(type, payload);
  }

  /** iframe → host 이벤트 구독. */
  on(event: WidgetEvent, cb: Listener): void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(cb);
  }

  destroy(): void {
    this.win.removeEventListener("message", this.onMessage);
    this.iframe.parentNode?.removeChild(this.iframe);
    this.listeners.clear();
    this.outbox.length = 0;
  }

  /** 테스트/검사용. */
  get element(): HTMLIFrameElement {
    return this.iframe;
  }
  get isReady(): boolean {
    return this.ready;
  }

  private send(type: WcMessageType, payload?: unknown): void {
    this.iframe.contentWindow?.postMessage({ type, payload }, this.widgetOrigin);
  }

  private handleMessage(e: MessageEvent): void {
    // origin 검증: 위젯 iframe origin + 해당 iframe contentWindow 만 수용.
    if (e.origin !== this.widgetOrigin) return;
    if (e.source && e.source !== this.iframe.contentWindow) return;

    const data = e.data as { type?: string; payload?: unknown } | null;
    if (!data || typeof data.type !== "string") return;
    if (!data.type.startsWith(WC_MESSAGE_PREFIX)) return;

    if (data.type === "wc:ready") {
      this.ready = true;
      this.flush();
      return;
    }
    if (data.type === "wc:event") {
      const ev = data.payload as { name?: WidgetEvent; data?: unknown } | undefined;
      if (ev?.name) this.emit(ev.name, ev.data);
    }
    // wc:resize 등 추가 처리는 후속 increment.
  }

  private flush(): void {
    while (this.outbox.length) {
      const msg = this.outbox.shift()!;
      this.send(msg.type, msg.payload);
    }
  }

  private emit(event: WidgetEvent, payload: unknown): void {
    this.listeners.get(event)?.forEach((cb) => cb(payload));
  }
}

/** boot config 에서 위젯 iframe URL·origin 을 해석. widgetBase 는 배포 env(0-architecture §4). */
export function resolveIframeTarget(
  config: BootConfig,
  widgetBase: string,
): { iframeSrc: string; widgetOrigin: string } {
  const base = widgetBase.replace(/\/$/, "");
  const params = new URLSearchParams({
    apiBase: config.apiBase,
    trigger: config.triggerEndpointPath,
  });
  if (config.locale) params.set("locale", config.locale);
  const iframeSrc = `${base}/web-chat/v1/app/?${params.toString()}`;
  return { iframeSrc, widgetOrigin: originOf(base) };
}
