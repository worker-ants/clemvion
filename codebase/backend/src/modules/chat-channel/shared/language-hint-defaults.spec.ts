import { Logger } from '@nestjs/common';
import {
  DEFAULT_LANGUAGE_HINTS,
  resolveLanguageHint,
  applyPlaceholders,
  resolveFormOpenLabel,
  FORM_OPEN_LABEL_DEFAULTS,
  resolveSessionExpiredMessage,
  SESSION_EXPIRED_DEFAULTS,
  resolveSurfaceMismatchMessage,
  SURFACE_MISMATCH_DEFAULTS,
  resolveCommandReceivedMessage,
  COMMAND_RECEIVED_DEFAULTS,
  resolveNoActiveExecutionMessage,
  NO_ACTIVE_EXECUTION_DEFAULTS,
  resolveExecutionStartedMessage,
  EXECUTION_STARTED_DEFAULTS,
  resolveExecutionRestartedMessage,
  EXECUTION_RESTARTED_DEFAULTS,
  makeLocaleResolver,
  pickLocaleDefault,
  GROUP_CHAT_REFUSAL_DEFAULT,
  FORM_VALIDATION_FAILED_DEFAULT,
  formNextFieldDefault,
  readLanguageHintOverride,
  type LanguageLocale,
} from './language-hint-defaults';

describe('makeLocaleResolver (F-4 3-level lookup factory)', () => {
  const resolve = makeLocaleResolver('demoKey', { ko: '한글', en: 'english' });
  it('override(non-empty) 우선', () => {
    expect(resolve({ demoKey: '커스텀' }, 'en')).toBe('커스텀');
  });
  it('빈 override 는 무시 → locale default', () => {
    expect(resolve({ demoKey: '' }, 'en')).toBe('english');
    expect(resolve({ demoKey: '' }, 'ko')).toBe('한글');
  });
  it('locale 미설정/unknown → ko fallback', () => {
    expect(resolve(undefined, undefined)).toBe('한글');
    expect(resolve({}, 'de' as LanguageLocale)).toBe('한글');
  });
  it('저장된 languageHints 가 null 이면 locale default (NERV Task `CLE-T-CSVGX0`)', () => {
    expect(resolve(null, 'en')).toBe('english');
    expect(resolve(null, undefined)).toBe('한글');
  });
  it('다른 키의 override 는 영향 없음', () => {
    expect(resolve({ otherKey: 'x' }, 'en')).toBe('english');
  });
});

describe('readLanguageHintOverride · pickLocaleDefault', () => {
  it('비어 있지 않은 문자열 override 만 돌려준다', () => {
    expect(readLanguageHintOverride({ k: '값' }, 'k')).toBe('값');
    expect(readLanguageHintOverride({ k: '' }, 'k')).toBeUndefined();
    expect(readLanguageHintOverride(undefined, 'k')).toBeUndefined();
    expect(readLanguageHintOverride(null, 'k')).toBeUndefined();
    expect(readLanguageHintOverride({ other: 'x' }, 'k')).toBeUndefined();
    expect(
      readLanguageHintOverride(
        { k: 3 } as unknown as Record<string, string>,
        'k',
      ),
    ).toBeUndefined();
  });
  it('en 이면 en, 그 밖은 ko 기본값이다', () => {
    const defaults = { ko: '한글', en: 'english' };
    expect(pickLocaleDefault(defaults, 'en')).toBe('english');
    expect(pickLocaleDefault(defaults, 'ko')).toBe('한글');
    expect(pickLocaleDefault(defaults, undefined)).toBe('한글');
    expect(pickLocaleDefault(defaults, 'de' as LanguageLocale)).toBe('한글');
  });
});

describe('resolveSessionExpiredMessage (§7.5 rehydration 실패 graceful 안내)', () => {
  it('default KO / EN', () => {
    expect(resolveSessionExpiredMessage(undefined, 'ko')).toBe(
      SESSION_EXPIRED_DEFAULTS.ko,
    );
    expect(resolveSessionExpiredMessage(undefined, 'en')).toBe(
      SESSION_EXPIRED_DEFAULTS.en,
    );
  });
  it('locale 미설정 → ko fallback', () => {
    expect(resolveSessionExpiredMessage(undefined, undefined)).toBe(
      SESSION_EXPIRED_DEFAULTS.ko,
    );
  });
  it('languageHints.sessionExpired override 우선', () => {
    expect(
      resolveSessionExpiredMessage({ sessionExpired: '커스텀' }, 'en'),
    ).toBe('커스텀');
  });
  it('빈 문자열 override 는 무시하고 default 사용', () => {
    expect(resolveSessionExpiredMessage({ sessionExpired: '' }, 'en')).toBe(
      SESSION_EXPIRED_DEFAULTS.en,
    );
  });
});

