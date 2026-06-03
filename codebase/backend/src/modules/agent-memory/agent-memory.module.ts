import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { AgentMemory } from './entities/agent-memory.entity';
import { AgentMemoryService } from './agent-memory.service';
import { LlmModule } from '../llm/llm.module';
import { AGENT_MEMORY_EXTRACTION_QUEUE } from './queues/agent-memory-extraction.queue';
import { AgentMemoryExtractionProcessor } from './queues/agent-memory-extraction.processor';

/**
 * AI Agent persistent 메모리의 영속 저장/회수/forgetting 레이어 (spec/5-system/17-agent-memory.md).
 * 임베딩 생성·유사도 검색은 KB 인프라 (LlmService) 를 재사용한다. AgentMemoryService 를 export 해
 * AI Agent 핸들러 (execution-engine) 가 주입받아 recall/saveMemories/scheduleExtraction 을 호출한다.
 *
 * 턴 경계 비동기 추출 (spec §3, AGM-04) 은 전용 BullMQ 큐
 * `agent-memory-extraction` 로 분리한다 — producer 는 AgentMemoryService.
 * scheduleExtraction (핸들러가 enqueue), consumer 는 AgentMemoryExtractionProcessor
 * (추출 LLM 콜 + saveMemories). 추출 부하가 회수/임베딩 hot path 의 동시성에
 * 간섭하지 않도록 `document-embedding` 와 분리된 큐로 둔다.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([AgentMemory]),
    LlmModule,
    BullModule.registerQueue({ name: AGENT_MEMORY_EXTRACTION_QUEUE }),
  ],
  providers: [AgentMemoryService, AgentMemoryExtractionProcessor],
  exports: [AgentMemoryService],
})
export class AgentMemoryModule {}
