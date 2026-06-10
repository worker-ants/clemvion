import { Module, forwardRef } from '@nestjs/common';
import { LlmConfigController } from './llm-config.controller';
import { LlmConfigService } from './llm-config.service';
import { LlmModule } from '../llm/llm.module';
import { ModelConfigModule } from '../model-config/model-config.module';

// DEPRECATED alias 모듈 — /api/llm-configs 컨트롤러를 한시 유지하되, 데이터·로직은
// 모두 ModelConfig(kind='chat') 로 위임한다. PR4 에서 제거.
@Module({
  imports: [forwardRef(() => LlmModule), ModelConfigModule],
  controllers: [LlmConfigController],
  providers: [LlmConfigService],
  exports: [LlmConfigService],
})
export class LlmConfigModule {}
