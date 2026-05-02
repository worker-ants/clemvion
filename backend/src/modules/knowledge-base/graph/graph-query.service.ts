import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { KnowledgeBase } from '../entities/knowledge-base.entity';
import { GraphEntity, EntityType } from '../entities/entity.entity';
import { GraphRelation } from '../entities/relation.entity';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto';

const ALLOWED_ENTITY_TYPES: EntityType[] = [
  'person',
  'organization',
  'concept',
  'location',
  'event',
  'other',
];

interface ListEntitiesQuery {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
}

interface ListRelationsQuery {
  page?: number;
  limit?: number;
  search?: string;
}

export interface EntityDetail extends GraphEntity {
  mentionedInChunks: Array<{
    chunkId: string;
    documentId: string;
    documentName: string;
    contentPreview: string;
  }>;
}

export interface GraphVisualizationData {
  nodes: Array<{
    id: string;
    label: string;
    type: string;
    mentionCount: number;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    predicate: string;
    weight: number;
  }>;
  truncated: boolean;
}

@Injectable()
export class GraphQueryService {
  constructor(
    @InjectRepository(KnowledgeBase)
    private readonly kbRepository: Repository<KnowledgeBase>,
    @InjectRepository(GraphEntity)
    private readonly entityRepository: Repository<GraphEntity>,
    @InjectRepository(GraphRelation)
    private readonly relationRepository: Repository<GraphRelation>,
    private readonly dataSource: DataSource,
  ) {}

