import { randomBytes } from 'crypto';
import { isSecretRef } from '../secret-store/secret-ref';

// 근거: [EIA 알림 웹훅 「시크릿 교체」](CLE-EIA-NOTIFY#시크릿-교체), [시크릿 저장소 「규칙」](CLE-INT-SECRET#규칙)

/** 서버가 만드는 알림 서명 시크릿(`wsk_<64hex>`). 첫 발급과 시크릿 교체가 같은 모양을 쓴다. */
export function newNotificationSigningSecret(): string {
  return `wsk_${randomBytes(32).toString('hex')}`;
}

/**
 * 저장된 `notification` 을 보고 알림 서명 시크릿을 어떻게 할지 정한다.
 *
 * | 저장된 `signing` | 결정 |
 * |---|---|
 * | `secretRef` 가 `secret://` 형식 | `rederive` — 참조를 트리거 id 로 다시 만들어 싣는다. 발급하지 않는다 |
 * | 참조가 없고 옛 평문 `secret` 이 비어 있지 않은 문자열 | `migrate` — 그 평문을 시크릿 저장소로 옮긴다. 발급하지 않는다 |
 * | 둘 다 없음 | `issue` — 첫 시크릿을 발급한다 |
 *
 * 판정은 발송 처리기(`NotificationWebhookProcessor.resolveSigningSecret`)와 같다 — 참조 «있음» 은
 * `isSecretRef`(시크릿 저장소 규칙 24), 옛 평문 «있음» 은 비어 있지 않은 문자열이다. 둘이 갈리면 발송이
 * «없음» 으로 보는 행을 여기서 «있음» 으로 보고 발급하지 않아 발송이 계속 `degraded` 가 된다.
 * 옛 평문이 있으면 옮기는 이유: PATCH 가 `notification` 을 통째로 바꾸면 그 평문이 사라지는데, 새로
 * 발급하면 수신 측이 쓰던 시크릿이 유예 없이 바뀐다. 빈 문자열은 «없음» 이다 — 빈 시크릿을 저장하지 않는다.
 */
export type NotificationSigningDecision =
  | { kind: 'rederive' }
  | { kind: 'migrate'; plaintext: string }
  | { kind: 'issue' };

export function decideNotificationSigning(
  storedNotification: unknown,
): NotificationSigningDecision {
  const signing =
    storedNotification && typeof storedNotification === 'object'
      ? (storedNotification as { signing?: unknown }).signing
      : undefined;
  const fields =
    signing && typeof signing === 'object'
      ? (signing as { secretRef?: unknown; secret?: unknown })
      : {};
  if (typeof fields.secretRef === 'string' && isSecretRef(fields.secretRef)) {
    return { kind: 'rederive' };
  }
  if (typeof fields.secret === 'string' && fields.secret.length > 0) {
    return { kind: 'migrate', plaintext: fields.secret };
  }
  return { kind: 'issue' };
}