describe('resolveSurfaceMismatchMessage (§4.1.1 F-2 표면 불일치 안내)', () => {
  it('default KO / EN', () => {
    expect(resolveSurfaceMismatchMessage(undefined, 'ko')).toBe(
      SURFACE_MISMATCH_DEFAULTS.ko,
    );
    expect(resolveSurfaceMismatchMessage(undefined, 'en')).toBe(
      SURFACE_MISMATCH_DEFAULTS.en,
    );
  });
  it('locale 미설정 → ko fallback', () => {
    expect(resolveSurfaceMismatchMessage(undefined, undefined)).toBe(
      SURFACE_MISMATCH_DEFAULTS.ko,
    );
  });
  it('languageHints.surfaceMismatch override 우선', () => {
    expect(
      resolveSurfaceMismatchMessage({ surfaceMismatch: '커스텀 안내' }, 'en'),
    ).toBe('커스텀 안내');
  });
  it('빈 문자열 override 는 무시하고 default 사용', () => {
    expect(resolveSurfaceMismatchMessage({ surfaceMismatch: '' }, 'ko')).toBe(
      SURFACE_MISMATCH_DEFAULTS.ko,
    );
  });
  // CLE-CHAT-DATA-CONFIG 「안내 문구 기본값」 표와 글자 그대로 같다(KO 는 합쇼체, CLE-T-A0G1FB).
  // 마침표가 있어도 된다. 발송 경로(HooksService.sendBestEffortNotice)가 adapter.escapeControlText 로
  // 프로바이더별 escape 를 한다.
  it('KO / EN default 는 스펙 표의 문구다', () => {
    expect(SURFACE_MISMATCH_DEFAULTS.ko).toBe(
      '지금은 이 입력을 받을 수 없습니다. 화면에 표시된 양식이나 버튼을 사용해 주세요.',
    );
    expect(SURFACE_MISMATCH_DEFAULTS.en).toBe(
      "This input can't be accepted here right now, please use the form or buttons shown above",
    );
  });
});

describe('locale 과 상관없는 안내 기본 문구 (CLE-CHAT-DATA-CONFIG 「안내 문구 기본값」)', () => {
  // 처음부터 있던 키의 영어 기본값은 스펙 범위 밖이라 locale 과 상관없이 한국어 문구 하나다.
  it('groupChatRefusal 기본 문구', () => {
    expect(GROUP_CHAT_REFUSAL_DEFAULT).toBe('이 봇은 1:1 대화만 지원합니다.');
  });
  it('formValidationFailed 기본 문구는 «~해 주세요» 로 띄어 쓴다', () => {
    expect(FORM_VALIDATION_FAILED_DEFAULT).toBe('입력값을 다시 확인해 주세요.');
  });
  it('formNextField 기본 문구는 «~해 주세요» 로 띄어 쓰고 1부터 센 항목 번호를 붙인다', () => {
    expect(formNextFieldDefault(2)).toBe('다음 항목을 입력해 주세요. (2)');
  });
});

describe('resolveFormOpenLabel (§4.1 form_modal 버튼 라벨)', () => {
  it('default KO / EN', () => {
    expect(resolveFormOpenLabel(undefined, 'ko')).toBe('양식 작성하기');
    expect(resolveFormOpenLabel(undefined, 'en')).toBe('Open form');
    expect(FORM_OPEN_LABEL_DEFAULTS.ko).toBe('양식 작성하기');
  });
  it('locale 미설정 → ko fallback', () => {
    expect(resolveFormOpenLabel(undefined, undefined)).toBe('양식 작성하기');
  });
  it('languageHints override 우선', () => {
    expect(resolveFormOpenLabel({ formOpenLabel: '작성' }, 'en')).toBe('작성');
  });
  it('빈 override 는 무시 → locale default', () => {
    expect(resolveFormOpenLabel({ formOpenLabel: '' }, 'en')).toBe('Open form');
  });
});

