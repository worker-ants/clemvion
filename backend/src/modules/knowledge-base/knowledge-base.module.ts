import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { KnowledgeBase } from './entities/knowledge-base.entity';
import { Document } from './entities/document.entity';
import { DocumentChunk } from './entities/document-chunk.entity';
import { GraphEntity } from './entities/entity.entity';
import { GraphRelation } from './entities/relation.entity';
import { GraphChunkEntity } from './entities/chunk-entity.entity';
import { KnowledgeBaseController } from './knowledge-base.controller';
import { GraphController } from './graph.controller';
import { KnowledgeBaseService } from './knowledge-base.service';
import { EmbeddingService } from './embedding/embedding.service';
import { RagSearchService } from './search/rag-search.service';
import { GraphExtractionService } from './graph/graph-extraction.service';
import { GraphQueryService } from './graph/graph-query.service';
import { KbStatsHelper } from './graph/kb-stats.helper';
import { S3Service } from '../../common/services/s3.service';
import { LlmModule } from '../llm/llm.module';
import { WebsocketModule } from '../websocket/websocket.module';
import { DOCUMENT_EMBEDDING_QUEUE } from './queues/document-embedding.queue';
import { DocumentEmbeddingProcessor } from './queues/document-embedding.processor';
import { GRAPH_EXTRACTION_QUEUE } from './queues/graph-extraction.queue';
import { GraphExtractionProcessor } from './queues/graph-extraction.processor';
import { StuckDocumentRecoveryService } from './queues/stuck-document-recovery.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      KnowledgeBase,
      Document,
      DocumentChunk,
      GraphEntity,
      GraphRelation,
      GraphChunkEntity,
    ]),
    LlmModule,
    forwardRef(() => WebsocketModule),
    // attempts=1 명시 — service 내부 retryWithBackoff 가 일시 오류를 책임지므로
    // BullMQ 의 외부 retry 는 사용하지 않는다. 손상 payload 도 UnrecoverableError 와
    // 함께 즉시 failed 큐로 이동.
    BullModule.registerQueue({
      name: DOCUMENT_EMBEDDING_QUEUE,
      defaultJobOptions: { attempts: 1 },
    }),
    BullModule.registerQueue({
      name: GRAPH_EXTRACTION_QUEUE,
      defaultJobOptions: { attempts: 1 },
    }),
  ],
  controllers: [KnowledgeBaseController, GraphController],
  providers: [
    KnowledgeBaseService,
    EmbeddingService,
    RagSearchService,
    GraphExtractionService,
    GraphQueryService,
    KbStatsHelper,
    S3Service,
    DocumentEmbeddingProcessor,
    GraphExtractionProcessor,
    StuckDocumentRecoveryService,
  ],
  exports: [KnowledgeBaseService, RagSearchService, EmbeddingService],
})
export class KnowledgeBaseModule {}
