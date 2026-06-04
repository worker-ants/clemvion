import { Logger } from '@nestjs/common';
import {
  ToolCall,
  ToolDef,
} from '../../../../modules/llm/interfaces/llm-client.interface';
import { RagSearchService } from '../../../../modules/knowledge-base/search/rag-search.service';
import { KnowledgeBaseService } from '../../../../modules/knowledge-base/knowledge-base.service';
import {
  AgentToolProvider,
  AgentToolResult,
  ProviderBuildCtx,
  ProviderCleanupCtx,
  ProviderExecCtx,
} from './agent-tool-provider.interface';

/**
 * KB ID 를 LLM-safe tool name suffix 로 변환. ai-agent.handler 의 sanitizeId 와
 * 동일 규칙. 별도로 보관해 provider 가 핸들러 내부 헬퍼에 의존하지 않게 한다.
 */
function sanitizeKbId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, '_');
}

/** `kb_<sanitizedKbId>` 형태의 LLM tool name. */
export function kbToolName(kbId: string): string {
  return `kb_${sanitizeKbId(kbId)}`;
}

/** tool name 에서 kb id 를 역추출. matches 로 prefix 검증된 이후에만 호출. */
function extractKbIdFromToolName(
  name: string,
  knownKbIds: string[],
): string | null {
  const suffix = name.slice('kb_'.length);
  // sanitize 가 일대다 매핑 (`-` → `_`) 이므로 원본 KB id 후보들을 sanitize 해서 비교.
  for (const id of knownKbIds) {
    if (sanitizeKbId(id) === suffix) return id;
  }
  return null;
}

interface ParsedKbArgs {
  query: string;
  topK?: number;
  threshold?: number;
}

/**
 * LLM 이 보낸 query 의 최대 길이. 임베딩 비용 / 토큰 절약 / 악성 페이로드 차단
 * 목적이며, 일반적인 사용자 질의는 100자를 거의 넘지 않으므로 충분히 여유 있다.
 */
const MAX_KB_QUERY_LENGTH = 2000;

function parseKbArgs(rawArgs: string): ParsedKbArgs {
  if (!rawArgs) return { query: '' };
  try {
    const parsed = JSON.parse(rawArgs) as Record<string, unknown>;
    const rawQuery = typeof parsed.query === 'string' ? parsed.query : '';
    // trim 후 상한 적용. 빈 문자열이면 호출부에서 'Missing required argument' 처리.
    const query = rawQuery.trim().slice(0, MAX_KB_QUERY_LENGTH);
    const topK =
      typeof parsed.top_k === 'number' && parsed.top_k > 0
        ? Math.floor(parsed.top_k)
        : undefined;
    const threshold =
      typeof parsed.threshold === 'number' &&
      parsed.threshold >= 0 &&
      parsed.threshold <= 1
        ? parsed.threshold
        : undefined;
    return { query, topK, threshold };
  } catch {
    return { query: '' };
  }
}

/**
 * KB 검색을 LLM tool 로 노출. 노드 config 의 `knowledgeBases` (KB id 배열) 를 KB 단위
 * 1:1 tool 로 변환해 LLM 이 사용자 의도에 맞는 KB 를 자율 선택·능동 분해 후 병렬
 * 호출하도록 유도한다 (agentic RAG). 각 호출은 단일 지식 단위 query 만 담으며,
 * 결과는 호출별로 분리된 tool_result 로 LLM 에 전달된다 (cross-call 병합 없음).
 *
 * - {@link buildTools}: 등록된 KB 메타를 일괄 조회해 ToolDef 배열 생성. 누락된 KB 는
 *   warn 로그 후 skip — workflow 가 다른 workspace KB id 를 참조하면 NotFound 가
 *   throw 되어 한 KB 의 권한 누락이 전체 도구 노출을 막지 않게 격리. 같은
 *   `executionId` 단위로 KB name 을 {@link metaCache} 에 적재해 후속 execute() 의
 *   findById 를 생략한다 (Promise.all 병렬 호출 시 N+1 쿼리 방지).
 * - {@link execute}: tool_use arguments 의 `query` 로 RagSearchService.search 1회 호출.
 *   결과를 JSON 문자열로 직렬화해 tool_result 메시지 content 로 반환. ragSources/diagnostics
 *   delta 를 함께 반환해 핸들러 meta 누적기에 push 한다. KB name 은 metaCache 우선,
 *   miss 시 findById 로 fallback (multi-turn resume / 캐시 만료 등의 견고성).
 * - {@link cleanup}: executionId 단위 metaCache 항목 제거 (핸들러가 노드 실행
 *   종료 / multi-turn waiting / error 시점마다 호출).
 */
