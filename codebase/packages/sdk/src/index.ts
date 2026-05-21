/**
 * @workflow/sdk — Clemvion External Interaction API client SDK.
 *
 * 외부 시스템(서버·봇·UI)이 webhook 트리거로 워크플로우를 시작하고, 도중의 인터랙션을 주고받고,
 * 종료 이벤트를 받을 수 있게 한다.
 *
 * [Spec EIA §1~§11] — 본 SDK 는 spec 의 권위 표면을 그대로 노출. 추가 비즈니스 로직은 두지 않는다.
 */

export { ClemvionClient } from './client';
export type {
  ClemvionClientOptions,
  TriggerWebhookResult,
  InteractCommand,
  InteractRequest,
  InteractAck,
  ExecutionStatus,
  RefreshTokenResult,
  SseSubscription,
  SseEventHandler,
} from './client';
export {
  verifyNotificationSignature,
  computeNotificationSignature,
} from './signature';
export type {
  SupportedHmacAlgorithm,
  NotificationVerifyResult,
} from './signature';
