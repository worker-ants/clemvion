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

/**
 * AI Agent persistent 메모리의 영속 저장소 (spec/5-system/17-agent-memory.md §1,
 * spec/1-data-model.md §2.23). pgvector 인프라를 DocumentChunk 와 동일하게 재사용하되
 * KnowledgeBase 와는 분리된 별도 테이블이다.
 *
 * 메모리 네임스페이스는 (workspace_id, scopeKey) 2-튜플이다. `scopeKey` 는 AI Agent 노드의
 * `memoryKey` 평가값 (truthy) 또는 `execution_id` fallback 이다 (§2). TS 필드명은 `scope` 가
 * 아닌 `scopeKey` 로 명확히 둬 Integration.scope 등 다른 도메인의 `scope` 와 혼동을 피한다.
 */
@Entity('agent_memory')
export class AgentMemory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'workspace_id' })
  workspaceId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ name: 'scope_key', type: 'text' })
  scopeKey: string;

  @Column({ type: 'text' })
  content: string;

  // Vector column is handled via raw SQL; TypeORM doesn't natively support pgvector.
  // The embedding is stored as vector type but accessed via raw queries in AgentMemoryService
  // (mirror of DocumentChunk.embedding).

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
