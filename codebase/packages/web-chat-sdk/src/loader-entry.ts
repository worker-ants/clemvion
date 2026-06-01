// loader.js IIFE 진입점 — 번들되어 <script src=".../web-chat/v1/loader.js"> 로 로드.
// 전역 ClemvionChat dispatcher 를 설치하고 스니펫 큐를 replay. spec/7-channel-web-chat/2-sdk §1.
import { DEFAULT_GLOBAL_NAME, installGlobal } from "./loader";

// 전역명 해석 — loader <script data-global="..."> opt-in 재지정(전역명 충돌 방지). 미지정 시 ClemvionChat.
// document.currentScript 는 IIFE 실행 완료 후 null 이 된다. 여기서는 IIFE 내부에서 동기 참조하므로 안전. (Info#21)
function resolveGlobalName(): string {
  if (typeof document !== "undefined") {
    const cur = document.currentScript as HTMLScriptElement | null;
    const name = cur?.dataset?.global?.trim();
    if (name) return name;
  }
  return DEFAULT_GLOBAL_NAME;
}

installGlobal(window, undefined, resolveGlobalName());
