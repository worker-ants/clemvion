# 아키텍처(Architecture) 리뷰

리뷰 대상: EIA terminal revoke reconciler — `TerminalRevokeReconcilerService` + `InteractionTokenService.reconcileTerminalRevocations` (RESOLUTION fix 반영 후 freshed diff)

---

## 발견사항

### [INFO] SRP 준수 — 어댑터/도메인 책임 분리 적절
- 위치: `terminal-revoke-reconciler.service.ts` 전체, `interaction-token.service.ts` reconcileTerminalRevocations
- 상세: `TerminalRevokeReconcilerService` 는 BullMQ 스케줄러 등록(`onModuleInit`)과 job 디스패치(`process`) 만 담당하고 실제 sweep 로직은 `InteractionTokenService` 에 완전히 위임한다. 클래스 주석 "본 service 는 scheduler/worker 어댑터만" 이 의도를 명시하고 있다. 이번 RESOLUTION 적용 후에는 reconciler 의 중복 swept 로그가 제거되어 단일 책임이 더 명확해졌다.
- 제안: 없음.

### [INFO] 의존성 역전(DIP) — 구체 클래스 직접 주입
- 위치: `terminal-revoke-reconciler.service.ts` constructor (InteractionTokenService 주입)
- 상세: `TerminalRevokeReconcilerService` 가 `InteractionTokenService` 구체 클래스를 직접 주입받는다. 소비 메서드는 `reconcileTerminalRevocations` 하나뿐이므로 현 규모에서 실질 결합도는 낮다. 향후 `InteractionTokenService` 가 비대해질 경우 ISP 위반 소지가 생긴다.
- 제안: 현 규모에서는 허용 범위. 필요 시 `ITerminalRevokeSource { reconcileTerminalRevocations(batchLimit?: number): Promise<{ swept: number; revoked: number }> }` 인터페이스를 추출해 DI 토큰으로 사용하면 ISP/DIP 동시 충족.

### [INFO] 크로스-모듈 임포트 — `ExecutionStatus` enum 직접 참조
- 위치: `interaction-token.service.ts` — `import { ExecutionStatus } from '../executions/entities/execution.entity'`
- 상세: `external-interaction` 모듈이 `executions` 엔티티 레이어의 `ExecutionStatus` 를 직접 참조한다. 의존 방향(`external-interaction → executions`)은 기존 설계와 일치하며 역방향 순환 의존성은 없다. 이번 diff 에서 `TERMINAL_STATUSES` 상수로 추출된 것은 변경점을 한 곳으로 모은 긍정적 조치다.
- 제안: 여러 모듈이 동일 enum 을 참조할 경우 `packages/shared-types` 로 상향하는 것을 중장기 검토.

### [INFO] Optional Repository 패턴 — if-guard 반복으로 응집도 약화
- 위치: `interaction-token.service.ts` — `reconcileTerminalRevocations`, `revokeAllForExecution`, `issuePerExecution` 등 메서드 시작부
- 상세: `executionTokenRepository` 가 `@Optional()` 로 주입되어 미주입 시 no-op 를 반환하는 guard 블록이 여러 메서드에 반복된다. 이는 레거시 호환 설계 선택이나, 호환 의무가 제거되면 `@InjectRepository` 필수 전환으로 분기를 단순화할 수 있다.
- 제안: 현 수준 허용. 레거시 호환이 불필요해지면 필수 주입 전환 예정으로 TODO 주석 추가를 권고.

### [INFO] `reconcile()` 가시성 — public 메서드로 스케줄러 우회 가능
- 위치: `terminal-revoke-reconciler.service.ts` — `async reconcile(): Promise<void>` (public)
- 상세: RESOLUTION 에서 직접 테스트 목적으로 public 유지를 명시했고 JSDoc 도 추가되었다. 단 public 이면 모듈 외부에서 임의 호출이 가능해 스케줄러 제어를 우회할 수 있다. 현재 동일 모듈 내에서만 사용되므로 실질 위험은 낮다.
- 제안: `private` 또는 `protected` 로 제한하고 테스트는 `process({} as never)` 간접 경로를 사용하는 것이 인터페이스 분리 측면에서 더 낫다. 단, 팀 규약으로 "직접 테스트를 위해 public" 을 명시했다면 INFO 수준 유지.

