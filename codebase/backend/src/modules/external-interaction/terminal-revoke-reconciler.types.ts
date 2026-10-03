/**
 * BullMQ 큐 이름 — terminal revoke reconciliation sweep.
 *
 * 별도 types 파일로 분리해 `system-status.constants.ts`(모니터링 레지스트리) 등 외부 소비자가
 * 서비스 구현 파일을 import 하지 않고 큐 이름 상수만 참조하게 한다 (notification-dispatcher.types
 * 패턴과 동일). SoT: [External Interaction API 「종료 시 토큰 폐기」](CLE-EIA#종료-시-토큰-폐기).
 */
export const TERMINAL_REVOKE_RECONCILE_QUEUE = 'terminal-revoke-reconcile';
