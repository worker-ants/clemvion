/**
 * 알림 도메인의 공유 타입 정의 — 단일 진실.
 *
 * filter.ts 와 href.ts 가 각각 독립적으로 NotificationLite 인터페이스를
 * 선언했던 구조를 통합한다. 새 알림 타입 추가 시 이 파일만 수정하면
 * filter · href · sidebar 모두에 컴파일 타임 안전성이 보장된다.
 */

export type NotificationType =
  | "integration_action_required"
  | "integration_expired"
  | "execution_failed"
  | "background_failed"
  | "schedule_failed"
  | "team_invite";

/**
 * 알림 목록 항목의 최소 공통 인터페이스.
 * filter.ts 와 href.ts 의 순수 helper 가 이 타입에만 의존한다.
 */
export interface NotificationLite {
  id?: string;
  type?: NotificationType | string;
  resourceType?: string | null;
  resourceId?: string | null;
}
