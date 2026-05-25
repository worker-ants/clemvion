/**
 * W-18 fix (SUMMARY#W-18): DEFAULT_GRACE_MS 상수를 module + service
 * 양쪽에서 중복 선언하던 것을 단일 파일로 통일.
 *
 * SoT: spec/5-system/4-execution-engine.md §11 Graceful Shutdown 표.
 */
export const DEFAULT_GRACE_MS = 30_000;
