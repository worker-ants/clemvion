import { extractBackgroundRunId } from './extract-background-run-id';

describe('extractBackgroundRunId (W-18)', () => {
  it('returns empty string when outputData is null', () => {
    expect(extractBackgroundRunId(null)).toBe('');
  });

  it('returns empty string when outputData is undefined', () => {
    expect(extractBackgroundRunId(undefined)).toBe('');
  });

  it('returns empty string when outputData is a primitive', () => {
    expect(extractBackgroundRunId('string')).toBe('');
    expect(extractBackgroundRunId(42)).toBe('');
    expect(extractBackgroundRunId(true)).toBe('');
  });

  it('returns empty string when meta is absent', () => {
    expect(extractBackgroundRunId({ port: 'main' })).toBe('');
  });

  it('returns empty string when meta is not an object', () => {
    expect(extractBackgroundRunId({ meta: 'ignore' })).toBe('');
    expect(extractBackgroundRunId({ meta: null })).toBe('');
    expect(extractBackgroundRunId({ meta: 42 })).toBe('');
  });

  it('returns empty string when backgroundRunId is absent', () => {
    expect(extractBackgroundRunId({ meta: { forkedAt: 'iso' } })).toBe('');
  });

  it('returns empty string when backgroundRunId is not a string', () => {
    expect(extractBackgroundRunId({ meta: { backgroundRunId: 123 } })).toBe('');
    expect(extractBackgroundRunId({ meta: { backgroundRunId: null } })).toBe(
      '',
    );
    expect(extractBackgroundRunId({ meta: { backgroundRunId: ['x'] } })).toBe(
      '',
    );
  });

  it('returns empty string when backgroundRunId is empty', () => {
    expect(extractBackgroundRunId({ meta: { backgroundRunId: '' } })).toBe('');
  });

  it('returns the UUID string when valid', () => {
    expect(
      extractBackgroundRunId({
        meta: { backgroundRunId: '8f3c6b1a-0d2e-4a7e-9c1d-2f0e5a8b1234' },
      }),
    ).toBe('8f3c6b1a-0d2e-4a7e-9c1d-2f0e5a8b1234');
  });
});
