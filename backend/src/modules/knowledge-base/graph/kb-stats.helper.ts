import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { WebsocketService } from '../../websocket/websocket.service';

/**
 * KB 의 entity_count / relation_count 캐시를 갱신하는 단일 진입점.
 *
 * 기존에는 GraphExtractionService 와 GraphQueryService 에 동일 SQL 사본이 있었고
 * 두 단계(SELECT 후 UPDATE)로 갈라져 비-원자였다. 본 helper 가:
 *
 *   1) `UPDATE knowledge_base SET (entity_count, relation_count) = (SELECT COUNT(*) ...)`
 *      단일 atomic SQL 로 캐시를 갱신
 *   2) 새 카운트를 RETURNING 으로 받아 WebSocket 으로 emit
 *
 * 호출자는 graph 데이터 변경 직후 (chunk 처리 / entity 삭제 / relation 삭제) 한 번씩 호출.
 */
@Injectable()
export class KbStatsHelper {
  constructor(
    private readonly dataSource: DataSource,
    private readonly websocketService: WebsocketService,
  ) {}

  async refresh(knowledgeBaseId: string): Promise<void> {
    const rows = await this.dataSource.query<
      { entity_count: number; relation_count: number }[]
    >(
      `UPDATE knowledge_base
         SET entity_count = (
               SELECT COUNT(*)::int FROM entity WHERE knowledge_base_id = $1
             ),
             relation_count = (
               SELECT COUNT(*)::int FROM relation WHERE knowledge_base_id = $1
             )
       WHERE id = $1
       RETURNING entity_count, relation_count`,
      [knowledgeBaseId],
    );
    const entityCount = rows[0]?.entity_count ?? 0;
    const relationCount = rows[0]?.relation_count ?? 0;
    try {
      this.websocketService.emitExecutionEvent(
        `kb:${knowledgeBaseId}`,
        'kb:graph_stats_updated' as never,
        { knowledgeBaseId, entityCount, relationCount },
      );
    } catch {
      // best-effort
    }
  }
}
