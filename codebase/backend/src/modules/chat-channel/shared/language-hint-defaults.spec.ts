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
  makeLocaleResolver,
  type LanguageLocale,
} from './language-hint-defaults';
// canonical MarkdownV2 escaper 를 재사용 — 특수문자 집합을 손으로 재선언하면 telegram
// renderer 쪽 정의가 갱신될 때 이 테스트의 안전성 보증이 stale 되어 조용히 무력화된다.
import { escapeMarkdownV2 } from '../providers/telegram/telegram-message.renderer';

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
  it('다른 키의 override 는 영향 없음', () => {
    expect(resolve({ otherKey: 'x' }, 'en')).toBe('english');
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
  // control-plane 경로(렌더러 escape 미적용)라 default 는 MarkdownV2 특수문자를 포함하면 안 됨.
  // canonical escapeMarkdownV2 를 통과시켜도 원문과 동일 = 이스케이프 대상 문자가 없음.
  it('KO / EN default 는 telegram MarkdownV2 특수문자를 포함하지 않는다 (raw 발송 안전)', () => {
    expect(escapeMarkdownV2(SURFACE_MISMATCH_DEFAULTS.ko)).toBe(
      SURFACE_MISMATCH_DEFAULTS.ko,
    );
    expect(escapeMarkdownV2(SURFACE_MISMATCH_DEFAULTS.en)).toBe(
      SURFACE_MISMATCH_DEFAULTS.en,
    );
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
