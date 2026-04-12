import {
  IsString,
  IsOptional,
  IsIn,
  IsObject,
  IsArray,
  ArrayUnique,
  IsNotEmpty,
  IsInt,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export const INTEGRATION_STATUSES = [
  'connected',
  'expiring',
  'expired',
  'error',
] as const;
export type IntegrationStatusFilter = (typeof INTEGRATION_STATUSES)[number];

export class ListIntegrationsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn(['personal', 'organization', 'all'])
  scope?: 'personal' | 'organization' | 'all';

  /**
   * Accepts repeated `serviceType` query params (`?serviceType=slack&serviceType=google`)
   * as well as a single value (`?serviceType=slack`). Always normalized to an array.
   */
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  serviceType?: string[];

  @IsOptional()
  @IsIn(INTEGRATION_STATUSES as unknown as string[])
  status?: IntegrationStatusFilter;
}

export class CreateIntegrationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  serviceType: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  authType: string;

  @IsOptional()
  @IsObject()
  credentials?: Record<string, unknown>;

  @IsOptional()
  @IsIn(['personal', 'organization'])
  scope?: 'personal' | 'organization';

  /** When provided, server consumes the OAuth preview token for credentials. */
  @IsOptional()
  @IsString()
  previewToken?: string;
}

export class PreviewTestDto {
  @IsString()
  @IsNotEmpty()
  serviceType: string;

  @IsString()
  @IsNotEmpty()
  authType: string;

  @IsObject()
  credentials: Record<string, unknown>;
}

export class OAuthBeginDto {
  @IsString()
  @IsNotEmpty()
  service: string;

  @IsArray()
  @IsString({ each: true })
  @MaxLength(128, { each: true })
  scopes: string[];

  /**
   * Accepts both `request-scopes` (spec form) and `request_scopes` (legacy)
   * to keep older clients working. Normalized to `request_scopes` downstream.
   */
  @IsIn(['new', 'reauthorize', 'request_scopes', 'request-scopes'])
  mode: 'new' | 'reauthorize' | 'request_scopes' | 'request-scopes';

  @IsOptional()
  @IsString()
  integrationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  integrationName?: string;

  @IsOptional()
  @IsIn(['personal', 'organization'])
  scope?: 'personal' | 'organization';
}

export class UpdateIntegrationDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;
}

export class RotateCredentialsDto {
  @IsObject()
  credentials: Record<string, unknown>;
}

export class RequestScopesDto {
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  scopes: string[];
}

export class UpdateScopeDto {
  @IsIn(['personal', 'organization'])
  scope: 'personal' | 'organization';
}

export class ActivityQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  days?: number;
}
