import { Injectable, Logger } from '@nestjs/common';
import { IntegrationsService } from '../../integrations/integrations.service';
import { ListIntegrationsQueryDto } from '../../integrations/dto/integration.dto';
import { LlmConfigService } from '../../llm-config/llm-config.service';
import { KnowledgeBaseService } from '../../knowledge-base/knowledge-base.service';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { ExploreToolsService } from './explore-tools.service';
import type {
  CandidateEntry,
  PendingUserConfigField,
} from './detect-pending-user-config';

/**
 * Spec ED-AI-39 (§4.3.1) — Assistant 가 `add_node` / `update_node` 를 실행해
 * 사용자 선택 필드(`integration-selector` · `llm-config-selector` ·
 * `kb-selector` · `workflow-selector` · `mcp-server-selector`) 가 비어있을 때,
 * 워크스페이스에서 후보를 조회해 picker 드롭다운 데이터를 채워 돌려준다.
 *
 * 후보 조회 스코프와 정렬은 spec §4.3.1 표를 그대로 구현한다:
 *   - integration-selector : connected Integration, `integrationServiceType`
 *     힌트가 있으면 해당 service_type 만 필터.
 *   - llm-config-selector  : 워크스페이스 LlmConfig 전체 (최근 수정순).
 *   - kb-selector          : 워크스페이스 KnowledgeBase 전체.
 *   - workflow-selector    : 같은 워크스페이스 워크플로 + 현재 편집 중 워크플로 제외.
 *   - mcp-server-selector  : connected Integration 중 service_type='mcp' 만.
 *
 * 상한은 widget 당 20개. 조회 실패 시 warn 로그 + 빈 배열로 degrade 해서
 * picker 는 "등록된 것이 없음" 으로 동작한다 (리뷰 가드는 candidate 0
 * 에서만 발동하므로 LLM 의 closing mention 은 여전히 올바르게 강제된다).
 */
const MAX_CANDIDATES = 20;

@Injectable()
export class CandidateLookupService {
  private readonly logger = new Logger(CandidateLookupService.name);

  constructor(
    private readonly integrations: IntegrationsService,
    private readonly llmConfigs: LlmConfigService,
    private readonly knowledgeBases: KnowledgeBaseService,
    private readonly exploreTools: ExploreToolsService,
  ) {}

  /**
   * 입력 `pending` 배열의 각 항목에 대해 후보를 조회해 **불변**으로 새 배열을
   * 돌려준다. 원본은 수정하지 않는다.
   */
  async fillCandidates(
    workspaceId: string,
    currentWorkflowId: string,
    pending: PendingUserConfigField[],
  ): Promise<PendingUserConfigField[]> {
    if (pending.length === 0) return [];
    return Promise.all(
      pending.map(async (field) => ({
        ...field,
        candidates: await this.lookup(workspaceId, currentWorkflowId, field),
      })),
    );
  }

  private async lookup(
    workspaceId: string,
    currentWorkflowId: string,
    field: PendingUserConfigField,
  ): Promise<CandidateEntry[]> {
    try {
      switch (field.widget) {
        case 'integration-selector':
          return await this.lookupIntegrations(
            workspaceId,
            field.integrationServiceType,
          );
        case 'llm-config-selector':
          return await this.lookupLlmConfigs(workspaceId);
        case 'kb-selector':
          return await this.lookupKnowledgeBases(workspaceId);
        case 'workflow-selector':
          return await this.lookupWorkflows(workspaceId, currentWorkflowId);
        case 'mcp-server-selector':
          return await this.lookupMcpServers(workspaceId);
        default:
          return [];
      }
    } catch (err) {
      // 조회 실패는 `candidates: []` 로 degrade 해 UI 가 "등록된 것 없음"
      // 상태로 뜬다. review guard 의 PENDING_USER_CONFIG_UNMENTIONED 도
      // 동일 조건에서 발동 — 일시적 DB 장애가 "실제로 리소스 없음" 으로
      // 오해석될 수 있다 (review W-3). 3-state 확장은 후속으로 미루고
      // 지금은 warn 로그에 "review guard 오발동 가능" 시그널을 명시해
      // 운영 모니터링으로 감지 가능하게 한다.
      this.logger.warn(
        `CANDIDATE_LOOKUP_FAILED widget=${field.widget} field=${field.field}: ${
          err instanceof Error ? err.message : String(err)
        } (returning empty candidates — review guard may misfire)`,
      );
      return [];
    }
  }

