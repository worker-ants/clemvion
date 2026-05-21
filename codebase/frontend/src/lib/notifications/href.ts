/**
 * Notification 의 type / resourceId 로 deep-link 라우트를 계산하는 순수 helper.
 *
 * 분리 의도: 옛 코드는 sidebar.tsx 안에 인라인 함수로 존재했고 회귀 검출이
 * 불가능했다 (`integration_action_required` 가 `/integration` 단수 경로로
 * 잘못 라우팅되는 버그가 main 에 머지된 채 잔존 — A-1 batch 진입 시 발견).
 * 본 helper 로 추출해 단위 테스트가 lock 한다.
 *
 * spec/data-flow/8-notifications.md §1.1 의 type 분류와
 * spec/2-navigation/_layout.md §3.1 알림 팝오버 라우팅 정책을 따른다.
 */
export interface NotificationLite {
  type?: string;
  resourceType?: string | null;
  resourceId?: string | null;
}

export function notificationHref(notif: NotificationLite): string | null {
  const { type, resourceId } = notif;
  if (!type) return null;
  switch (type) {
    // 통합 관련 알림은 detail 페이지로 직접 deep-link — `/integrations/<id>`.
    // resourceId 가 없는 legacy / 비정상 row 는 목록으로 폴백 (404 회피).
    case "integration_action_required":
    case "integration_expired":
      return resourceId ? `/integrations/${resourceId}` : "/integrations";
    // 실행 실패 류는 워크플로우 detail. resourceId 가 워크플로우 id 임에
    // 의존한다 (backend NotificationsService 가 resourceId=workflowId 로
    // 채워서 보냄 — spec/data-flow/8-notifications.md §1.1 참조).
    case "execution_failed":
    case "background_failed":
    case "schedule_failed":
      return resourceId ? `/workflows/${resourceId}` : "/workflows";
    case "team_invite":
      return "/profile";
    default:
      return null;
  }
}
