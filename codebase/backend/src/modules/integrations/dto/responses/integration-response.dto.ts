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

  /** 마지막 에러 요약. callback / 노드 실행 실패의 진단 단서. */
  @ApiPropertyOptional({
    type: 'object',
    nullable: true,
    properties: {
      code: { type: 'string', description: 'UPPER_SNAKE_CASE 에러 코드' },
      message: { type: 'string', description: '사람 친화 메시지' },
      at: { type: 'string', format: 'date-time' },
    },
  })
  lastError?: { code?: string; message?: string; at?: string } | null;

  /**
   * Safe-to-expose hints derived from credentials. Frontend must use these
   * instead of `credentials.*` for flow gating — only `meta.appType` is
   * populated today, used to decide Reauthorize button visibility for
   * Cafe24 Private apps (which have no reauthorize entry point).
   */
  @ApiProperty({
    type: 'object',
    properties: {
      appType: {
        type: 'string',
        enum: ['public', 'private'],
        nullable: true,
      },
    },
  })
  meta: { appType: 'public' | 'private' | null };

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

  /**
   * 자동 갱신 가능 통합 식별자 (derived 가상 필드, DB 컬럼 아님).
   * `ServiceDefinition.supportsTokenAutoRefresh` (service registry)
   * 에서 매 응답 시점에 계산. 현재 cafe24·google 만 true,
   * github (Refresh ✗) 포함 그 외는 false.
   * UI 의 attention/expiring 술어 제외, 상세 페이지 헤더의 "Auto-renews"
   * 보조 라벨, Reauthorize hover 안내 분기 신호로 사용된다.
   * spec/2-navigation/4-integration.md §9.1 + Rationale "자동 갱신 통합을
   * attention 술어에서 제외 (2026-05-17)".
   */
  @ApiProperty({ type: 'boolean', example: true })
  autoRefresh: boolean;
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

/**
 * 통합별 API operation 카탈로그 한 행. SoT:
 * `spec/conventions/cafe24-api-metadata.md §7.5` + 통합 spec §9.3.
 * `key` 는 활동 로그 `api_label` 의 join key (cafe24 의 경우
 * `cafe24.<resource>.<operation>`). `labelKey`/`descriptionKey` 는
 * frontend i18n dict 의 lookup key — 백엔드는 i18n 결과를 직접 반환하지
 * 않는다 (UI 언어 변경 시 stale 회귀 방지).
 */
export class OperationCatalogEntryDto {
  @ApiProperty({ example: 'cafe24.order.order_list' })
  key: string;

  @ApiProperty({ example: 'GET' })
  method: string;

  @ApiProperty({ example: '/admin/orders' })
  path: string;

  @ApiProperty({ example: 'cafe24.order.order_list' })
  labelKey: string;

  @ApiProperty({ example: 'cafe24.order.order_list.description', required: false })
  descriptionKey?: string;
}

/**
 * `GET /api/integrations/services/:type/catalog` 응답 shape.
 * 기존 `ServiceCatalogDto` (서비스 종류 목록) 와 명확히 구분되도록 `Operation`
 * 접두 — 이 카탈로그는 "특정 서비스 타입이 노출하는 operation 목록".
 * 초기엔 cafe24 만 채워 반환하고 다른 서비스는 빈 배열.
 */
