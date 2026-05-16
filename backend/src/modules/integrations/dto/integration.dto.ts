import {
  IsString,
  IsOptional,
  IsIn,
  IsObject,
  IsArray,
  ArrayUnique,
  IsNotEmpty,
  IsInt,
  Matches,
  Max,
  MaxLength,
  MinLength,
  Min,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

// Filter parameter values accepted by GET /api/integrations#status.
// Includes two virtual filter values (spec/2-navigation/4-integration.md
// §2.3 + §9.1 + Rationale "Attention 가상 필터값"):
//   - `expiring`  = status='connected' AND token_expires_at within 7d
//   - `attention` = Expired ∪ Expiring ∪ Error (single chip surface)
// Neither exists in the Integration.status DB enum.
export const INTEGRATION_STATUSES = [
  'connected',
  'expiring',
  'expired',
  'error',
  'attention',
] as const;
export type IntegrationStatusFilter = (typeof INTEGRATION_STATUSES)[number];

export class ListIntegrationsQueryDto extends PaginationQueryDto {
  /** 통합 이름 또는 서비스 타입에 대한 검색어 */
  @ApiPropertyOptional({
    description: '통합 이름 또는 서비스 타입 검색어 (부분 일치)',
    example: 'google',
  })
  @IsOptional()
  @IsString()
  q?: string;

  /** 조회 범위 (개인 / 조직 / 전체) */
  @ApiPropertyOptional({
    description: '조회 범위. personal=개인, organization=조직, all=전체',
    enum: ['personal', 'organization', 'all'],
    example: 'all',
  })
  @IsOptional()
  @IsIn(['personal', 'organization', 'all'])
  scope?: 'personal' | 'organization' | 'all';

  /**
   * 서비스 타입 필터. 단일 값 또는 복수 값(`?serviceType=google&serviceType=github`)을 모두 지원하며 항상 배열로 정규화됩니다.
   */
  @ApiPropertyOptional({
    description:
      '서비스 타입 필터. 단일/복수 값을 모두 허용하며 내부적으로 배열로 정규화됩니다.',
    type: [String],
    example: ['google', 'github'],
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value) ? (value as string[]) : [value as string],
  )
  @IsArray()
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  serviceType?: string[];

  /** 통합 상태 필터 */
  @ApiPropertyOptional({
    description:
      '통합 상태 필터. connected=정상, expiring=만료 임박(가상), expired=만료, error=오류, attention=주의 필요(가상 — expired ∪ expiring ∪ error). expiring/attention 은 DB Enum 에 없는 가상 필터값으로 서버에서 합집합 WHERE 절로 변환된다 (spec §9.1).',
    enum: INTEGRATION_STATUSES,
    example: 'attention',
  })
  @IsOptional()
  @IsIn(INTEGRATION_STATUSES)
  status?: IntegrationStatusFilter;
}

export class CreateIntegrationDto {
  /** 통합 서비스 타입 (예: google, github) */
  @ApiProperty({
    description: '통합 서비스 타입 식별자',
    example: 'google',
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  serviceType: string;

  /** 통합 표시 이름 */
  @ApiProperty({
    description: '통합 표시 이름 (사용자 구분용)',
    example: 'Marketing Google',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  /** 인증 방식 (oauth2, api_key 등) */
  @ApiProperty({
    description: '인증 방식. oauth2, api_key, basic 등',
    example: 'oauth2',
    maxLength: 20,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  authType: string;

  /** 자격 증명 객체 (API Key, 토큰 등). 서비스 레지스트리 스키마에 따라 검증됨 */
  @ApiPropertyOptional({
    description:
      '자격 증명 정보. authType에 따라 요구 필드가 달라지며 서비스 레지스트리로 검증됩니다.',
    type: 'object',
    additionalProperties: true,
    example: { apiKey: 'sk-xxxx' },
  })
  @IsOptional()
  @IsObject()
  credentials?: Record<string, unknown>;

  /** 통합 범위. 개인(personal) 또는 조직(organization) */
  @ApiPropertyOptional({
    description: '통합 범위. personal=개인, organization=조직',
    enum: ['personal', 'organization'],
    example: 'personal',
  })
  @IsOptional()
  @IsIn(['personal', 'organization'])
  scope?: 'personal' | 'organization';

  /** OAuth preview 플로우에서 발급된 토큰. 값이 있으면 서버가 credentials 대신 토큰을 소비함 */
  @ApiPropertyOptional({
    description:
      'OAuth preview 플로우에서 발급된 단기 토큰. 전달 시 credentials 대신 토큰을 사용해 자격 증명을 구성합니다.',
    example: 'prev_01HABCD...',
  })
  @IsOptional()
  @IsString()
  previewToken?: string;
}

export class PreviewTestDto {
  /** 통합 서비스 타입 */
  @ApiProperty({
    description: '통합 서비스 타입',
    example: 'http',
  })
  @IsString()
  @IsNotEmpty()
  serviceType: string;

  /** 인증 방식 */
  @ApiProperty({
    description: '인증 방식',
    example: 'api_key',
  })
  @IsString()
  @IsNotEmpty()
  authType: string;

  /** 검증 대상 자격 증명 */
  @ApiProperty({
    description:
      '검증 대상 자격 증명. 실제 외부 호출은 하지 않고 구조적 유효성만 확인합니다.',
    type: 'object',
    additionalProperties: true,
    example: { apiKey: 'sk-test-xxxx' },
  })
  @IsObject()
  credentials: Record<string, unknown>;
}

export class OAuthBeginDto {
  /** OAuth 대상 서비스 */
  @ApiProperty({
    description: 'OAuth 인증을 시작할 서비스 식별자',
    example: 'google',
  })
  @IsString()
  @IsNotEmpty()
  service: string;

  /** 요청할 OAuth 스코프 목록 */
  @ApiProperty({
    description: '요청할 OAuth 스코프 목록',
    type: [String],
    example: ['https://www.googleapis.com/auth/gmail.readonly'],
  })
  @IsArray()
  @IsString({ each: true })
  @MaxLength(128, { each: true })
  scopes: string[];

  /**
   * OAuth 시작 모드.
   * `request-scopes`(spec 표기)와 `request_scopes`(레거시 표기)를 모두 허용하며 내부적으로 `request_scopes`로 정규화됩니다.
   */
  @ApiProperty({
    description:
      'OAuth 시작 모드. new=신규 연결, reauthorize=재인증, request_scopes/request-scopes=스코프 추가 요청',
    enum: ['new', 'reauthorize', 'request_scopes', 'request-scopes'],
    example: 'new',
  })
  @IsIn(['new', 'reauthorize', 'request_scopes', 'request-scopes'])
  mode: 'new' | 'reauthorize' | 'request_scopes' | 'request-scopes';

  /** reauthorize / request_scopes 모드에서 지정하는 기존 통합 ID */
  @ApiPropertyOptional({
    description:
      'reauthorize 또는 request_scopes 모드에서 지정하는 기존 통합 ID',
    format: 'uuid',
  })
  @IsOptional()
  @IsString()
  integrationId?: string;

  /** new 모드에서 사용할 통합 이름 */
  @ApiPropertyOptional({
    description: 'new 모드에서 새로 생성될 통합의 표시 이름',
    example: 'My Google Account',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  integrationName?: string;

  /** 통합 범위 */
  @ApiPropertyOptional({
    description: '통합 범위. personal=개인, organization=조직',
    enum: ['personal', 'organization'],
    example: 'personal',
  })
  @IsOptional()
  @IsIn(['personal', 'organization'])
  scope?: 'personal' | 'organization';

  /**
   * Cafe24 한정: 쇼핑몰 식별자 (`https://{mall_id}.cafe24api.com`).
   * Validation `/^[a-z0-9-]{3,50}$/` — SSRF 방어 + Cafe24 mall_id 규약.
   */
  @ApiPropertyOptional({
    description:
      'Cafe24 mall_id (base/authorize URL 의 일부). cafe24 한정 필수',
    example: 'myshop',
    pattern: '^[a-z0-9-]{3,50}$',
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  // Pattern enforces SSRF defence: mall_id is interpolated directly into
  // https://{mall_id}.cafe24api.com, so reject anything outside the
  // Cafe24 mall identifier alphabet. Mirrors the regex in
  // IntegrationOAuthService.CAFE24_MALL_ID_PATTERN.
  @Matches(/^[a-z0-9-]{3,50}$/, {
    message:
      'mallId must match /^[a-z0-9-]{3,50}$/ — lowercase letters, digits, and hyphens only',
  })
  mallId?: string;

  /** Cafe24 한정: 앱 발급 형태 (public=앱스토어 / private=자체) */
  @ApiPropertyOptional({
    description: 'Cafe24 앱 발급 형태. cafe24 한정 필수',
    enum: ['public', 'private'],
    example: 'public',
  })
  @IsOptional()
  @IsIn(['public', 'private'])
  appType?: 'public' | 'private';

  /** Cafe24 private 앱 한정: OAuth client_id (사용자 자체 발급) */
  @ApiPropertyOptional({
    description: 'Cafe24 private 앱의 OAuth client_id (app_type=private 한정)',
    maxLength: 128,
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  // Printable ASCII only — defence against CRLF / control-char injection
  // into the eventual HTTP Basic auth header (Authorization: Basic …).
  @Matches(/^[\x20-\x7E]+$/, {
    message: 'clientId must contain only printable ASCII characters',
  })
  clientId?: string;

  /** Cafe24 private 앱 한정: OAuth client_secret */
  @ApiPropertyOptional({
    description:
      'Cafe24 private 앱의 OAuth client_secret (app_type=private 한정)',
    maxLength: 256,
  })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  // Same printable-ASCII guard as clientId — header injection defence.
  @Matches(/^[\x20-\x7E]+$/, {
    message: 'clientSecret must contain only printable ASCII characters',
  })
  clientSecret?: string;
}

export class UpdateIntegrationDto {
  /** 변경할 통합 표시 이름 */
  @ApiPropertyOptional({
    description: '변경할 통합 표시 이름',
    example: 'Team Google (renamed)',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;
}

export class RotateCredentialsDto {
  /** 교체할 새 자격 증명 */
  @ApiProperty({
    description: '교체할 새 자격 증명. 기존 값은 대체됩니다.',
    type: 'object',
    additionalProperties: true,
    example: { apiKey: 'sk-new-xxxx' },
  })
  @IsObject()
  credentials: Record<string, unknown>;
}

export class RequestScopesDto {
  /** 추가 요청할 스코프 목록 (중복 불가) */
  @ApiProperty({
    description: '추가로 요청할 OAuth 스코프 목록. 중복 불가.',
    type: [String],
    example: ['https://www.googleapis.com/auth/drive.file'],
  })
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  scopes: string[];
}

export class UpdateScopeDto {
  /** 변경할 통합 범위 */
  @ApiProperty({
    description: '변경할 통합 범위. personal=개인, organization=조직',
    enum: ['personal', 'organization'],
    example: 'organization',
  })
  @IsIn(['personal', 'organization'])
  scope: 'personal' | 'organization';
}

export class ActivityQueryDto {
  /** 반환할 최근 활동 로그 개수 (1~100) */
  @ApiPropertyOptional({
    description: '반환할 최근 활동 로그 개수',
    minimum: 1,
    maximum: 100,
    default: 20,
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  /** 조회할 기간 (1~30일) */
  @ApiPropertyOptional({
    description: '조회할 활동 기간(일)',
    minimum: 1,
    maximum: 30,
    default: 7,
    example: 7,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  days?: number;
}

/**
 * Cafe24 mall_id 사전 중복 감지 query.
 *
 * 프론트엔드가 `/integrations/new` 의 cafe24 step 에서 mall_id 입력 시점에
 * debounce 호출. 같은 워크스페이스에 이미 같은 mall 의 cafe24 통합이 있는지
 * 확인해 inline 경고 배너를 띄운다. begin 단계 사전 가드와 동일 SELECT 를
 * 노출하므로 throttle (분당 60회) 로 brute-force enumeration 차단.
 */
export class Cafe24PrecheckQueryDto {
  @ApiProperty({
    description:
      'Cafe24 mall identifier — lowercase letters / digits / hyphens, 3–50자',
    example: 'myshop',
    pattern: '^[a-z0-9-]{3,50}$',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  // SSRF 방어와 begin DTO 와 동일한 정규식을 사용.
  // CAFE24_MALL_ID_PATTERN = /^[a-z0-9-]{3,50}$/
  @Matches(/^[a-z0-9-]{3,50}$/, {
    message:
      'mallId must match /^[a-z0-9-]{3,50}$/ — lowercase letters, digits, and hyphens only',
  })
  mallId!: string;
}