### [INFO] BullMQ 큐 상수 위치 — 기존 패턴과 불일치
- 위치: `terminal-revoke-reconciler.service.ts:1` — `export const TERMINAL_REVOKE_RECONCILE_QUEUE`
- 상세: `NOTIFICATION_WEBHOOK_QUEUE` 는 `notification-dispatcher.types.ts` 에 분리되어 있으나, `TERMINAL_REVOKE_RECONCILE_QUEUE` 는 서비스 구현 파일에 위치한다. 모듈 파일이 이 상수를 import 할 때 서비스 구현 전체가 참조되어 불필요한 결합이 생기고, 소규모 worker 상수 파일 구성 규약이 일관되지 않는다.
- 제안: `terminal-revoke-reconciler.types.ts` 를 별도 생성하거나, 기존 규약 문서에 "소규모 worker 는 서비스 파일 내 상수 허용" 을 명시해 의도를 확정한다.

### [INFO] 확장성 — `TERMINAL_STATUSES` 배열 enum 확장 시 동기화 의무
- 위치: `interaction-token.service.ts` — `const TERMINAL_STATUSES: readonly ExecutionStatus[]`
- 상세: 이번 diff 에서 배열을 상수로 추출한 것은 긍정적이며 JSDoc 에 "enum 확장 시 본 배열 동기화" 주의사항이 명시되어 있다. 그러나 컴파일 타임 강제가 없으므로 향후 `ExecutionStatus` 에 terminal 상태가 추가될 경우 누락될 수 있다.
- 제안: TypeScript exhaustiveness check 패턴(예: never 타입 단언)을 도입하거나, enum 에 `isTerminal()` 타입 가드를 추가해 목록 유지보수 책임을 enum 정의 쪽으로 이동하는 것을 검토.

### [INFO] 병렬화 도입 — bounded-concurrency 구조 적절
- 위치: `interaction-token.service.ts` — reconcileTerminalRevocations 의 청크 루프 + `Promise.allSettled`
- 상세: RESOLUTION W2/W3 fix 로 `RECONCILE_CONCURRENCY=20` 청크 병렬화가 도입되었다. `Promise.allSettled` 로 부분 실패를 격리하는 패턴은 at-least-once 의미론을 유지하면서 fail-open 보장도 지킨다. 동시성 상수(`RECONCILE_CONCURRENCY`)가 파일 상단에 추출되어 조정 가능성이 명확하다.
- 제안: 없음. 현재 구조 적절.

---

## 요약

이번 변경 세트(RESOLUTION 적용 후)는 `TerminalRevokeReconcilerService`(BullMQ repeatable 어댑터)와 `InteractionTokenService.reconcileTerminalRevocations`(sweep 도메인 로직)의 2-레이어 분리, bounded-concurrency 병렬화(`Promise.allSettled` + `RECONCILE_CONCURRENCY=20`), `batchLimit` clamp, 매직넘버 상수화, `concurrency: 1` 명시 등 이전 리뷰에서 제기된 INFO/WARNING 항목을 전반적으로 해소하였다. 순환 의존성 없음, 레이어 책임 분리 명확, at-least-once 의미론 일관. 남은 개선 포인트는 (1) `InteractionTokenService` 직접 주입 대신 인터페이스 토큰(DIP 강화), (2) `reconcile()` 가시성 제한, (3) 큐 상수 파일 분리(기존 패턴과 일관성), (4) `TERMINAL_STATUSES` exhaustiveness 강제 — 모두 INFO 수준이며 아키텍처적 차단 요소는 없다.

---

## 위험도

LOW
