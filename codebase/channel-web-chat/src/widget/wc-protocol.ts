// host ↔ iframe postMessage 프로토콜 상수(위젯 측). SDK 의 types.WcMessageType 과 동일 계약(2-sdk §3).
export const WC_PREFIX = "wc:" as const;

export type WcMessageType = "wc:boot" | "wc:command" | "wc:ready" | "wc:resize" | "wc:event";
