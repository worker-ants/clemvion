import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsString, Matches, MaxLength } from 'class-validator';

export class UpdateWorkspaceSettingsDto {
  @ApiProperty({
    type: [String],
    example: ['https://example.com', 'https://shop.example.com'],
    description:
      '외부 상호작용을 허용할 origin 목록 (scheme://host[:port] 형식, path/query/fragment 불가). 빈 배열은 모든 origin 차단을 의미합니다.',
  })
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(2048, { each: true })
  @Matches(/^https?:\/\/[^/\s?#]+$/i, {
    each: true,
    message: 'origin must be scheme://host[:port] with no path/query',
  })
  interactionAllowedOrigins: string[];
}
