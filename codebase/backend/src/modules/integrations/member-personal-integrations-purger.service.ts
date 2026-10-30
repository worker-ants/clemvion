import { Injectable, Logger } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { updateReturningRows } from '../../common/utils/update-returning-rows';
import type {
  MemberDeparture,
  MemberPersonalIntegrationsPurger,
  PurgedPersonalIntegration,
} from '../workspaces/member-personal-integrations.port';
import { IntegrationsService } from './integrations.service';

/**
 * 멤버가 나가거나 제거될 때 그 사람의 개인 통합을 지운다(REQ-INTMGMT-065). 워크스페이스 모듈의 포트
 * (`MEMBER_PERSONAL_INTEGRATIONS_PURGER`)를 구현한다. 워크스페이스 서비스가 멤버십 DELETE 와 같은 트랜잭션에서
 * {@link purgeInTransaction} 을, 커밋 뒤에 {@link finishAfterCommit} 을 부른다.
 *
 * 일반 삭제의 판정(역할, 사용처 409)을 거치지 않는다. 상태와 사용처를 보지 않고 지운다. 커밋 뒤 후처리는 일반 삭제와 같은
 * {@link IntegrationsService.finishIntegrationDeletion} 이다.
 * 근거: [통합 데이터와 흐름 「멤버가 나가거나 제거될 때」](CLE-INT-DATA#멤버가-나가거나-제거될-때)
 */
@Injectable()
export class MemberPersonalIntegrationsPurgerService implements MemberPersonalIntegrationsPurger {
  private readonly logger = new Logger(
    MemberPersonalIntegrationsPurgerService.name,
  );

  constructor(private readonly integrationsService: IntegrationsService) {}

  async purgeInTransaction(
    manager: EntityManager,
    member: { workspaceId: string; userId: string },
  ): Promise<PurgedPersonalIntegration[]> {
    const result: unknown = await manager.query(
      `DELETE FROM integration
       WHERE workspace_id = $1 AND created_by = $2 AND scope = 'personal'
       RETURNING id, service_type, name`,
      [member.workspaceId, member.userId],
    );
    return updateReturningRows<{
      id: string;
      service_type: string;
      name: string;
    }>(
      result,
      `member personal integration purge, workspace ${member.workspaceId} — 트랜잭션을 롤백한다`,
    ).map((row) => ({
      id: row.id,
      serviceType: row.service_type,
      name: row.name,
    }));
  }

  /**
   * 던지지 않는다. 삭제는 이미 커밋됐다. 한 통합의 후처리가 실패해도 나머지를 이어 가고 오류만 남긴다. 그 통합의 캐시가
   * 남아도 노드 실행은 통합 소유자가 멤버가 아니라서 REQ-INTMGMT-058 로 거절된다. 감사 행 누락은 스펙이 받아들였다.
   */
  async finishAfterCommit(
    purged: readonly PurgedPersonalIntegration[],
    departure: MemberDeparture,
  ): Promise<void> {
    for (const row of purged) {
      try {
        await this.integrationsService.finishIntegrationDeletion(
          row,
          { workspaceId: departure.workspaceId, userId: departure.actorUserId },
          { mode: departure.mode, memberUserId: departure.memberUserId },
        );
      } catch (err) {
        this.logger.error(
          `Post-commit cleanup failed for purged personal integration id=${row.id} workspace=${departure.workspaceId}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
  }
}
