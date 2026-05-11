import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LoginHistoryService } from '../login-history.service';

/**
 * 매일 새벽 3시(서버 로컬 타임존)에 180일을 넘긴 login_history 행을 삭제한다.
 * 보존 기간 정책은 LoginHistoryService 내부에 캡슐화되어 있다.
 */
@Injectable()
export class LoginHistoryPrunerService {
  private readonly logger = new Logger(LoginHistoryPrunerService.name);

  constructor(private readonly loginHistory: LoginHistoryService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
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
