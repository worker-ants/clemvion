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

@Entity('llm_config')
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
