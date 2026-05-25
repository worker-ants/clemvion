import type { ExecutionFailureClass } from './execution-failure-classifier';

/**
 * languageHints default 문구 (KO / EN) + lookup / placeholder 치환 helper.
 *
 * SoT:
 *   - spec/5-system/15-chat-channel.md §4.1 (languageHints / languageLocale)
 *   - spec/5-system/15-chat-channel.md §4.1.1 (KO/EN default 12 문구 표)
 *   - spec/5-system/15-chat-channel.md §3.5 CCH-ERR-03 (placeholder 화이트리스트 = {statusCode})
 *
 * lookup 순서 (어댑터 책임 — Convention §3.1 helper 는 key 만 결정, locale 분기는 어댑터):
 *   (1) `languageHints[key]` 사용자 override (non-empty string)
 *   (2) `languageLocale` 의 default 문구
 *   (3) 'ko' fallback (locale 미설정 또는 unknown locale 방어)
 */

export type LanguageLocale = 'ko' | 'en';

/**
 * CCH-ERR-* 6 키의 default 문구 — KO/EN. 키는 `ExecutionFailureClass['key']` 와 1:1.
 * 신규 key 추가 시 본 map 도 동시 갱신 (KO/EN parity 강제).
 */
export const DEFAULT_LANGUAGE_HINTS: Record<
  LanguageLocale,
  Record<ExecutionFailureClass['key'], string>
> = {
  ko: {
    executionFailedThirdParty4xx:
      '외부 서비스 요청이 거부되었습니다 ({statusCode}). 잠시 후 다시 시도해 주세요.',
    executionFailedThirdParty5xx:
      '외부 서비스에 일시적인 문제가 발생했습니다 ({statusCode}). 잠시 후 다시 시도해 주세요.',
    executionFailedThirdParty:
      '외부 서비스 응답을 받지 못했습니다. 잠시 후 다시 시도해 주세요.',
    executionFailedTimeout:
      '처리 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.',
    executionFailedRateLimit: '요청량이 많아 잠시 후 다시 시도해 주세요.',
    executionFailedInternal:
      '서비스에 일시적 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.',
  },
  en: {
    executionFailedThirdParty4xx:
      'The external service rejected the request ({statusCode}). Please try again later.',
    executionFailedThirdParty5xx:
      'The external service is temporarily unavailable ({statusCode}). Please try again later.',
    executionFailedThirdParty:
      "Couldn't reach the external service. Please try again later.",
    executionFailedTimeout: 'The request timed out. Please try again later.',
    executionFailedRateLimit: 'Too many requests. Please try again later.',
    executionFailedInternal:
      'The service is temporarily unavailable. Please try again later.',
  },
};

/**
 * 3-level lookup — Spec Chat Channel §4.1.1 + §3.5 CCH-ERR-01.
 *
 * @param key 분류 helper 결과 (CCH-ERR-* 6 키 중 하나)
 * @param languageHints 사용자 override (`config.chatChannel.languageHints`)
 * @param languageLocale `config.chatChannel.languageLocale` ("ko" | "en" | undefined)
 * @returns 치환 전 raw template (caller 가 applyPlaceholders 호출)
 */
export function resolveLanguageHint(
  key: ExecutionFailureClass['key'],
  languageHints: Record<string, string> | undefined,
  languageLocale: LanguageLocale | undefined,
): string {
  // (1) user override
  const override = languageHints?.[key];
  if (typeof override === 'string' && override.length > 0) {
    return override;
  }
  // (2) locale default — unknown locale 은 (3) 으로 fallthrough
  if (languageLocale === 'en') {
    return DEFAULT_LANGUAGE_HINTS.en[key];
  }
  // (3) ko fallback
  return DEFAULT_LANGUAGE_HINTS.ko[key];
}

/**
 * `{statusCode}` placeholder 치환 — 화이트리스트 1종 (CCH-ERR-03).
 * 다른 placeholder (`{nodeId}` 등) 는 literal 유지 — DTO validator 가 등록 시점에 reject 하지만,
 * runtime 도 안전 (raw 노출되어도 internal label 만, 사용자에게 의미 불명).
 */
export function applyPlaceholders(
  template: string,
  placeholders: { statusCode?: number },
): string {
  const replacement =
    typeof placeholders.statusCode === 'number'
      ? String(placeholders.statusCode)
      : '?';
  return template.replace(/\{statusCode\}/g, replacement);
}
