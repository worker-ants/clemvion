import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Document } from './document.entity';
import { KnowledgeBase } from './knowledge-base.entity';

@Entity('document_chunk')
export class DocumentChunk {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'document_id' })
  documentId: string;

  @ManyToOne(() => Document, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'document_id' })
  document: Document;

  @Column({ name: 'knowledge_base_id' })
  knowledgeBaseId: string;

  @ManyToOne(() => KnowledgeBase, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'knowledge_base_id' })
  knowledgeBase: KnowledgeBase;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'chunk_index', type: 'int' })
  chunkIndex: number;

  // Vector column is handled via raw SQL; TypeORM doesn't natively support pgvector
  // The embedding is stored as vector type but accessed via raw queries in RagSearchService

  @Column({ name: 'token_count', type: 'int', default: 0 })
  tokenCount: number;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