export class KbToolProvider implements AgentToolProvider {
  readonly key = 'kb';
  private static readonly logger = new Logger('KbToolProvider');

  /**
   * executionId → kbId → meta. buildTools 에서 채워두면 같은 노드 실행 내의
   * execute() 들이 KB findById 를 재발행하지 않는다. multi-turn waiting/resume
   * 사이에는 cleanup 으로 비워지고, resume 의 새 buildTools 가 다시 채운다.
   */
  private readonly metaCache = new Map<string, Map<string, { name: string }>>();

  constructor(
    private readonly ragSearchService: RagSearchService,
    private readonly knowledgeBaseService: KnowledgeBaseService,
  ) {}

  matches(toolName: string): boolean {
    return toolName.startsWith('kb_');
  }

  async buildTools(ctx: ProviderBuildCtx): Promise<ToolDef[]> {
    const kbIds = (ctx.config.knowledgeBases as string[]) || [];
    if (kbIds.length === 0) return [];

    const defaultTopK = (ctx.config.ragTopK as number) || 5;
    const defaultThreshold = (ctx.config.ragThreshold as number) || 0.7;

    const tools: ToolDef[] = [];
    // 병렬로 KB 메타 조회. 한 KB 가 NotFound 여도 나머지는 노출되도록 settled.
    const settled = await Promise.allSettled(
      kbIds.map((id) =>
        this.knowledgeBaseService.findById(id, ctx.workspaceId),
      ),
    );
    // executionId 가 있으면 후속 execute() 가 findById 를 건너뛰도록 KB name 을
    // 캐시. 인-메모리 단순 Map 이며 cleanup 시 비워진다.
    const cache = ctx.executionId ? new Map<string, { name: string }>() : null;
    for (let i = 0; i < settled.length; i++) {
      const r = settled[i];
      const kbId = kbIds[i];
      if (r.status === 'rejected') {
        KbToolProvider.logger.warn(
          `Skipping KB ${kbId}: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`,
        );
        continue;
      }
      const kb = r.value;
      cache?.set(kbId, { name: kb.name });
      const desc = kb.description?.trim()
        ? `${kb.name} — ${kb.description.trim()}`
        : kb.name;
      tools.push({
        name: kbToolName(kbId),
        description: `Search the "${desc}" knowledge base. Do NOT pass the user's raw question — first decompose it into the atomic knowledge units needed to answer, then call this tool once per unit (one topic per call). Emit multiple parallel calls in the same turn whenever distinct facts are needed; each call's results are returned separately to you (no cross-call merging). Re-call with refined queries if results are insufficient.`,
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description:
                "Single-topic search phrase (one knowledge unit per call) optimized for semantic retrieval, in the same language as the user message. Do not concatenate multiple topics with 'and / 와 / 및' — split into separate parallel calls instead.",
            },
            top_k: {
              type: 'integer',
              description: `Maximum chunks to return (default ${defaultTopK}). Increase for broader recall.`,
              minimum: 1,
              maximum: 50,
            },
            threshold: {
              type: 'number',
              description: `Minimum similarity score 0-1 (default ${defaultThreshold}). Lower for broader recall.`,
              minimum: 0,
              maximum: 1,
            },
          },
          required: ['query'],
        },
      });
    }
    if (ctx.executionId && cache && cache.size > 0) {
      this.metaCache.set(ctx.executionId, cache);
    }
    return tools;
  }

  async execute(
    call: ToolCall,
    ctx: ProviderExecCtx,
  ): Promise<AgentToolResult> {
    const kbIds = (ctx.config.knowledgeBases as string[]) || [];
    const kbId = extractKbIdFromToolName(call.name, kbIds);
    if (!kbId) {
      // LLM 이 만든 tool 이름은 로그에만 남기고 다음 prompt context 에는 고정
      // 코드만 흘려보낸다 (반사형 페이로드 노출 차단).
      KbToolProvider.logger.warn(
        `Unknown KB tool requested: ${call.name} (known=${kbIds.length})`,
      );
      return {
        toolCallId: call.id,
        content: JSON.stringify({ error: 'unknown_kb_tool' }),
        status: 'error',
        error: 'unknown_kb_tool',
      };
    }

    const args = parseKbArgs(call.arguments);
    if (!args.query) {
      return {
        toolCallId: call.id,
        content: JSON.stringify({
          error: 'Missing required argument: query',
        }),
        status: 'error',
        error: 'Missing required argument: query',
      };
    }

    const defaultTopK = (ctx.config.ragTopK as number) || 5;
    const defaultThreshold = (ctx.config.ragThreshold as number) || 0.7;
    const topK = args.topK ?? defaultTopK;
    const threshold = args.threshold ?? defaultThreshold;

    let kbName = kbId;
    const cached = ctx.executionId
      ? this.metaCache.get(ctx.executionId)?.get(kbId)
      : undefined;
    if (cached) {
      kbName = cached.name;
    } else {
      try {
        const kb = await this.knowledgeBaseService.findById(
          kbId,
          ctx.workspaceId,
        );
        kbName = kb.name;
      } catch {
        // KB 메타 조회 실패해도 검색은 시도. 검색이 빈 결과로 graceful fallback.
      }
    }

    let results: Awaited<ReturnType<RagSearchService['search']>> = [];
    let rerankDiagnostics:
      | Awaited<ReturnType<RagSearchService['searchWithMeta']>>['rerank']
      | undefined;
    try {
      const meta = await this.ragSearchService.searchWithMeta(
        args.query,
        [kbId],
        ctx.workspaceId,
        { topK, threshold },
      );
      results = meta.results;
      rerankDiagnostics = meta.rerank;
    } catch (e) {
      const rawMsg = e instanceof Error ? e.message : String(e);
      KbToolProvider.logger.warn(`KB search failed (kb=${kbId}): ${rawMsg}`);
      // 원시 예외 메시지(`KB search failed: ${rawMsg}`)는 내부 호스트명·DB
      // 연결 문자열·스택 단편 등을 포함할 수 있다. tool_result content 는 그대로
      // LLM 다음 turn 에 주입돼 사용자 응답으로 인용될 수 있으므로, 외부에는
      // 고정 사용자 메시지만 노출하고 원시 메시지는 logger.warn 으로만 남긴다.
      const safeMessage =
        'KB 검색이 일시적으로 실패했습니다. 잠시 후 다시 시도해 주세요.';
      return {
        toolCallId: call.id,
        content: JSON.stringify({
          kb: kbName,
          query: args.query,
          error: 'search_failed',
          message: safeMessage,
          results: [],
        }),
        status: 'error',
        error: rawMsg,
        ragDiagnosticsDelta: {
          kbId,
          query: args.query,
          resultCount: 0,
        },
      };
    }

    const content = JSON.stringify({
      kb: kbName,
      query: args.query,
      results: results.map((r) => ({
        source: r.documentName,
        score: Number(r.score.toFixed(3)),
        content: r.content,
      })),
    });

    // ragSources 는 frontend run-results UI 가 인용한 청크들을 표시할 때 사용한다.
    // tool_result content 는 LLM 컨텍스트용이고, ragSources 는 사용자 가시 메타.
    // 텍스트는 200자 미리보기로 잘라 frontend 노출용 카드에 맞춘다 (기존 buildContext 와 동일 규칙).
    const ragSourcesDelta = results.map((r) => ({
      ...r,
      content:
        r.content.substring(0, 200) + (r.content.length > 200 ? '...' : ''),
    }));

    return {
      toolCallId: call.id,
      content,
      ragSourcesDelta,
      ragDiagnosticsDelta: {
        kbId,
        query: args.query,
        resultCount: results.length,
        // rerank 진단은 rerank_mode ≠ off 인 KB 호출 시에만 포함됨.
        ...(rerankDiagnostics !== undefined
          ? { rerank: rerankDiagnostics }
          : {}),
      },
    };
  }

  cleanup(ctx: ProviderCleanupCtx): Promise<void> {
    if (ctx.executionId) {
      this.metaCache.delete(ctx.executionId);
    } else {
      // executionId 미지정은 "전체 자원 정리" — 본 provider 는 외부 세션이
      // 없으므로 캐시만 비운다.
      this.metaCache.clear();
    }
    return Promise.resolve();
  }
}
