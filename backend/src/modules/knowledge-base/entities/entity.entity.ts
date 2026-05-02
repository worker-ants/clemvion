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
import { KnowledgeBase } from './knowledge-base.entity';
import { DocumentChunk } from './document-chunk.entity';

export type EntityType =
  | 'person'
  | 'organization'
  | 'concept'
  | 'location'
  | 'event'
  | 'other';

@Entity('entity')
@Index('idx_entity_kb_type', ['knowledgeBaseId', 'type'])
export class GraphEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'knowledge_base_id', type: 'uuid' })
  knowledgeBaseId: string;

  @ManyToOne(() => KnowledgeBase, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'knowledge_base_id' })
  knowledgeBase: KnowledgeBase;

  // 정규화 이름 (소문자·trim·동의어 통합)
  @Column({ type: 'text' })
  name: string;

  @Column({ name: 'display_name', type: 'text' })
  displayName: string;

  @Column({ type: 'text' })
  type: EntityType;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'mention_count', type: 'int', default: 0 })
  mentionCount: number;

  @Column({ name: 'last_seen_chunk_id', type: 'uuid', nullable: true })
  lastSeenChunkId: string | null;

  @ManyToOne(() => DocumentChunk, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'last_seen_chunk_id' })
  lastSeenChunk: DocumentChunk | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
