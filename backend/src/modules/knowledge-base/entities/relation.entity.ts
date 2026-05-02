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
import { GraphEntity } from './entity.entity';
import { DocumentChunk } from './document-chunk.entity';

/**
 * 그래프 RAG 의 추출된 (head, predicate, tail) 트리플.
 *
 * 클래스명에 `Graph` 접두를 둔 이유는 TypeORM `@Entity` 데코레이터/심볼과의
 * 명명 충돌을 피하고, GraphEntity 와 한 쌍으로 묶어서 import 하기 쉽게 하기 위함이다.
 * DB 테이블명(`relation`)은 변경 없이 유지된다.
 */
@Entity('relation')
@Index('idx_relation_kb_head', ['knowledgeBaseId', 'headEntityId'])
@Index('idx_relation_kb_tail', ['knowledgeBaseId', 'tailEntityId'])
export class GraphRelation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'knowledge_base_id', type: 'uuid' })
  knowledgeBaseId: string;

  @ManyToOne(() => KnowledgeBase, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'knowledge_base_id' })
  knowledgeBase: KnowledgeBase;

  @Column({ name: 'head_entity_id', type: 'uuid' })
  headEntityId: string;

  @ManyToOne(() => GraphEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'head_entity_id' })
  headEntity: GraphEntity;

  @Column({ name: 'tail_entity_id', type: 'uuid' })
  tailEntityId: string;

  @ManyToOne(() => GraphEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tail_entity_id' })
  tailEntity: GraphEntity;

  @Column({ type: 'text' })
  predicate: string;

  @Column({ name: 'evidence_chunk_id', type: 'uuid', nullable: true })
  evidenceChunkId: string | null;

  @ManyToOne(() => DocumentChunk, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'evidence_chunk_id' })
  evidenceChunk: DocumentChunk | null;

  @Column({ type: 'int', default: 1 })
  weight: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
