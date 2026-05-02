import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { DocumentChunk } from './document-chunk.entity';
import { GraphEntity } from './entity.entity';

/**
 * 청크가 언급한 entity 매핑. (chunk_id, entity_id) 복합 PK.
 *
 * 클래스명에 `Graph` 접두를 둔 것은 TypeORM `@Entity` 데코레이터/심볼과
 * 도메인 단어(엔티티)·다른 모듈의 ChunkEntity 후보들 사이의 키워드 충돌을
 * 피하기 위함이다. DB 테이블명(`chunk_entity`)은 변경 없이 유지된다.
 *
 * 인덱스(`idx_chunk_entity_entity`)는 Flyway V025 에서 이미 생성되어 있으나,
 * 엔티티 메타데이터 차원에서도 같은 인덱스를 선언해 두면 ORM 가독성 + 향후
 * synchronize 환경에서의 일관성이 보장된다 (운영은 Flyway 가 단일 진실).
 */
@Entity('chunk_entity')
@Index('idx_chunk_entity_entity', ['entityId'])
export class GraphChunkEntity {
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
