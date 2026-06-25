// host ↔ iframe postMessage bridge — spec/7-channel-web-chat/2-sdk §3.
// - 메시지 type 은 wc:* namespace prefix.
// - origin 검증 필수(양방향). host 는 위젯 origin 만, iframe 은 boot 시 host origin 만 수용.
// - 명령 큐: wc:ready 이전 host→iframe 명령은 버퍼링 후 ready 시 flush.

import type {
  BootConfig,
  Unsubscribe,
  WcMessageType,
  WcResizePayload,
  WidgetEvent,
} from "./types";
import { WC_MESSAGE_PREFIX } from "./types";

export interface BridgeDeps {
  /** iframe 이 로드할 위젯 SPA URL (정적 CDN 문서). */
  iframeSrc: string;
  /** host 가 수신 검증할 위젯 iframe origin. */
  widgetOrigin: string;
  /** 위젯 코너 고정 위치 (appearance.position). 기본 bottom-right. (spec 2-sdk §3 — position 은 appearance 를 따른다) */
  position?: "bottom-right" | "bottom-left";
  /** iframe z-index (appearance.zIndex). 미지정 시 기본 최상위값. */
  zIndex?: number;
  /** 테스트/SSR 회피용 DOM 주입 (기본 전역 document/window). */
  doc?: Document;
  win?: Window;
}

/** iframe 기본 z-index — 호스트 페이지 콘텐츠 위로 올린다(spec 2-sdk §1 스니펫 예시값). appearance.zIndex 로 override. */
export const DEFAULT_Z_INDEX = 2147483000;

type Listener = (payload: unknown) => void;

function originOf(url: string): string {
  // URL 파서로 origin 추출 (상대경로/비정상 입력은 throw → boot 단계에서 검증됨).
  return new URL(url).origin;
}

/**
 * host ↔ iframe postMessage bridge. 위젯 SPA iframe 을 생성·뷰포트 코너에 고정하고, wc:* 메시지를
 * 중계한다(wc:ready 전 명령 버퍼링, wc:resize 로 iframe 크기 조정, wc:event 구독 fan-out).
 * spec/7-channel-web-chat/2-sdk §3.
 */
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
    // 코너 고정 — position:fixed 만으로는 in-flow 정적 위치(본문 끝, 화면 밖)에 박히므로
    // 뷰포트 코너에 anchor 한다. 위젯 SPA 가 iframe 내부에서 launcher/panel 을 bottom/side:16px 로
    // 띄우고 박스(LAUNCHER_BOX 392×132 등)에 여백을 포함하므로 iframe 은 코너 flush(0)로 고정.
    // position/zIndex 는 appearance 를 따른다 (spec 2-sdk §3).
    iframe.style.position = "fixed";
    iframe.style.bottom = "0";
    // bottom-left 외 모든 값(미지정·미지원 값 포함)은 기본 bottom-right 로 anchor — 항상 한 코너에 고정됨을 보장.
    if (deps.position === "bottom-left") iframe.style.left = "0";
    else iframe.style.right = "0";
    iframe.style.zIndex = String(deps.zIndex ?? DEFAULT_Z_INDEX);
    this.iframe = iframe;
    this.doc.body.appendChild(iframe);

    this.onMessage = (e: MessageEvent) => this.handleMessage(e);
    this.win.addEventListener("message", this.onMessage);
  }

  /** host → iframe 명령 전송. wc:ready(iframe 핸드셰이크) 전이면 버퍼링 — wc:boot 포함.
   *  iframe 이 로드 완료 후 wc:ready 를 보내면 큐를 순서대로 flush(wc:boot 먼저). */
  post(type: WcMessageType, payload?: unknown): void {
    if (!type.startsWith(WC_MESSAGE_PREFIX)) {
      throw new Error(`[web-chat] 잘못된 메시지 type(prefix 누락): ${type}`);
    }
    if (!this.ready) {
      this.outbox.push({ type, payload });
      return;
    }
    this.send(type, payload);
  }

  /** iframe → host 이벤트 구독. 구독 해제 함수를 반환(SPA 언마운트 cleanup). */
  on(event: WidgetEvent, cb: Listener): Unsubscribe {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(cb);
    return () => this.off(event, cb);
  }

  /** 구독 해제. cb 지정 시 해당 핸들러만, 생략 시 해당 이벤트 전체 해제. */
  off(event: WidgetEvent, cb?: Listener): void {
    const set = this.listeners.get(event);
    if (!set) return;
    if (cb) {
      set.delete(cb);
      if (set.size === 0) this.listeners.delete(event);
    } else {
      this.listeners.delete(event);
    }
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
      return;
    }
    if (data.type === "wc:resize") {
      this.applyResize(data.payload as WcResizePayload | undefined);
    }
  }

  /**
   * wc:resize 적용 — iframe 박스를 위젯 요청 크기에 맞춘다(2-sdk §3 필수).
   * 위젯 SPA 자체는 iframe 내부에서 자신의 iframe 크기를 제어할 수 없으므로(Same-Origin 아님)
   * host 가 부모 iframe 요소의 style 을 직접 변경해야 한다. (Info#19)
   * width/height 누락 시 해당 축은 유지. 숫자는 px 로, 문자열은 그대로(예: '100%').
   */
  private applyResize(payload?: WcResizePayload): void {
    if (!payload) return;
    const toCss = (v: number | string | undefined): string | undefined => {
      if (v === undefined) return undefined;
      return typeof v === "number" ? `${v}px` : v;
    };
    const w = toCss(payload.width);
    const h = toCss(payload.height);
    if (w !== undefined) this.iframe.style.width = w;
    if (h !== undefined) this.iframe.style.height = h;
    if (payload.state) this.iframe.dataset.wcState = payload.state;
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
