// host ↔ iframe postMessage 프로토콜 상수(위젯 측). SDK 의 types.WcMessageType 과 동일 계약(2-sdk §3).
export const WC_PREFIX = "wc:" as const;

export type WcMessageType = "wc:boot" | "wc:command" | "wc:ready" | "wc:resize" | "wc:event";

/**
 * wc:resize payload — iframe 이 host(loader/미리보기)에 요청하는 위젯 박스 크기/상태.
 * host 가 부모 iframe 엘리먼트의 크기를 이 값에 맞춘다(2-sdk §3, SDK WcResizePayload 와 동일 계약).
 */
export interface WcResizePayload {
  width?: number;
  height?: number;
  state?: "collapsed" | "expanded";
}
