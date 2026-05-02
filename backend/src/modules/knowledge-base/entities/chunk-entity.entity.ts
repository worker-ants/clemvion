import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { DocumentChunk } from './document-chunk.entity';
import { GraphEntity } from './entity.entity';

// 청크가 언급한 entity 매핑. (chunk_id, entity_id) 복합 PK.
@Entity('chunk_entity')
export class ChunkEntity {
  @PrimaryColumn({ name: 'chunk_id', type: 'uuid' })
  chunkId: string;

  @ManyToOne(() => DocumentChunk, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'chunk_id' })
  chunk: DocumentChunk;

  @PrimaryColumn({ name: 'entity_id', type: 'uuid' })
  entityId: string;

  @ManyToOne(() => GraphEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'entity_id' })
  entity: GraphEntity;

  // 청크에서 등장한 원형 표기 (정규화 전)
  @Column({ name: 'mention_text', type: 'text', nullable: true })
  mentionText: string | null;
}
