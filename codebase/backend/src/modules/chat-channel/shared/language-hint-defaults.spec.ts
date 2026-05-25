import {
  DEFAULT_LANGUAGE_HINTS,
  resolveLanguageHint,
  applyPlaceholders,
  type LanguageLocale,
} from './language-hint-defaults';

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

  it('legacy `executionFailed` single key is ignored (deprecated)', () => {
    // 운영자가 `executionFailed` 만 설정한 경우 — 신규 6 키 lookup 은 default 로 fallback
    const result = resolveLanguageHint(
      'executionFailedInternal',
      { executionFailed: 'legacy custom' },
      'ko',
    );
    // legacy 'executionFailed' 무시, ko default 반환
    expect(result).toBe(DEFAULT_LANGUAGE_HINTS.ko.executionFailedInternal);
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
