# 아키텍처(Architecture) 리뷰

리뷰 대상: EIA terminal revoke reconciler (TerminalRevokeReconcilerService + InteractionTokenService.reconcileTerminalRevocations)

---

## 발견사항

### [INFO] SRP 준수 — Reconciler 가 스케줄러 어댑터 역할만 담당
- 위치: `terminal-revoke-reconciler.service.ts` 전체
- 상세: `TerminalRevokeReconcilerService` 는 BullMQ `WorkerHost` 를 상속해 scheduler 등록(`onModuleInit`)과 job 디스패치(`process`) 만 담당하고, 실제 revoke 로직은 `InteractionTokenService.reconcileTerminalRevocations()` 로 위임한다. 클래스 주석에도 "본 service 는 scheduler/worker 어댑터만" 이라고 명확히 기술되어 있다. 단일 책임 원칙을 잘 지킨다.
- 제안: 없음.

### [INFO] 의존성 역전 — 구체 클래스 직접 주입
- 위치: `terminal-revoke-reconciler.service.ts:48-51` (constructor 의 InteractionTokenService 주입)
- 상세: `TerminalRevokeReconcilerService` 가 `InteractionTokenService` 구체 클래스를 직접 주입받는다. 테스트에서는 `Pick<InteractionTokenService, 'reconcileTerminalRevocations'>` 로 부분 모킹해 실질적 결합도를 낮추고 있으나, 런타임 바인딩은 인터페이스가 아닌 클래스 토큰이다. 단일 소비자(reconciler)가 단일 메서드(`reconcileTerminalRevocations`)만 호출하므로 현재 규모에서 실질 위험은 낮다. 향후 `InteractionTokenService` 가 비대해질 경우 인터페이스 분리 원칙(ISP) 위반 소지가 있다.
- 제안: 현 규모에서는 허용 범위. 향후 `ITerminalRevokeSource { reconcileTerminalRevocations(): Promise<...> }` 인터페이스를 추출해 주입 토큰으로 쓰면 ISP 와 DIP 를 동시에 충족하고 테스트 setup 도 단순해진다.

### [INFO] 도메인 크로스-레이어 임포트 — ExternalInteraction 모듈이 Executions 엔티티 직접 참조
- 위치: `interaction-token.service.ts` 상단 `import { ExecutionStatus } from '../executions/entities/execution.entity'`
- 상세: `reconcileTerminalRevocations` 가 쿼리에서 `ExecutionStatus` enum 을 직접 사용한다. `external-interaction` 모듈이 `executions` 모듈의 엔티티 레이어를 직접 임포트하는 구조로, 이미 TypeOrmModule 에서 `Execution` 엔티티를 `forFeature` 로 등록하는 기존 패턴과 일치하므로 현재 설계 내에서 일관성은 있다. 단, `ExecutionStatus` 를 shared-types 레이어로 올리지 않으면 `executions` 모듈 변경이 `external-interaction` 에 전파된다.
- 제안: 현 모노레포 구조에서 허용 범위이나, `ExecutionStatus` 가 여러 모듈에서 참조될 경우 `packages/shared-types` 로 추출을 검토할 것.

### [INFO] Optional Repository 패턴 — 조건부 주입에 따른 if-guard 반복
- 위치: `interaction-token.service.ts` — `reconcileTerminalRevocations`, `revokeAllForExecution`, `issuePerExecution` 등 메서드 시작부
- 상세: `executionTokenRepository` 가 `@Optional()` 로 주입되어 미주입 시 no-op 를 반환하는 패턴이 모든 메서드에 반복된다. 이는 레거시 모듈 설정 호환이라는 명시된 의도에 따른 것으로 설계적 선택이지만, Optional 주입 분기가 서비스 여러 곳에 흩어져 응집도를 약화시킨다.
- 제안: 현재 수준에서 허용. 향후 레거시 호환 요구가 사라지면 `@InjectRepository` 를 필수로 전환해 guard if-block 을 제거하는 것이 응집도 면에서 더 낫다.

### [INFO] reconcile() 메서드 가시성 — public 노출로 스케줄러 우회 가능
- 위치: `terminal-revoke-reconciler.service.ts:96` — `async reconcile(): Promise<void>` 가 public
- 상세: `process(_job)` 가 `reconcile()` 을 위임 호출하는 구조는 BullMQ job 처리와 수동 트리거를 분리한 것으로 테스트 용이성을 위한 선택이다. 다만 `reconcile()` 이 public 이면 외부에서 임의 호출이 가능해 스케줄러 제어를 우회할 수 있다. 현재 동일 모듈 내에서만 사용되므로 실질 위험은 낮다.
- 제안: `private reconcile()` 으로 제한하거나 `protected` 로 좁혀 의도를 명확히 할 것. 테스트는 `process({} as never)` 로 간접 검증하는 방식이 이미 사용되고 있다.

### [INFO] BullMQ Queue 상수와 서비스 구현이 동일 파일에 위치 — 기존 패턴과 불일치
- 위치: `terminal-revoke-reconciler.service.ts:1` — `TERMINAL_REVOKE_RECONCILE_QUEUE` 상수가 서비스 구현 파일에 위치
- 상세: `NOTIFICATION_WEBHOOK_QUEUE` 는 별도 `notification-dispatcher.types.ts` 파일로 분리되어 있으나, `TERMINAL_REVOKE_RECONCILE_QUEUE` 는 서비스 구현 파일에 함께 존재한다. 모듈 파일이 이 상수를 import 할 때 서비스 구현 전체를 참조하게 되어 패턴 일관성이 깨진다.
- 제안: `terminal-revoke-reconciler.types.ts` 를 별도 생성해 큐 상수를 분리하거나, 팀 규약으로 소규모 worker 는 상수를 같은 파일에 두어도 됨을 명시해 의도를 문서화할 것.

---

## 요약

이번 변경은 at-least-once terminal token revoke 를 보장하기 위해 `TerminalRevokeReconcilerService`(BullMQ Repeatable Scheduler 어댑터) + `InteractionTokenService.reconcileTerminalRevocations()`(실제 스윕 로직) 의 2-레이어 구조를 도입했다. 어댑터와 도메인 로직의 책임 분리, BullMQ 를 통한 멀티 인스턴스 안전성, `execution_token` 을 implicit outbox 로 재사용해 별도 outbox 테이블 없이 idempotent 재처리를 구현한 점은 아키텍처적으로 적절하다. 개선 여지는 (1) `InteractionTokenService` 직접 주입 대신 인터페이스 토큰 사용으로 ISP/DIP 강화, (2) `reconcile()` 가시성 제한, (3) 큐 상수 파일 분리를 통한 기존 패턴과의 일관성 확보 정도이며, 모두 INFO 수준이다. Optional Repository 패턴으로 인한 if-guard 반복은 설계 의도가 주석으로 명확히 기술되어 있어 허용 범위다.

---

## 위험도

LOW
