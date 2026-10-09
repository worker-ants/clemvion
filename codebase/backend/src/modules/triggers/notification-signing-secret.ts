import { randomBytes } from 'crypto';
import { isSecretRef } from '../secret-store/secret-ref';

// 근거: [EIA 알림 웹훅 「시크릿 교체」](CLE-EIA-NOTIFY#시크릿-교체), [시크릿 저장소 「규칙」](CLE-INT-SECRET#규칙)

/** 서버가 만드는 알림 서명 시크릿(`wsk_<64hex>`). 첫 발급과 시크릿 교체가 같은 모양을 쓴다. */
export function newNotificationSigningSecret(): string {
  return `wsk_${randomBytes(32).toString('hex')}`;
}

/** {@link decideNotificationSigning} 의 결정. 각 값의 뜻은 그 함수의 표에 있다. */
export type NotificationSigningDecision =
  | { kind: 'rederive' }
  | { kind: 'migrate'; plaintext: string }
  | { kind: 'issue' };

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

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 서명 설정에 정식 참조를 싣고 옛 평문 키를 뺀다 — 평문은 시크릿 저장소에만 둔다(시크릿 저장소 규칙 14).
 * 객체가 아닌 값(없음 · 문자열 등)은 빈 설정으로 본다.
 *
 * 서명 설정을 `config` 에 다시 얹는 자리(첫 발급 · 옛 평문 이전 · 승격 · 평문 정규화)가 모두 이 함수를 쓴다.
 * 자리마다 손으로 적으면 평문 키를 빼는 규칙이 바뀔 때 한 곳을 놓쳐 평문이 `config` 에 남는다.
 */
export function signingWithRef(
  signing: unknown,
  secretRef: string,
): Record<string, unknown> {
  const next: Record<string, unknown> = isPlainRecord(signing)
    ? { ...signing }
    : {};
  delete next.secret;
  next.secretRef = secretRef;
  return next;
}

/** `notification` 위에 {@link signingWithRef} 로 만든 `signing` 을 얹는다. 나머지 키는 그대로 둔다. */
export function notificationWithSigningRef(
  notification: unknown,
  secretRef: string,
): Record<string, unknown> {
  const base = isPlainRecord(notification) ? notification : {};
  return { ...base, signing: signingWithRef(base.signing, secretRef) };
}
