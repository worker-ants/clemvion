# 아키텍처(Architecture) 리뷰

**대상**: M-2 — ShutdownStateService.registerInFlight early-return 제거 (06-concurrency)
**파일**: `codebase/backend/src/modules/execution-engine/shutdown/shutdown-state.service.ts`

---

## 발견사항

### [INFO] 단일 책임 원칙(SRP) — ShutdownStateService 범위 명확, 현재 수준 적절
- 위치: `shutdown-state.service.ts` 전체
- 상세: `ShutdownStateService` 는 (1) in-flight 노드 추적(register/unregister), (2) shutdown 상태 플래그 관리, (3) grace drain 대기, (4) 만료 시 DB 마킹, 총 4가지 책임을 단일 클래스에서 수행한다. 이 책임들은 "graceful shutdown 보장"이라는 하나의 도메인 불변식 이행에 모두 귀결되므로 응집도 관점에서 정당하다. 다만 향후 `markRemainingAsInterrupted` 로직이 복잡해지면(예: 부분 재시도, 외부 이벤트 발행) 분리 압력이 생길 수 있다.
- 제안: 현재는 조치 불요. `markRemainingAsInterrupted` 에 부가 로직이 추가되면 별도 `ShutdownMarkingService` 로 분리를 검토한다.

### [INFO] 개방-폐쇄 원칙(OCP) — framework 의존 암묵 가정이 extension point 부재
- 위치: `shutdown-state.service.ts` JSDoc "신규 세그먼트 job consume 중단은 `@nestjs/bullmq WorkerHost` 의 shutdown lifecycle(worker close) 이 담당하므로 drain 집합은 grace 한도 내로 bounded"
- 상세: M-2 의 핵심 전제인 "drain 집합 상한"은 `@nestjs/bullmq WorkerHost` 의 framework 내부 동작에 의존한다. 이 가정이 서비스 코드 외부(framework lifecycle)에 내재하고 있어, BullMQ 버전 업그레이드나 다른 queue 구현으로 교체 시 컴파일 오류 없이 조용히 §11.2 계약이 깨진다. `ShutdownStateService` 자체는 `inFlightCount > 0` 이어도 grace 시간이 지나면 마킹하므로 안전하지만, "드레인이 반드시 bounded 된다"는 운영 보장이 추상화 경계 바깥에 존재한다.
- 제안: 중기적으로 `ShutdownStateService` 가 `WorkerControlPort` 같은 추상 인터페이스를 주입받아 "신규 consume 차단" 동작을 명시적으로 호출하는 패턴을 고려한다(현재 의존 경로가 spec §11.2에도 미명시된 점은 cross-spec INFO 와 동일 맥락). 즉각 수정 요구 수준은 아님.

### [INFO] 레이어 책임 — 비즈니스/데이터 레이어 경계 준수
- 위치: `markRemainingAsInterrupted` (line 563-622)
- 상세: `ShutdownStateService` 가 `Repository` 를 직접 주입받아 DB 업데이트 쿼리를 실행한다. NestJS 생태계에서 service 가 repository 를 직접 사용하는 것은 관용 패턴이며, 현재 이 서비스가 데이터 레이어를 소비하는 유일 경로(별도 사용 사례 없음)이므로 레이어 오염보다 실용적 설계에 가깝다. 그러나 NodeExecution/Execution 상태 전환 로직이 여러 곳에 분산될 경우 별도 `NodeExecutionRepository` / `ExecutionRepository` 래퍼 또는 `StatusTransitionService` 가 더 적합할 수 있다.
- 제안: 현재는 조치 불요.

