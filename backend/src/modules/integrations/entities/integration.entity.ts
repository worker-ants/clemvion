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

export type IntegrationStatus = 'connected' | 'expired' | 'error';

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
