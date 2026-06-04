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

// workspace 당 `isDefault=true` 레코드는 최대 1개. 동시 요청으로 default 가
// 교차 설정되어 중복이 생기는 것을 DB 레이어에서 차단한다. Postgres partial
// unique index 사용 — `is_default = false` 는 여러 개 허용. (LlmConfig 동일 패턴)
@Entity('rerank_config')
@Index('rerank_config_workspace_default_unique', ['workspaceId'], {
  unique: true,
  where: '"is_default" = true',
})
export class RerankConfig {
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

  // rerank apiKey 는 tei/local 셀프호스팅에서 선택 — nullable.
  // `string | null` 유니온은 reflect-metadata 가 design:type 을 Object 로 추론하므로
  // 명시적 type 을 줘야 한다 (DataTypeNotSupportedError 방지).
  @Column({ name: 'api_key', type: 'varchar', length: 500, nullable: true })
  apiKey: string | null;

  @Column({ name: 'base_url', type: 'varchar', length: 500, nullable: true })
  baseUrl: string | null;

  @Column({ name: 'default_model', length: 100 })
  defaultModel: string;

  @Column({ name: 'is_default', default: false })
  isDefault: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
