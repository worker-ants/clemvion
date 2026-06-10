import { Injectable } from '@nestjs/common';
import { ModelConfigService } from '../model-config/model-config.service';
import { ModelConfig } from '../model-config/entities/model-config.entity';
import { CreateLlmConfigDto } from './dto/create-llm-config.dto';
import { UpdateLlmConfigDto } from './dto/update-llm-config.dto';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

/**
 * @deprecated — PR4(plan/in-progress/unified-model-management.md) 에서 제거 예정.
 * chat 모델 설정은 통합 ModelConfig(kind='chat') 로 흡수됐다.
 * 본 서비스는 기존 소비자(llm.service·candidate-lookup·workflows·구 /llm-configs
 * 컨트롤러)의 무변경을 위한 thin alias 로, 모든 호출을 kind='chat' 로 ModelConfigService
 * 에 위임한다. (spec/2-navigation/6-config.md Part B)
 */
@Injectable()
export class LlmConfigService {
  constructor(private readonly modelConfigService: ModelConfigService) {}

  findAll(
    workspaceId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<Record<string, unknown>>> {
    return this.modelConfigService.findAll(workspaceId, 'chat', query);
  }

  findById(id: string, workspaceId: string): Promise<Record<string, unknown>> {
    // Pass expectedKind to prevent cross-kind leak via deprecated /api/llm-configs
    return this.modelConfigService.findById(id, workspaceId, 'chat');
  }

  findEntity(id: string, workspaceId: string): Promise<ModelConfig> {
    return this.modelConfigService.findEntity(id, workspaceId, 'chat');
  }

  findDefault(workspaceId: string): Promise<ModelConfig | null> {
    return this.modelConfigService.findDefault(workspaceId, 'chat');
  }

  create(
    workspaceId: string,
    dto: CreateLlmConfigDto,
  ): Promise<Record<string, unknown>> {
    return this.modelConfigService.create(workspaceId, 'chat', {
      ...dto,
      kind: 'chat',
    });
  }

  update(
    id: string,
    workspaceId: string,
    dto: UpdateLlmConfigDto,
  ): Promise<Record<string, unknown>> {
    return this.modelConfigService.update(id, workspaceId, dto, 'chat');
  }

  setDefault(id: string, workspaceId: string): Promise<void> {
    return this.modelConfigService.setDefault(id, workspaceId, 'chat');
  }

  remove(id: string, workspaceId: string): Promise<void> {
    return this.modelConfigService.remove(id, workspaceId, 'chat');
  }

  /** chat config 는 항상 api_key 를 가지므로 평문 문자열 반환(없으면 빈 문자열). */
  getDecryptedApiKey(config: ModelConfig): string {
    return this.modelConfigService.getDecryptedApiKey(config) ?? '';
  }
}
