/**
 * 백엔드 `PaginatedResponseDto<T>` (api-convention §5.2) 정규화 유틸.
 *
 * 표준 응답:
 * ```
 * { data: T[], pagination: { page, limit, totalItems, totalPages } }
 * ```
 *
 * 이 유틸은 표준 형식과, 일부 레거시 엔드포인트에서 만날 수 있는 bare-array
 * (`T[]`) 형식까지 모두 안전하게 처리한다. `pagination` 메타가 없을 때는
 * `totalPages = 1` 로 폴백 — 마지막 페이지에서 partial(예: 5/20) 응답이
 * 와도 `Math.ceil(items.length / pageSize) = 1` 처럼 실제로는 여러 페이지가
 * 있는데 한 페이지로 잘못 인식되는 사일런트 페일을 방지한다.
 */
export interface PagedResult<T> {
  items: T[];
  page: number;
  totalItems: number;
  totalPages: number;
}

interface RawPaginatedShape {
  data?: unknown;
  pagination?: {
    page?: number;
    limit?: number;
    totalItems?: number;
    totalPages?: number;
  };
}

export function normalizePagedResponse<T>(
  body: unknown,
  fallbackPage = 1,
): PagedResult<T> {
  if (Array.isArray(body)) {
    const items = body as T[];
    return {
      items,
      page: fallbackPage,
      totalItems: items.length,
      totalPages: 1,
    };
  }
  const obj = (body ?? {}) as RawPaginatedShape;
  const items: T[] = Array.isArray(obj.data) ? (obj.data as T[]) : [];
  const page = obj.pagination?.page ?? fallbackPage;
  const totalItems = obj.pagination?.totalItems ?? items.length;
  // When the server omits pagination metadata altogether, default to 1 page —
  // computing from `items.length / pageSize` would clamp legit multi-page lists
  // to 1 on the last (partial) page.
  const totalPages = obj.pagination?.totalPages ?? 1;
  return { items, page, totalItems, totalPages };
}
