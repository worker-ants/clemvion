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
  origin?: 'reranked';
}

export interface RerankDiagnostics {
  // 라우팅된 rerank_mode. cross_encoder / cross_encoder_llm 둘 다 cross-encoder
  // 재점수화 레이어를 타며, cross_encoder_llm 은 추가 LLM grading(후속)을 약속한다.
  // 모드를 진단에 그대로 보존해 cross_encoder_llm 이 cross_encoder 로 무음 강등된
  // 것처럼 보이지 않게 한다 (Spec RAG 검색 §3.3.1).
  mode: 'cross_encoder' | 'cross_encoder_llm';
  candidateCount: number;
  returnedCount: number;
  // listwise LLM grading 적용 여부. cross_encoder 는 항상 false. cross_encoder_llm
  // 도 LLM grading 단계 구현 전까지는 false (후속) — false 자체가 "cross-encoder
  // 까지만 적용됐고 LLM grading 은 아직 미적용" breadcrumb 이다 (§3.3.2 step 3).
  llmGradingApplied: boolean;
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
  // 라우팅된 rerank_mode — diagnostics.mode 로 그대로 보존된다. cross_encoder_llm
  // 의 LLM grading 단계는 후속이지만, cross-encoder 재점수화는 두 모드 모두 수행.
  mode: 'cross_encoder' | 'cross_encoder_llm';
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

      // 유효 index 필터 후 결과가 비어 있으면 cosine 강등 — 빈 배열을 조용히 반환하지 않는다.
      if (reranked.length === 0 && candidates.length > 0) {
        this.logger.warn(
          `Rerank returned no valid results (provider=${config.provider}); falling back to cosine order`,
        );
        return this.fallback(params, 'RERANK_NO_VALID_RESULTS');
      }

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
          mode: params.mode,
          candidateCount: candidates.length,
          returnedCount: sliced.length,
          // LLM grading 단계는 후속 — cross_encoder_llm 도 현재는 cross-encoder
          // 까지만 적용된다 (§3.3.2 step 3, plan/in-progress/rag-rerank-followup.md).
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
   * 안전 강등: 원본 cosine score 내림차순 정렬 후 topK slice. origin 은 붙이지
   * 않는다 — 강등 결과는 reranked 가 아니며 diagnostics.error 로 강등 사실을 표시한다.
   */
  private fallback(params: RerankParams, error: string): RerankResponse {
    const sorted = [...params.candidates]
      .sort((a, b) => b.score - a.score)
      .slice(0, params.topK)
      .map((c) => ({ ...c }));
    return {
      results: sorted,
      diagnostics: {
        mode: params.mode,
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
