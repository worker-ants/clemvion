import { Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Integration } from '../../../modules/integrations/entities/integration.entity';
import {
  Cafe24ApiClient,
  REFRESH_WINDOW_MS,
  resolveTokenExpiry,
} from './cafe24-api.client';
import {
  CAFE24_REFRESH_QUEUE,
  Cafe24RefreshJobData,
} from '../../../modules/integrations/cafe24-token-refresh.constants';

/**
 * Cafe24 토큰 갱신 큐의 worker.
 *
 * **존재 이유 — 멀티 인스턴스 race 보호:**
 * 두 backend pod 이 같은 통합에 대해 동시에 refresh 를 시도하면, 둘 다
 * Cafe24 `/oauth/token` 에 같은 old refresh_token 으로 요청을 보낸다.
 * 결과는 (Cafe24 의 rotation 정책에 따라) 둘 중 하나가 실패하거나, 둘
 * 다 새 토큰을 받지만 DB 는 last-write-wins 로 한 쪽 토큰만 살아남고
 * 나머지는 orphan 이 된다. 다음 refresh 가 orphan 으로 들어가면 401.
 *
 * 본 worker 가 `jobId = integrationId` 로 큐에 들어온 잡을 처리함으로써
 * Cafe24 HTTP 요청 자체가 클러스터 전체에서 직렬화된다 — `Queue.add` 가
 * 같은 jobId 의 잡이 이미 대기/실행 중이면 그 잡 참조를 반환하므로
 * 모든 호출자가 동일 worker 의 결과를 공유한다.
 *
 * **잡 처리 흐름:**
 * 1. DB 에서 통합 다시 로드 (호출자가 보낸 참조는 stale 일 수 있음 —
 *    백그라운드 스캐너는 ID 만 보낸다).
 * 2. `serviceType !== 'cafe24'` 거부 (큐가 cafe24 전용이지만 방어적 체크).
 * 3. **재확인 (단 `source === 'reactive_401'` 은 예외, 2026-05-18)** —
 *    잡 enqueue 와 worker pickup 사이에 다른 경로가 이미 refresh 했을 수
 *    있다. `resolveTokenExpiry(fresh) - now > REFRESH_WINDOW_MS` 이면
 *    short-circuit (불필요한 Cafe24 호출 방지). 단 `reactive_401` source
 *    (caller 가 empirical 401 을 받은 경로) 는 *DB 의 expiresAt 신뢰 불가*
 *    신호라 short-circuit 을 건너뛰고 항상 refresh 시도. spec/2-navigation/
 *    4-integration.md ## Rationale "Cafe24 token 만료 SoT — JWT exp 격상
 *    (2026-05-18)".
 * 4. `cafe24ApiClient.refreshAccessToken(fresh)` 호출. 성공 시 통합 row
 *    의 4-field atomic update; 실패 시 markAuthFailed (기존 동작).
 *
 * **재시도 정책:** `attempts: 1`. refresh 실패는 거의 항상 terminal
 * (refresh_token 자체 만료 / Cafe24 가 invalidate). 자동 재시도하면
 * 같은 401 을 N 번 반복하고 알림만 늘어난다. BullMQ retry 대신 호출자
 * (다음 API 호출 또는 다음 일일 스캐너 패스) 가 자연스럽게 재시도하게
 * 둔다.
 */
@Injectable()
@Processor(CAFE24_REFRESH_QUEUE)
export class Cafe24TokenRefreshProcessor extends WorkerHost {
  private readonly logger = new Logger(Cafe24TokenRefreshProcessor.name);

  constructor(
    @InjectRepository(Integration)
    private readonly integrationRepository: Repository<Integration>,
    private readonly cafe24ApiClient: Cafe24ApiClient,
  ) {
    super();
  }

  async process(job: Job<Cafe24RefreshJobData>): Promise<void> {
    const { integrationId, source } = job.data;
    const fresh = await this.integrationRepository.findOne({
      where: { id: integrationId },
    });
    if (!fresh) {
      // 삭제된 통합 — silently no-op. 같은 jobId 로 다시 enqueue 될 일도
      // 없으므로 idempotent.
      this.logger.warn(
        `Cafe24 refresh job for missing integration ${integrationId} (source=${source}) — skipping`,
      );
      return;
    }
    if (fresh.serviceType !== 'cafe24') {
      this.logger.warn(
        `Cafe24 refresh job dispatched for non-cafe24 integration ${integrationId} (serviceType=${fresh.serviceType}) — skipping`,
      );
      return;
    }

    // CONC H-2 (2026-05-16) — status 검증은 source 와 무관하게 적용한다.
    // BullMQ jobId dedup 의 부수 효과 때문 — proactive 가 먼저 enqueue 된
    // 직후 background 가 같은 jobId 로 add() 하면 worker 는 기존 잡의
    // `source='proactive'` data 만 보게 된다 (data 는 dedup 시 덮어쓰지
    // 않음). 옛 코드는 `source === 'background'` 일 때만 status 검증을
    // 수행해, 위 race 가 발생하면 사용자가 의도한 reauthorize 흐름이
    // 우회될 수 있었다. 이제 source 무관하게 connected 만 처리해 race-safe.
    //
    // 호출자 (Cafe24ApiClient.call) 는 어차피 handler 의 `resolveIntegration`
    // 에서 status='connected' 검증을 거친 뒤에만 도착하므로 proactive 경로
    // 도 이 검증이 정상 흐름에 영향을 주지 않는다.
    if (fresh.status !== 'connected') {
      this.logger.log(
        `Cafe24 refresh skipped for ${integrationId} — status=${fresh.status} (reauthorize required, source=${source})`,
      );
      return;
    }

    // 재확인: enqueue 시점과 pickup 시점 사이에 다른 경로가 이미 갱신했을
    // 가능성. proactive 경로는 매 API 호출마다 enqueue 할 수 있으므로
    // 이 short-circuit 이 중요하다.
    //
    // **단, source='reactive_401' 은 skip 한다 (2026-05-18 추가)**: 본 source
    // 는 `Cafe24ApiClient.executeWithRateLimit` 의 401 자가 회복 경로로,
    // *caller 가 empirical 401 을 받았다* 는 강한 신호다. DB 의
    // `tokenExpiresAt` 가 의도와 다른 epoch (예: 옛 TZ 모호성 회귀로 9h
    // 미래) 로 저장된 경우 short-circuit 이 잘못된 값을 신뢰해 refresh 를
    // 건너뛰고, caller 의 retry 가 같은 stale token 으로 두 번째 401 을
    // 받는 회귀가 있었다. reactive_401 은 그 무력화 경로를 차단.
    // spec/2-navigation/4-integration.md ## Rationale "Cafe24 token 만료
    // SoT — JWT exp 격상 (2026-05-18)".
    if (source !== 'reactive_401') {
      const expiresAtMs = resolveTokenExpiry(fresh);
      if (
        expiresAtMs !== null &&
        expiresAtMs - Date.now() > REFRESH_WINDOW_MS
      ) {
        this.logger.debug(
          `Cafe24 refresh ${integrationId} no-op — token already fresh (expires ${new Date(expiresAtMs).toISOString()}, source=${source})`,
        );
        return;
      }
    }

    this.logger.log(
      `Cafe24 refresh ${integrationId} via queue worker (source=${source})`,
    );
    await this.cafe24ApiClient.refreshAccessToken(fresh);
  }
}
