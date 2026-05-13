import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Integration } from '../../../modules/integrations/entities/integration.entity';
import { Cafe24ApiClient } from './cafe24-api.client';

/**
 * Cafe24 node infrastructure. Owns the rate-limit-aware Cafe24ApiClient
 * that both the cafe24 workflow node and the Cafe24McpToolProvider share
 * (spec/4-nodes/4-integration/4-cafe24.md §4.1 / §8.4).
 *
 * Kept in `nodes/integration/cafe24/` rather than the upstream
 * `modules/integrations/` to preserve the project's `nodes → modules`
 * dependency direction — IntegrationsModule must never import from
 * `nodes/*`. ExecutionEngineModule imports Cafe24Module directly to make
 * Cafe24ApiClient injectable into ExecutionEngineService for the
 * HandlerDependencies wiring.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Integration])],
  providers: [Cafe24ApiClient],
  exports: [Cafe24ApiClient],
})
export class Cafe24Module {}
