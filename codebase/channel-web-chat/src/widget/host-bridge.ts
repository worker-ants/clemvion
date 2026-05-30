// iframe(위젯 SPA) 측 ↔ host 브리지. SDK 의 WidgetBridge(host 측)와 짝. spec/7-channel-web-chat/2-sdk §3.
// 핸드셰이크: iframe 로드 → wc:ready(targetOrigin '*', 비밀 없음) → host 가 wc:boot 응답 → iframe 이 host origin 핀.

import type { WcMessageType } from "./wc-protocol";
import { WC_PREFIX } from "./wc-protocol";

export interface BootMessage {
  apiBase: string;
  triggerEndpointPath: string;
  locale?: "ko" | "en";
  appearance?: { primaryColor?: string; position?: "bottom-right" | "bottom-left"; zIndex?: number };
  headerTitle?: string;
  welcome?: { text?: string; suggestions?: string[] };
  launcher?: { suggestions?: string[] };
  disclaimer?: string;
  profile?: Record<string, unknown>;
}

export interface CommandMessage {
  action: string;
  [k: string]: unknown;
}

export interface IframeBridge {
  /** 핀된 host(부모 페이지) origin. wc:boot 수신 전엔 null. */
  readonly hostOrigin: string | null;
  onBoot(cb: (config: BootMessage) => void): void;
  onCommand(cb: (command: CommandMessage) => void): void;
  sendEvent(name: string, data?: unknown): void;
  destroy(): void;
}

export function createIframeBridge(win: Window = window): IframeBridge {
  let hostOrigin: string | null = null;
  let bootCb: ((c: BootMessage) => void) | null = null;
  let commandCb: ((c: CommandMessage) => void) | null = null;
  const parent = win.parent;

  const post = (type: WcMessageType, payload?: unknown, target = hostOrigin ?? "*") => {
    parent?.postMessage({ type, payload }, target);
  };

  const onMessage = (e: MessageEvent) => {
    // host(부모 window) 에서 온 메시지만 수용.
    if (e.source && e.source !== parent) return;
    const data = e.data as { type?: string; payload?: unknown } | null;
    if (!data || typeof data.type !== "string" || !data.type.startsWith(WC_PREFIX)) return;

    if (data.type === "wc:boot") {
      // 첫 boot 의 origin 을 host origin 으로 핀(이후 메시지 검증·송신 대상).
      if (!hostOrigin) hostOrigin = e.origin;
      else if (e.origin !== hostOrigin) return;
      bootCb?.(data.payload as BootMessage);
      return;
    }
    if (hostOrigin && e.origin !== hostOrigin) return; // boot 이후엔 핀된 origin 만.
    if (data.type === "wc:command") {
      commandCb?.(data.payload as CommandMessage);
    }
  };

  win.addEventListener("message", onMessage);
  // 핸드셰이크 — 로드 완료 신호. 비밀이 없으므로 targetOrigin '*' 안전.
  post("wc:ready", undefined, "*");

  return {
    get hostOrigin() {
      return hostOrigin;
    },
    onBoot(cb) {
      bootCb = cb;
    },
    onCommand(cb) {
      commandCb = cb;
    },
    sendEvent(name, dataPayload) {
      post("wc:event", { name, data: dataPayload });
    },
    destroy() {
      win.removeEventListener("message", onMessage);
      bootCb = null;
      commandCb = null;
    },
  };
}

/** 임베드 soft 검증용 실제 host origin 추출(ancestorOrigins → referrer). 4-security §3-①. */
export function detectHostOrigin(win: Window = window): string | null {
  try {
    const ao = win.location.ancestorOrigins;
    if (ao && ao.length > 0) return ao[0];
  } catch {
    /* 미지원 */
  }
  if (win.document.referrer) {
    try {
      return new URL(win.document.referrer).origin;
    } catch {
      /* noop */
    }
  }
  return null;
}
