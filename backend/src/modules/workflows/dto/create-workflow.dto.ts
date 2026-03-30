import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateWorkflowDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsUUID()
  folderId?: string;
}
