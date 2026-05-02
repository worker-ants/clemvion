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

// Entity 타입 단일 정의. 신규 타입 추가 시 본 배열만 갱신하면 prompt / DTO / DB CHECK 가
// 일관되게 대응한다 (DB CHECK 갱신은 별도 마이그레이션 필요).
export const ENTITY_TYPES = [
  'person',
  'organization',
  'concept',
  'location',
  'event',
  'other',
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];

/**
 * 그래프 RAG 의 추출된 entity (knowledge_base 내 정규화 이름 단위).
 *
 * 클래스명에 `Graph` 접두를 둔 이유는 TypeORM `@Entity` 데코레이터/심볼과
 * 도메인 단어(엔티티) 사이의 키워드 충돌을 피하기 위함이다.
 * DB 테이블명(`entity`)은 변경 없이 유지된다.
 */
@Entity('entity')
@Index('idx_entity_kb_type', ['knowledgeBaseId', 'type'])
// idx_entity_kb_mention 은 mention_count DESC 정렬 — TypeORM @Index 는
// ASC/DESC 방향을 지원하지 않으므로 컬럼 목록만 선언으로 남기고 실제 정렬은
// Flyway V025 에서 `mention_count DESC` 로 생성된 인덱스가 담당한다.
@Index('idx_entity_kb_mention', ['knowledgeBaseId', 'mentionCount'])
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
