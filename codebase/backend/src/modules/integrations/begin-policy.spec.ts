import { describe, it, expect } from '@jest/globals';
import { ConflictException } from '@nestjs/common';
import {
  isStoreIdentifierConflict,
  resolveBeginScope,
  toAlreadyConnectedConflict,
} from './begin-policy';
import {
  ALREADY_CONNECTED_BY_SERVICE,
  GENERIC_ALREADY_CONNECTED,
  STORE_IDENTIFIER_UNIQUE_CONSTRAINT,
} from './integrations.constants';

describe('resolveBeginScope', () => {
  it('scope 가 없으면 개인이다(멤버십 잠금 판정 · INSERT · 생성 인가가 같은 기본값을 쓴다)', () => {
    expect(resolveBeginScope({})).toBe('personal');
  });

  it.each(['personal', 'organization'] as const)(
    '요청한 scope %s 는 그대로 쓴다',
    (scope) => {
      expect(resolveBeginScope({ scope })).toBe(scope);
    },
  );
});

describe('isStoreIdentifierConflict', () => {
  it('상점 식별자 UNIQUE 위반이면 true 다', () => {
    expect(
      isStoreIdentifierConflict({
        code: '23505',
        constraint: STORE_IDENTIFIER_UNIQUE_CONSTRAINT,
      }),
    ).toBe(true);
  });

  it('TypeORM driverError 로 감싼 위반도 true 다', () => {
    expect(
      isStoreIdentifierConflict({
        driverError: {
          code: '23505',
          constraint: STORE_IDENTIFIER_UNIQUE_CONSTRAINT,
        },
      }),
    ).toBe(true);
  });

  it.each([
    ['다른 제약의 UNIQUE 위반', { code: '23505', constraint: 'other_idx' }],
    ['제약 이름이 없는 UNIQUE 위반', { code: '23505' }],
    [
      'UNIQUE 위반이 아닌 오류',
      { code: '23503', constraint: STORE_IDENTIFIER_UNIQUE_CONSTRAINT },
    ],
    ['일반 Error', new Error('boom')],
    ['null', null],
  ])('%s 는 false 다', (_label, err) => {
    expect(isStoreIdentifierConflict(err)).toBe(false);
  });
});

describe('toAlreadyConnectedConflict', () => {
  it.each(['cafe24', 'makeshop'])(
    '%s 는 서비스별 409 코드와 문구를 쓴다',
    (service) => {
      const err = toAlreadyConnectedConflict(service);
      expect(err).toBeInstanceOf(ConflictException);
      expect(err.getStatus()).toBe(409);
      expect(err.getResponse()).toEqual({
        code: ALREADY_CONNECTED_BY_SERVICE[service].code,
        message: ALREADY_CONNECTED_BY_SERVICE[service].message,
      });
    },
  );

  it('등록되지 않은 서비스는 TypeError 대신 공용 409 로 끝난다', () => {
    const err = toAlreadyConnectedConflict('unregistered-service');
    expect(err.getStatus()).toBe(409);
    expect(err.getResponse()).toEqual({
      code: GENERIC_ALREADY_CONNECTED.code,
      message: GENERIC_ALREADY_CONNECTED.message,
    });
  });
});
