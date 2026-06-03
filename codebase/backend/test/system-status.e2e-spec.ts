import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail } from './helpers/db';
import { registerAndLogin } from './helpers/auth';

/**
 * e2e: 시스템 상태 API (spec/5-system/16-system-status-api.md).
 *
 * 검증 영역:
 *   1) 미인증 → 401 (전역 JWT 가드)
 *   2) 인증 → 200, {data:{generatedAt,overall,totalFailed,totalRecentFailed,failedWindowMinutes,queues}} 형태 + 12개 큐 enumerate
 *   3) 각 큐 항목 구조(counts/recentFailed/health/group/utilization) 정합
 *   4) 시스템 전역 API — X-Workspace-Id 유무가 결과 큐 집합에 영향 없음
 *
 * 실 BullMQ root 연결이 떠 있는 e2e 인프라에서만 의미가 있다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

// SoT: src/modules/system-status/system-status.constants.ts 의 MONITORED_QUEUES.
// 블랙박스 e2e 는 앱 소스를 import 하지 않는다 (constants 가 큐 상수를 서비스 파일에서
// 끌어와 nodes 그래프 전체를 전이 로드 → e2e jest 모듈 해석 실패). 큐 추가 시 본 목록도 갱신.
const EXPECTED_QUEUE_NAMES = [
  'background-execution',
  'execution-continuation',
  'document-embedding',
  'graph-extraction',
  'notification-webhook',
  'cafe24-token-refresh',
  'schedule-execution',
  'login-history-pruner',
  'notification-secret-rotator',
  'chat-channel-token-rotator',
  'integration-expiry-scanner',
  'alerts-evaluator',
];

const HEALTH_VALUES = ['healthy', 'degraded', 'down'];
const GROUP_VALUES = ['execution', 'knowledge-base', 'integration', 'system'];

interface QueueStatus {
  name: string;
  group: string;
  counts: {
    waiting: number;
    active: number;
    delayed: number;
    failed: number;
    paused: number;
  };
  recentFailed: number;
  recentFailedCapped: boolean;
  concurrency: number;
  utilization: number;
  isPaused: boolean;
  health: string;
}

describe('System Status API (e2e)', () => {
  let db: Client;
  let owner: { accessToken: string };

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    owner = await registerAndLogin(BASE_URL, uniqueEmail('sysstatus'), db);
  });

  afterAll(async () => {
    await db.end();
  });

  it('미인증 요청은 401', async () => {
    const res = await request(BASE_URL).get('/api/system-status/overview');
    expect(res.status).toBe(401);
  });

  it('인증 시 12개 큐의 집계 상태를 반환한다', async () => {
    const res = await request(BASE_URL)
      .get('/api/system-status/overview')
      .set('Authorization', `Bearer ${owner.accessToken}`);

    expect(res.status).toBe(200);
    const data = res.body.data as {
      generatedAt: string;
      overall: string;
      totalFailed: number;
      totalRecentFailed: number;
      recentFailedCapped: boolean;
      failedWindowMinutes: number;
      queues: QueueStatus[];
    };

    expect(typeof data.generatedAt).toBe('string');
    expect(new Date(data.generatedAt).toISOString()).toBe(data.generatedAt);
    expect(HEALTH_VALUES).toContain(data.overall);
    expect(typeof data.totalFailed).toBe('number');
    expect(typeof data.totalRecentFailed).toBe('number');
    expect(typeof data.recentFailedCapped).toBe('boolean');
    // 윈도우 길이는 양수 (env 미설정 시 기본 60)
    expect(typeof data.failedWindowMinutes).toBe('number');
    expect(data.failedWindowMinutes).toBeGreaterThan(0);

    const names = data.queues.map((q) => q.name).sort();
    expect(names).toEqual([...EXPECTED_QUEUE_NAMES].sort());

    for (const q of data.queues) {
      expect(GROUP_VALUES).toContain(q.group);
      expect(HEALTH_VALUES).toContain(q.health);
      expect(typeof q.counts.waiting).toBe('number');
      expect(typeof q.counts.active).toBe('number');
      expect(typeof q.counts.delayed).toBe('number');
      expect(typeof q.counts.failed).toBe('number');
      expect(typeof q.counts.paused).toBe('number');
      expect(typeof q.recentFailed).toBe('number');
      expect(typeof q.recentFailedCapped).toBe('boolean');
      // recentFailed 는 보관 중 누적(failed)을 초과할 수 없다 (윈도우 부분집합)
      expect(q.recentFailed).toBeLessThanOrEqual(q.counts.failed);
      expect(typeof q.isPaused).toBe('boolean');
      expect(typeof q.utilization).toBe('number');
      // 집계만 노출 — 개별 job 식별자/payload 가 새지 않는다.
      expect(q).not.toHaveProperty('jobs');
      expect(q).not.toHaveProperty('payload');
    }

    // totalFailed / totalRecentFailed 는 각각 큐별 합산과 일치
    const sumFailed = data.queues.reduce((s, q) => s + q.counts.failed, 0);
    expect(data.totalFailed).toBe(sumFailed);
    const sumRecent = data.queues.reduce((s, q) => s + q.recentFailed, 0);
    expect(data.totalRecentFailed).toBe(sumRecent);
  });

  it('시스템 전역 API — X-Workspace-Id 유무가 큐 집합에 영향 없음', async () => {
    const withoutWs = await request(BASE_URL)
      .get('/api/system-status/overview')
      .set('Authorization', `Bearer ${owner.accessToken}`);
    const withWs = await request(BASE_URL)
      .get('/api/system-status/overview')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('X-Workspace-Id', '00000000-0000-0000-0000-000000000000');

    expect(withoutWs.status).toBe(200);
    expect(withWs.status).toBe(200);

    const names = (qs: QueueStatus[]) => qs.map((q) => q.name).sort();
    expect(names(withWs.body.data.queues)).toEqual(
      names(withoutWs.body.data.queues),
    );
  });
});
