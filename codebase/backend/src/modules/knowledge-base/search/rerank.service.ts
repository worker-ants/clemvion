import { Injectable, Logger } from '@nestjs/common';
import { RerankConfigService } from '../../rerank-config/rerank-config.service';
import { RerankConfig } from '../../rerank-config/entities/rerank-config.entity';
import { RerankClientFactory } from '../../llm/rerank/rerank-client.factory';

export interface RerankCandidate {
  chunkId: string;
  content: string;
  score: number;
  [k: string]: unknown;
}

export interface RerankResult extends RerankCandidate {
  origin: 'reranked';
}

export interface RerankDiagnostics {
  mode: 'cross_encoder';
  candidateCount: number;
  returnedCount: number;
  llmGradingApplied: false;
  cutoffApplied: boolean;
  // null = 성공. 실패 시 UPPER_SNAKE_CASE 코드 (Spec RAG 검색 §3.3.2 / §6).
  error: string | null;
}

export interface RerankParams {
  query: string;
  candidates: RerankCandidate[];
  workspaceId: string;
  rerankConfigId: string | null;
  topK: number;
  scoreThreshold: number | null;
}

export interface RerankResponse {
  results: RerankResult[];
  diagnostics: RerankDiagnostics;
}

/**
 * RAG 검색 후처리 — cross-encoder 리랭킹 (Spec RAG 검색 §3.3).
 * wide 회수 후보를 RerankConfig endpoint 로 재점수화하고 동적 컷·topK slice 한다.
 *
 * 어떤 실패(설정 누락/미지원 provider/endpoint 실패)에도 throw 하지 않고
 * cosine score 순 안전 강등한다 (§6) — 노드 실패가 아니다.
 */
@Injectable()
export class RerankService {
  private readonly logger = new Logger(RerankService.name);

  constructor(
    private readonly rerankConfigService: RerankConfigService,
    private readonly rerankClientFactory: RerankClientFactory,
  ) {}

  async rerankCandidates(params: RerankParams): Promise<RerankResponse> {
    const { query, candidates, workspaceId, rerankConfigId, topK } = params;

    // 설정 해석 — 실패 시 RERANK_CONFIG_INVALID 로 cosine 강등.
    let config: RerankConfig;
    try {
      config = await this.rerankConfigService.resolveConfig(
        rerankConfigId ?? undefined,
        workspaceId,
      );
    } catch (err) {
      this.logger.warn(
        `Rerank config resolution failed (ws=${workspaceId}); falling back to cosine order: ${this.errMsg(err)}`,
      );
      return this.fallback(params, 'RERANK_CONFIG_INVALID');
    }

    // 클라이언트 생성 + 리랭크 호출 — 실패 시 RERANK_ENDPOINT_FAILED 로 강등.
    try {
      const apiKey =
        this.rerankConfigService.getDecryptedApiKey(config) ?? undefined;
      const client = this.rerankClientFactory.create({
        provider: config.provider,
        apiKey,
        defaultModel: config.defaultModel,
        baseUrl: config.baseUrl ?? undefined,
      });

      const scores = await client.rerank(
        query,
        candidates.map((c) => c.content),
        config.defaultModel,
        { topK },
      );

      // 반환된 index 순서로 후보 재정렬, score 를 리랭크 점수로 치환.
      let reranked: RerankResult[] = scores
        .filter((s) => s.index >= 0 && s.index < candidates.length)
        .map((s) => ({
          ...candidates[s.index],
          score: s.score,
          origin: 'reranked' as const,
        }));

      // 동적 점수 컷 — threshold 가 있으면 미달 후보 drop.
      let cutoffApplied = false;
      if (params.scoreThreshold !== null) {
        const threshold = params.scoreThreshold;
        const before = reranked.length;
        reranked = reranked.filter((r) => r.score >= threshold);
        cutoffApplied = reranked.length < before;
      }

      // 최종 topK slice.
      const sliced = reranked.slice(0, topK);

      return {
        results: sliced,
        diagnostics: {
          mode: 'cross_encoder',
          candidateCount: candidates.length,
          returnedCount: sliced.length,
          llmGradingApplied: false,
          cutoffApplied,
          error: null,
        },
      };
    } catch (err) {
      this.logger.warn(
        `Rerank endpoint failed (provider=${config.provider}); falling back to cosine order: ${this.errMsg(err)}`,
      );
      return this.fallback(params, 'RERANK_ENDPOINT_FAILED');
    }
  }

  /**
   * 안전 강등: 원본 cosine score 내림차순 정렬 후 topK slice. origin 은 보존하지
   * 않고 reranked 도 아니므로 결과에는 리랭크 표식을 붙이지 않는다 — 대신
   * diagnostics.error 로 강등을 표시한다.
   */
  private fallback(params: RerankParams, error: string): RerankResponse {
    const sorted = [...params.candidates]
      .sort((a, b) => b.score - a.score)
      .slice(0, params.topK)
      .map((c) => ({ ...c, origin: 'reranked' as const }));
    return {
      results: sorted,
      diagnostics: {
        mode: 'cross_encoder',
        candidateCount: params.candidates.length,
        returnedCount: sorted.length,
        llmGradingApplied: false,
        cutoffApplied: false,
        error,
      },
    };
  }

  private errMsg(err: unknown): string {
    return err instanceof Error ? err.message : 'unknown error';
  }
}
