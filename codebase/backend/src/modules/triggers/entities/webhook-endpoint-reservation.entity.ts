import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Workspace } from '../../workspaces/entities/workspace.entity';

/**
 * 웹훅 경로의 소유 기록 — `spec/1-data-model.md` §2.8.1.
 *
 * 트리거가 어떤 `endpoint_path` 를 처음 가지는 순간 그 경로를 트리거의 워크스페이스 소유로 예약하고, **지우지 않는다**.
 * 쓰는 쪽은 앱이 아니라 DB 트리거(V133 `trg_trigger_reserve_endpoint_path`)다 — 앱 레벨 검사는 동시 요청을 막지 못한다.
 * 다른 워크스페이스가 예약한 경로를 쓰면 그 트리거가 `unique_violation` 을 라벨 `webhook_endpoint_reservation_owner` 로
 * 내고, `TriggersService` 가 409 로 옮긴다.
 */
@Entity('webhook_endpoint_reservation')
@Index('idx_webhook_endpoint_reservation_workspace_id', ['workspaceId'], {
  where: 'workspace_id IS NOT NULL',
})
export class WebhookEndpointReservation {
  @PrimaryColumn({ name: 'endpoint_path', type: 'varchar', length: 255 })
  endpointPath: string;

  /** 워크스페이스가 지워지면 NULL — 주인 없는 예약은 누구도 쓸 수 없다. */
  @Column({ name: 'workspace_id', type: 'uuid', nullable: true })
  workspaceId: string | null;

  @ManyToOne(() => Workspace, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace | null;

  @CreateDateColumn({ name: 'reserved_at', type: 'timestamptz' })
  reservedAt: Date;
}
