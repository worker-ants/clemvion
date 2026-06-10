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

/**
 * 모델 역할 판별자 (spec/1-data-model.md §2.16).
 * - chat: AI 노드 / Assistant / graph 추출 LLM
 * - embedding: KB 임베딩 (dimension 소유)
 * - rerank: KB 검색 후처리 리랭커 (전용 /rerank 호출 — 실행 레이어 RerankClientFactory)
 */
export type ModelConfigKind = 'chat' | 'embedding' | 'rerank';

export const MODEL_CONFIG_KINDS: readonly ModelConfigKind[] = [
  'chat',
  'embedding',
  'rerank',
];

// chat/embedding/rerank 통합 provider 설정 (구 llm_config + rerank_config).
// workspace × kind 당 `isDefault=true` 레코드는 최대 1개 — Postgres partial
// unique index 로 동시 setDefault 중복을 DB 레이어에서 차단 (V089).
@Entity('model_config')
@Index('model_config_workspace_kind_default_unique', ['workspaceId', 'kind'], {
  unique: true,
  where: '"is_default" = true',
})
export class ModelConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'workspace_id' })
  workspaceId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ length: 20 })
  kind: ModelConfigKind;

  @Column({ length: 50 })
  provider: string;

  @Column({ length: 255 })
  name: string;

  // 자가호스팅(local/tei) 은 키 불요라 nullable. 외부 provider 는 서비스 단에서 필수 검증.
  // `string | null` 유니온은 reflect-metadata 가 design:type 을 Object 로 추론하므로
  // 명시적 type 을 줘야 한다 (DataTypeNotSupportedError 방지).
  @Column({ name: 'api_key', type: 'varchar', length: 500, nullable: true })
  apiKey: string | null;

  @Column({ name: 'base_url', type: 'varchar', length: 500, nullable: true })
  baseUrl: string | null;

  @Column({ name: 'default_model', length: 100 })
  defaultModel: string;

  // chat 전용 호출 파라미터 프리셋. embedding/rerank 는 빈 객체.
  @Column({ name: 'default_params', type: 'jsonb', default: {} })
  defaultParams: Record<string, unknown>;

  // embedding 전용 벡터 차원 (SoT). chat/rerank 는 NULL.
  @Column({ type: 'int', nullable: true })
  dimension: number | null;

  @Column({ name: 'is_default', default: false })
  isDefault: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
