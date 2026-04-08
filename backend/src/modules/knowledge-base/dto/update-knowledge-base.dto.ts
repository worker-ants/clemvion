import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';

export class UpdateKnowledgeBaseDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(8000)
  chunkSize?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2000)
  chunkOverlap?: number;
}