### [INFO] fromConfig static factory 와 DI 혼용 — 두 생성 경로 동시 존재
- 위치: `shutdown-state.service.ts:462-473` (`fromConfig` static factory)
- 상세: `ShutdownStateService` 는 `@Injectable()` DI 경로와 `fromConfig()` static factory 경로 두 가지로 인스턴스를 생성할 수 있다. JSDoc 에 "테스트 직접 호출" 용도라고 명시했지만, 실제로 테스트 파일은 `new ShutdownStateService(...)` 직접 생성자를 사용하고 있어 `fromConfig` 가 실제로는 사용되지 않는 dead API가 되었을 가능성이 있다. 불필요하게 두 생성 경로를 노출하면 소비자가 어느 경로를 써야 하는지 혼란을 줄 수 있다.
- 제안: `fromConfig` 가 애플리케이션 코드 또는 다른 테스트에서 실제로 사용되는지 확인하고, 사용처가 없으면 제거를 검토한다.

### [INFO] 폴링 기반 drain 대기 — 이벤트 기반 대안 고려 여지
- 위치: `waitForDrain` (line 551-560)
- 상세: `setInterval` 폴링 방식(`pollMs` 주기)으로 `inFlightCount === 0` 을 감시한다. 현재 `pollMs` 기본값 200ms, 테스트는 10ms로 제어 가능하므로 테스트 친화적이다. 그러나 고부하 종료 시 폴링 주기가 불필요한 대기를 추가하거나, `pollMs` 가 너무 짧으면 CPU를 낭비할 수 있다. `unregisterInFlight` 에서 count가 0이 되는 순간 Promise를 resolve 하는 이벤트 기반(`EventEmitter` / `Promise` signal) 구조가 더 효율적이지만, 현재 grace timeout 제약 안에서 결과적 차이는 미미하다.
- 제안: 현재는 조치 불요. 성능 이슈가 실측될 경우 `unregisterInFlight` 에서 drain 완료 신호를 방출하는 방식으로 개선한다.

### [INFO] `inFlightNodeExecutions` Map 의 동시성 안전성 — Node.js 단일 스레드 이벤트 루프 의존
- 위치: `shutdown-state.service.ts:433` (`private readonly inFlightNodeExecutions = new Map<string, string>()`)
- 상세: `registerInFlight` / `unregisterInFlight` 가 동기로 `Map` 을 수정하고, `onApplicationShutdown` 은 `await` 에서 잠시 이벤트 루프 제어권을 넘긴다. Node.js 의 단일 스레드 이벤트 루프 덕분에 실질적 race condition 은 없지만, `waitForDrain` 중 `registerInFlight` / `unregisterInFlight` 가 언제든 호출될 수 있다는 사실이 코드 주석에 명시되지 않았다. M-2 수정(early-return 제거)이 바로 이 경로(`waitForDrain` 중 새 노드 등록)를 허용하므로, 해당 concurrent 접근이 의도적이고 안전한 이유(이벤트 루프 단일 스레드)를 코드 또는 주석에 명시해 두면 향후 Worker Threads 도입 시 재검토 단서가 된다.
- 제안: `inFlightNodeExecutions` 필드 또는 `registerInFlight` 메서드 JSDoc에 "Node.js 이벤트 루프 단일 스레드 보장 하에 lock-free" 설명 한 줄 추가를 권장한다.

---

## 요약

이번 변경(`registerInFlight` early-return 4줄 제거)은 범위가 극소하고 아키텍처 관점에서 올바른 방향이다. `ShutdownStateService` 의 단일 책임·레이어 경계는 유지되며, 핵심 수정은 서비스의 불변식("본 인스턴스가 추적한 노드는 grace 만료 시 반드시 SERVER_INTERRUPTED 로 마킹")을 강화하는 버그 수정에 해당한다. 아키텍처적 긴장점은 모두 기존 설계에서 비롯된 것들이며 이번 PR이 새로 도입한 구조적 문제는 없다. 주목할 점은 "drain 상한이 framework 내부 lifecycle에 암묵 의존한다"는 사실이 `ShutdownStateService` 외부에 있어 추상화 경계를 벗어나 있다는 점이나, 이는 명시적 추상 인터페이스 도입으로 개선 가능한 중장기 숙제이며 즉각 조치 수준은 아니다. 테스트 변경도 구현 의도를 정확히 반영하며, 경계 조건(grace 만료 시 두 노드 모두 WHERE 절에 포함)을 적절히 검증하고 있다.

---

## 위험도

NONE
