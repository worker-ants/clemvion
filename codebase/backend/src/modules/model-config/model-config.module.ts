import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModelConfig } from './entities/model-config.entity';
import { ModelConfigController } from './model-config.controller';
import { ModelConfigService } from './model-config.service';

@Module({
  // llm 모듈에 대한 역의존(forwardRef) 제거 — 부속 엔드포인트는 LlmModelConfigController(llm)
  // 로 이전, 캐시 무효화는 ModelConfigService 옵저버 통지로 역전했다 (C-2 cluster 4).
  imports: [TypeOrmModule.forFeature([ModelConfig])],
  controllers: [ModelConfigController],
  providers: [ModelConfigService],
  exports: [ModelConfigService],
})
export class ModelConfigModule {}
