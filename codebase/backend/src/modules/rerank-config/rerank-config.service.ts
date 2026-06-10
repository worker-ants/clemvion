import { Injectable } from '@nestjs/common';
import { ModelConfigService } from '../model-config/model-config.service';
import { ModelConfig } from '../model-config/entities/model-config.entity';
import { CreateRerankConfigDto } from './dto/create-rerank-config.dto';
import { UpdateRerankConfigDto } from './dto/update-rerank-config.dto';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

/**
 * DEPRECATED — 리랭커 설정은 통합 ModelConfig(kind='rerank') 로 흡수됐다.
 * 본 서비스는 기존 소비자(rerank.service·구 /rerank-configs 컨트롤러)의 무변경을 위한
 * thin alias 로, 모든 호출을 kind='rerank' 로 ModelConfigService 에 위임한다.
 * PR4 에서 제거 예정. (spec/2-navigation/6-config.md Part B.6)
 */
@Injectable()
export class RerankConfigService {
  constructor(private readonly modelConfigService: ModelConfigService) {}

  findAll(
    workspaceId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<Record<string, unknown>>> {
    return this.modelConfigService.findAll(workspaceId, 'rerank', query);
  }

  findById(id: string, workspaceId: string): Promise<Record<string, unknown>> {
    return this.modelConfigService.findById(id, workspaceId);
  }

  findEntity(id: string, workspaceId: string): Promise<ModelConfig> {
    return this.modelConfigService.findEntity(id, workspaceId);
  }

  findDefault(workspaceId: string): Promise<ModelConfig | null> {
    return this.modelConfigService.findDefault(workspaceId, 'rerank');
  }

  /** RAG 리랭킹에서 사용할 rerank ModelConfig 해석 (없으면 throw). */
  resolveConfig(
    rerankConfigId: string | undefined,
    workspaceId: string,
  ): Promise<ModelConfig> {
    return this.modelConfigService.resolveConfig(
      rerankConfigId,
      workspaceId,
      'rerank',
    );
  }

  create(
    workspaceId: string,
    dto: CreateRerankConfigDto,
  ): Promise<Record<string, unknown>> {
    return this.modelConfigService.create(workspaceId, 'rerank', {
      ...dto,
      kind: 'rerank',
    });
  }

  update(
    id: string,
    workspaceId: string,
    dto: UpdateRerankConfigDto,
  ): Promise<Record<string, unknown>> {
    return this.modelConfigService.update(id, workspaceId, dto);
  }

  setDefault(id: string, workspaceId: string): Promise<void> {
    return this.modelConfigService.setDefault(id, workspaceId);
  }

  remove(id: string, workspaceId: string): Promise<void> {
    return this.modelConfigService.remove(id, workspaceId);
  }

  /** rerank apiKey 는 tei/local 셀프호스팅에서 null 일 수 있다. */
  getDecryptedApiKey(config: ModelConfig): string | null {
    return this.modelConfigService.getDecryptedApiKey(config);
  }
}
