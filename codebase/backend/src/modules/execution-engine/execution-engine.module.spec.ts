/**
 * W-12 fix (SUMMARY#W-12): SIGTERM_GRACE_MS factory 방어 코드 단위 테스트.
 *
 * module factory 의 `useFactory` 로직을 직접 추출해 NaN / 음수 / 정상값
 * 케이스를 검증한다.
 */

import { DEFAULT_GRACE_MS } from './shutdown/shutdown.constants';

/** execution-engine.module.ts 의 SHUTDOWN_GRACE_MS useFactory 와 동일 로직.
 * 테스트는 이 함수를 단독 호출해 env 의존성 없이 검증한다. */
function graceFactory(raw: string | undefined): number {
  const parsed = Number(raw ?? DEFAULT_GRACE_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_GRACE_MS;
}

describe('ExecutionEngineModule — SHUTDOWN_GRACE_MS factory (W-12)', () => {
  it('정상 숫자 문자열은 그대로 반환', () => {
    expect(graceFactory('60000')).toBe(60_000);
  });

  it('undefined 시 DEFAULT_GRACE_MS 반환', () => {
    expect(graceFactory(undefined)).toBe(DEFAULT_GRACE_MS);
  });

  it('비숫자 문자열(NaN) 시 DEFAULT_GRACE_MS fallback', () => {
    expect(graceFactory('invalid')).toBe(DEFAULT_GRACE_MS);
  });

  it('빈 문자열(NaN) 시 DEFAULT_GRACE_MS fallback', () => {
    expect(graceFactory('')).toBe(DEFAULT_GRACE_MS);
  });

  it('0 은 유효하지 않음 — DEFAULT_GRACE_MS fallback', () => {
    // 0 은 Number.isFinite(0) true 이지만 > 0 조건에 걸림 → fallback.
    expect(graceFactory('0')).toBe(DEFAULT_GRACE_MS);
  });

  it('음수는 유효하지 않음 — DEFAULT_GRACE_MS fallback', () => {
    expect(graceFactory('-1000')).toBe(DEFAULT_GRACE_MS);
  });

  it('DEFAULT_GRACE_MS 상수값 sanity', () => {
    expect(DEFAULT_GRACE_MS).toBe(30_000);
  });
});
