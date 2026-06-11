import { MONITORED_QUEUES } from './system-status.constants';
import { CAFE24_REFRESH_QUEUE } from '../integrations/cafe24-token-refresh.constants';
import { MAKESHOP_REFRESH_QUEUE } from '../integrations/makeshop-token-refresh.constants';

/**
 * spec/5-system/16-system-status-api.md §1 '대상 큐 레지스트리' + SoT
 * spec/data-flow/0-overview.md §4 BullMQ 큐 카탈로그.
 *
 * V-15 회귀: makeshop-token-refresh 큐가 spec 카탈로그에는 등재됐으나 코드
 * MONITORED_QUEUES 에는 누락돼 시스템 상태 화면에서 보이지 않던 갭 방지.
 */
describe('MONITORED_QUEUES — 큐 레지스트리 ↔ spec 카탈로그 동기', () => {
  const names = MONITORED_QUEUES.map((q) => q.name);

  it('integration 토큰 갱신 큐(cafe24·makeshop)를 모두 모니터링한다', () => {
    expect(names).toContain(CAFE24_REFRESH_QUEUE);
    expect(names).toContain(MAKESHOP_REFRESH_QUEUE);
  });

  it('makeshop-token-refresh 는 integration 그룹·concurrency 1 (spec §1 표)', () => {
    const entry = MONITORED_QUEUES.find(
      (q) => q.name === MAKESHOP_REFRESH_QUEUE,
    );
    expect(entry).toBeDefined();
    expect(entry?.group).toBe('integration');
    expect(entry?.concurrency).toBe(1);
  });

  it('큐 이름 중복이 없다', () => {
    expect(new Set(names).size).toBe(names.length);
  });
});
