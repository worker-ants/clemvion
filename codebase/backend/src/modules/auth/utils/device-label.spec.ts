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

  // iOS 는 WebKit 강제 정책으로 브라우저마다 전용 토큰(CriOS/FxiOS/EdgiOS/OPT)을 쓴다
  it('Chrome on iOS (CriOS)', () => {
    expect(
      deriveDeviceLabel(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('Chrome on iOS');
  });

  it('Firefox on iOS (FxiOS)', () => {
    expect(
      deriveDeviceLabel(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/116.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('Firefox on iOS');
  });

  it('Edge on iOS (EdgiOS) — Version/ 토큰이 있어도 Edge 로 식별', () => {
    expect(
      deriveDeviceLabel(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 EdgiOS/115.0.1901.96 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('Edge on iOS');
  });

  it('Opera on iOS (OPT)', () => {
    expect(
      deriveDeviceLabel(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) OPT/4.4.0',
      ),
    ).toBe('Opera on iOS');
  });

  it('Opera on iOS (OPiOS, 구 Opera Mini)', () => {
    expect(
      deriveDeviceLabel(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 10_3 like Mac OS X) AppleWebKit/603.1.30 (KHTML, like Gecko) OPiOS/14.0.0.104835 Mobile/14E5239e Safari/9537.53',
      ),
    ).toBe('Opera on iOS');
  });

  it('Safari on iPod touch 도 iOS 로 식별', () => {
    expect(
      deriveDeviceLabel(
        'Mozilla/5.0 (iPod touch; CPU iPhone OS 15_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('Safari on iOS');
  });

  it('iPad Chrome (CriOS) 도 iOS 로 식별', () => {
    expect(
      deriveDeviceLabel(
        'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('Chrome on iOS');
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
