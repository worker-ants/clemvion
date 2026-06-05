import { Injectable, Logger } from '@nestjs/common';
import { RerankConfigService } from '../../rerank-config/rerank-config.service';
import { RerankConfig } from '../../rerank-config/entities/rerank-config.entity';
import { RerankClientFactory } from '../../llm/rerank/rerank-client.factory';
import { LlmService } from '../../llm/llm.service';

// cross_encoder_llm 모드에서 cross-encoder 상위 후보 중 listwise LLM grading 에
// 투입할 survivor 수 (Spec RAG 검색 §3.3.2 step 3 — "survivors(~15)").
const LLM_GRADING_POOL = 15;
// grading 프롬프트에 넣는 후보당 본문 최대 길이 (토큰 통제).
const GRADING_CONTENT_CHARS = 500;

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
  // 재점수화 레이어를 타며, cross_encoder_llm 은 추가로 listwise LLM grading 을 수행한다.
  // 모드를 진단에 그대로 보존해 cross_encoder_llm 이 cross_encoder 로 무음 강등된
  // 것처럼 보이지 않게 한다 (Spec RAG 검색 §3.3.1).
  mode: 'cross_encoder' | 'cross_encoder_llm';
  candidateCount: number;
  returnedCount: number;
  // listwise LLM grading 적용 여부. cross_encoder 는 항상 false. cross_encoder_llm
  // 은 grading 성공 시 true, grading 실패/강등 시 false (이 경우 error 로 표시).
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
  // 라우팅된 rerank_mode — diagnostics.mode 로 그대로 보존된다. cross_encoder 는
  // 재점수화까지, cross_encoder_llm 은 추가로 listwise LLM grading 을 수행한다.
  mode: 'cross_encoder' | 'cross_encoder_llm';
  // cross_encoder_llm grading 에 사용할 chat LLMConfig. NULL → 워크스페이스 default.
  rerankLlmConfigId?: string | null;
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
    private readonly llmService: LlmService,
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

      // cross_encoder_llm: cross-encoder 상위 survivors 에 listwise LLM grading 1콜
      // (§3.3.2 step 3). 실패 시 cross-encoder 결과 유지(전체 cosine 강등 아님).
      let llmGradingApplied = false;
      let gradingError: string | null = null;
      if (params.mode === 'cross_encoder_llm') {
        const survivors = reranked.slice(0, LLM_GRADING_POOL);
        const graded = await this.applyLlmGrading(query, survivors, params);
        if (graded.applied) {
          reranked = graded.results;
          llmGradingApplied = true;
        } else {
          gradingError = graded.error;
        }
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
          llmGradingApplied,
          cutoffApplied,
          error: gradingError,
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
   * cross_encoder_llm — survivors 에 listwise LLM grading 1콜 (§3.3.2 step 3).
   * chat LLM 에 numbered passages 를 주고 관련도 순위+점수(1-10)를 JSON 으로 받아
   * 재정렬한다. 실패(설정/호출/파싱)는 throw 없이 applied=false 로 회신 →
   * 호출부가 cross-encoder 결과를 유지한다 (전체 cosine 강등 아님).
   */
  private async applyLlmGrading(
    query: string,
    survivors: RerankResult[],
    params: RerankParams,
  ): Promise<{
    applied: boolean;
    results: RerankResult[];
    error: string | null;
  }> {
    const FAIL = {
      applied: false,
      results: [] as RerankResult[],
      error: 'RERANK_LLM_GRADING_FAILED',
    };
    try {
      const config = await this.llmService.resolveConfig(
        params.rerankLlmConfigId ?? undefined,
        params.workspaceId,
      );
      const result = await this.llmService.chat(config, {
        model: config.defaultModel,
        messages: [
          { role: 'user', content: this.buildGradingPrompt(query, survivors) },
        ],
        responseFormat: 'json',
      });
      const ranking = this.parseGradingResponse(result.content);
      if (!ranking || ranking.length === 0) return FAIL;

      // ranking[].id 는 1-based survivor index. 유효 항목만 재정렬·점수 치환(1-10 → 0-1).
      const graded: RerankResult[] = [];
      const seen = new Set<number>();
      for (const { id, score } of ranking) {
        const idx = id - 1;
        if (idx >= 0 && idx < survivors.length && !seen.has(idx)) {
          seen.add(idx);
          graded.push({
            ...survivors[idx],
            score: score / 10,
            origin: 'reranked',
          });
        }
      }
      if (graded.length === 0) return FAIL;
      return { applied: true, results: graded, error: null };
    } catch (err) {
      this.logger.warn(
        `LLM grading failed; keeping cross-encoder order: ${this.errMsg(err)}`,
      );
      return FAIL;
    }
  }

  private buildGradingPrompt(query: string, survivors: RerankResult[]): string {
    const passages = survivors
      .map((s, i) => `[${i + 1}] ${s.content.slice(0, GRADING_CONTENT_CHARS)}`)
      .join('\n\n');
    return [
      'You are a relevance grader for retrieval-augmented generation.',
      'Given a user query and numbered passages, return ONLY a JSON object of the form:',
      '{"ranking": [{"id": <passage number>, "score": <integer 1-10>}]}',
      'List passages relevant to answering the query, ordered most-relevant first.',
      'Omit clearly irrelevant passages. Do not include any commentary.',
      '',
      `Query: ${query}`,
      '',
      'Passages:',
      passages,
    ].join('\n');
  }

  private parseGradingResponse(
    content: string | null,
  ): { id: number; score: number }[] | null {
    if (!content) return null;
    try {
      const cleaned = content.replace(/```json\s*|```/g, '').trim();
      const parsed = JSON.parse(cleaned) as {
        ranking?: { id: number; score: number }[];
      };
      if (!Array.isArray(parsed.ranking)) return null;
      return parsed.ranking
        .filter(
          (r) => typeof r?.id === 'number' && typeof r?.score === 'number',
        )
        .map((r) => ({ id: r.id, score: Math.max(0, Math.min(10, r.score)) }));
    } catch {
      return null;
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
