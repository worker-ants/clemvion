import { Module, forwardRef } from '@nestjs/common';
import { LlmConfigModule } from '../llm-config/llm-config.module';
import { LLMClientFactory } from './llm-client.factory';
import { LlmService } from './llm.service';

@Module({
  imports: [forwardRef(() => LlmConfigModule)],
  providers: [LLMClientFactory, LlmService],
  exports: [LlmService, LLMClientFactory],
})
export class LlmModule {}
