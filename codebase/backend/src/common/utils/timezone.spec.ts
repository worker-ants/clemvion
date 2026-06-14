import { isValidIanaTimezone } from './timezone';

describe('isValidIanaTimezone', () => {
  it('유효한 IANA 식별자 → true', () => {
    expect(isValidIanaTimezone('Asia/Seoul')).toBe(true);
    expect(isValidIanaTimezone('America/New_York')).toBe(true);
    expect(isValidIanaTimezone('UTC')).toBe(true);
    expect(isValidIanaTimezone('Europe/London')).toBe(true);
  });

  it('빈 문자열/비문자열 → false', () => {
    expect(isValidIanaTimezone('')).toBe(false);
    expect(isValidIanaTimezone(undefined as unknown as string)).toBe(false);
    expect(isValidIanaTimezone(null as unknown as string)).toBe(false);
  });

  it('오타/미지원 식별자 → false', () => {
    expect(isValidIanaTimezone('Not/AZone')).toBe(false);
    expect(isValidIanaTimezone('Mars/Phobos')).toBe(false);
    expect(isValidIanaTimezone('!!!')).toBe(false);
  });
});
