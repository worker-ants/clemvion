import { Injectable, Logger } from '@nestjs/common';
import { RerankConfigService } from '../../rerank-config/rerank-config.service';
import { RerankConfig } from '../../rerank-config/entities/rerank-config.entity';
import { RerankClientFactory } from '../../llm/rerank/rerank-client.factory';
import { LlmService } from '../../llm/llm.service';
import { applyDynamicCut } from './dynamic-cut.util';

// cross_encoder_llm 모드에서 cross-encoder 상위 후보 중 listwise LLM grading 에
// 투입할 survivor 수 (Spec RAG 검색 §3.3.2 step 3 — "survivors(~15)").
const LLM_GRADING_POOL = 15;
// grading 프롬프트에 넣는 후보당 본문 최대 길이 (토큰 통제).
const GRADING_CONTENT_CHARS = 500;

// conditional escalate 진입 임계 (Spec RAG 검색 §3.3.2). **provisional default** —
// P0 골든셋 기반 A/B 로 확정 예정 (plan/in-progress/rag-rerank-followup.md). cross-encoder
// 점수는 0~1 정규화(cohere relevance_score)를 가정한다; tei 등 비정규화 스케일은
// 후속 보정 대상. escalate 미발생 시 cross-encoder 결과를 그대로 사용한다(v1 부분집합).
const ESCALATE_TOP_SCORE_FLOOR = 0.6; // 최상위 점수가 낮으면 무엇이 관련인지 모호
const ESCALATE_FLAT_REL_GAP = 0.05; // top1-top2 상대 격차가 작으면 순위 평탄

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
  // 은 conditional escalate 로 escalate+grading 성공 시 true, escalate 미발생/grading
  // 실패 시 false (escalate 미발생은 정상, grading 실패는 error 로 표시). (§3.3.2)
  llmGradingApplied: boolean;
  // grading 이 실행됐고 grader 가 모든 survivor 를 무관(근거 없음)으로 판정한 경우 true.
  // grading parse 실패(RERANK_LLM_GRADING_FAILED, cross-encoder fallback)와 구분된다.
  // 이 신호를 받은 KB tool 호출은 결과 메타에 '관련 근거 없음' 을 명시한다 (§3.3.2 환각 억제).
  gradingNoGrounding: boolean;
  cutoffApplied: boolean;
  // null = 성공. 실패 시 UPPER_SNAKE_CASE 코드 (Spec RAG 검색 §3.3.2 / §6).
  error: string | null;
}

export interface RerankParams {
  query: string;
  candidates: RerankCandidate[];
  workspaceId: string;
  rerankConfigId: string | null;
  // 동적 점수 컷 (§3.4): inject-cap(명시 top_k 또는 내부 ceiling) + token-budget.
  injectCap: number;
  tokenBudget: number;
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
 * wide 회수 후보를 RerankConfig endpoint 로 재점수화하고 §3.4 동적 컷(점수 θ +
 * token-budget + inject-cap)한다.
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
    const { query, candidates, workspaceId, rerankConfigId } = params;

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

