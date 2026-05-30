// @clemvion/web-chat (잠정 scope) — 공개 진입점.
// 스니펫 로더와 npm 이 공유하는 단일 코어. spec/7-channel-web-chat/2-sdk.
//
// 현 increment: 공개 타입 + boot 검증 + host↔iframe wc:* bridge + 명령 큐 + iframe 주입.
// 후속: loader 스니펫(IIFE) wrapper, EIA 클라이언트(@workflow/sdk 재사용)는 위젯 SPA 내부.

import type { BootConfig, ChatInstance, WidgetEvent } from "./types";
import { WidgetBridge, resolveIframeTarget } from "./bridge";

export * from "./types";
export { WidgetBridge, resolveIframeTarget } from "./bridge";

// 번들러가 build 시 define 으로 치환하는 위젯 CDN base 상수. 미주입 시 typeof 가드로 안전.
declare const __WEBCHAT_WIDGET_BASE__: string | undefined;

// 위젯 CDN base — 배포 env 주입(0-architecture §4). 우선순위: 명시 override → 빌드 상수 → loader script src.
let widgetBaseOverride: string | undefined;

/** 배포/테스트에서 위젯 CDN base 를 명시 지정(예: 'https://cdn.example.com'). */
export function setWidgetBase(base: string): void {
  widgetBaseOverride = base;
}

function resolveWidgetBase(): string {
  if (widgetBaseOverride) return widgetBaseOverride;
  // 빌드타임 상수 (번들러가 define 으로 치환). 미정의 시 ReferenceError 회피.
  const buildConst =
    typeof __WEBCHAT_WIDGET_BASE__ !== "undefined" ? __WEBCHAT_WIDGET_BASE__ : undefined;
  if (buildConst) return buildConst;
  // loader 스니펫: 자기 script src 에서 base 유도 (.../web-chat/v1/loader.js → base).
  if (typeof document !== "undefined") {
    const cur = document.currentScript as HTMLScriptElement | null;
    const src = cur?.src ?? findLoaderSrc();
    if (src) {
      const m = src.match(/^(.*?)\/web-chat\/v\d+\/loader\.js/);
      if (m) return m[1];
    }
  }
  throw new Error(
    "[web-chat] 위젯 CDN base 를 해석할 수 없습니다 — setWidgetBase() 로 지정하거나 빌드 시 __WEBCHAT_WIDGET_BASE__ 를 주입하세요.",
  );
}

function findLoaderSrc(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const scripts = Array.from(document.getElementsByTagName("script"));
  return scripts.map((s) => s.src).find((src) => /\/web-chat\/v\d+\/loader\.js/.test(src));
}

/** boot config 의 최소 유효성 검증 — 필수 필드(apiBase, triggerEndpointPath). */
export function validateBootConfig(config: BootConfig): void {
  if (!config || typeof config !== "object") {
    throw new Error("[web-chat] boot config 객체가 필요합니다.");
  }
  if (!config.apiBase) {
    throw new Error("[web-chat] boot.apiBase 는 필수입니다.");
  }
  if (!config.triggerEndpointPath) {
    throw new Error("[web-chat] boot.triggerEndpointPath 는 필수입니다.");
  }
}

/** 위젯 부팅 — iframe 주입 + wc:* bridge 연결 후 제어 인스턴스 반환. */
export function boot(config: BootConfig): ChatInstance {
  validateBootConfig(config);
  const base = resolveWidgetBase();
  const { iframeSrc, widgetOrigin } = resolveIframeTarget(config, base);
  const bridge = new WidgetBridge({ iframeSrc, widgetOrigin });

  // 초기 boot config 전달.
  bridge.post("wc:boot", config);

  const cmd = (action: string, extra?: Record<string, unknown>) =>
    bridge.post("wc:command", { action, ...extra });

  return {
    open: () => cmd("open"),
    close: () => cmd("close"),
    show: () => cmd("show"),
    hide: () => cmd("hide"),
    sendMessage: (text: string) => cmd("sendMessage", { text }),
    updateProfile: (profile: Record<string, unknown>) => cmd("updateProfile", { profile }),
    on: (event: WidgetEvent, callback: (payload: unknown) => void) => bridge.on(event, callback),
    shutdown: () => bridge.destroy(),
  };
}

/** 전역 진입점 객체 (스니펫 `ClemvionChat('boot', cfg)` / npm `ClemvionChat.boot(cfg)` 공용). */
export const ClemvionChat = { boot, validateBootConfig, setWidgetBase };
export default ClemvionChat;
