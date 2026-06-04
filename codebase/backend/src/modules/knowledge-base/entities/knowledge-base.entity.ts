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

  // 검색 모드. 'vector' | 'graph'. 생성 시에만 결정 (불변).
  @Column({ name: 'rag_mode', type: 'text', default: 'vector' })
  ragMode: 'vector' | 'graph';

  // graph 모드에서 그래프 추출에 사용할 LLMConfig 의 chat 모델. NULL 이면 워크스페이스 default LLMConfig.
  @Column({ name: 'extraction_llm_config_id', type: 'uuid', nullable: true })
  extractionLlmConfigId: string | null;

  // 임베딩에 사용할 LLMConfig. NULL 이면 워크스페이스 default LLMConfig.
  // 자기호스팅/Azure 등 default 가 아닌 endpoint 의 임베딩 모델을 KB 마다 선택할 수 있게 한다.
  @Column({ name: 'embedding_llm_config_id', type: 'uuid', nullable: true })
  embeddingLlmConfigId: string | null;

  // graph 검색 시 그래프 확장 깊이 (1 또는 2). vector 모드에서는 무시.
  @Column({ name: 'max_hops', type: 'int', default: 1 })
  maxHops: number;

  // graph 검색 시 vector seed 개수.
  @Column({ name: 'vector_seed_top_k', type: 'int', default: 5 })
  vectorSeedTopK: number;

  // graph expansion 후 회수할 청크 상한.
  @Column({ name: 'expanded_chunk_limit', type: 'int', default: 15 })
  expandedChunkLimit: number;

  // KB 의 entity / relation 총 수 (캐시). vector 모드는 항상 0.
  @Column({ name: 'entity_count', type: 'int', default: 0 })
  entityCount: number;

  @Column({ name: 'relation_count', type: 'int', default: 0 })
  relationCount: number;

  // KB 전체 그래프 재추출 잠금 상태. 'idle' | 'in_progress'.
  @Column({ name: 'reextract_status', type: 'text', default: 'idle' })
  reextractStatus: 'idle' | 'in_progress';

  // ──────── 검색 후처리(리랭킹) 컬럼 (V074, spec/5-system/9-rag-search.md §3.3) ────────
  // 검색 시점 적용 — 사후 변경 가능, 재임베딩 불요. 'off' 면 현행 동작(하위호환).
  @Column({ name: 'rerank_mode', type: 'text', default: 'off' })
  rerankMode: 'off' | 'cross_encoder' | 'cross_encoder_llm';

  // cross-encoder 리랭커 설정(RerankConfig). NULL → 워크스페이스 default, 그것도 없으면 off 강등.
  @Column({ name: 'rerank_config_id', type: 'uuid', nullable: true })
  rerankConfigId: string | null;

  // 리랭크에 투입할 1차 회수 후보 수(wide pool). off 시 무시.
  @Column({ name: 'rerank_candidate_k', type: 'int', default: 50 })
  rerankCandidateK: number;

  // 리랭크 점수 동적 컷 임계. NULL 이면 컷 없이 점수순 정렬 후 top-k. off 시 무시.
  @Column({
    name: 'rerank_score_threshold',
    type: 'double precision',
    nullable: true,
  })
  rerankScoreThreshold: number | null;

  // cross_encoder_llm 모드의 listwise grading LLM. NULL → 워크스페이스 default chat. (cross_encoder_llm 은 후속 구현)
  @Column({ name: 'rerank_llm_config_id', type: 'uuid', nullable: true })
  rerankLlmConfigId: string | null;

  @OneToMany(() => Document, (doc) => doc.knowledgeBase)
  documents: Document[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