describe('DEFAULT_LANGUAGE_HINTS (Spec Chat Channel §4.1.1)', () => {
  it('contains all 6 keys for both ko and en', () => {
    const keys = [
      'executionFailedThirdParty4xx',
      'executionFailedThirdParty5xx',
      'executionFailedThirdParty',
      'executionFailedTimeout',
      'executionFailedRateLimit',
      'executionFailedInternal',
    ] as const;
    for (const key of keys) {
      expect(typeof DEFAULT_LANGUAGE_HINTS.ko[key]).toBe('string');
      expect(DEFAULT_LANGUAGE_HINTS.ko[key].length).toBeGreaterThan(0);
      expect(typeof DEFAULT_LANGUAGE_HINTS.en[key]).toBe('string');
      expect(DEFAULT_LANGUAGE_HINTS.en[key].length).toBeGreaterThan(0);
    }
  });

  it('KO default uses {statusCode} placeholder in 4xx / 5xx variants only', () => {
    expect(DEFAULT_LANGUAGE_HINTS.ko.executionFailedThirdParty4xx).toContain(
      '{statusCode}',
    );
    expect(DEFAULT_LANGUAGE_HINTS.ko.executionFailedThirdParty5xx).toContain(
      '{statusCode}',
    );
    expect(DEFAULT_LANGUAGE_HINTS.ko.executionFailedThirdParty).not.toContain(
      '{statusCode}',
    );
    expect(DEFAULT_LANGUAGE_HINTS.ko.executionFailedTimeout).not.toContain(
      '{statusCode}',
    );
    expect(DEFAULT_LANGUAGE_HINTS.ko.executionFailedRateLimit).not.toContain(
      '{statusCode}',
    );
    expect(DEFAULT_LANGUAGE_HINTS.ko.executionFailedInternal).not.toContain(
      '{statusCode}',
    );
  });

  it('EN default mirrors {statusCode} placement', () => {
    expect(DEFAULT_LANGUAGE_HINTS.en.executionFailedThirdParty4xx).toContain(
      '{statusCode}',
    );
    expect(DEFAULT_LANGUAGE_HINTS.en.executionFailedThirdParty5xx).toContain(
      '{statusCode}',
    );
  });

  it('does not contain any other {...} placeholder (whitelist enforcement)', () => {
    for (const locale of ['ko', 'en'] as const) {
      for (const text of Object.values(DEFAULT_LANGUAGE_HINTS[locale])) {
        const placeholders = text.match(/\{[^}]+\}/g) ?? [];
        for (const ph of placeholders) {
          expect(ph).toBe('{statusCode}');
        }
      }
    }
  });
});

