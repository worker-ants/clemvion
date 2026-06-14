/**
 * BullMQ 큐 이름 — terminal revoke reconciliation sweep.
 *
 * 별도 types 파일로 분리해 `system-status.constants.ts`(모니터링 레지스트리) 등 외부 소비자가
 * 서비스 구현 파일을 import 하지 않고 큐 이름 상수만 참조하게 한다 (notification-dispatcher.types
 * 패턴과 동일). SoT: [Spec EIA §3.4 EIA-RL-06 / §9.3 R15](../../../../spec/5-system/14-external-interaction-api.md).
 */
export const TERMINAL_REVOKE_RECONCILE_QUEUE = 'terminal-revoke-reconcile';
