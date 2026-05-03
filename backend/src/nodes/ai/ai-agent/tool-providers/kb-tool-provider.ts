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

function parseKbArgs(rawArgs: string): ParsedKbArgs {
  if (!rawArgs) return { query: '' };
  try {
    const parsed = JSON.parse(rawArgs) as Record<string, unknown>;
    const query = typeof parsed.query === 'string' ? parsed.query : '';
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
 * 1:1 tool 로 변환해 LLM 이 사용자 의도에 맞는 KB 를 자율 선택·동시 호출하도록 한다.
 *
 * - {@link buildTools}: 등록된 KB 메타를 일괄 조회해 ToolDef 배열 생성. 누락된 KB 는
 *   warn 로그 후 skip — workflow 가 다른 workspace KB id 를 참조하면 NotFound 가
 *   throw 되어 한 KB 의 권한 누락이 전체 도구 노출을 막지 않게 격리.
 * - {@link execute}: tool_use arguments 의 `query` 로 RagSearchService.search 1회 호출.
 *   결과를 JSON 문자열로 직렬화해 tool_result 메시지 content 로 반환. ragSources/diagnostics
 *   delta 를 함께 반환해 핸들러 meta 누적기에 push 한다.
 */
export class KbToolProvider implements AgentToolProvider {
  readonly key = 'kb';
  private static readonly logger = new Logger('KbToolProvider');

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
      const desc = kb.description?.trim()
        ? `${kb.name} — ${kb.description.trim()}`
        : kb.name;
      tools.push({
        name: kbToolName(kbId),
        description: `Search the "${desc}" knowledge base. Call this when the user's question requires information from this KB. You may call multiple kb_* tools in parallel for multi-intent questions, and re-call with refined queries if results are insufficient.`,
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description:
                'Short search phrase optimized for retrieval, in the same language as the user message.',
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
    return tools;
  }

  async execute(call: ToolCall, ctx: ProviderExecCtx): Promise<AgentToolResult> {
    const kbIds = (ctx.config.knowledgeBases as string[]) || [];
    const kbId = extractKbIdFromToolName(call.name, kbIds);
    if (!kbId) {
      return {
        toolCallId: call.id,
        content: JSON.stringify({
          error: `Unknown knowledge base tool: ${call.name}`,
        }),
      };
    }

    const args = parseKbArgs(call.arguments);
    if (!args.query) {
      return {
        toolCallId: call.id,
        content: JSON.stringify({
          error: 'Missing required argument: query',
        }),
      };
    }

    const defaultTopK = (ctx.config.ragTopK as number) || 5;
    const defaultThreshold = (ctx.config.ragThreshold as number) || 0.7;
    const topK = args.topK ?? defaultTopK;
    const threshold = args.threshold ?? defaultThreshold;

    let kbName = kbId;
    try {
      const kb = await this.knowledgeBaseService.findById(
        kbId,
        ctx.workspaceId,
      );
      kbName = kb.name;
    } catch {
      // KB 메타 조회 실패해도 검색은 시도. 검색이 빈 결과로 graceful fallback.
    }

    let results: Awaited<ReturnType<RagSearchService['search']>> = [];
    try {
      results = await this.ragSearchService.search(
        args.query,
        [kbId],
        ctx.workspaceId,
        { topK, threshold },
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      KbToolProvider.logger.warn(`KB search failed (kb=${kbId}): ${msg}`);
      return {
        toolCallId: call.id,
        content: JSON.stringify({
          kb: kbName,
          query: args.query,
          error: 'search_failed',
          results: [],
        }),
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
      },
    };
  }
}
