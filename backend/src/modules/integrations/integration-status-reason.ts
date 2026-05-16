/**
 * `Integration.statusReason` — `status` 가 `error` 또는 `expired` 일 때 사용자
 * 또는 운영자에게 노출되는 사유 슬러그. snake_case + 64자 이내 (V040 schema).
 *
 * 옛 케이스: 호출 경로에 따라 `errorCode.toLowerCase()` (예: `oauth_token_exchange_failed`)
 * 처럼 임의 문자열이 들어가 UI 가 case 분기를 못 하거나 알 수 없는 값이
 * 표시되는 문제가 있었다. 본 union 으로 허용값을 고정하고, 알 수 없는 값은
 * `unknown_error` 로 fallback 한다 (`normalizeStatusReason` 헬퍼).
 *
 * spec/2-navigation/4-integration.md §10 (상태 전이) 참조.
 */
export const INTEGRATION_STATUS_REASONS = [
  // OAuth / 자격 증명 관련
  'auth_failed', // 401/403 / refresh_token 무효 → status=error
  'insufficient_scope', // 403 + scope 시그널 → status=error
  'network', // transport 오류 누적 → status=error
  // Cafe24 install 흐름
  'install_timeout', // pending_install 24h TTL 만료 → status=expired
  // OAuth callback 실패 사유 (pending_install 유지, 사용자 재시도 가능)
  'oauth_state_invalid',
  'oauth_state_mismatch',
  'oauth_state_expired',
  'oauth_provider_error',
  'oauth_token_exchange_failed',
  'oauth_preview_invalid',
  'oauth_preview_expired',
  // 미분류 fallback — 운영 알람 신호. 새 케이스는 위 union 에 추가.
  'unknown_error',
] as const;

export type IntegrationStatusReason = (typeof INTEGRATION_STATUS_REASONS)[number];

const STATUS_REASON_SET: ReadonlySet<string> = new Set(
  INTEGRATION_STATUS_REASONS as readonly string[],
);

/**
 * 호출자가 임의의 문자열 (예: 옛 `errorCode.toLowerCase()`) 을 statusReason
 * 으로 넘길 때, union 에 포함되면 그대로 쓰고 아니면 `unknown_error` 로
 * 정규화한다. UI/API 응답이 union 밖 값을 노출하지 않도록 보장.
 */
export function normalizeStatusReason(raw: string | null | undefined): IntegrationStatusReason {
  if (!raw) return 'unknown_error';
  return STATUS_REASON_SET.has(raw)
    ? (raw as IntegrationStatusReason)
    : 'unknown_error';
}
