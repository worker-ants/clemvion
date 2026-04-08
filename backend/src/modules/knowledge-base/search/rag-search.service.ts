import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { LlmService } from '../../llm/llm.service';
import { SearchResult, RagContext } from './search-result.interface';

@Injectable()
export class RagSearchService {
  private readonly logger = new Logger(RagSearchService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly llmService: LlmService,
  ) {}

  async search(
    query: string,
    knowledgeBaseIds: string[],
    workspaceId: string,
    options?: { topK?: number; threshold?: number },
  ): Promise<SearchResult[]> {
    if (!knowledgeBaseIds?.length || !query.trim()) {
      return [];
    }

    const topK = options?.topK ?? 5;
    const threshold = options?.threshold ?? 0.7;

    try {
      // Resolve LLM config for embedding
      const llmConfig = await this.llmService.resolveConfig(
        undefined,
        workspaceId,
      );

      // Embed the query
      const embeddings = await this.llmService.embed(llmConfig, [query]);
      const queryEmbedding = embeddings[0];
      const vectorStr = `[${queryEmbedding.join(',')}]`;

      // Vector similarity search
      const results = await this.dataSource.query(
        `SELECT
          dc.id AS "chunkId",
          dc.document_id AS "documentId",
          d.name AS "documentName",
          dc.content,
          dc.metadata,
          1 - (dc.embedding <=> $1::vector) AS score
        FROM document_chunk dc
        JOIN document d ON d.id = dc.document_id
        JOIN knowledge_base kb ON kb.id = d.knowledge_base_id AND kb.workspace_id = $5
        WHERE d.knowledge_base_id = ANY($2::uuid[])
          AND d.embedding_status = 'completed'
          AND dc.embedding IS NOT NULL
          AND 1 - (dc.embedding <=> $1::vector) >= $3
        ORDER BY score DESC
        LIMIT $4`,
        [vectorStr, knowledgeBaseIds, threshold, topK, workspaceId],
      );

      return results.map(
        (r: {
          chunkId: string;
          documentId: string;
          documentName: string;
          content: string;
          score: string;
          metadata: Record<string, unknown>;
        }) => ({
          chunkId: r.chunkId,
          documentId: r.documentId,
          documentName: r.documentName,
          content: r.content,
          score: parseFloat(r.score),
          metadata: r.metadata || {},
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`RAG search failed: ${message}`);
      return [];
    }
  }

  buildContext(results: SearchResult[]): RagContext {
    if (results.length === 0) {
      return { context: '', sources: [] };
    }

    const lines = results.map(
      (r) =>
        `---\n[Source: ${r.documentName}] (relevance: ${r.score.toFixed(2)})\n${r.content}\n`,
    );

    const context = `\n### Relevant Knowledge\n\nThe following information was retrieved from the knowledge base. Use it to inform your response when relevant.\n\n${lines.join('\n')}---`;

    return {
      context,
      sources: results.map((r) => ({
        ...r,
        content:
          r.content.substring(0, 200) + (r.content.length > 200 ? '...' : ''),
      })),
    };
  }
}
