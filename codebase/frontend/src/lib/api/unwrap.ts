import type { AxiosResponse } from "axios";

/**
 * 백엔드 `TransformInterceptor` 가 모든 응답을 `{ data: T }` 로 감싼다.
 * 프론트 API 클라이언트는 그 envelope 을 한 겹 벗겨 호출자에게 순수 payload 만
 * 돌려주고자 한다. 역사적으로 일부는 `data.data`, 일부는 `data?.data ?? data`
 * 로 직접 풀고 있었는데, 이 유틸을 통해 두 패턴 모두를 허용하며 중앙화한다.
 *
 * envelope 이 있으면 안쪽 `data` 를 반환하고, 없으면 원본을 그대로 반환 —
 * 배열/프리미티브 루트 응답 (일부 레거시 엔드포인트) 도 안전하게 처리.
 *
 * `apiClient` 전역 인터셉터로 이 동작을 올리는 변경은 50+ 호출 사이트의 `.data`
 * 이중 언래핑을 함께 손봐야 하므로 별도 PR 로 이관한다.
 */
export function unwrap<T>(response: AxiosResponse<unknown>): T {
  const body = response.data;
  if (
    body &&
    typeof body === "object" &&
    !Array.isArray(body) &&
    "data" in (body as Record<string, unknown>)
  ) {
    return (body as { data: T }).data;
  }
  return body as T;
}
