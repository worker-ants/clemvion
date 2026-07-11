import {
  RESERVED_VARIABLE_NAME_CODE,
  RESERVED_VARIABLE_PREFIX,
  isReservedVariableName,
  reservedVariableNameError,
  reservedVariableNameRuntimeError,
} from './reserved-variable-name.util';

describe('reserved-variable-name.util', () => {
  describe('isReservedVariableName', () => {
    it.each(['__workspaceId', '__dryRun', '__', '__x', '___triple'])(
      'rejects %s (double-underscore prefix)',
      (name) => {
        expect(isReservedVariableName(name)).toBe(true);
      },
    );

    // 원칙 4(top-level `_resumeState`)와 원칙 5(`variables` 맵 내부 `__`)의
    // 구분을 고정한다 — 단일 underscore 는 variables 맵에서 예약이 아니다.
    it.each(['_foo', '_', 'foo', 'foo__bar', 'a__', ''])(
      'allows %s (not a double-underscore prefix)',
      (name) => {
        expect(isReservedVariableName(name)).toBe(false);
      },
    );

    it.each([undefined, null, 42, {}, ['__x']])(
      'returns false for non-string %p (name-required check owns that error)',
      (name) => {
        expect(isReservedVariableName(name)).toBe(false);
      },
    );
  });

  it('reservedVariableNameError embeds the path and the prefix', () => {
    expect(reservedVariableNameError('variables[2].name')).toBe(
      'variables[2].name must not start with reserved prefix "__"',
    );
  });

  it('reservedVariableNameRuntimeError carries the code prefix and resolved value', () => {
    const err = reservedVariableNameRuntimeError(
      'variables[0].name',
      '__workspaceId',
    );
    expect(err).toBeInstanceOf(Error);
    // 엔진은 thrown Error 를 message-only 로 기록하므로 코드가 message 안에 있어야 한다.
    expect(err.message).toContain(RESERVED_VARIABLE_NAME_CODE);
    expect(err.message).toContain('__workspaceId');
    expect(err.message).toContain('variables[0].name');
  });

  it('exposes the prefix as the single source of truth', () => {
    expect(RESERVED_VARIABLE_PREFIX).toBe('__');
  });
});