describe('resolveLanguageHint — 3-level lookup', () => {
  it('(1) user override takes precedence over locale default', () => {
    const result = resolveLanguageHint(
      'executionFailedInternal',
      { executionFailedInternal: '커스텀 안내' },
      'ko',
    );
    expect(result).toBe('커스텀 안내');
  });

  it('(2) en locale default when override missing', () => {
    const result = resolveLanguageHint(
      'executionFailedInternal',
      undefined,
      'en',
    );
    expect(result).toBe(DEFAULT_LANGUAGE_HINTS.en.executionFailedInternal);
  });

  it('(3) ko fallback when locale undefined', () => {
    const result = resolveLanguageHint(
      'executionFailedInternal',
      undefined,
      undefined,
    );
    expect(result).toBe(DEFAULT_LANGUAGE_HINTS.ko.executionFailedInternal);
  });

  it('(3) ko fallback when locale is unknown value (defensive)', () => {
    const result = resolveLanguageHint(
      'executionFailedTimeout',
      {},
      'fr' as unknown as LanguageLocale,
    );
    expect(result).toBe(DEFAULT_LANGUAGE_HINTS.ko.executionFailedTimeout);
  });

  it('legacy `executionFailed` single key is ignored (deprecated) + warn log 발생', () => {
    // 운영자가 `executionFailed` 만 설정한 경우 — 신규 6 키 lookup 은 default 로 fallback
    // 03 m-1 — console.warn → NestJS Logger 전환.
    const warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const result = resolveLanguageHint(
      'executionFailedInternal',
      { executionFailed: 'legacy custom' },
      'ko',
    );
    // legacy 'executionFailed' 무시, ko default 반환
    expect(result).toBe(DEFAULT_LANGUAGE_HINTS.ko.executionFailedInternal);
    // W#13: deprecation warn log 발생 확인
    expect(warnSpy).toHaveBeenCalled();
    const call = warnSpy.mock.calls[0]?.[0];
    const repr = typeof call === 'string' ? call : JSON.stringify(call);
    expect(repr).toContain('chat_channel_deprecated_execution_failed_hint');
    warnSpy.mockRestore();
  });

  it('empty string override falls back to default (treat empty as unset)', () => {
    const result = resolveLanguageHint(
      'executionFailedInternal',
      { executionFailedInternal: '' },
      'en',
    );
    expect(result).toBe(DEFAULT_LANGUAGE_HINTS.en.executionFailedInternal);
  });

  // 입구 거부(CLE-T-9Q304H) 전에 저장된 트리거에는 `languageHints: null` 이 남아 있을 수 있다(NERV Task `CLE-T-CSVGX0`).
  it('저장된 languageHints 가 null 이면 던지지 않고 기본 문구를 돌려주며 폐기 키 경고를 내지 않는다', () => {
    const warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    try {
      expect(resolveLanguageHint('executionFailedInternal', null, 'ko')).toBe(
        DEFAULT_LANGUAGE_HINTS.ko.executionFailedInternal,
      );
      expect(resolveLanguageHint('executionFailedTimeout', null, 'en')).toBe(
        DEFAULT_LANGUAGE_HINTS.en.executionFailedTimeout,
      );
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });
});

describe('applyPlaceholders ({statusCode} 치환)', () => {
  it('integer statusCode replaces {statusCode}', () => {
    const text = applyPlaceholders('HTTP {statusCode} error', {
      statusCode: 404,
    });
    expect(text).toBe('HTTP 404 error');
  });

  it('omitted statusCode → "?" replacement', () => {
    const text = applyPlaceholders('HTTP {statusCode} error', {});
    expect(text).toBe('HTTP ? error');
  });

  it('multiple {statusCode} occurrences all replaced', () => {
    const text = applyPlaceholders('{statusCode}—{statusCode}', {
      statusCode: 502,
    });
    expect(text).toBe('502—502');
  });

  it('text without placeholder returned as-is', () => {
    const text = applyPlaceholders('no placeholder here', {
      statusCode: 500,
    });
    expect(text).toBe('no placeholder here');
  });

  it('does not interpret unknown placeholders ({nodeId} stays literal)', () => {
    // DTO validator 가 등록 시점에 reject 해야 하지만, runtime 도 안전.
    const text = applyPlaceholders('fail in {nodeId} ({statusCode})', {
      statusCode: 500,
    });
    expect(text).toBe('fail in {nodeId} (500)');
  });
});

// 근거: NERV 질문 `01a1d025-899f-7709-b759-4f7bf6c16ef5`(2026-11-12) — 슬래시 명령의 수신 응답은 새
// `languageHints` 키 하나에 합쇼체 기본값을 둔다. NERV Task `CLE-T-TSEP9G`.
describe('resolveCommandReceivedMessage (슬래시 명령 수신 응답)', () => {
  it('기본 문구는 KO 합쇼체 · EN 이다', () => {
    expect(resolveCommandReceivedMessage(undefined, 'ko')).toBe(
      '요청을 받았습니다.',
    );
    expect(resolveCommandReceivedMessage(undefined, 'en')).toBe(
      'Request received.',
    );
    expect(COMMAND_RECEIVED_DEFAULTS.ko).toBe('요청을 받았습니다.');
  });
  it('locale 이 없으면 ko 문구다', () => {
    expect(resolveCommandReceivedMessage(undefined, undefined)).toBe(
      COMMAND_RECEIVED_DEFAULTS.ko,
    );
  });
  it('languageHints.commandReceived 가 있으면 그 문구다', () => {
    expect(
      resolveCommandReceivedMessage({ commandReceived: '접수했어요' }, 'en'),
    ).toBe('접수했어요');
  });
  it('빈 문자열 override 는 무시한다', () => {
    expect(resolveCommandReceivedMessage({ commandReceived: '' }, 'en')).toBe(
      COMMAND_RECEIVED_DEFAULTS.en,
    );
  });
});

// 근거: NERV 질문 `01a1f2b8-1ad7-7778-b15d-36c208d2accf`(2026-11-19) — 진행 중인 실행이 없는 대화의 `/cancel`
// 안내는 새 `languageHints` 키 `noActiveExecution` 에 합쇼체 기본값을 둔다. NERV Task `CLE-T-A78V0M`.
describe('resolveNoActiveExecutionMessage (진행 중인 실행이 없을 때 /cancel 안내)', () => {
  it('기본 문구는 KO 합쇼체 · EN 이다', () => {
    expect(resolveNoActiveExecutionMessage(undefined, 'ko')).toBe(
      '진행 중인 대화가 없습니다.',
    );
    expect(resolveNoActiveExecutionMessage(undefined, 'en')).toBe(
      'There is no active conversation.',
    );
  });
  it('locale 이 없으면 ko 문구다', () => {
    expect(resolveNoActiveExecutionMessage(undefined, undefined)).toBe(
      NO_ACTIVE_EXECUTION_DEFAULTS.ko,
    );
  });
  it('languageHints.noActiveExecution 이 있으면 그 문구다', () => {
    expect(
      resolveNoActiveExecutionMessage(
        { noActiveExecution: '취소할 대화 없음' },
        'en',
      ),
    ).toBe('취소할 대화 없음');
  });
  it('빈 문자열 override 는 무시한다', () => {
    expect(
      resolveNoActiveExecutionMessage({ noActiveExecution: '' }, 'en'),
    ).toBe(NO_ACTIVE_EXECUTION_DEFAULTS.en);
  });
});

// 근거: NERV 질문 `01a1f7b4-2468-7172-8504-4918e82d8396`(2026-11-20) — `/start` 로 새 실행을 시작하면 시작 안내
// `executionStarted`, 활성 실행을 취소하고 다시 시작하면 새 키 `executionRestarted` 를 보낸다. NERV Task `CLE-T-0400J6`.
describe('resolveExecutionStartedMessage (/start 시작 안내)', () => {
  it('기본 문구는 KO 합쇼체 · EN 이다', () => {
    expect(resolveExecutionStartedMessage(undefined, 'ko')).toBe(
      '워크플로우를 시작합니다.',
    );
    expect(resolveExecutionStartedMessage(undefined, 'en')).toBe(
      'Started the workflow.',
    );
  });
  it('locale 이 없으면 ko 문구다', () => {
    expect(resolveExecutionStartedMessage(undefined, undefined)).toBe(
      EXECUTION_STARTED_DEFAULTS.ko,
    );
  });
  it('languageHints.executionStarted 가 있으면 그 문구다', () => {
    expect(
      resolveExecutionStartedMessage({ executionStarted: '시작!' }, 'en'),
    ).toBe('시작!');
  });
  it('빈 문자열 override 는 무시한다', () => {
    expect(resolveExecutionStartedMessage({ executionStarted: '' }, 'en')).toBe(
      EXECUTION_STARTED_DEFAULTS.en,
    );
  });
});

describe('resolveExecutionRestartedMessage (/start 재시작 안내)', () => {
  it('기본 문구는 KO 합쇼체 · EN 이다', () => {
    expect(resolveExecutionRestartedMessage(undefined, 'ko')).toBe(
      '기존 대화를 종료하고 새로 시작합니다.',
    );
    expect(resolveExecutionRestartedMessage(undefined, 'en')).toBe(
      'Ended the previous conversation and started a new one.',
    );
  });
  it('locale 이 없으면 ko 문구다', () => {
    expect(resolveExecutionRestartedMessage(undefined, undefined)).toBe(
      EXECUTION_RESTARTED_DEFAULTS.ko,
    );
  });
  it('languageHints.executionRestarted 가 있으면 그 문구다', () => {
    expect(
      resolveExecutionRestartedMessage(
        { executionRestarted: '다시 시작!', executionStarted: '시작!' },
        'en',
      ),
    ).toBe('다시 시작!');
  });
  it('executionStarted 덮어쓰기는 재시작 안내에 쓰지 않는다', () => {
    expect(
      resolveExecutionRestartedMessage({ executionStarted: '시작!' }, 'ko'),
    ).toBe(EXECUTION_RESTARTED_DEFAULTS.ko);
  });
  it('빈 문자열 override 는 무시한다', () => {
    expect(
      resolveExecutionRestartedMessage({ executionRestarted: '' }, 'en'),
    ).toBe(EXECUTION_RESTARTED_DEFAULTS.en);
  });
});
