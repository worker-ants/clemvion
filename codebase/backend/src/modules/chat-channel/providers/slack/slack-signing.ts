import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Slack `X-Slack-Signature` 검증.
 *
 * Spec [providers/slack §6 보안]:
 *   - HMAC-SHA256(signing_secret, "v0:" + X-Slack-Request-Timestamp + ":" + raw_body)
 *   - 5분 replay window (현재 시각 ± 5분 밖이면 거부)
 *   - constant-time compare
 *
 * Pure 함수 — side-effect 없음. caller (`ChatChannelInboundAuthenticator`) 가
 * `inboundSigningRef` 로 secret 을 resolve 한 뒤 본 함수에 전달한다.
 *
 * @returns boolean — true: 검증 성공. false: signature mismatch 또는 replay window 초과 또는 형식 오류.
 */
export function verifySlackSignature(
  body: string,
  signature: string,
  timestamp: string,
  signingSecret: string,
): boolean {
  // 형식 검증.
  if (!signingSecret) return false;
  if (!signature.startsWith('v0=')) return false;
  if (!timestamp) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || !Number.isInteger(ts)) return false;

  // 5분 replay window (양방향).
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - ts) > 5 * 60) return false;

  // HMAC-SHA256 계산.
  const base = `v0:${timestamp}:${body}`;
  let computed: string;
  try {
    computed = `v0=${createHmac('sha256', signingSecret).update(base).digest('hex')}`;
  } catch {
    return false;
  }

  // constant-time compare — 길이 다르면 timingSafeEqual 가 throw 하므로 사전 비교.
  const sigBuf = Buffer.from(signature, 'utf8');
  const cmpBuf = Buffer.from(computed, 'utf8');
  if (sigBuf.length !== cmpBuf.length) return false;
  return timingSafeEqual(sigBuf, cmpBuf);
}
