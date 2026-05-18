import { registerAs } from '@nestjs/config';
import { Logger } from '@nestjs/common';

const logger = new Logger('WebAuthnConfig');

/**
 * WebAuthn Relying Party 설정.
 *
 * spec/5-system/1-auth.md §1.4.3 — 셀프 호스팅 운영에서 도메인이 SaaS 와 다르므로
 * 환경변수로 분리한다. 모두 누락 시 `FRONTEND_URL` 의 hostname/origin 으로
 * best-effort 폴백 + warn 로그.
 *
 *   WEBAUTHN_RP_ID    호스트명만 (포트·스킴 없음). 예: clemvion.example.com
 *   WEBAUTHN_RP_NAME  사용자 다이얼로그에 표시될 이름. 예: Clemvion
 *   WEBAUTHN_ORIGIN   콤마 구분 허용 origin 목록. 예: https://a,https://b
 */
export interface WebAuthnConfig {
  rpID: string;
  rpName: string;
  origins: string[];
}

function pickOrigins(): { origins: string[]; fallback: boolean } {
  const raw = process.env.WEBAUTHN_ORIGIN;
  if (raw && raw.trim()) {
    const list = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (list.length > 0) return { origins: list, fallback: false };
  }
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3012';
  return { origins: [frontendUrl], fallback: true };
}

function pickRpID(originHostFallback: string): { rpID: string; fallback: boolean } {
  const raw = process.env.WEBAUTHN_RP_ID;
  if (raw && raw.trim()) return { rpID: raw.trim(), fallback: false };
  return { rpID: originHostFallback, fallback: true };
}

export const webauthnConfig = registerAs<WebAuthnConfig>('webauthn', () => {
  const { origins, fallback: originsFallback } = pickOrigins();
  let originHostFallback = 'localhost';
  try {
    originHostFallback = new URL(origins[0]).hostname;
  } catch {
    // keep default 'localhost'
  }
  const { rpID, fallback: rpIDFallback } = pickRpID(originHostFallback);
  const rpName = process.env.WEBAUTHN_RP_NAME || 'Clemvion';

  if (originsFallback || rpIDFallback) {
    const message =
      `WebAuthn config falling back to FRONTEND_URL (originsFallback=${originsFallback}, rpIDFallback=${rpIDFallback}). ` +
      `Set WEBAUTHN_RP_ID / WEBAUTHN_ORIGIN — rpID/origin mismatch breaks registration & authentication.`;
    // production 에서 미설정은 보안상 fatal — 운영자가 의식적으로 폴백을 허용하려면
    // WEBAUTHN_ALLOW_FALLBACK=1 (단발성 escape hatch).
    if (
      process.env.NODE_ENV === 'production' &&
      process.env.WEBAUTHN_ALLOW_FALLBACK !== '1'
    ) {
      throw new Error(
        `${message} Set WEBAUTHN_ALLOW_FALLBACK=1 to opt out (not recommended).`,
      );
    }
    logger.warn(message);
  }

  return { rpID, rpName, origins };
});
