import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LlmConfigModule } from '../llm-config/llm-config.module';
import { LLMClientFactory } from './llm-client.factory';
import { LlmService } from './llm.service';
import { LlmPreviewService } from './llm-preview.service';
import { LlmUsageLog } from './entities/llm-usage-log.entity';
import { LlmUsageLogService } from './llm-usage-log.service';

@Module({
  imports: [
    forwardRef(() => LlmConfigModule),
    TypeOrmModule.forFeature([LlmUsageLog]),
  ],
  providers: [
    LLMClientFactory,
    LlmService,
    LlmPreviewService,
    LlmUsageLogService,
  ],
  exports: [
    LlmService,
    LlmPreviewService,
    LLMClientFactory,
    LlmUsageLogService,
    TypeOrmModule,
  ],
})
export class LlmModule {}
