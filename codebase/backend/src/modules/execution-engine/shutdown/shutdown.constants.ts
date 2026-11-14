/**
 * W-18 fix (SUMMARY#W-18): DEFAULT_GRACE_MS 상수를 module + service
 * 양쪽에서 중복 선언하던 것을 단일 파일로 통일.
 *
 * SoT: spec/5-system/4-execution-engine.md §11 Graceful Shutdown 표.
 */
export const DEFAULT_GRACE_MS = 30_000;

/** DiscoveryService 가 배선되지 않았을 때 종료 처리가 남기는 경고. 서비스와 테스트가 같은 문구를 쓴다. */
export const DISCOVERY_NOT_WIRED_WARNING =
  'Graceful shutdown: DiscoveryService is not wired; BullMQ workers will not be paused or force-closed';