      // 모든 후보를 재점수화한다 (작은 topK 로 미리 굶기면 동적 컷이 무의미). 최종
      // 주입 수는 아래 §3.4 동적 컷(scoreThreshold + token-budget + inject-cap)이 결정.
      const scores = await client.rerank(
        query,
        candidates.map((c) => c.content),
        config.defaultModel,
        { topK: candidates.length },
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

      // cross_encoder_llm: conditional escalate — cross-encoder 상위 점수가 평탄/모호할
      // 때만 survivors 에 listwise LLM grading 1콜 (§3.3.2 step 3). escalate 미발생 시
      // cross-encoder 결과 유지(정상, v1 부분집합). grading 실패 시도 결과 유지.
      let llmGradingApplied = false;
      let gradingNoGrounding = false;
      let gradingError: string | null = null;
      if (
        params.mode === 'cross_encoder_llm' &&
        this.shouldEscalateGrading(reranked)
      ) {
        const survivors = reranked.slice(0, LLM_GRADING_POOL);
        const graded = await this.applyLlmGrading(query, survivors, params);
        if (graded.outcome === 'applied') {
          reranked = graded.results;
          llmGradingApplied = true;
        } else if (graded.outcome === 'no_grounding') {
          // grader 가 모든 survivor 를 무관 판정 — 근거 없음. 결과를 비우고 신호만 남긴다.
          reranked = [];
          llmGradingApplied = true;
          gradingNoGrounding = true;
        } else {
          // parse/호출 실패 — cross-encoder 결과 유지 (전체 cosine 강등 아님).
          gradingError = graded.error;
        }
      }

      // 동적 점수 컷 (§3.4): ① rerank 점수 θ 미달 drop ② token-budget ③ inject-cap.
      let cutoffApplied = false;
      if (params.scoreThreshold !== null) {
        const threshold = params.scoreThreshold;
        const before = reranked.length;
        reranked = reranked.filter((r) => r.score >= threshold);
        cutoffApplied = reranked.length < before;
      }
      const { kept: sliced, cutoffApplied: dynCutApplied } = applyDynamicCut(
        reranked,
        { tokenBudget: params.tokenBudget, maxCount: params.injectCap },
      );
      cutoffApplied = cutoffApplied || dynCutApplied;

      return {
        results: sliced,
        diagnostics: {
          mode: params.mode,
          candidateCount: candidates.length,
          returnedCount: sliced.length,
          llmGradingApplied,
          gradingNoGrounding,
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
   * conditional escalate 진입 판정 (§3.3.2). cross-encoder 상위 점수가 **평탄/모호**할
   * 때만 listwise LLM grading 으로 escalate 한다 — 그 외에는 cross-encoder 결과가
   * 충분히 변별력이 있다고 보고 LLM 콜을 아낀다. 임계는 provisional(§상수 주석).
   */
  private shouldEscalateGrading(reranked: RerankResult[]): boolean {
    if (reranked.length === 0) return false;
    const top = reranked[0].score;
    // 모호: 최상위 점수도 낮으면 무엇이 명확히 관련인지 불분명 → escalate.
    if (top < ESCALATE_TOP_SCORE_FLOOR) return true;
    // 평탄: top1-top2 상대 격차가 작으면 순위가 평탄 → escalate.
    if (reranked.length >= 2) {
      const relGap = (top - reranked[1].score) / (Math.abs(top) + 1e-6);
      if (relGap < ESCALATE_FLAT_REL_GAP) return true;
    }
    return false;
  }

  /**
   * cross_encoder_llm — survivors 에 listwise LLM grading 1콜 (§3.3.2 step 3).
   * chat LLM 에 numbered passages 를 주고 관련도 순위+점수(1-10)를 JSON 으로 받아
   * 재정렬한다. 결과는 outcome 으로 구분:
   * - `applied`: 관련 passage 가 있어 재정렬됨.
   * - `no_grounding`: grader 가 유효 응답으로 **빈 ranking**(모두 무관)을 반환 — 근거 없음.
   *   호출부가 결과를 비우고 `gradingNoGrounding` 신호를 남긴다(환각 억제).
   * - `failed`: 설정/호출/파싱 실패 — throw 없이 회신, 호출부가 cross-encoder 결과 유지.
   */
  private async applyLlmGrading(
    query: string,
    survivors: RerankResult[],
    params: RerankParams,
  ): Promise<{
    outcome: 'applied' | 'no_grounding' | 'failed';
    results: RerankResult[];
    error: string | null;
  }> {
    const FAIL = {
      outcome: 'failed' as const,
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
      // parse 실패(null) = 실패. 유효하지만 빈 ranking = 근거 없음(grader 가 명시적으로 모두 무관).
      if (!ranking) return FAIL;
      if (ranking.length === 0) {
        return { outcome: 'no_grounding', results: [], error: null };
      }

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
      // ranking 은 비어있지 않은데 유효 id 매핑이 0건 = 형식 오류 → 실패(cross-encoder 유지).
      if (graded.length === 0) return FAIL;
      return { outcome: 'applied', results: graded, error: null };
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
   * 안전 강등: 원본 cosine score 내림차순 정렬 후 §3.4 동적 컷. origin 은 붙이지
   * 않는다 — 강등 결과는 reranked 가 아니며 diagnostics.error 로 강등 사실을 표시한다.
   */
  private fallback(params: RerankParams, error: string): RerankResponse {
    // cosine score 순 정렬 후 동적 컷(token-budget + inject-cap) — 강등 경로도 §3.4 일관.
    const sorted = [...params.candidates].sort((a, b) => b.score - a.score);
    const { kept } = applyDynamicCut(sorted, {
      tokenBudget: params.tokenBudget,
      maxCount: params.injectCap,
    });
    return {
      results: kept.map((c) => ({ ...c })),
      diagnostics: {
        mode: params.mode,
        candidateCount: params.candidates.length,
        returnedCount: kept.length,
        llmGradingApplied: false,
        gradingNoGrounding: false,
        cutoffApplied: false,
        error,
      },
    };
  }

  private errMsg(err: unknown): string {
    return err instanceof Error ? err.message : 'unknown error';
  }
}
