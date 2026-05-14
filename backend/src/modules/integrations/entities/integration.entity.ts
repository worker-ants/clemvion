import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { Workspace } from '../../workspaces/entities/workspace.entity';
import { User } from '../../users/entities/user.entity';
import { encryptedJsonTransformer } from '../services/credentials-transformer';

export type IntegrationStatus =
  | 'connected'
  | 'expired'
  | 'error'
  | 'pending_install';

@Entity('integration')
@Unique('integration_workspace_name_unique', ['workspaceId', 'name'])
@Index('idx_integration_workspace_status', ['workspaceId', 'status'])
export class Integration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'workspace_id' })
  workspaceId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ name: 'service_type', length: 50 })
  serviceType: string;

  @Column({ length: 255 })
  name: string;

  @Column({ name: 'auth_type', length: 20 })
  authType: string;

  @Column({
    type: 'jsonb',
    default: {},
    transformer: encryptedJsonTransformer,
  })
  credentials: Record<string, unknown>;

  @Column({ length: 20, default: 'personal' })
  scope: string;

  @Column({ length: 20, default: 'connected' })
  status: IntegrationStatus;

  @Column({
    name: 'install_token',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  installToken: string | null;

  /**
   * Cafe24 Private install_token 발급 시각. TTL 스캐너 (`pending-install-ttl`
   * job) 가 `now - 24h` 와 비교해 만료를 판단한다. install_token 갱신(begin
   * 재호출로 인한 row 재사용) 시 함께 갱신. 옛 행에서는 NULL — 스캐너가
   * `createdAt` 으로 fallback. V044 추가.
   */
  @Column({
    name: 'install_token_issued_at',
    type: 'timestamptz',
    nullable: true,
  })
  installTokenIssuedAt: Date | null;

  /**
   * Cafe24 `mall_id` 의 plain projection. credentials JSONB 안의 동일
   * 값을 plain 컬럼으로 복제 — `(workspace_id, mall_id)` 부분 UNIQUE 인덱스
   * (V045) 가 중복 방지 SQL constraint 를 강제하고 O(1) 조회를 가능하게
   * 한다. cafe24 외 service_type 에서는 항상 NULL. 옛 행은 NULL —
   * 다음 ORM save 시 backfill.
   */
  @Column({
    name: 'mall_id',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  mallId: string | null;

  @Column({
    name: 'status_reason',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  statusReason: string | null;

  @Column({ name: 'token_expires_at', type: 'timestamptz', nullable: true })
  tokenExpiresAt: Date | null;

  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt: Date | null;

  @Column({ name: 'last_rotated_at', type: 'timestamptz', nullable: true })
  lastRotatedAt: Date | null;

  @Column({
    name: 'last_error',
    type: 'jsonb',
    nullable: true,
    transformer: encryptedJsonTransformer,
  })
  lastError: Record<string, unknown> | null;

  @Column({ name: 'created_by' })
  createdBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  creator: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
