import { registerAs } from '@nestjs/config';
import { Logger } from '@nestjs/common';

const logger = new Logger('WebAuthnConfig');

/**
 * WebAuthn Relying Party 설정.
 *
 * spec/5-system/1-auth.md §1.4.3 — 셀프 호스팅 운영에서 도메인이 SaaS 와 다르므로
 * 환경변수로 분리한다. 두 환경변수(`WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGIN`)가 모두
 * 설정되어 있어야 WebAuthn 기능이 활성화된다. 누락 시 `enabled = false` 로 두고
 * 부팅을 막지 않는다 — WebAuthn 엔드포인트만 503 으로 비활성화되며 TOTP·일반
 * 로그인은 정상 동작한다.
 *
 *   WEBAUTHN_RP_ID    호스트명만 (포트·스킴 없음). 예: clemvion.example.com
 *   WEBAUTHN_RP_NAME  사용자 다이얼로그에 표시될 이름. 예: Clemvion (기본 'Clemvion')
 *   WEBAUTHN_ORIGIN   콤마 구분 허용 origin 목록. 예: https://a,https://b
 *
 *   WEBAUTHN_ALLOW_FALLBACK=1
 *     RP_ID/ORIGIN 미설정 상태에서도 `FRONTEND_URL` 의 hostname/origin 으로 폴백해
 *     기능을 켠다. 개발·로컬·시연 한정 escape hatch. 운영에서는 사용 금지.
 */
export interface WebAuthnConfig {
  enabled: boolean;
  rpID: string;
  rpName: string;
  origins: string[];
}

function parseOrigins(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export const webauthnConfig = registerAs<WebAuthnConfig>('webauthn', () => {
  const rpIDEnv = process.env.WEBAUTHN_RP_ID?.trim();
  const originsEnv = parseOrigins(process.env.WEBAUTHN_ORIGIN);
  const rpName = process.env.WEBAUTHN_RP_NAME || 'Clemvion';
  const allowFallback = process.env.WEBAUTHN_ALLOW_FALLBACK === '1';

  // 정상 경로: 두 환경변수가 모두 설정되어 있다.
  if (rpIDEnv && originsEnv.length > 0) {
    return { enabled: true, rpID: rpIDEnv, rpName, origins: originsEnv };
  }

  // escape hatch: FRONTEND_URL 로 폴백해서라도 기능을 켠다 (운영 비권장).
  if (allowFallback) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3012';
    let host = 'localhost';
    try {
      host = new URL(frontendUrl).hostname;
    } catch {
      // keep default 'localhost'
    }
    logger.warn(
      `WebAuthn config falling back to FRONTEND_URL (WEBAUTHN_ALLOW_FALLBACK=1). ` +
        `rpID=${rpIDEnv || host}, origins=[${(originsEnv.length > 0 ? originsEnv : [frontendUrl]).join(', ')}]. ` +
        `운영 환경에서는 WEBAUTHN_RP_ID·WEBAUTHN_ORIGIN 을 명시적으로 설정하세요.`,
    );
    return {
      enabled: true,
      rpID: rpIDEnv || host,
      rpName,
      origins: originsEnv.length > 0 ? originsEnv : [frontendUrl],
    };
  }

  // 누락 + 폴백 미허용 → 기능 비활성화 (부팅은 정상 진행).
  logger.warn(
    `WebAuthn 기능 비활성: WEBAUTHN_RP_ID / WEBAUTHN_ORIGIN 미설정. ` +
      `Passkey/보안 키 등록·로그인 엔드포인트는 503 으로 응답하고, TOTP·일반 로그인은 정상 동작합니다. ` +
      `활성화하려면 두 환경변수를 모두 설정하세요 (개발 한정으로 WEBAUTHN_ALLOW_FALLBACK=1 폴백 사용 가능).`,
  );
  return { enabled: false, rpID: '', rpName, origins: [] };
});
