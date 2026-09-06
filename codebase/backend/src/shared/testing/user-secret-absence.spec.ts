import { describe, it, expect } from '@jest/globals';

import {
  USER_SECRET_KEYS,
  expectNoUserSecrets,
  findUserSecretLeaks,
} from './user-secret-absence';

/**
 * 단언 헬퍼 자신의 회귀 가드.
 *
 * 이 헬퍼가 무르게 바뀌면 그것을 부르는 모든 e2e 가 **동시에** 조용히 통과한다. 그래서
 * 통과 경로만 보지 않고 **실패해야 하는 경로**를 각각 문다 (자매 헬퍼
 * `schedule-trigger-ref.spec.ts` 와 같은 이유).
 */
describe('findUserSecretLeaks', () => {
  it('깨끗한 응답에는 아무것도 없다', () => {
    expect(
      findUserSecretLeaks({
        data: { items: [{ id: 'u1', name: 'a', email: 'a@b.c' }] },
      }),
    ).toEqual([]);
  });

  it('민감 7컬럼을 **각각** 잡는다 — 하나라도 목록에서 빠지면 여기서 걸린다', () => {
    for (const key of USER_SECRET_KEYS) {
      expect(findUserSecretLeaks({ data: { user: { [key]: 'x' } } })).toEqual([
        `data.user.${key}`,
      ]);
    }
  });

  it('중첩·배열 안쪽도 훑는다 — 유출은 최상위가 아니라 거기서 났다', () => {
    const body = {
      data: { items: [{ id: 'a' }, { id: 'b', user: { passwordHash: 'x' } }] },
    };
    expect(findUserSecretLeaks(body)).toEqual([
      'data.items[1].user.passwordHash',
    ]);
  });

  it('snake_case 로 나가는 형태도 막는다 (raw 쿼리 결과 경로)', () => {
    expect(
      findUserSecretLeaks({ data: { user: { password_hash: 'x' } } }),
    ).toEqual(['data.user.password_hash']);
  });

  it('여러 건이면 경로를 전부 돌려준다 — 하나만 고치고 끝내지 않도록', () => {
    const body = {
      data: {
        user: { passwordHash: 'x', twoFactorSecret: 'y' },
      },
    };
    expect(findUserSecretLeaks(body).sort()).toEqual([
      'data.user.passwordHash',
      'data.user.twoFactorSecret',
    ]);
  });

  it('`null` 값이어도 **키가 있으면** 잡는다 — 키 존재 자체가 계약 위반이다', () => {
    expect(
      findUserSecretLeaks({ data: { user: { passwordHash: null } } }),
    ).toEqual(['data.user.passwordHash']);
  });

  it('이름이 비슷할 뿐인 키는 놓아 준다', () => {
    expect(
      findUserSecretLeaks({
        data: { hasPassword: true, passwordChangedAt: 't', userEmail: 'a' },
      }),
    ).toEqual([]);
  });

  it('원시값·null 을 넘겨도 터지지 않는다', () => {
    expect(findUserSecretLeaks(null)).toEqual([]);
    expect(findUserSecretLeaks('passwordHash')).toEqual([]);
    expect(findUserSecretLeaks(42)).toEqual([]);
  });

  it('expectNoUserSecrets 는 위반이 있으면 던진다', () => {
    expect(() =>
      expectNoUserSecrets({ data: { user: { passwordHash: 'x' } } }),
    ).toThrow();
    expect(() =>
      expectNoUserSecrets({ data: { user: { id: 'u1' } } }),
    ).not.toThrow();
  });
});