  private async assertGraphKb(
    kbId: string,
    workspaceId: string,
  ): Promise<KnowledgeBase> {
    const kb = await this.kbRepository.findOne({
      where: { id: kbId, workspaceId },
    });
    if (!kb) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Knowledge base not found',
      });
    }
    if (kb.ragMode !== 'graph') {
      throw new BadRequestException({
        code: 'KB_NOT_GRAPH_MODE',
        message: 'This API is only available for graph-mode knowledge bases',
      });
    }
    return kb;
  }

  async listEntities(
    kbId: string,
    workspaceId: string,
    query: ListEntitiesQuery,
  ): Promise<PaginatedResponseDto<GraphEntity>> {
    await this.assertGraphKb(kbId, workspaceId);
    const { page = 1, limit = 20, search, type } = query;

    const qb = this.entityRepository
      .createQueryBuilder('e')
      .where('e.knowledge_base_id = :kbId', { kbId });

    if (search) {
      qb.andWhere(
        '(e.name ILIKE :search OR e.display_name ILIKE :search)',
        { search: `%${search}%` },
      );
    }
    if (type) {
      if (!ALLOWED_ENTITY_TYPES.includes(type as EntityType)) {
        throw new BadRequestException({
          code: 'INVALID_ENTITY_TYPE',
          message: `type must be one of ${ALLOWED_ENTITY_TYPES.join(', ')}`,
        });
      }
      qb.andWhere('e.type = :type', { type });
    }
    qb.orderBy('e.mention_count', 'DESC').addOrderBy('e.name', 'ASC');

    const totalItems = await qb.getCount();
    const data = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();
    return PaginatedResponseDto.create(data, totalItems, page, limit);
  }

  async getEntityDetail(
    kbId: string,
    entityId: string,
    workspaceId: string,
  ): Promise<EntityDetail> {
    await this.assertGraphKb(kbId, workspaceId);
    const entity = await this.entityRepository.findOne({
      where: { id: entityId, knowledgeBaseId: kbId },
    });
    if (!entity) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Entity not found',
      });
    }
    const chunks = await this.dataSource.query<
      Array<{
        chunkId: string;
        documentId: string;
        documentName: string;
        contentPreview: string;
      }>
    >(
      `SELECT dc.id AS "chunkId",
              dc.document_id AS "documentId",
              d.name AS "documentName",
              SUBSTRING(dc.content FOR 240) AS "contentPreview"
       FROM chunk_entity ce
       JOIN document_chunk dc ON dc.id = ce.chunk_id
       JOIN document d ON d.id = dc.document_id
       WHERE ce.entity_id = $1 AND d.knowledge_base_id = $2
       ORDER BY dc.created_at DESC
       LIMIT 100`,
      [entityId, kbId],
    );
    return { ...entity, mentionedInChunks: chunks };
  }

  async deleteEntity(
    kbId: string,
    entityId: string,
    workspaceId: string,
  ): Promise<void> {
    await this.assertGraphKb(kbId, workspaceId);
    const entity = await this.entityRepository.findOne({
      where: { id: entityId, knowledgeBaseId: kbId },
    });
    if (!entity) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Entity not found',
      });
    }
    await this.entityRepository.remove(entity);
    // 캐시 컬럼 갱신 (relation 도 CASCADE 로 삭제될 수 있어 같이 재계산).
    await this.refreshKbStats(kbId);
  }

  async listRelations(
    kbId: string,
    workspaceId: string,
    query: ListRelationsQuery,
  ): Promise<PaginatedResponseDto<GraphRelation>> {
    await this.assertGraphKb(kbId, workspaceId);
    const { page = 1, limit = 20, search } = query;

    const qb = this.relationRepository
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.headEntity', 'head')
      .leftJoinAndSelect('r.tailEntity', 'tail')
      .where('r.knowledge_base_id = :kbId', { kbId });

    if (search) {
      qb.andWhere(
        '(r.predicate ILIKE :search OR head.name ILIKE :search OR tail.name ILIKE :search)',
        { search: `%${search}%` },
      );
    }
    qb.orderBy('r.weight', 'DESC').addOrderBy('r.predicate', 'ASC');

    const totalItems = await qb.getCount();
    const data = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();
    return PaginatedResponseDto.create(data, totalItems, page, limit);
  }

  async deleteRelation(
    kbId: string,
    relationId: string,
    workspaceId: string,
  ): Promise<void> {
    await this.assertGraphKb(kbId, workspaceId);
    const relation = await this.relationRepository.findOne({
      where: { id: relationId, knowledgeBaseId: kbId },
    });
    if (!relation) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Relation not found',
      });
    }
    await this.relationRepository.remove(relation);
    await this.refreshKbStats(kbId);
  }

  // 상위 mention_count entity 와 그 사이의 relation 만 추려 그래프 시각화에 보낼 페이로드를 만든다.
  // entity 가 너무 많으면 시각화가 무거워지므로 상한(`limit`, default 50, max 200) 으로 자른다.
  // 자른 경우 truncated=true 로 표기해 UI 가 안내할 수 있게 한다.
  async getGraphVisualization(
    kbId: string,
    workspaceId: string,
    rawLimit?: number,
  ): Promise<GraphVisualizationData> {
    await this.assertGraphKb(kbId, workspaceId);
    const limit = Math.min(Math.max(rawLimit ?? 50, 1), 200);

    const entities = await this.entityRepository
      .createQueryBuilder('e')
      .where('e.knowledge_base_id = :kbId', { kbId })
      .orderBy('e.mention_count', 'DESC')
      .addOrderBy('e.name', 'ASC')
      .take(limit + 1)
      .getMany();

    const truncated = entities.length > limit;
    const sliced = truncated ? entities.slice(0, limit) : entities;
    const entityIds = sliced.map((e) => e.id);

    if (entityIds.length === 0) {
      return { nodes: [], edges: [], truncated: false };
    }

    // 양 끝이 모두 selected entity 안에 있는 relation 만 가져온다 (양쪽이 잘려 있으면 의미 없음).
    const relations = await this.dataSource.query<
      Array<{
        id: string;
        head_entity_id: string;
        tail_entity_id: string;
        predicate: string;
        weight: number;
      }>
    >(
      `SELECT id, head_entity_id, tail_entity_id, predicate, weight
       FROM relation
       WHERE knowledge_base_id = $1
         AND head_entity_id = ANY($2::uuid[])
         AND tail_entity_id = ANY($2::uuid[])
       ORDER BY weight DESC`,
      [kbId, entityIds],
    );

    return {
      nodes: sliced.map((e) => ({
        id: e.id,
        label: e.displayName,
        type: e.type,
        mentionCount: e.mentionCount,
      })),
      edges: relations.map((r) => ({
        id: r.id,
        source: r.head_entity_id,
        target: r.tail_entity_id,
        predicate: r.predicate,
        weight: r.weight,
      })),
      truncated,
    };
  }

  // KB 의 entity_count / relation_count 캐시를 실제 COUNT 로 다시 계산.
  // GraphExtractionService 와 동일한 로직 — 별도 서비스가 의존성 없이 호출할 수 있어
  // 본 클래스에 동일 helper 를 둔다.
  private async refreshKbStats(knowledgeBaseId: string): Promise<void> {
    const rows = await this.dataSource.query<
      { entity_count: number; relation_count: number }[]
    >(
      `SELECT
         (SELECT COUNT(*)::int FROM entity WHERE knowledge_base_id = $1) AS entity_count,
         (SELECT COUNT(*)::int FROM relation WHERE knowledge_base_id = $1) AS relation_count`,
      [knowledgeBaseId],
    );
    const entityCount = rows[0]?.entity_count ?? 0;
    const relationCount = rows[0]?.relation_count ?? 0;
    await this.dataSource.query(
      `UPDATE knowledge_base SET entity_count = $1, relation_count = $2 WHERE id = $3`,
      [entityCount, relationCount, knowledgeBaseId],
    );
  }
}

