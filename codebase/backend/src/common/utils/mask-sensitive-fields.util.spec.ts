import {
  DEFAULT_SENSITIVE_KEYS,
  maskSensitiveFields,
} from './mask-sensitive-fields.util';
import { deepRedactSecrets } from '../../shared/utils/sanitize-error-message';

describe('maskSensitiveFields', () => {
  it('masks apiKey preserving only the last 4 chars', () => {
    expect(maskSensitiveFields({ apiKey: 'sk-abcdef1234' })).toEqual({
      apiKey: '****1234',
    });
  });

  it('masks across case variants (apiKey, api_key, apikey)', () => {
    expect(
      maskSensitiveFields({
        apiKey: 'aaaaaaaa1111',
        api_key: 'bbbbbbbb2222',
        apikey: 'cccccccc3333',
      }),
    ).toEqual({
      apiKey: '****1111',
      api_key: '****2222',
      apikey: '****3333',
    });
  });

  it('masks deeply nested fields inside objects and arrays', () => {
    const input = {
      user: {
        name: 'Alice',
        credentials: { password: 'p@ssw0rdlong' },
      },
      tokens: [{ refresh_token: 'rt-xxyyzz9999' }, { other: 'ok' }],
    };
    expect(maskSensitiveFields(input)).toEqual({
      user: {
        name: 'Alice',
        credentials: { password: '****long' },
      },
      tokens: [{ refresh_token: '****9999' }, { other: 'ok' }],
    });
  });

  it('returns short values as plain "****" without leaking trailing chars', () => {
    expect(maskSensitiveFields({ apiKey: 'abc' })).toEqual({ apiKey: '****' });
  });

  it('masks non-string sensitive values to "****"', () => {
    expect(maskSensitiveFields({ apiKey: { nested: 'secret' } })).toEqual({
      apiKey: '****',
    });
  });

  it('leaves unrelated fields untouched', () => {
    expect(maskSensitiveFields({ name: 'Bob', age: 30 })).toEqual({
      name: 'Bob',
      age: 30,
    });
  });

  it('handles null, undefined, primitives without throwing', () => {
    expect(maskSensitiveFields(null)).toBeNull();
    expect(maskSensitiveFields(undefined)).toBeUndefined();
    expect(maskSensitiveFields(42)).toBe(42);
    expect(maskSensitiveFields('plain')).toBe('plain');
  });

  it('avoids infinite recursion on circular references', () => {
    const obj: Record<string, unknown> = { name: 'loop' };
    obj.self = obj;
    const masked = maskSensitiveFields(obj) as Record<string, unknown>;
    expect(masked.name).toBe('loop');
    expect(masked.self).toBe('[Circular]');
  });

  it('does not mutate the input', () => {
    const input = { apiKey: 'original-key-1234' };
    const masked = maskSensitiveFields(input);
    expect(input.apiKey).toBe('original-key-1234');
    expect(masked).not.toBe(input);
  });

  // ── `token` 계열 — 이 목록은 **키 이름 완전 일치**라 계열을 정규식처럼 못 접는다.
  //    2026-08-16 실측: bare `token` 만 잡히고 접두형 넷이 평문 통과했다.
  //
  //    **여기 캐너리를 두는 이유**: 이 목록의 다른 소비처(`handler-output.adapter.ts` 의
  //    노드 `config` echo)는 값-패턴 층을 겹치지 않는다. workflow-assistant 쪽 테스트는
  //    겹친 층이 같은 키를 덮어 버려 **목록에서 항목을 빼도 GREEN 이다**(뮤테이션으로 확인).
  //    즉 이 목록을 지키는 가드는 이 자리뿐이다.
  it.each([
    ['csrfToken'],
    ['csrf_token'],
    ['authToken'],
    ['auth_token'],
    ['sessionToken'],
    ['session_token'],
    ['idToken'],
    ['id_token'],
  ])('masks the `%s` key (token family, not just bare `token`)', (key) => {
    const masked = maskSensitiveFields({ [key]: 'AAAABBBB9999' }) as Record<
      string,
      unknown
    >;
    expect(masked[key]).toBe('****9999');
  });

  it('leaves a non-credential key that merely contains "token" as a substring', () => {
    // 대조군 — 목록은 **완전 일치**다. 넓히다 이 성질을 잃으면 여기가 RED 가 된다.
    expect(maskSensitiveFields({ tokenCount: 12345 })).toEqual({
      tokenCount: 12345,
    });
  });
});

