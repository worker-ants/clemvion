import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Edge } from './entities/edge.entity';
import { Workflow } from '../workflows/entities/workflow.entity';
import { EdgesController } from './edges.controller';
import { EdgesService } from './edges.service';

@Module({
  imports: [TypeOrmModule.forFeature([Edge, Workflow])],
  controllers: [EdgesController],
  providers: [EdgesService],
  exports: [EdgesService],
})
export class EdgesModule {}
