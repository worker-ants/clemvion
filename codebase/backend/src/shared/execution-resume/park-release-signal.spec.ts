/**
 * WARNING #9 (ai-review) — `park-release-signal.ts` 전체 미커버.
 * `ParkReleaseSignal` 클래스와 `isParkReleaseSignal` 타입 가드의 기본 동작 4케이스 검증.
 *
 * spec: 5-system/4-execution-engine.md §4.x(park = 세그먼트 종료) · §7.5(중첩 재개)
 */

import { ParkReleaseSignal, isParkReleaseSignal } from './park-release-signal';

describe('ParkReleaseSignal', () => {
  it('instanceof ParkReleaseSignal 는 true (자기 자신)', () => {
    const signal = new ParkReleaseSignal();
    expect(signal instanceof ParkReleaseSignal).toBe(true);
  });

  it('instanceof ParkReleaseSignal 는 Error 도 true (Error 상속)', () => {
    const signal = new ParkReleaseSignal();
    expect(signal instanceof Error).toBe(true);
  });

  it('name 은 "ParkReleaseSignal"', () => {
    const signal = new ParkReleaseSignal();
    expect(signal.name).toBe('ParkReleaseSignal');
  });

  it('message 에 park 설명 포함', () => {
    const signal = new ParkReleaseSignal();
    expect(signal.message).toContain('park');
  });
});

describe('isParkReleaseSignal', () => {
  it('ParkReleaseSignal 인스턴스에 대해 true', () => {
    expect(isParkReleaseSignal(new ParkReleaseSignal())).toBe(true);
  });

  it('일반 Error 에 대해 false', () => {
    expect(isParkReleaseSignal(new Error('boom'))).toBe(false);
  });

  it('null 에 대해 false (null 안전 처리)', () => {
    expect(isParkReleaseSignal(null)).toBe(false);
  });

  it('undefined 에 대해 false', () => {
    expect(isParkReleaseSignal(undefined)).toBe(false);
  });
});
