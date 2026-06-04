import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RerankConfig } from './entities/rerank-config.entity';
import { RerankConfigController } from './rerank-config.controller';
import { RerankConfigService } from './rerank-config.service';

@Module({
  imports: [TypeOrmModule.forFeature([RerankConfig])],
  controllers: [RerankConfigController],
  providers: [RerankConfigService],
  exports: [RerankConfigService],
})
export class RerankConfigModule {}
