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
import type { NotificationLite } from "./types";
export type { NotificationLite };

/**
 * 허용 resourceId 패턴 — 영문자·숫자·하이픈·언더스코어만 허용 (최대 128자).
 * 경로 트래버설(`..`) 이나 프로토콜 상대 URL 삽입을 방지한다.
 */
const SAFE_ID = /^[a-zA-Z0-9_-]{1,128}$/;

/**
 * 알림의 type / resourceId 로 클릭 시 이동할 라우트를 반환한다.
 * 매핑되지 않는 type 이거나 type 이 없으면 null 을 반환 — 클릭 시 라우팅 없음.
 * resourceId 는 SAFE_ID 패턴(`/^[a-zA-Z0-9_-]{1,128}$/`) 으로 검증 후 사용한다.
 * 패턴 불일치 시 목록 경로(`/integrations`, `/workflows`)로 폴백한다.
 */
export function notificationHref(notif: NotificationLite): string | null {
  const { type, resourceId } = notif;
  if (!type) return null;
  // resourceId 화이트리스트 검증 — 패턴 불일치 또는 빈 문자열은 폴백 처리
  const safeId = resourceId && SAFE_ID.test(resourceId) ? resourceId : null;
  switch (type) {
    // 통합 관련 알림은 detail 페이지로 직접 deep-link — `/integrations/<id>`.
    // resourceId 가 없거나 비정상 값이면 목록으로 폴백 (404 회피 + 경로 탐색 방지).
    case "integration_action_required":
    case "integration_expired":
      return safeId ? `/integrations/${safeId}` : "/integrations";
    // 실행 실패 류는 워크플로우 detail. resourceId 가 워크플로우 id 임에
    // 의존한다 (backend NotificationsService 가 resourceId=workflowId 로
    // 채워서 보냄 — spec/data-flow/8-notifications.md §1.1 참조).
    case "execution_failed":
    case "background_failed":
    case "schedule_failed":
      return safeId ? `/workflows/${safeId}` : "/workflows";
    case "team_invite":
      return "/profile";
    default:
      return null;
  }
}