/**
 * **포함관계 캐너리 — 두 마스커의 키 집합**
 *
 * `maskSensitiveFields`(이 파일, 키 이름 목록 `DEFAULT_SENSITIVE_KEYS`)와
 * `deepRedactSecrets`(`sanitize-error-message.ts`, `CREDENTIAL_KEY_PATTERN` 정규식)는
 * **같은 클래스를 서로 다른 수단으로** 막는다. 그런데 egress 경로(WS `maskWireEnvelope` ·
 * REST `redactStoredDataForResponse`)는 **후자만** 지난다.
 *
 * 그래서 *"전자가 잡는 키를 후자도 잡는가"* 가 **구조적 안전 전제**다. 이 포함관계가 서 있으면
 * 앞단(`handler-output.adapter` 의 config echo)에서 전자를 걷어내도 egress 는 여전히 덮인다.
 * 깨지면 그 차집합이 곧 유출이다.
 *
 * ## 상수에서 **직접** 파생한다
 *
 * 초판은 키를 **손으로 다시 나열**하고 `Object.keys(maskSensitiveFields({...}))` 로 감싸
 * *"목록에서 파생했다"* 고 적었다. `maskSensitiveFields` 는 키를 **드롭하지 않으므로** 그
 * 표현식은 입력 리터럴을 그대로 돌려줄 뿐이고, `DEFAULT_SENSITIVE_KEYS` 와 **무관**했다.
 * `10_53_52` 리뷰가 실증했다 — egress 가 못 잡는 가상 키를 목록에 넣어도 전 스위트 GREEN.
 *
 * 그래서 상수를 export 해 `[...DEFAULT_SENSITIVE_KEYS]` 로 **진짜 파생**한다. 이제 목록이
 * 넓어지면(2026-08-23 에 token 계열 8키가 그랬듯) 새 키가 **자동으로** 검사된다.
 */
describe('DEFAULT_SENSITIVE_KEYS ⊆ deepRedactSecrets 의 키 축', () => {
  const KEYS = [...DEFAULT_SENSITIVE_KEYS];

  it('[메타] 목록이 비어 있지 않다 — 파생이 끊기면 아래 전부가 공허해진다', () => {
    expect(KEYS.length).toBeGreaterThan(15);
  });

  it.each(KEYS)(
    '`%s` 는 egress 마스커(`deepRedactSecrets`)도 가린다',
    (key) => {
      const raw = 'SUPER-SECRET-VALUE-0123456789';
      const out = deepRedactSecrets({ [key]: raw }) as Record<string, unknown>;
      expect(out[key]).not.toBe(raw);
      expect(String(out[key])).not.toContain('0123456789');
    },
  );

  /**
   * **빈 값은 이 PR 이 실제로 동작을 바꾼 지점**이다 (`11_25_15` testing INFO 4).
   * 어댑터 마스킹이 있을 땐 빈 문자열도 마스킹 형태로 눌렸지만, 이제 egress 까지 원문으로
   * 간다. 값이 비어 있어 **실질 유출은 없다** — 그 사각을 우연이 아니라 **의도**로 못박는다.
   */
  it('[대조군] 빈 문자열 자격증명은 원문으로 통과한다 (유출 없음, 의도된 사각)', () => {
    const out = deepRedactSecrets({ apiKey: '' }) as Record<string, unknown>;
    // `typeof === 'string'` 은 **마스킹돼도 참**이라 분기를 못 가른다 (`12_00_05` W2 가
    // `v !== ''` 가드를 빼는 뮤턴트로 42/42 GREEN 을 실증했다). 값으로 단언한다.
    expect(out.apiKey).toBe('');
  });

  it('[대조군] 민감하지 않은 키는 두 마스커 모두 건드리지 않는다', () => {
    const benign = { tokenCount: 12345, description: 'plain text' };
    expect(maskSensitiveFields(benign)).toEqual(benign);
    expect(deepRedactSecrets(benign)).toEqual(benign);
  });
});
