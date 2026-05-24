import { createPublicKey, verify as cryptoVerify } from 'node:crypto';

/**
 * Discord Interactions Webhook 의 ed25519 signature 검증.
 *
 * Spec [providers/discord §6 보안]:
 *   - `X-Signature-Ed25519` (hex) + `X-Signature-Timestamp` (sec)
 *   - verify(publicKey, timestamp + body, signature)
 *   - 5분 replay window
 *
 * Discord 의 public key 는 64 chars hex (32 bytes raw ed25519). Node 의 createPublicKey 는
 * SubjectPublicKeyInfo DER 만 받으므로 raw 32 bytes 를 SPKI prefix 와 concat.
 *
 * Pure 함수 — side-effect 없음.
 *
 * @returns boolean — true: 검증 성공. false: signature mismatch / replay / 형식 오류.
 */
export function verifyDiscordSignature(
  body: string,
  signatureHex: string,
  timestamp: string,
  publicKeyHex: string,
): boolean {
  if (!publicKeyHex) return false;
  if (!signatureHex) return false;
  if (!timestamp) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || !Number.isInteger(ts)) return false;

  // 5분 replay window.
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - ts) > 5 * 60) return false;

  // hex 검증.
  if (!/^[0-9a-fA-F]+$/.test(publicKeyHex) || publicKeyHex.length !== 64) {
    return false;
  }
  if (!/^[0-9a-fA-F]+$/.test(signatureHex) || signatureHex.length !== 128) {
    return false;
  }

  try {
    const publicKeyDer = Buffer.concat([
      // SubjectPublicKeyInfo prefix for ed25519 (OID 1.3.101.112 + bit string header).
      Buffer.from('302a300506032b6570032100', 'hex'),
      Buffer.from(publicKeyHex, 'hex'),
    ]);
    const publicKey = createPublicKey({
      key: publicKeyDer,
      format: 'der',
      type: 'spki',
    });
    return cryptoVerify(
      null,
      Buffer.from(timestamp + body, 'utf8'),
      publicKey,
      Buffer.from(signatureHex, 'hex'),
    );
  } catch {
    return false;
  }
}
