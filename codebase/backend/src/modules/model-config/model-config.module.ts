import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModelConfig } from './entities/model-config.entity';
import { ModelConfigController } from './model-config.controller';
import { ModelConfigService } from './model-config.service';
import { LlmModule } from '../llm/llm.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ModelConfig]),
    forwardRef(() => LlmModule),
  ],
  controllers: [ModelConfigController],
  providers: [ModelConfigService],
  exports: [ModelConfigService],
})
export class ModelConfigModule {}