export class OperationCatalogDto {
  @ApiProperty({ type: [OperationCatalogEntryDto] })
  operations: OperationCatalogEntryDto[];
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

/**
 * OAuth 시작 결과 — 두 가지 분기.
 *
 * 1. 일반 흐름 (google/github/cafe24 Public): `OAuthBeginPopupResultDto`
 *    = `{ authUrl, state }`. 사용자 브라우저를 authorize URL 로 보낸다.
 * 2. Cafe24 Private 흐름: `OAuthBeginCafe24PendingResultDto`
 *    = `{ mode: 'cafe24_private_pending', integrationId, appUrl,
 *    callbackUrl, scopesAdded? }`. Cafe24 가 OAuth flow 를 시작하므로
 *    우리는 사용자에게 등록할 URL 만 반환.
 *
 * Swagger 표현 — 두 분기를 명시적으로 보여주기 위해 controller 가
 * `ApiOkWrappedOneOfResponse([Popup, Cafe24Pending], ...)` 를 사용해
 * `data: oneOf` 스키마로 문서화한다. spec/2-navigation/4-integration.md
 * §9.2.
 */
export class OAuthBeginPopupResultDto {
  /** OAuth provider 인증 URL. 사용자 브라우저를 이 URL 로 redirect. */
  @ApiProperty({ description: 'OAuth provider 인증 URL' })
  authUrl!: string;

  /** CSRF 방지용 state 토큰. */
  @ApiProperty({ description: 'CSRF 방지용 state 토큰' })
  state!: string;
}

export class OAuthBeginCafe24PendingResultDto {
  /** 분기 식별자 — Cafe24 Private 앱 install 흐름. */
  @ApiProperty({
    enum: ['cafe24_private_pending'],
    description:
      'Cafe24 Private 앱 install 흐름. 일반 흐름에서는 본 DTO 가 아닌 OAuthBeginPopupResultDto 가 반환된다.',
  })
  mode!: 'cafe24_private_pending';

  /** 새로 생성된 pending_install integration ID. */
  @ApiProperty({ format: 'uuid' })
  integrationId!: string;

  /**
   * 사용자가 Cafe24 Developers 의 "App URL" 에 등록할 URL.
   * Cafe24 "테스트 실행" 이 이 URL 을 호출.
   */
  @ApiProperty({ description: 'Cafe24 Developers "App URL" 등록용 URL' })
  appUrl!: string;

  /**
   * 사용자가 Cafe24 Developers 의 "Redirect URI" 에 등록할 URL.
   * OAuth authorize 후 Cafe24 가 이 URL 로 redirect.
   */
  @ApiProperty({ description: 'Cafe24 Developers Redirect URI 등록용 URL' })
  callbackUrl!: string;

  /**
   * request-scopes 진입점에서 scopes 가 변경된 경우의 추가 분량.
   * `request_scopes` mode 에서만 채워진다.
   */
  @ApiProperty({ required: false, type: [String] })
  scopesAdded?: string[];
}

/**
 * Cafe24 mall_id 사전 중복 감지 응답.
 *
 * 프론트엔드가 mall_id 입력 시점에 350ms debounce 로 호출해 inline 경고
 * 배너를 띄우는 read-only endpoint. 동일 (workspaceId, mall_id) cafe24 row 의
 * 상태를 가장 제한적인 것부터 (`connected > pending_install > error > expired`)
 * 반환. 인증 정보 누설 방지를 위해 (id, name, status) 만 노출 — 자격 증명·
 * 토큰·timestamps 비포함. spec/2-navigation/4-integration.md §9.2 Rationale
 * "precheck endpoint — mall_id 입력 단계 사전 감지 UX".
 */
export class Cafe24PrecheckResultDto {
  @ApiProperty({
    description:
      '동일 (workspaceId, mall_id) cafe24 통합이 이미 존재하면 true. false 면 begin 호출이 안전.',
  })
  conflict!: boolean;

  @ApiPropertyOptional({
    format: 'uuid',
    description: '충돌 대상 통합의 UUID. conflict=true 일 때만 채워진다.',
  })
  existingIntegrationId?: string;

  @ApiPropertyOptional({
    description: '충돌 대상 통합의 표시 이름. conflict=true 일 때만 채워진다.',
  })
  existingName?: string;

  @ApiPropertyOptional({
    enum: ['connected', 'pending_install', 'expired', 'error'],
    description:
      '충돌 대상 통합의 현재 상태. 프론트엔드 inline 안내 메시지 분기 기준.',
  })
  status?: 'connected' | 'pending_install' | 'expired' | 'error';
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
