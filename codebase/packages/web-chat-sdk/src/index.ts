// @clemvion/web-chat (잠정 scope) — 공개 진입점.
// 스니펫 로더와 npm 이 공유하는 단일 코어. spec/7-channel-web-chat/2-sdk.
//
// 스캐폴딩 단계: 공개 표면(타입 + boot/validate)만. iframe 주입·wc:* postMessage bridge·EIA 클라이언트
// (@workflow/sdk 재사용)는 후속 increment.

import type { BootConfig, ChatInstance } from "./types";

export * from "./types";

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

/**
 * 위젯 부팅 — iframe 주입 + bridge 연결 후 제어 인스턴스 반환.
 * 스캐폴딩 단계 stub: 검증만 수행하고 NotImplemented 인스턴스를 돌려준다.
 */
export function boot(config: BootConfig): ChatInstance {
  validateBootConfig(config);
  // TODO(impl): launcher+iframe 주입, wc:boot 전송, wc:event 구독, 명령 큐 flush.
  const notImpl = (m: string) => () => {
    throw new Error(`[web-chat] ${m}: 미구현(스캐폴딩 단계).`);
  };
  return {
    open: notImpl("open"),
    close: notImpl("close"),
    show: notImpl("show"),
    hide: notImpl("hide"),
    sendMessage: notImpl("sendMessage"),
    updateProfile: notImpl("updateProfile"),
    on: notImpl("on"),
    shutdown: notImpl("shutdown"),
  };
}

/** 전역 진입점 객체 (스니펫 `ClemvionChat('boot', cfg)` / npm `ClemvionChat.boot(cfg)` 공용). */
export const ClemvionChat = { boot, validateBootConfig };
export default ClemvionChat;
