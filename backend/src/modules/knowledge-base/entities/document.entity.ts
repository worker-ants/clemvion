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
