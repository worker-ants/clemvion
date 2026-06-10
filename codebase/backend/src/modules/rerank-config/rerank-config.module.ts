import { Module } from '@nestjs/common';
import { RerankConfigController } from './rerank-config.controller';
import { RerankConfigService } from './rerank-config.service';
import { ModelConfigModule } from '../model-config/model-config.module';

// DEPRECATED alias 모듈 — /api/rerank-configs 컨트롤러를 한시 유지하되, 데이터·로직은
// 모두 ModelConfig(kind='rerank') 로 위임한다. PR4 에서 제거.
@Module({
  imports: [ModelConfigModule],
  controllers: [RerankConfigController],
  providers: [RerankConfigService],
  exports: [RerankConfigService],
})
export class RerankConfigModule {}
