import { Logger } from '@nestjs/common';
import type { ExecutionFailureClass } from './execution-failure-classifier';

const logger = new Logger('ChatChannelLanguageHint');

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
 * languageHints 3-level lookup resolver 공통 factory (F-4) —
 * (1) `languageHints[overrideKey]` 사용자 override(non-empty string) → (2) `languageLocale`
 * default → (3) ko fallback. `resolveFormOpenLabel` / `resolveSessionExpiredMessage` /
 * `resolveSurfaceMismatchMessage` 가 문자 단위로 동일한 패턴이라 factory 로 통합해, 신규
 * control-plane 키 추가 시 네 번째 복제가 생기지 않도록 한다.
 */
export function makeLocaleResolver(
  overrideKey: string,
  defaults: Record<LanguageLocale, string>,
): (
  languageHints: Record<string, string> | undefined,
  languageLocale: LanguageLocale | undefined,
) => string {
  return (languageHints, languageLocale) => {
    const override = languageHints?.[overrideKey];
    if (typeof override === 'string' && override.length > 0) return override;
    if (languageLocale === 'en') return defaults.en;
    return defaults.ko;
  };
}

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
  // Deprecation guard (CCH-ERR-* 마이그레이션 안내):
  // 구 운영자 설정의 `executionFailed` 단일 키 + `{{code}}`/`{{message}}` 는 silently ignored.
  // 1회 경고 로그로 마이그레이션 필요성 알림 (CCH-ERR-04 연계 / W#13).
  if (
    languageHints !== undefined &&
    typeof (languageHints as Record<string, unknown>)['executionFailed'] ===
      'string'
  ) {
    logger.warn(
      JSON.stringify({
        kind: 'chat_channel_deprecated_execution_failed_hint',
        message:
          'languageHints.executionFailed 단일 키는 더 이상 사용되지 않습니다. ' +
          'CCH-ERR-* 6 키(executionFailedThirdParty4xx/5xx/ThirdParty/Timeout/RateLimit/Internal)로 마이그레이션하세요.',
        migration_guide:
          'spec/5-system/15-chat-channel.md §4.1.1 / user-guide 실행 실패 안내 메시지 가이드 참조',
      }),
    );
  }

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
 * §4.1 native modal `form_modal` 버튼 라벨 default (KO/EN).
 * CCH-ERR-* 와 달리 봇 메시지 라벨 키이며 modal 격상과 함께 도입 (2026-05-28).
 * SoT: spec/5-system/15-chat-channel.md §4.1.1 / spec/conventions/chat-channel-adapter.md §2.2.
 */
export const FORM_OPEN_LABEL_DEFAULTS: Record<LanguageLocale, string> = {
  ko: '양식 작성하기',
  en: 'Open form',
};

/**
 * `form_modal` 버튼 라벨 3-level lookup — (1) languageHints.formOpenLabel override →
 * (2) languageLocale default → (3) ko fallback ({@link makeLocaleResolver}).
 */
export const resolveFormOpenLabel = makeLocaleResolver(
  'formOpenLabel',
  FORM_OPEN_LABEL_DEFAULTS,
);

/**
 * §7.5 rehydration 실패 (`RESUME_*`) 시 사용자에게 보내는 graceful 안내 default
 * (KO/EN). 인스턴스 재시작/checkpoint 부재로 multi-turn 대화를 재개할 수 없을 때
 * generic "취소" 대신 본 문구를 표시한다 — 사용자의 다음 메시지는 새 대화로
 * 시작된다 (`isActiveExecution` 이 cancelled 를 비활성으로 판정).
 * SoT: spec/4-nodes/7-trigger/providers/telegram.md / spec/5-system/4-execution-engine.md §7.5.
 */
export const SESSION_EXPIRED_DEFAULTS: Record<LanguageLocale, string> = {
  ko: '대화 세션이 만료되어 재개할 수 없습니다. 새 메시지를 보내면 새 대화가 시작됩니다.',
  en: 'This conversation session has expired and cannot be resumed. Send a new message to start a fresh conversation.',
};

/**
 * 세션 만료 안내 3-level lookup — (1) languageHints.sessionExpired override →
 * (2) languageLocale default → (3) ko fallback ({@link makeLocaleResolver}).
 */
export const resolveSessionExpiredMessage = makeLocaleResolver(
  'sessionExpired',
  SESSION_EXPIRED_DEFAULTS,
);

/**
 * 표면 불일치 안내 (F-2 / plan eia-command-waiting-surface-guard) — 채팅 채널 inbound 명령이
 * 현재 대기 노드의 인터랙션 표면과 맞지 않아 publisher 가 409 `STATE_MISMATCH` 로 거부했을 때,
 * 사용자에게 "지금은 이 입력을 받을 수 없다"고 best-effort 안내하는 default 문구 (KO/EN).
 * chat-channel spec §4.1 / §4.1.1 / CCH-ERR-04 ("silently swallow 금지") 대칭.
 *
 * **MarkdownV2-safe (특수문자 미포함)**: 본 문구는 `HooksService.sendSurfaceMismatchNotice` 가
 * 렌더러를 거치지 않고 `adapter.sendMessage` 로 직접 발송한다 (control-plane notice — sessionExpired
 * 처럼 EIA event 렌더 경로가 아니므로 provider 별 escape 가 적용되지 않는다). 따라서 default 는
 * telegram MarkdownV2 특수문자(. ! - ( ) [ ] 등)를 피해, 세 provider (telegram / slack / discord)
 * 모두에서 raw 로 안전하게 렌더되도록 한다. lookup 경로는 `sessionExpired` 와 동일
 * (override → locale default → ko fallback).
 */
export const SURFACE_MISMATCH_DEFAULTS: Record<LanguageLocale, string> = {
  ko: '지금은 이 입력을 받을 수 없어요 화면에 표시된 양식이나 버튼을 사용해 주세요',
  en: "This input can't be accepted here right now, please use the form or buttons shown above",
};

/**
 * 표면 불일치 안내 3-level lookup — (1) languageHints.surfaceMismatch override →
 * (2) languageLocale default → (3) ko fallback ({@link makeLocaleResolver}).
 * 반환값은 raw (호출자가 escape 없이 발송).
 */
export const resolveSurfaceMismatchMessage = makeLocaleResolver(
  'surfaceMismatch',
  SURFACE_MISMATCH_DEFAULTS,
);

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
