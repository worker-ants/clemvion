import {
  buildSecretRef,
  buildSecretRefPrefix,
  isSecretRef,
  parseSecretRef,
} from './secret-ref';

describe('secret-ref', () => {
  describe('parseSecretRef', () => {
    it('정상 — triggers/{uuid}/bot-token', () => {
      const result = parseSecretRef(
        'secret://triggers/123e4567-e89b-12d3-a456-426614174000/bot-token',
      );
      expect(result).toEqual({
        scope: 'triggers',
        resourceId: '123e4567-e89b-12d3-a456-426614174000',
        name: 'bot-token',
      });
    });

    it('정상 — .v2 접미사 (rotation grace)', () => {
      const result = parseSecretRef('secret://triggers/abc/bot-token.v2');
      expect(result?.name).toBe('bot-token.v2');
    });

    it('정상 — auth-configs scope', () => {
      const result = parseSecretRef('secret://auth-configs/abc/client-secret');
      expect(result?.scope).toBe('auth-configs');
    });

    it('실패 — secret:// prefix 누락', () => {
      expect(parseSecretRef('triggers/abc/bot-token')).toBeNull();
    });

    it('실패 — scope 대문자', () => {
      expect(parseSecretRef('secret://Triggers/abc/bot-token')).toBeNull();
    });

    it('실패 — name 빈 문자열', () => {
      expect(parseSecretRef('secret://triggers/abc/')).toBeNull();
    });

    it('실패 — 깊이 부족', () => {
      expect(parseSecretRef('secret://triggers/abc')).toBeNull();
    });

    it('실패 — name 대문자', () => {
      expect(parseSecretRef('secret://triggers/abc/BotToken')).toBeNull();
    });
  });

  describe('buildSecretRef', () => {
    it('정상 합성', () => {
      const ref = buildSecretRef({
        scope: 'triggers',
        resourceId: 'abc',
        name: 'bot-token',
      });
      expect(ref).toBe('secret://triggers/abc/bot-token');
    });

    it('실패 — 잘못된 scope', () => {
      expect(() =>
        buildSecretRef({ scope: 'INVALID', resourceId: 'a', name: 'b' }),
      ).toThrow();
    });
  });

  describe('isSecretRef', () => {
    it('valid', () => {
      expect(isSecretRef('secret://triggers/abc/bot-token')).toBe(true);
    });

    it('invalid string', () => {
      expect(isSecretRef('not-a-ref')).toBe(false);
    });

    it('non-string', () => {
      expect(isSecretRef(123)).toBe(false);
      expect(isSecretRef(null)).toBe(false);
      expect(isSecretRef(undefined)).toBe(false);
    });
  });

  describe('buildSecretRefPrefix', () => {
    it('한 리소스의 ref 전부를 가리키는 접두 — 이름을 붙이면 buildSecretRef 와 같다', () => {
      const prefix = buildSecretRefPrefix({
        scope: 'triggers',
        resourceId: 'trig-1',
      });

      expect(prefix).toBe('secret://triggers/trig-1/');
      expect(prefix + 'bot-token').toBe(
        buildSecretRef({
          scope: 'triggers',
          resourceId: 'trig-1',
          name: 'bot-token',
        }),
      );
    });

    it('끝의 `/` 로 이웃 id 를 가른다 — trig-1 접두가 trig-10 의 ref 를 덮지 않는다', () => {
      const prefix = buildSecretRefPrefix({
        scope: 'triggers',
        resourceId: 'trig-1',
      });

      expect('secret://triggers/trig-10/bot-token'.startsWith(prefix)).toBe(
        false,
      );
    });

    it('형식 검증은 buildSecretRef 와 같다 — scope 가 형식을 어기면 던진다', () => {
      expect(() =>
        buildSecretRefPrefix({ scope: 'Triggers', resourceId: 'trig-1' }),
      ).toThrow(/buildSecretRef: invalid parts/);
    });
  });
});
