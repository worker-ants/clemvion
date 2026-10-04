import { buildSecretRef } from '../secret-store/secret-ref';

// 근거: [시크릿 저장소 「규칙」](CLE-INT-SECRET#규칙)

/**
 * 트리거 알림 웹훅 서명 비밀의 참조(`secret://triggers/<triggerId>/notification-signing`). 이 참조를
 * 만드는 곳은 여기 하나다. 설정 정규화와 서명 시크릿 승격(`triggers.service.ts`)이 쓰고, 발송
 * 처리기(`notification-webhook.processor.ts`)가 저장값 대신 이 값으로 서명 비밀을 읽는다.
 */
export function notificationSigningSecretRef(triggerId: string): string {
  return buildSecretRef({
    scope: 'triggers',
    resourceId: triggerId,
    name: 'notification-signing',
  });
}
