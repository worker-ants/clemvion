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

/** lookup (1) — `languageHints[key]` 가 비어 있지 않은 문자열이면 그 값, 아니면 `undefined` 다. */
export function readLanguageHintOverride(
  languageHints: Record<string, string> | undefined,
  key: string,
): string | undefined {
  const override = languageHints?.[key];
  return typeof override === 'string' && override.length > 0
    ? override
    : undefined;
}

/** lookup (2)·(3) — `languageLocale` 의 기본 문구, locale 이 없거나 모르는 값이면 ko 다. */
export function pickLocaleDefault(
  defaults: Record<LanguageLocale, string>,
  languageLocale: LanguageLocale | undefined,
): string {
  return languageLocale === 'en' ? defaults.en : defaults.ko;
}

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
  return (languageHints, languageLocale) =>
    readLanguageHintOverride(languageHints, overrideKey) ??
    pickLocaleDefault(defaults, languageLocale);
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
          '실행 실패 안내 6 키(executionFailedThirdParty4xx/5xx/ThirdParty/Timeout/RateLimit/Internal)로 마이그레이션하세요.',
        migration_guide:
          'CLE-CHAT-CORE 「실행 실패 안내」 / user-guide 실행 실패 안내 메시지 가이드 참조',
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
 * 문구는 CLE-CHAT-DATA-CONFIG 「안내 문구 기본값」 표와 같다(KO 는 합쇼체, NERV Task `CLE-T-A0G1FB`).
 *
 * 본 문구는 `HooksService.sendSurfaceMismatchNotice` 가 렌더러를 거치지 않고 보내는 제어 안내다.
 * 발송 직전 `sendBestEffortNotice` 가 `adapter.escapeControlText` 로 프로바이더별 escape 를 하므로
 * 마침표 같은 MarkdownV2 특수문자를 넣어도 된다. lookup 경로는 `sessionExpired` 와 동일
 * (override → locale default → ko fallback).
 */
export const SURFACE_MISMATCH_DEFAULTS: Record<LanguageLocale, string> = {
  ko: '지금은 이 입력을 받을 수 없습니다. 화면에 표시된 양식이나 버튼을 사용해 주세요.',
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
 * `groupChatRefusal`(그룹 대화 거절 안내)의 기본 문구. 이 키는 처음부터 있던 키라 영어 기본값이
 * 스펙 범위 밖이다(CLE-CHAT-DATA-CONFIG 「안내 문구 기본값」). 그래서 locale 과 상관없이 이 문구 하나다.
 * Slack · Discord 어댑터의 DM 밖 슬래시 명령 응답과 `HooksService` 의 Telegram 그룹 대화 안내가 함께 읽는다.
 */
export const GROUP_CHAT_REFUSAL_DEFAULT = '이 봇은 1:1 대화만 지원합니다.';

/**
 * `formValidationFailed`(다단계 질문의 검증 실패 재질문)의 기본 문구. locale 과 상관없이 이 문구다.
 * 봇 안내 문구라 합쇼체로 쓰고 «~해 주세요» 로 띄어 쓴다(CLE-CHAT-DATA-CONFIG, NERV Task `CLE-T-A0G1FB`).
 */
export const FORM_VALIDATION_FAILED_DEFAULT = '입력값을 다시 확인해 주세요.';

/**
 * `formNextField`(다단계 질문의 다음 필드 질문)의 기본 문구. `fieldNumber` 는 1부터 센 항목 번호다.
 * locale 과 상관없이 한국어 문구이고 «~해 주세요» 로 띄어 쓴다(NERV Task `CLE-T-A0G1FB`).
 */
export function formNextFieldDefault(fieldNumber: number): string {
  return `다음 항목을 입력해 주세요. (${fieldNumber})`;
}

/**
 * 수신 응답 문구 — 슬래시 명령처럼 프로바이더가 즉시 응답 메시지를 요구하는 인터랙션에 본인에게만
 * 보이게 싣는 기본 문구(KO/EN, 합쇼체). 새 실행 · 취소 · 답장 전달 · 중복 · 한도 초과 · 워크플로우
 * 비활성 경로가 같은 문구를 쓴다. 도움말은 따로 싣는다. 2026-11-12 사람 결정(NERV 질문
 * `01a1d025-899f-7709-b759-4f7bf6c16ef5`, Task `CLE-T-TSEP9G`).
 */
export const COMMAND_RECEIVED_DEFAULTS: Record<LanguageLocale, string> = {
  ko: '요청을 받았습니다.',
  en: 'Request received.',
};

/**
 * 수신 응답 3-level lookup — (1) languageHints.commandReceived override →
 * (2) languageLocale default → (3) ko fallback ({@link makeLocaleResolver}).
 */
export const resolveCommandReceivedMessage = makeLocaleResolver(
  'commandReceived',
  COMMAND_RECEIVED_DEFAULTS,
);

/**
 * 진행 중인 실행이 없는 대화에 `/cancel` 이 왔을 때 보내는 안내의 기본 문구(KO/EN, 합쇼체). 대화 상태가
 * 없거나 가리키는 실행이 이미 끝났을 때 쓴다. Slack · Discord 슬래시 명령은 본인에게만 보이는 즉시 응답의
 * 내용으로, Telegram 은 대화에 보내는 제어 안내로 싣는다. 2026-11-19 사람 결정(NERV 질문
 * `01a1f2b8-1ad7-7778-b15d-36c208d2accf`, Task `CLE-T-A78V0M`).
 */
export const NO_ACTIVE_EXECUTION_DEFAULTS: Record<LanguageLocale, string> = {
  ko: '진행 중인 대화가 없습니다.',
  en: 'There is no active conversation.',
};

/**
 * `/cancel` 안내 3-level lookup — (1) languageHints.noActiveExecution override →
 * (2) languageLocale default → (3) ko fallback ({@link makeLocaleResolver}).
 */
export const resolveNoActiveExecutionMessage = makeLocaleResolver(
  'noActiveExecution',
  NO_ACTIVE_EXECUTION_DEFAULTS,
);

/**
 * 슬래시 명령 `help` 의 기본 도움말(KO/EN). `{prefix}` 는 호출한 쪽이 명령 이름으로 바꾼다. Discord 는
 * 등록한 명령 이름(`languageHints.slashPrefix`), Slack 은 요청의 `command` 를 넣는다.
 * `languageHints.help` override 가 있으면 이 문구를 쓰지 않는다.
 */
export const SLASH_HELP_DEFAULTS: Record<LanguageLocale, string> = {
  ko: [
    '/{prefix} start - 새 대화 시작',
    '/{prefix} cancel - 진행 중인 대화 취소',
    '/{prefix} reply - 진행 중인 대화에 답장',
    '/{prefix} help - 도움말',
  ].join('\n'),
  en: [
    '/{prefix} start - Start a new conversation',
    '/{prefix} cancel - Cancel the active conversation',
    '/{prefix} reply - Reply to the active conversation',
    '/{prefix} help - Show help',
  ].join('\n'),
};

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
