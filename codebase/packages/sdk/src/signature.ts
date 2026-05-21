import { createHmac, timingSafeEqual } from 'crypto';

export type SupportedHmacAlgorithm = 'hmac-sha256' | 'hmac-sha512';

const ALG_TO_NODE: Record<SupportedHmacAlgorithm, string> = {
  'hmac-sha256': 'sha256',
  'hmac-sha512': 'sha512',
};

export interface NotificationVerifyResult {
  valid: boolean;
  reason?: 'malformed' | 'timestamp_outside_window' | 'mismatch';
}

/**
 * Outbound notification 의 `X-Clemvion-Signature` 헤더를 검증한다.
 *
 * [Spec EIA §6.1]. Stripe-style `t=<unix>,v1=<hex>[,v1=<rotated_hex>]`. timestamp ±5분 window +
 * timing-safe 비교. secret rotation 시 v1= 두 개 중 하나라도 매칭되면 valid.
 *
 * 외부 시스템(서드파티 webhook 수신자)이 본 SDK 를 import 해 자체 검증에 사용.
 */
export function verifyNotificationSignature(
  signatureHeader: string | null | undefined,
  rawBody: string,
  secret: string,
  algorithm: SupportedHmacAlgorithm = 'hmac-sha256',
  opts: { toleranceSec?: number; nowSec?: number } = {},
): NotificationVerifyResult {
  if (typeof signatureHeader !== 'string' || signatureHeader.length === 0) {
    return { valid: false, reason: 'malformed' };
  }
  const tolerance = opts.toleranceSec ?? 5 * 60;
  const now = opts.nowSec ?? Math.floor(Date.now() / 1000);
  let timestamp: number | null = null;
  const hexes: string[] = [];
  for (const seg of signatureHeader.split(',')) {
    const eq = seg.indexOf('=');
    if (eq <= 0) return { valid: false, reason: 'malformed' };
    const key = seg.slice(0, eq).trim();
    const value = seg.slice(eq + 1).trim();
    if (!key || !value) return { valid: false, reason: 'malformed' };
    if (key === 't') {
      const n = Number(value);
      if (!Number.isFinite(n) || n <= 0) {
        return { valid: false, reason: 'malformed' };
      }
      timestamp = Math.floor(n);
    } else if (key === 'v1') {
      // [ai-review W14] hex 입력 유효성 — Buffer.from(value, 'hex') 는 invalid char 를 silent
      // 무시해 부분 hex 가 통과할 수 있다. 엄격한 hex 검증으로 차단.
      if (!/^[0-9a-fA-F]+$/.test(value) || value.length % 2 !== 0) {
        return { valid: false, reason: 'malformed' };
      }
      hexes.push(value);
    }
  }
  if (timestamp === null || hexes.length === 0) {
    return { valid: false, reason: 'malformed' };
  }
  if (Math.abs(now - timestamp) > tolerance) {
    return { valid: false, reason: 'timestamp_outside_window' };
  }
  const expected = computeNotificationSignature(
    algorithm,
    secret,
    timestamp,
    rawBody,
  );
  const expectedBuf = Buffer.from(expected, 'hex');
  for (const hex of hexes) {
    const candidate = Buffer.from(hex, 'hex');
    if (candidate.length === 0 || candidate.length !== expectedBuf.length) {
      continue;
    }
    if (timingSafeEqual(candidate, expectedBuf)) {
      return { valid: true };
    }
  }
  return { valid: false, reason: 'mismatch' };
}

/**
 * 발신측 호환 헬퍼 — 같은 알고리즘으로 hex 서명을 직접 계산.
 * 보통은 backend 가 자동 서명하므로 사용 빈도는 낮지만, SDK 사용자의 mock·테스트용도로 노출.
 */
export function computeNotificationSignature(
  algorithm: SupportedHmacAlgorithm,
  secret: string,
  timestampSec: number,
  rawBody: string,
): string {
  const nodeAlg = ALG_TO_NODE[algorithm];
  if (!nodeAlg) {
    throw new Error(`Unsupported algorithm: ${algorithm as string}`);
  }
  return createHmac(nodeAlg, secret)
    .update(`${timestampSec}.${rawBody}`)
    .digest('hex');
}
