import { makePgError } from '../../shared/testing/pg-error-fixtures';
import {
  isPostgresUniqueViolation,
  pgErrorCode,
  pgErrorConstraint,
} from './pg-error';

/**
 * 이 헬퍼들이 존재하는 이유는 **wrap 깊이가 호출 경로마다 다르기** 때문이다 — raw query 는
 * `err.code`, `Repository.save` 는 `err.driverError.code` 로 올라온다. 그래서 두 표면을
 * 각각 태우지 않으면 "한쪽만 보는" 판이 조용히 살아남는다 (실제로 그렇게 생긴 사본이
 * 저장소에 넷 있었다 — `review/code/2026/09/06/14_59_48` W1).
 */
describe('pg-error — 두 wrap 표면', () => {
  // fixture 는 `__test-utils__/pg-error-fixtures.ts` 가 SoT 다 — 표면을 손으로 다시
  // 만들면 이 PR 이 프로덕션에서 막은 중복이 테스트에 재발한다
  // (`review/code/2026/09/06/15_52_58` W3).
  const wrapped = (props: Record<string, unknown>): unknown =>
    makePgError(props, 'driverError');
  const flat = (props: Record<string, unknown>): unknown =>
    makePgError(props, 'top');

  it.each([
    ['driverError 표면', wrapped({ code: '23505' })],
    ['최상위 표면', flat({ code: '23505' })],
  ])('%s 의 SQLSTATE 를 읽는다', (_label, err) => {
    expect(pgErrorCode(err)).toBe('23505');
    expect(isPostgresUniqueViolation(err)).toBe(true);
  });

  it.each([
    ['driverError 표면', wrapped({ code: '23505', constraint: 'idx_a' })],
    ['최상위 표면', flat({ code: '23505', constraint: 'idx_a' })],
  ])('%s 의 제약 이름을 읽는다', (_label, err) => {
    expect(pgErrorConstraint(err)).toBe('idx_a');
  });

  it.each([
    ['driverError 표면', wrapped({ code: '23505' })],
    ['최상위 표면', flat({ code: '23505' })],
  ])(
    '%s — 제약 이름이 없으면 undefined (호출부가 좁히지 않고 전역 매핑에 맡기게 한다)',
    (_label, err) => {
      // 종전엔 `driverError` 표면만 이름 붙여 태우고 최상위 표면은 범용 테이블에
      // **우연히만** 덮였다 — 라벨과 커버리지가 어긋난 상태였다
      // (`review/code/2026/09/06/16_58_14` INFO#6).
      expect(pgErrorConstraint(err)).toBeUndefined();
    },
  );

  it.each([
    ['null', null],
    ['원시값', 'boom'],
    ['빈 에러', new Error('x')],
  ])('%s 에도 터지지 않고 undefined/false', (_label, err) => {
    expect(pgErrorCode(err)).toBeUndefined();
    expect(pgErrorConstraint(err)).toBeUndefined();
    expect(isPostgresUniqueViolation(err)).toBe(false);
  });

  it('23505 가 아닌 SQLSTATE 는 unique 위반이 아니다', () => {
    expect(isPostgresUniqueViolation(wrapped({ code: '23502' }))).toBe(false);
  });
});
