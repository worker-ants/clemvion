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
    BullModule.registerQueue({ name: DOCUMENT_EMBEDDING_QUEUE }),
    BullModule.registerQueue({ name: GRAPH_EXTRACTION_QUEUE }),
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
