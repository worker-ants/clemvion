import { Module, forwardRef } from '@nestjs/common';
import { LlmConfigController } from './llm-config.controller';
import { LlmConfigService } from './llm-config.service';
import { LlmModule } from '../llm/llm.module';
import { ModelConfigModule } from '../model-config/model-config.module';

// DEPRECATED alias 모듈 — /api/llm-configs 컨트롤러를 한시 유지하되, 데이터·로직은
// 모두 ModelConfig(kind='chat') 로 위임한다. PR4 에서 제거.
//
// ModelConfigModule 도 forwardRef 로 감싼다 — model-config.controller 가
// llm-config/dto/preview-llm-models.dto 를 import 해 파일 레벨 순환이 발생하므로
// NestJS DI 컨테이너 레벨에서 지연 해소가 필요하다.
@Module({
  imports: [forwardRef(() => LlmModule), forwardRef(() => ModelConfigModule)],
  controllers: [LlmConfigController],
  providers: [LlmConfigService],
  exports: [LlmConfigService],
})
export class LlmConfigModule {}
