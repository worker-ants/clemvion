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
import { encryptedJsonTransformer } from '../../integrations/services/credentials-transformer';

@Entity('auth_config')
export class AuthConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'workspace_id' })
  workspaceId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 20 })
  type: string;

  // AES-256-GCM 으로 암호화된 JSONB. Webhook Bearer Token / API Key 같은 민감
  // 인증 자격증명을 평문 저장하지 않는다 (Integration.credentials 와 동일 패턴).
  // 키 부재 시 transformer 가 평문 fallback + warn — production 에서는 반드시
  // INTEGRATION_ENCRYPTION_KEY 설정 필요.
  @Column({
    type: 'jsonb',
    default: {},
    transformer: encryptedJsonTransformer,
  })
  config: Record<string, unknown>;

  @Column({ name: 'ip_whitelist', type: 'text', array: true, nullable: true })
  ipWhitelist: string[];

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
