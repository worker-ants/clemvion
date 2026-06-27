import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModelConfigModule } from '../model-config/model-config.module';
import { LLMClientFactory } from './llm-client.factory';
import { LlmService } from './llm.service';
import { LlmPreviewService } from './llm-preview.service';
import { LlmModelConfigController } from './llm-model-config.controller';
import { LlmUsageLog } from './entities/llm-usage-log.entity';
import { LlmUsageLogService } from './llm-usage-log.service';

@Module({
  // model-config → llm 역의존이 제거돼(부속 엔드포인트는 LlmModelConfigController 로,
  // 캐시 무효화는 옵저버로 역전) forwardRef 없이 단방향 import 한다 (C-2 cluster 4).
  imports: [ModelConfigModule, TypeOrmModule.forFeature([LlmUsageLog])],
  controllers: [LlmModelConfigController],
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
