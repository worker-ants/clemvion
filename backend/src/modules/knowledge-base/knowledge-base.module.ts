import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
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

@Module({
  imports: [
    TypeOrmModule.forFeature([KnowledgeBase, Document, DocumentChunk]),
    LlmModule,
    forwardRef(() => WebsocketModule),
  ],
  controllers: [KnowledgeBaseController],
  providers: [
    KnowledgeBaseService,
    EmbeddingService,
    RagSearchService,
    S3Service,
  ],
  exports: [KnowledgeBaseService, RagSearchService, EmbeddingService],
})
export class KnowledgeBaseModule {}
