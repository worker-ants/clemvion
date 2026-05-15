import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * KB 의 entity_count / relation_count 캐시를 갱신하는 단일 진입점.
 *
 * 기존에는 GraphExtractionService 와 GraphQueryService 에 동일 SQL 사본이 있었고
 * 두 단계(SELECT 후 UPDATE)로 갈라져 비-원자였다. 본 helper 는
 * `UPDATE knowledge_base SET (entity_count, relation_count) = (SELECT COUNT(*) ...)`
 * 단일 atomic SQL 로 캐시를 갱신한다.
 *
 * 호출자는 graph 데이터 변경 직후 (chunk 처리 / entity 삭제 / relation 삭제) 한 번씩 호출.
 *
 * 과거 이 메서드는 `kb:graph_stats_updated` WebSocket 이벤트도 broadcast 했으나,
 * `emitExecutionEvent` 가 채널을 `execution:` prefix 로 변환해 frontend 의 `kb:`
 * 구독에 도달하지 못하는 dead path 였다 (`KbEventType` union 에도 없는 type 을
 * `as never` 로 강제 통과). frontend 는 이미 `document:graph_completed` 수신 시
 * `kb-graph-stats` React Query 를 invalidate 해 통계를 갱신하므로 UX 영향 없음.
 * 자세한 결정 근거는 `plan/complete/kb-graph-stats-dead-path.md` 와
 * `spec/5-system/6-websocket-protocol.md ## Rationale` 참조.
 */
@Injectable()
export class KbStatsHelper {
  constructor(private readonly dataSource: DataSource) {}

  async refresh(knowledgeBaseId: string): Promise<void> {
    await this.dataSource.query(
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
  }
}
