import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { LlmService } from '../../llm/llm.service';
import { AgentMemoryService } from '../agent-memory.service';
import {
  AGENT_MEMORY_EXTRACTION_QUEUE,
  AgentMemoryExtractionJob,
  EXTRACTION_SYSTEM_PROMPT,
  buildExtractionTranscript,
  parseExtractionResponse,
} from './agent-memory-extraction.queue';

/**
 * 턴 경계 비동기 추출 worker (spec/5-system/17-agent-memory.md §3, AGM-04).
 *
 * 핸들러(hot path) 가 enqueue 한 turn 스냅샷을 소비해:
 *  1. transcript 렌더 → 추출 LLM 콜 (LlmService.chat, 노드 llmConfigId/model 재사용)
 *  2. JSON 배열 파싱 (실패 graceful — 빈 배열)
 *  3. `AgentMemoryService.saveMemories` 로 content 단위 사실 저장
 *
 * turns 가 비었거나 transcript 가 비었거나 추출 결과가 없으면 no-op. 추출
 * 실패는 로그 + throw (BullMQ 기본 재시도 정책). hot path 와 완전히 분리된
 * 경로이므로 여기서의 실패/지연은 응답 latency 에 영향을 주지 않는다.
 */
@Processor(AGENT_MEMORY_EXTRACTION_QUEUE, { concurrency: 2 })
export class AgentMemoryExtractionProcessor extends WorkerHost {
  private readonly logger = new Logger(AgentMemoryExtractionProcessor.name);

  constructor(
    private readonly llmService: LlmService,
    private readonly agentMemoryService: AgentMemoryService,
  ) {
    super();
  }

  async process(job: Job<AgentMemoryExtractionJob>): Promise<void> {
    const { workspaceId, scopeKey, llmConfigId, model, turns } = job.data ?? {};
    if (!workspaceId || !scopeKey) return;
    if (!Array.isArray(turns) || turns.length === 0) return;

    const transcript = buildExtractionTranscript(turns);
    if (!transcript.trim()) return;

    // 추출 LLM 콜 — 노드 llmConfigId 재사용 (scope-freeze §3). 미지정이면
    // 워크스페이스 기본 LLMConfig (resolveConfig fallback).
    const llmConfig = await this.llmService.resolveConfig(
      llmConfigId ?? undefined,
      workspaceId,
    );

    const result = await this.llmService.chat(llmConfig, {
      model: model || llmConfig.defaultModel,
      messages: [
        { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
        { role: 'user', content: transcript },
      ],
      // 결정적·간결 추출 — 낮은 temperature.
      temperature: 0,
      responseFormat: 'json',
    });

    const facts = parseExtractionResponse(result.content);
    if (facts.length === 0) return;

    await this.agentMemoryService.saveMemories(
      workspaceId,
      scopeKey,
      facts.map((content) => ({
        content,
        metadata: { kind: 'fact', source: 'turn_boundary_extraction' },
      })),
      // 저장 임베딩 출처 — 회수/추출과 동일 llmConfigId (차원·endpoint 일치, §3).
      { llmConfigId: llmConfigId ?? undefined, embeddingModel: undefined },
    );

    this.logger.debug(
      `Extracted ${facts.length} memory item(s) for scope ${scopeKey}`,
    );
  }
}
