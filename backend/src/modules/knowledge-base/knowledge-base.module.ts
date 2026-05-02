import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { KnowledgeBase } from './entities/knowledge-base.entity';
import { Document } from './entities/document.entity';
import { DocumentChunk } from './entities/document-chunk.entity';
import { KnowledgeBaseController } from './knowledge-base.controller';
import { KnowledgeBaseService } from './knowledge-base.service';
import { EmbeddingService } from './embedding/embedding.service';
import { RagSearchService } from './search/rag-search.service';
import { S3Service } from '../../common/services/s3.service';
import { LlmModule } from '../llm/llm.module';
import { WebsocketModule } from '../websocket/websocket.module';
import { DOCUMENT_EMBEDDING_QUEUE } from './queues/document-embedding.queue';
import { DocumentEmbeddingProcessor } from './queues/document-embedding.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([KnowledgeBase, Document, DocumentChunk]),
    LlmModule,
    forwardRef(() => WebsocketModule),
    BullModule.registerQueue({ name: DOCUMENT_EMBEDDING_QUEUE }),
  ],
  controllers: [KnowledgeBaseController],
  providers: [
    KnowledgeBaseService,
    EmbeddingService,
    RagSearchService,
    S3Service,
    DocumentEmbeddingProcessor,
  ],
  exports: [KnowledgeBaseService, RagSearchService, EmbeddingService],
})
export class KnowledgeBaseModule {}
