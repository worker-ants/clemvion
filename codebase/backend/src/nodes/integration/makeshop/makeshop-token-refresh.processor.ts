import { Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Integration } from '../../../modules/integrations/entities/integration.entity';
import {
  MakeshopApiClient,
  MAKESHOP_REFRESH_WINDOW_MS,
  resolveMakeshopTokenExpiry,
} from './makeshop-api.client';
import {
  MAKESHOP_REFRESH_QUEUE,
  MakeshopRefreshJobData,
} from '../../../modules/integrations/makeshop-token-refresh.constants';

/**
 * MakeShop 토큰 갱신 큐의 worker — cafe24 의 `Cafe24TokenRefreshProcessor`
 * 동형.
 *
 * **존재 이유 — 멀티 인스턴스 race 보호:** 두 backend pod 이 같은 통합에
 * 대해 동시에 refresh 를 시도하면 둘 다 같은 old refresh_token 으로 MakeShop
 * `/oauth/token` 에 요청한다. MakeShop refresh_token 도 rotation 되므로 (1회
 * 사용 후 회전) DB last-write-wins 로 한 쪽 토큰만 살아남고 나머지는 orphan
 * 이 된다. 다음 refresh 가 orphan 으로 들어가면 401.
 *
 * 본 worker 가 `jobId = integrationId` 로 큐에 들어온 잡을 처리함으로써
 * MakeShop HTTP 요청 자체가 클러스터 전체에서 직렬화된다.
 *
 * **잡 처리 흐름:**
 * 1. DB 에서 통합 다시 로드 (호출자가 보낸 참조는 stale 일 수 있음).
 * 2. `serviceType !== 'makeshop'` 거부 (방어적 체크).
 * 3. status !== 'connected' 거부 (reauthorize 필요).
 * 4. **재확인 (단 `source === 'reactive_401'` 은 예외)** — 잡 enqueue 와 worker
 *    pickup 사이에 다른 경로가 이미 refresh 했을 가능성. expiry SoT 는
 *    `resolveMakeshopTokenExpiry` (tokenExpiresAt → credentials.expires_at →
 *    guarded JWT). future 이면 short-circuit. `reactive_401` 은 caller 가
 *    empirical 401 을 받은 강한 신호라 short-circuit 자체를 skip 하고 항상 refresh.
 * 5. `makeshopApiClient.refreshAccessToken(fresh)` 호출.
 *
 * **재시도 정책:** `attempts: 1`. refresh 실패는 거의 항상 terminal — 호출자
 * (다음 API 호출 또는 다음 스캐너 패스) 가 자연스럽게 재시도한다.
 */
@Injectable()
@Processor(MAKESHOP_REFRESH_QUEUE)
export class MakeshopTokenRefreshProcessor extends WorkerHost {
  private readonly logger = new Logger(MakeshopTokenRefreshProcessor.name);

  constructor(
    @InjectRepository(Integration)
    private readonly integrationRepository: Repository<Integration>,
    private readonly makeshopApiClient: MakeshopApiClient,
  ) {
    super();
  }

  async process(job: Job<MakeshopRefreshJobData>): Promise<void> {
    const { integrationId, source } = job.data;
    const fresh = await this.integrationRepository.findOne({
      where: { id: integrationId },
    });
    if (!fresh) {
      this.logger.warn(
        `MakeShop refresh job for missing integration ${integrationId} (source=${source}) — skipping`,
      );
      return;
    }
    if (fresh.serviceType !== 'makeshop') {
      this.logger.warn(
        `MakeShop refresh job dispatched for non-makeshop integration ${integrationId} (serviceType=${fresh.serviceType}) — skipping`,
      );
      return;
    }

    // status 검증은 source 와 무관하게 적용 (BullMQ jobId dedup race-safety —
    // cafe24 CONC H-2 동형).
    if (fresh.status !== 'connected') {
      this.logger.log(
        `MakeShop refresh skipped for ${integrationId} — status=${fresh.status} (reauthorize required, source=${source})`,
      );
      return;
    }

    // 재확인: enqueue 와 pickup 사이 다른 경로가 이미 갱신했을 가능성.
    // reactive_401 은 caller 가 empirical 401 을 받은 강한 신호라 skip.
    if (source !== 'reactive_401') {
      const expiresAtMs = resolveMakeshopTokenExpiry(fresh);
      if (
        expiresAtMs !== null &&
        expiresAtMs - Date.now() > MAKESHOP_REFRESH_WINDOW_MS
      ) {
        this.logger.debug(
          `MakeShop refresh ${integrationId} no-op — token expiry future (expires ${new Date(expiresAtMs).toISOString()}, source=${source})`,
        );
        return;
      }
    }

    this.logger.log(
      `MakeShop refresh ${integrationId} via queue worker (source=${source})`,
    );
    await this.makeshopApiClient.refreshAccessToken(fresh);
  }
}
