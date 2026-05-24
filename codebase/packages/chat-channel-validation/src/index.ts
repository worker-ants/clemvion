/**
 * @workflow/chat-channel-validation
 *
 * Chat Channel provider 의 inbound-signing plaintext (Slack signing secret /
 * Discord ed25519 application public key) 형식 검증 정규식 + 헬퍼.
 *
 * Backend service / DTO 와 frontend client-side 검증이 동일 정규식을 사용하도록
 * 단일 진실로 추출. 신규 provider 추가 시 본 파일에 새 export 만 추가.
 *
 * SoT:
 *   - spec/4-nodes/7-trigger/providers/slack.md §6 — Slack signing secret 형식
 *   - spec/4-nodes/7-trigger/providers/discord.md §6 — Discord ed25519 public key 형식
 *   - spec/conventions/secret-store.md §5.5 (b) — provider-issued plaintext 흐름
 */

/**
 * Slack signing secret 형식 — lowercase hex 32 chars.
 * Slack 발급 표준. uppercase 입력은 외부 Slack HMAC 검증 실패를 유발하므로 사전 차단.
 *
 * @see spec/4-nodes/7-trigger/providers/slack.md §6
 */
export const SLACK_SIGNING_SECRET_REGEX = /^[a-f0-9]{32}$/;

/**
 * Discord application public key 형식 — lowercase hex 64 chars (ed25519 32 bytes).
 * Discord 발급 표준. uppercase 입력은 외부 Discord ed25519 verify 실패 회피를 위해 사전 차단.
 *
 * @see spec/4-nodes/7-trigger/providers/discord.md §6
 */
export const DISCORD_PUBLIC_KEY_REGEX = /^[a-f0-9]{64}$/;

/**
 * Slack signing secret plaintext 가 표준 형식 (lowercase hex 32) 인지 검증.
 *
 * @param value 검증 대상 plaintext
 * @returns 형식 match 여부
 */
export function isValidSlackSigningSecret(value: string): boolean {
  return SLACK_SIGNING_SECRET_REGEX.test(value);
}

/**
 * Discord application public key plaintext 가 표준 형식 (lowercase hex 64) 인지 검증.
 *
 * @param value 검증 대상 plaintext
 * @returns 형식 match 여부
 */
export function isValidDiscordPublicKey(value: string): boolean {
  return DISCORD_PUBLIC_KEY_REGEX.test(value);
}
