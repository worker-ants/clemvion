import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { IntegrationStatus } from '../../entities/integration.entity';

/** 통합(Integration) 응답 DTO. credentials 필드는 마스킹된 상태로 반환됩니다. */
export class IntegrationDto {
  /** 통합 UUID */
  @ApiProperty({ format: 'uuid' })
  id: string;

  /** 소속 워크스페이스 UUID */
  @ApiProperty({ format: 'uuid' })
  workspaceId: string;

  /** 서비스 타입 (예: slack, notion) */
  @ApiProperty({ example: 'slack' })
  serviceType: string;

  /** 통합 이름 */
  @ApiProperty()
  name: string;

  /** 인증 방식 (예: api_key, oauth2) */
  @ApiProperty({ example: 'oauth2' })
  authType: string;

  /** 마스킹된 자격 증명 객체 */
  @ApiProperty({ type: 'object', additionalProperties: true })
  credentials: Record<string, unknown>;

  /** 범위 (personal | organization) */
  @ApiProperty({ enum: ['personal', 'organization'], example: 'personal' })
  scope: string;

  /**
   * 상태. `pending_install` 은 Cafe24 Private 앱의 OAuth 미완료 상태이며
   * 노드·AI Agent 에서 사용 불가 ([Spec §6](../../2-navigation/4-integration.md#6-상태-전이)).
   */
  @ApiProperty({
    enum: ['connected', 'expired', 'error', 'pending_install'],
    example: 'connected',
  })
  status: IntegrationStatus;

  /** 상태 사유 코드 (snake_case). pending_install + callback 실패 시 `oauth_token_exchange_failed` 등 진단 단서. */
  @ApiPropertyOptional({ nullable: true })
  statusReason?: string | null;

  /** 마지막 에러 요약 `{ code, message, at }`. callback / 노드 실행 실패의 진단 단서. */
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  lastError?: Record<string, unknown> | null;

  /**
   * 자격 증명 복호화 상태. `needs_reauth`는 저장된 envelope을 현재 키로
   * 복호화하지 못한 행이며, UI는 재인증 흐름을 노출해야 한다.
   */
  @ApiProperty({ enum: ['ok', 'needs_reauth'], example: 'ok' })
  credentialsStatus: 'ok' | 'needs_reauth';

  /** 마지막 확인 시각 */
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  lastCheckedAt?: string | null;

  /** 만료 시각 */
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  expiresAt?: string | null;

  /** 생성자 UUID */
  @ApiProperty({ format: 'uuid' })
  createdBy: string;

  /** 생성 시각 */
  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  /** 수정 시각 */
  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}

/** 지원 서비스 카탈로그 엔트리 */
export class ServiceCatalogEntryDto {
  @ApiProperty({ example: 'slack' })
  serviceType: string;

  @ApiProperty({ example: 'Slack' })
  label: string;

  @ApiProperty({ type: [String], example: ['oauth2', 'webhook'] })
  authTypes: string[];

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional({ type: [String] })
  scopes?: string[];
}

/** 서비스 카탈로그 응답 */
export class ServiceCatalogDto {
  @ApiProperty({ type: [ServiceCatalogEntryDto] })
  services: ServiceCatalogEntryDto[];
}

/** MCP `tools/list` 미리보기 — 등록 UI 의 capability 카운트 표시용 */
export class McpConnectionPreviewDto {
  @ApiProperty({ required: false, description: '서버가 노출하는 도구 수' })
  toolCount?: number;

  @ApiProperty({ description: '서버가 resources capability 를 보고했는지' })
  resourceSupported: boolean;

  @ApiProperty({ description: '서버가 prompts capability 를 보고했는지' })
  promptSupported: boolean;
}

/** 자격 증명 사전 검증 결과 */
export class PreviewTestResultDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  /**
   * MCP service_type 한정 — 성공 시 서버가 보고한 capabilities 객체 그대로.
   * 다른 service_type 에서는 생략된다.
   */
  @ApiProperty({
    required: false,
    additionalProperties: true,
    description: 'MCP capabilities (mcp service_type only)',
  })
  capabilities?: Record<string, unknown>;

  /** MCP service_type 한정 — 성공 시 서버 이름·버전 */
  @ApiProperty({
    required: false,
    additionalProperties: true,
    description: 'MCP server identity (mcp service_type only)',
  })
  serverInfo?: { name: string; version: string };

  /** MCP service_type 한정 — 등록 UI 의 capability 미리보기 */
  @ApiProperty({ required: false, type: McpConnectionPreviewDto })
  preview?: McpConnectionPreviewDto;
}

/** OAuth 시작 결과 */
export class OAuthBeginResultDto {
  /** OAuth provider 인증 URL */
  @ApiProperty()
  authorizeUrl: string;

  /** CSRF 방지용 state 토큰 */
  @ApiProperty()
  state: string;
}

/** 사용처 조회 응답 */
export class IntegrationUsageItemDto {
  @ApiProperty({ format: 'uuid' })
  workflowId: string;

  @ApiProperty()
  workflowName: string;

  @ApiProperty({ type: [Object] })
  nodes: Array<{ id: string; label: string; type: string }>;
}

export class IntegrationUsagesDto {
  @ApiProperty({ type: [IntegrationUsageItemDto] })
  usages: IntegrationUsageItemDto[];
}

/** 최근 활동 로그 */
export class IntegrationActivityItemDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ enum: ['success', 'failure'], example: 'success' })
  status: string;

  @ApiPropertyOptional({ nullable: true })
  errorMessage?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  executionId?: string | null;
}

export class IntegrationActivityDto {
  @ApiProperty({ type: [IntegrationActivityItemDto] })
  items: IntegrationActivityItemDto[];

  @ApiProperty({ type: 'object', additionalProperties: true })
  summary: Record<string, unknown>;
}

/** 연결 테스트 결과 */
export class TestConnectionResultDto {
  @ApiProperty()
  success: boolean;

  @ApiPropertyOptional()
  latencyMs?: number;

  @ApiPropertyOptional({ nullable: true })
  message?: string | null;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  meta?: Record<string, unknown>;
}
