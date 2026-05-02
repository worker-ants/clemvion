import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Workspace } from '../../workspaces/entities/workspace.entity';
import { Document } from './document.entity';

@Entity('knowledge_base')
export class KnowledgeBase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'workspace_id' })
  workspaceId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    name: 'embedding_model',
    length: 100,
    default: 'text-embedding-3-small',
  })
  embeddingModel: string;

  @Column({ name: 'embedding_dimension', type: 'int', nullable: true })
  embeddingDimension: number | null;

  @Column({ name: 'chunk_size', type: 'int', default: 1000 })
  chunkSize: number;

  @Column({ name: 'chunk_overlap', type: 'int', default: 200 })
  chunkOverlap: number;

  @Column({ name: 'document_count', type: 'int', default: 0 })
  documentCount: number;

  // KB 전체 재임베딩 잠금 상태. 'idle' | 'in_progress'.
  // BullMQ child job 들이 모두 끝나면 EmbeddingProcessor 가 'idle' 로 reset.
  @Column({ name: 'reembed_status', type: 'text', default: 'idle' })
  reembedStatus: 'idle' | 'in_progress';

  @OneToMany(() => Document, (doc) => doc.knowledgeBase)
  documents: Document[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
