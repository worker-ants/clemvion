import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LlmUsageLog } from './entities/llm-usage-log.entity';
import { TokenUsage } from './interfaces/llm-client.interface';
import { calculateCostUsd } from './pricing';

export interface RecordLlmUsageParams {
  workspaceId: string;
  workflowId?: string | null;
  executionId?: string | null;
  nodeExecutionId?: string | null;
  llmConfigId?: string | null;
  provider: string;
  model: string;
  usage: TokenUsage;
}

@Injectable()
export class LlmUsageLogService {
  private readonly logger = new Logger(LlmUsageLogService.name);

  constructor(
    @InjectRepository(LlmUsageLog)
    private readonly repository: Repository<LlmUsageLog>,
  ) {}

  /**
   * LLM 호출 결과의 토큰 사용량을 기록한다.
   * 기록 실패는 LLM 호출 결과에 영향을 주지 않으며 경고만 남긴다.
   */
  async record(params: RecordLlmUsageParams): Promise<void> {
    try {
      const cost = calculateCostUsd(
        params.provider,
        params.model,
        params.usage.inputTokens,
        params.usage.outputTokens,
      );
      await this.repository.insert({
        workspaceId: params.workspaceId,
        workflowId: params.workflowId ?? null,
        executionId: params.executionId ?? null,
        nodeExecutionId: params.nodeExecutionId ?? null,
        llmConfigId: params.llmConfigId ?? null,
        provider: params.provider,
        model: params.model,
        promptTokens: params.usage.inputTokens,
        completionTokens: params.usage.outputTokens,
        totalTokens: params.usage.totalTokens,
        thinkingTokens: params.usage.thinkingTokens ?? null,
        costUsd: cost === null ? null : cost.toFixed(6),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`LLM usage 기록 실패: ${message}`);
    }
  }
}
