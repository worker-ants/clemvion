import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Workspace } from '../../workspaces/entities/workspace.entity';

// workspace 당 `isDefault=true` 레코드는 최대 1개. 동시 요청으로 `setDefault` 가
// 교차 실행되어 중복이 생기는 것을 DB 레이어에서 차단한다. Postgres partial
// unique index 사용 — `is_default = false` 는 여러 개 허용.
@Entity('llm_config')
@Index('llm_config_workspace_default_unique', ['workspaceId'], {
  unique: true,
  where: '"is_default" = true',
})
export class LlmConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'workspace_id' })
  workspaceId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ length: 50 })
  provider: string;

  @Column({ length: 255 })
  name: string;

  @Column({ name: 'api_key', length: 500 })
  apiKey: string;

  @Column({ name: 'base_url', length: 500, nullable: true })
  baseUrl: string;

  @Column({ name: 'default_model', length: 100 })
  defaultModel: string;

  @Column({ name: 'default_params', type: 'jsonb', default: {} })
  defaultParams: Record<string, unknown>;

  @Column({ name: 'is_default', default: false })
  isDefault: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
