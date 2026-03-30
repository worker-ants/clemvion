export class PaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export class PaginatedResponseDto<T> {
  data: T[];
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
