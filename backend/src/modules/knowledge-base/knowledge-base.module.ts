import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { KnowledgeBase } from './entities/knowledge-base.entity';
import { Document } from './entities/document.entity';
import { DocumentChunk } from './entities/document-chunk.entity';
import { GraphEntity } from './entities/entity.entity';
import { GraphRelation } from './entities/relation.entity';
import { ChunkEntity } from './entities/chunk-entity.entity';
import { KnowledgeBaseController } from './knowledge-base.controller';
import { KnowledgeBaseService } from './knowledge-base.service';
import { EmbeddingService } from './embedding/embedding.service';
import { RagSearchService } from './search/rag-search.service';
import { GraphExtractionService } from './graph/graph-extraction.service';
import { GraphQueryService } from './graph/graph-query.service';
import { S3Service } from '../../common/services/s3.service';
import { LlmModule } from '../llm/llm.module';
import { WebsocketModule } from '../websocket/websocket.module';
import { DOCUMENT_EMBEDDING_QUEUE } from './queues/document-embedding.queue';
import { DocumentEmbeddingProcessor } from './queues/document-embedding.processor';
import { GRAPH_EXTRACTION_QUEUE } from './queues/graph-extraction.queue';
import { GraphExtractionProcessor } from './queues/graph-extraction.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      KnowledgeBase,
      Document,
      DocumentChunk,
      GraphEntity,
      GraphRelation,
      ChunkEntity,
    ]),
    LlmModule,
    forwardRef(() => WebsocketModule),
    BullModule.registerQueue({ name: DOCUMENT_EMBEDDING_QUEUE }),
    BullModule.registerQueue({ name: GRAPH_EXTRACTION_QUEUE }),
  ],
  controllers: [KnowledgeBaseController],
  providers: [
    KnowledgeBaseService,
    EmbeddingService,
    RagSearchService,
    GraphExtractionService,
    GraphQueryService,
    S3Service,
    DocumentEmbeddingProcessor,
    GraphExtractionProcessor,
  ],
  exports: [KnowledgeBaseService, RagSearchService, EmbeddingService],
})
export class KnowledgeBaseModule {}
