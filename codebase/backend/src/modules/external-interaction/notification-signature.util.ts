import { createHmac, timingSafeEqual } from 'crypto';

/**
 * [Spec EIA §6.1 / §R12] — Outbound notification 의 HMAC 서명.
 *
 * Stripe-style: `X-Clemvion-Signature: t=<unix>,v1=<hex>`. timestamp ±5분 window + timing-safe
 * 비교가 검증 측 권장. 본 모듈은 발신 측 — 서명 생성과 헤더 빌드만 담당. 검증 헬퍼는 e2e
 * 테스트 + SDK 양쪽에서 재사용 가능하도록 export.
 */

export type SupportedHmacAlgorithm = 'hmac-sha256' | 'hmac-sha512';

const ALG_TO_NODE: Record<SupportedHmacAlgorithm, string> = {
  'hmac-sha256': 'sha256',
  'hmac-sha512': 'sha512',
};

/**
 * Signed payload 의 canonical form: `{timestamp}.{rawBody}`.
 *
 * timestamp 는 unix seconds (정수). rawBody 는 HTTP POST body 의 raw 문자열 (JSON.stringify
 * 후 그대로). signed_payload = `"<unix>.<rawBody>"`.
 */
export function buildSignedPayload(timestamp: number, rawBody: string): string {
  return `${timestamp}.${rawBody}`;
}

/**
 * HMAC 서명 hex digest 계산.
 */
export function computeHmacSignature(
  algorithm: SupportedHmacAlgorithm,
  secret: string,
  timestamp: number,
  rawBody: string,
): string {
  const nodeAlg = ALG_TO_NODE[algorithm];
  if (!nodeAlg) {
    throw new Error(`Unsupported HMAC algorithm: ${algorithm as string}`);
  }
  return createHmac(nodeAlg, secret)
    .update(buildSignedPayload(timestamp, rawBody))
    .digest('hex');
}

/**
 * `X-Clemvion-Signature` 헤더 값 빌드.
 *
 * 단일 서명: `t=<unix>,v1=<hex>`.
 * Rotation 기간 (secondaryHex 있음) 동안: `t=<unix>,v1=<hex>,v1=<secondaryHex>` — 두 서명 중
 * 하나가 매칭되면 검증 측이 통과. spec EIA §6.6 의 secret rotation grace 모델.
 */
export function buildSignatureHeader(
  timestamp: number,
  hex: string,
  secondaryHex?: string,
): string {
  const parts = [`t=${timestamp}`, `v1=${hex}`];
  if (secondaryHex && secondaryHex !== hex) {
    parts.push(`v1=${secondaryHex}`);
  }
  return parts.join(',');
}

/**
 * 검증 측 헬퍼 (SDK / e2e 에서 사용). timestamp ±toleranceSec 안에서 timing-safe 비교.
 *
 * `signatureHeader` 의 모든 `v1=` 값 중 하나라도 매칭되면 통과 (secret rotation grace 지원).
 *
 * @returns valid=true / false. invalid 사유는 디버그용 reason 필드.
 */
export function verifySignatureHeader(
  signatureHeader: string | null | undefined,
  rawBody: string,
  secret: string,
  algorithm: SupportedHmacAlgorithm = 'hmac-sha256',
  opts: { toleranceSec?: number; nowSec?: number } = {},
): {
  valid: boolean;
  reason?: 'malformed' | 'timestamp_outside_window' | 'mismatch';
} {
  if (typeof signatureHeader !== 'string' || signatureHeader.length === 0) {
    return { valid: false, reason: 'malformed' };
  }
  const tolerance = opts.toleranceSec ?? 5 * 60;
  const now = opts.nowSec ?? Math.floor(Date.now() / 1000);
  let timestamp: number | null = null;
  const candidateHexes: string[] = [];
  for (const segment of signatureHeader.split(',')) {
    const eq = segment.indexOf('=');
    if (eq <= 0) return { valid: false, reason: 'malformed' };
    const key = segment.slice(0, eq).trim();
    const value = segment.slice(eq + 1).trim();
    if (!key || !value) return { valid: false, reason: 'malformed' };
    if (key === 't') {
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return { valid: false, reason: 'malformed' };
      }
      timestamp = Math.floor(parsed);
    } else if (key === 'v1') {
      candidateHexes.push(value);
    }
  }
  if (timestamp === null || candidateHexes.length === 0) {
    return { valid: false, reason: 'malformed' };
  }
  if (Math.abs(now - timestamp) > tolerance) {
    return { valid: false, reason: 'timestamp_outside_window' };
  }
  const expected = computeHmacSignature(algorithm, secret, timestamp, rawBody);
  const expectedBuf = Buffer.from(expected, 'hex');
  for (const hex of candidateHexes) {
    let candidateBuf: Buffer;
    try {
      candidateBuf = Buffer.from(hex, 'hex');
    } catch {
      continue;
    }
    if (candidateBuf.length === 0) continue;
    if (candidateBuf.length !== expectedBuf.length) continue;
    if (timingSafeEqual(candidateBuf, expectedBuf)) {
      return { valid: true };
    }
  }
  return { valid: false, reason: 'mismatch' };
}
