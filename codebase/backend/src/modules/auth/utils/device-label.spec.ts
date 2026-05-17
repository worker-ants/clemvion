import { deriveDeviceLabel } from './device-label';

describe('deriveDeviceLabel', () => {
  it('Chrome on macOS', () => {
    expect(
      deriveDeviceLabel(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ),
    ).toBe('Chrome on macOS');
  });

  it('Safari on iOS', () => {
    expect(
      deriveDeviceLabel(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('Safari on iOS');
  });

  it('Firefox on Windows', () => {
    expect(
      deriveDeviceLabel(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
      ),
    ).toBe('Firefox on Windows');
  });

  it('Chrome on Android', () => {
    expect(
      deriveDeviceLabel(
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      ),
    ).toBe('Chrome on Android');
  });

  it('curl CLI', () => {
    expect(deriveDeviceLabel('curl/8.4.0')).toBe('curl');
  });

  it('null 입력은 알 수 없음', () => {
    expect(deriveDeviceLabel(null)).toBe('Unknown device');
    expect(deriveDeviceLabel(undefined)).toBe('Unknown device');
    expect(deriveDeviceLabel('')).toBe('Unknown device');
  });

  it('식별 불가능한 UA 는 원문을 축약', () => {
    expect(deriveDeviceLabel('SomeBot/1.0')).toBe('SomeBot/1.0');
    const long = 'A'.repeat(200);
    expect(deriveDeviceLabel(long).length).toBeLessThanOrEqual(64);
  });
});
