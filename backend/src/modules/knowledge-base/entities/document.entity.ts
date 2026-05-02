import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { KnowledgeBase } from './knowledge-base.entity';

@Entity('document')
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'knowledge_base_id' })
  knowledgeBaseId: string;

  @ManyToOne(() => KnowledgeBase, (kb) => kb.documents, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'knowledge_base_id' })
  knowledgeBase: KnowledgeBase;

  @Column({ length: 255 })
  name: string;

  @Column({ name: 'file_type', length: 10 })
  fileType: string;

  @Column({ name: 'file_url', length: 500 })
  fileUrl: string;

  @Column({ name: 'file_size', type: 'int', default: 0 })
  fileSize: number;

  @Column({ name: 'embedding_status', length: 20, default: 'pending' })
  embeddingStatus: string;

  // graph 모드 KB 의 그래프 추출 진행 상태. vector 모드 KB 에서는 항상 'pending' (사용 안 함).
  @Column({
    name: 'graph_extraction_status',
    type: 'text',
    default: 'pending',
  })
  graphExtractionStatus: 'pending' | 'processing' | 'completed' | 'error';

  @Column({ name: 'chunk_count', type: 'int', default: 0 })
  chunkCount: number;

  @Column({ type: 'text', array: true, default: '{}' })
  tags: string[];

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
