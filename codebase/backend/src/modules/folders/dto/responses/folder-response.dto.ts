import { ApiProperty } from '@nestjs/swagger';

/** 폴더 응답 DTO */
export class FolderDto {
  /** 폴더 UUID */
  @ApiProperty({ format: 'uuid' })
  id: string;

  /** 소속 워크스페이스 UUID */
  @ApiProperty({ format: 'uuid' })
  workspaceId: string;

  /** 폴더 이름 */
  @ApiProperty({ example: '마케팅' })
  name: string;

  /** 부모 폴더 UUID (루트면 null) */
  // §5.4 기본형 — 키는 모든 응답(생성 포함)에 늘 실리고 루트면 값이 null 이다. `type` 을 적는 것은 `string | null` 의 설계
  // 타입(`Object`)이 플러그인 없는 스키마에서 `type: object` 로 새지 않게 하려는 것이다.
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  parentId: string | null;

  /** 같은 레벨에서의 정렬 순서 */
  @ApiProperty({ example: 0 })
  sortOrder: number;

  /** 생성 시각 */
  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  /** 수정 시각 */
  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}
