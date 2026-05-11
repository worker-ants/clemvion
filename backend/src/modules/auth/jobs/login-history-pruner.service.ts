import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { LoginHistoryService } from '../login-history.service';

/**
 * 매일 새벽 3시(Asia/Seoul) 에 180일을 넘긴 login_history 행을 삭제한다.
 *
 * - 명시적 timezone — 서버 로컬 타임존 변동(EC2 이전·CI 머신 등) 으로 인한 시각 표류 차단.
 * - 단일 인스턴스 가정 — 멀티 인스턴스 배포 시 분산 락(Redis SETNX 등) 으로 중복 실행을 막아야 한다.
 *   현재는 단일 backend 프로세스라 미적용 (후속 plan 으로 분리).
 * - 배치 LIMIT — pruner 자체가 한 번에 너무 많은 row 를 삭제하지 않도록 service 가 배치 루프로 처리.
 */
@Injectable()
export class LoginHistoryPrunerService {
  private readonly logger = new Logger(LoginHistoryPrunerService.name);

  constructor(private readonly loginHistory: LoginHistoryService) {}

  @Cron('0 3 * * *', { timeZone: 'Asia/Seoul' })
  async prune(): Promise<void> {
    try {
      const removed = await this.loginHistory.pruneOlderThanRetention();
      if (removed > 0) {
        this.logger.log(
          `login_history pruned ${removed} row(s) past retention`,
        );
      }
    } catch (err) {
      this.logger.error(
        `login_history prune failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
