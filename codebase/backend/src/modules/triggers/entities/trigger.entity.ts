import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Workspace } from '../../workspaces/entities/workspace.entity';
import { Workflow } from '../../workflows/entities/workflow.entity';

/**
 * Outbound notification webhook 의 발송 건강도. V059 마이그레이션이 NOT NULL DEFAULT 'unknown'
 * 으로 초기화. 첫 outbound notification 시도 후 'healthy' 또는 'degraded' 로 갱신된다.
 *
 * 'degraded' 는 [Spec EIA §R6] 의 자동 비활성화 금지 정책에 따라 trigger 자체를 비활성화하지
 * 않고 표시만 한다.
 */
export type TriggerNotificationHealth = 'unknown' | 'healthy' | 'degraded';

@Entity('trigger')
export class Trigger {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'workspace_id' })
  workspaceId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ name: 'workflow_id' })
  workflowId: string;

  @ManyToOne(() => Workflow, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workflow_id' })
  workflow: Workflow;

  @Column({ length: 20 })
  type: string;

  @Column({ length: 255 })
  name: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', default: {} })
  config: Record<string, unknown>;

  @Column({ name: 'endpoint_path', nullable: true, length: 255 })
  endpointPath: string;

  @Column({ name: 'auth_config_id', type: 'uuid', nullable: true })
  authConfigId: string | null;

  @Column({ name: 'last_triggered_at', type: 'timestamptz', nullable: true })
  lastTriggeredAt: Date;

  /**
   * Outbound notification 발송 건강도. [Spec EIA §3.1 EIA-NX-07] — 5회 연속 실패 시 'degraded'
   * 로 갱신되지만 trigger 자체는 비활성화되지 않는다 (R6).
   *
   * V059 마이그레이션의 CHECK 제약이 enum 값을 강제하므로 DB 레벨에서 invalid 값 입력 차단.
   */
  @Column({
    name: 'notification_health',
    type: 'varchar',
    length: 16,
    default: 'unknown',
  })
  notificationHealth: TriggerNotificationHealth;

  /**
   * 최종 실패한 outbound notification 의 마지막 에러 메시지. 디버깅·UI 표시용.
   * 길이 제한 없음 (TEXT) — 실 사용 시 호출자가 1KB 정도로 truncate 권장.
   */
  @Column({ name: 'notification_last_error', type: 'text', nullable: true })
  notificationLastError: string | null;

  /**
   * Secret rotation 의 24h grace 기간 동안 신규 secret. NOT NULL 이면 outbound 발송 시 두 secret
   * 으로 모두 서명 시도 (검증 측이 둘 중 하나로 통과되도록). grace 종료 후 본 컬럼이 새 secret
   * 으로 승격되고 본 컬럼은 다시 NULL 로 초기화된다.
   *
   * [Spec EIA §3.1 EIA-NX-12] / §7.1 참조.
   */
  @Column({ name: 'notification_secret_v2', type: 'text', nullable: true })
  notificationSecretV2: string | null;

  /**
   * Secret rotation 시작 시각. grace 종료 (rotation 시작 + 24h) 판정에 사용. NULL 이면 rotation
   * 진행 중이 아님.
   */
  @Column({
    name: 'notification_rotated_at',
    type: 'timestamptz',
    nullable: true,
  })
  notificationRotatedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
