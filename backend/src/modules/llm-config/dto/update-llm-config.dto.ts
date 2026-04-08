import {
  IsString,
  IsOptional,
  IsBoolean,
  IsIn,
  IsObject,
  MaxLength,
} from 'class-validator';

export class UpdateLlmConfigDto {
  @IsOptional()
  @IsIn(['openai', 'anthropic', 'google', 'azure', 'local'])
  provider?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  apiKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  baseUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  defaultModel?: string;

  @IsOptional()
  @IsObject()
  defaultParams?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
