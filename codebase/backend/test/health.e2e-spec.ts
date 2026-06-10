import { describe, it, expect } from '@jest/globals';
import request from 'supertest';

/**
 * e2e: health probe 엔드포인트 (spec/data-flow/9-observability.md §1.1).
 *
 * 전제 — docker-compose.e2e.yml 환경에서 DB/Redis 가 정상이므로:
 *   - GET /api/health (readiness)     → 200, body.status === 'healthy'
 *   - GET /api/health/live (liveness) → 200, body.status === 'ok' (의존성 미점검)
 *
 * unhealthy 시 503 경로는 의존성을 인위적으로 죽여야 해 e2e 범위 밖 —
 * health.controller.spec.ts 의 HTTP wire 통합 테스트(mock unhealthy service)가 커버한다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

describe('Health probe (e2e)', () => {
  it('GET /api/health → 200 + status healthy (의존성 정상)', async () => {
    const res = await request(BASE_URL).get('/api/health');
    expect(res.status).toBe(200);
    // TransformInterceptor 가 { data: {...} } 로 감싼다.
    const body = res.body.data ?? res.body;
    expect(body.status).toBe('healthy');
    expect(body.checks.database.status).toBe('healthy');
  });

  it('GET /api/health/live → 200 + status ok (항상)', async () => {
    const res = await request(BASE_URL).get('/api/health/live');
    expect(res.status).toBe(200);
    const body = res.body.data ?? res.body;
    expect(body.status).toBe('ok');
  });
});
