import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateWorkspaceDto {
  @ApiProperty({
    example: 'Marketing Team',
    description: '새 워크스페이스 이름 (2~100자)',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name: string;
}
