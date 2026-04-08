import {
  IsString,
  IsOptional,
  IsBoolean,
  IsIn,
  IsObject,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';

export class CreateLlmConfigDto {
  @IsIn(['openai', 'anthropic', 'google', 'azure', 'local'])
  provider: string;

  @IsString()
  @MaxLength(255)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  apiKey: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  baseUrl?: string;

  @IsString()
  @MaxLength(100)
  defaultModel: string;

  @IsOptional()
  @IsObject()
  defaultParams?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
