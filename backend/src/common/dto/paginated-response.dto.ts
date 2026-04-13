import { ApiProperty } from '@nestjs/swagger';

export class PaginationMeta {
  @ApiProperty({ description: '현재 페이지 번호', example: 1 })
  page: number;

  @ApiProperty({ description: '페이지당 항목 수', example: 20 })
  limit: number;

  @ApiProperty({ description: '전체 항목 수', example: 123 })
  totalItems: number;

  @ApiProperty({ description: '전체 페이지 수', example: 7 })
  totalPages: number;
}

export class PaginatedResponseDto<T> {
  @ApiProperty({
    description: '현재 페이지의 데이터 목록',
    isArray: true,
  })
  data: T[];

  @ApiProperty({
    description: '페이지네이션 메타 정보',
    type: () => PaginationMeta,
  })
  pagination: PaginationMeta;

  static create<T>(
    data: T[],
    totalItems: number,
    page: number,
    limit: number,
  ): PaginatedResponseDto<T> {
    const response = new PaginatedResponseDto<T>();
    response.data = data;
    response.pagination = {
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
    };
    return response;
  }
}
