/**
 * Notification 목록의 type 기반 클라이언트 사이드 필터.
 *
 * 본 batch 는 사이드바 popover 의 10개 limit 안에서 동작 — server-side
 * `?type=...` 필터는 별 plan (notification 수가 늘어나면 도입). 옵션 union 은
 * 칩 UI / i18n / 분기 모두에서 공유하므로 한 곳에 모은다.
 */
export type { NotificationLite } from "./types";

export type NotificationFilter =
  | "all"
  | "general"
  | "integration-action-required";

/**
 * 필터 칩 value → i18n 키 매핑 상수.
 * sidebar.tsx 의 JSX 인라인 리터럴 대신 이 상수를 import 해 렌더링한다.
 * NotificationFilter 에 새 값이 추가되면 이 배열도 함께 수정한다.
 */
export const FILTER_CHIPS = [
  ["all", "sidebar.notificationFilter.all"],
  ["general", "sidebar.notificationFilter.general"],
  [
    "integration-action-required",
    "sidebar.notificationFilter.integrationActionRequired",
  ],
] as const satisfies ReadonlyArray<[NotificationFilter, string]>;

export function filterNotifications<T extends NotificationLite>(
  list: T[],
  filter: NotificationFilter,
): T[] {
  switch (filter) {
    case "all":
      return list;
    case "integration-action-required":
      return list.filter((n) => n.type === "integration_action_required");
    case "general":
      // 'general' = 통합 액션 필요 이외 모든 알림. integration_expired 도
      // 'general' 에 포함 — 그 타입은 만료 7d 안내 같은 passive 알림이라
      // 즉시 액션 의무가 없다. type 누락 legacy 행도 보수적으로 general 로
      // 분류 (사용자가 칩에서 명시적으로 통합 액션 필요만 보지 않는 한 표시).
      return list.filter((n) => n.type !== "integration_action_required");
  }
}