  private async lookupIntegrations(
    workspaceId: string,
    serviceType?: string,
  ): Promise<CandidateEntry[]> {
    const query: ListIntegrationsQueryDto = {
      page: 1,
      limit: MAX_CANDIDATES,
      status: 'connected',
      // serviceType 은 enum 배열로 받음 (IntegrationsService.findAll 은
      // `IN (:...serviceTypes)` 로 내부 처리). hint 가 없으면 전체 connected.
      ...(serviceType ? { serviceType: [serviceType] } : {}),
    };
    const result = await this.integrations.findAll(workspaceId, query);
    return result.data.slice(0, MAX_CANDIDATES).map((i) => ({
      id: i.id,
      label: i.name,
      sublabel: i.serviceType,
    }));
  }

  private async lookupLlmConfigs(
    workspaceId: string,
  ): Promise<CandidateEntry[]> {
    const query: PaginationQueryDto = {
      page: 1,
      limit: MAX_CANDIDATES,
    };
    const result = await this.llmConfigs.findAll(workspaceId, query);
    return result.data.slice(0, MAX_CANDIDATES).map((cfg) => {
      // LlmConfigService.findAll 의 row 타입이 `Record<string, unknown>` 로
      // 선언되어 있어 필드를 안전하게 해석한다.
      const id = typeof cfg.id === 'string' ? cfg.id : '';
      const label =
        typeof cfg.name === 'string'
          ? cfg.name
          : typeof cfg.provider === 'string'
            ? cfg.provider
            : 'LLM Config';
      const sublabel =
        typeof cfg.defaultModel === 'string'
          ? cfg.defaultModel
          : typeof cfg.model === 'string'
            ? cfg.model
            : undefined;
      return { id, label, sublabel };
    });
  }

  /**
   * MCP 서버는 워크스페이스에 등록된 service_type='mcp' Integration 으로
   * 표현된다 (spec/5-system/11-mcp-client.md). connected 상태만 후보로
   * 노출해 picker 가 "당장 쓸 수 있는" 서버만 보이도록 한다. sublabel 은
   * 표시하지 않음 — 모두 동일하게 'mcp' 라 중복 정보다.
   */
  private async lookupMcpServers(
    workspaceId: string,
  ): Promise<CandidateEntry[]> {
    const query: ListIntegrationsQueryDto = {
      page: 1,
      limit: MAX_CANDIDATES,
      status: 'connected',
      serviceType: ['mcp'],
    };
    const result = await this.integrations.findAll(workspaceId, query);
    return result.data.slice(0, MAX_CANDIDATES).map((i) => ({
      id: i.id,
      label: i.name,
    }));
  }

  private async lookupKnowledgeBases(
    workspaceId: string,
  ): Promise<CandidateEntry[]> {
    const query: PaginationQueryDto = {
      page: 1,
      limit: MAX_CANDIDATES,
    };
    const result = await this.knowledgeBases.findAll(workspaceId, query);
    return result.data.slice(0, MAX_CANDIDATES).map((kb) => ({
      id: kb.id,
      label: kb.name,
    }));
  }

  private async lookupWorkflows(
    workspaceId: string,
    currentWorkflowId: string,
  ): Promise<CandidateEntry[]> {
    // ExploreToolsService.listWorkflows 는 이미 workspace 스코프 +
    // excludeId + limit 옵션을 지원한다. 재사용. 반환 타입이 `unknown`
    // 이라 안전한 type narrowing 으로 items 를 꺼낸다.
    const raw = await this.exploreTools.listWorkflows(workspaceId, {
      limit: MAX_CANDIDATES,
      excludeId: currentWorkflowId,
    });
    const items = extractWorkflowItems(raw);
    return items.slice(0, MAX_CANDIDATES).map((wf) => ({
      id: typeof wf.id === 'string' ? wf.id : '',
      label: typeof wf.name === 'string' ? wf.name : 'Workflow',
      sublabel:
        typeof wf.description === 'string' && wf.description.length > 0
          ? wf.description.slice(0, 60)
          : undefined,
    }));
  }
}

/**
 * `ExploreToolsService.listWorkflows` 의 반환 타입이 `unknown` 이라 items
 * 배열을 꺼낼 때 타입 guard 가 필요하다. 명시적으로 narrowing 해서 lint
 * `no-unsafe-*` 경고를 차단한다.
 */
function extractWorkflowItems(raw: unknown): Array<Record<string, unknown>> {
  if (!raw || typeof raw !== 'object') return [];
  const maybeItems = (raw as { items?: unknown }).items;
  if (!Array.isArray(maybeItems)) return [];
  return maybeItems.filter(
    (entry): entry is Record<string, unknown> =>
      entry !== null && typeof entry === 'object',
  );
}
