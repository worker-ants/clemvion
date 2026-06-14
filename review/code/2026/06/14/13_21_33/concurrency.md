# 동시성(Concurrency) 리뷰 결과

## 발견사항

### 1. [INFO] observeQueues — async ObservableCallback 패턴 (false-positive 확인)
- **위치**: `/codebase/backend/src/modules/metrics/business-metrics.service.ts` L78, L133
- **상세**: `this.queueDepth.addCallback((result) => this.observeQueues(result))` 에서 `observeQueues` 가 `async` 함수를 반환한다. 이전 리뷰(SUMMARY W-1)에서 이미 분석됐으며 의도적인 패턴으로 확인됐다. OTel JS SDK는 `ObservableCallback` 의 반환 Promise를 수집 주기마다 `await` 하는 것이 공식 지원 패턴이다(코드 주석으로 명시). 동시성 문제 없음.
- **제안**: 현행 유지.

### 2. [INFO] observeQueues — await 중 queueProviders 변형 격리 (이미 조치됨)
- **위치**: `/codebase/backend/src/modules/metrics/business-metrics.service.ts` L134
- **상세**: `const providers = [...this.queueProviders]` 스냅샷 복사로 `await Promise.allSettled` 실행 중 새 provider push가 이터레이션에 간섭하지 않도록 격리되어 있다. 이전 리뷰 W-2 조치가 반영된 상태다. `queueProviders` 배열은 단일 이벤트 루프 내에서만 수정되며(Node.js 단일 스레드), `registerQueueDepthProvider` 는 동기 `push` 이므로 스냅샷 없이는 await 양보 중 길이 변화가 가능하다. 스냅샷 패턴이 이를 올바르게 해결하고 있다.
- **제안**: 현행 유지.

### 3. [INFO] emitTerminalExecutionMetrics — fire-and-forget 비동기 패턴
- **위치**: `/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L9374
- **상세**: `void this.recordNodeLatencyMetrics(execution.id)` 로 비동기 DB 쿼리를 fire-and-forget 처리한다. 실행 마감 경로를 블로킹하지 않으려는 의도적 설계다. `recordNodeLatencyMetrics` 내부의 `catch {}` 가 모든 거부를 삼키므로 UnhandledPromiseRejection 이 발생하지 않는다. async 관점의 누락 `await` 가 아니라 설계된 비연결 계측이다.
- **제안**: 현행 유지.

### 4. [INFO] registerQueueDepthProvider — push 등록의 단일 스레드 안전성
- **위치**: `/codebase/backend/src/modules/metrics/business-metrics.service.ts` L124-126
- **상세**: Node.js 단일 스레드 이벤트 루프 모델이므로 `queueProviders.push()` 는 진정한 의미의 race condition 이 없다. 모든 `onModuleInit` 호출 역시 동일 이벤트 루프에서 순차 실행된다. 스레드 세이프 이슈 없음. 단, `observeQueues` 의 `await` 양보 중 push 간섭 가능성은 스냅샷 패턴(발견사항 2)으로 이미 해결됐다.
- **제안**: 현행 유지.

### 5. [INFO] recordLlmTokens — 동기 Counter.add 의 원자성
- **위치**: `/codebase/backend/src/modules/metrics/business-metrics.service.ts` L96-106
- **상세**: OTel Counter의 `add()` 는 동기 호출이며 OTel SDK 내부에서 누적을 관리한다. Node.js 단일 스레드에서 복합 조건(inputTokens / outputTokens / thinkingTokens 각 개별 add) 사이에 인터리빙이 없다. 단일 호출 내 원자성 이슈 없음.
- **제안**: 현행 유지.

### 6. [INFO] provider 타임아웃 미적용 — 잠재적 이벤트 루프 지연
- **위치**: `/codebase/backend/src/modules/metrics/business-metrics.service.ts` L135
- **상세**: `Promise.allSettled(providers.map(p => p()))` 에서 각 provider 의 완료를 무제한 대기한다. Redis 일시 장애 시 BullMQ `getJobCounts` 가 응답을 반환하지 않으면 OTel 수집 콜백이 무기한 대기 상태가 될 수 있다. 이전 리뷰에서 I-3 (Promise.race 패턴)으로 식별됐고 plan 후속 항목으로 등록됐다. 현재 수준에서는 OTel SDK 가 gauge 콜백의 타임아웃을 자체 관리하는지 여부에 따라 위험 수준이 달라진다.
- **제안**: 중기 후속으로 `Promise.race([p(), timeoutPromise(5000)])` 패턴을 각 provider 호출에 적용하는 것을 권장한다. plan 후속 I-3 항목으로 이미 기록됨.

## 요약

이번 변경(NF-OB-07 비즈니스 메트릭 파이프라인)에서 동시성 관점의 실질적 위험은 없다. Node.js 단일 스레드 모델에서 새로운 공유 가변 상태는 `queueProviders` 배열 하나뿐이며, `observeQueues` 의 스냅샷 이터레이션 패턴(`[...this.queueProviders]`)이 await 양보 중 변형 간섭을 올바르게 처리한다. async 비동기 패턴은 모두 의도적(OTel ObservableCallback의 공식 async 지원, fire-and-forget 메트릭 계측)이며 `await` 누락이 아니다. OTel Counter/Histogram의 동기 record 호출과 이벤트 루프 내 순차 실행이 결합되어 원자성 이슈도 없다. 미조치 항목은 provider 타임아웃 미적용(I-3, plan 후속 등록됨)으로 OTel SDK 자체 타임아웃 정책 확인 후 적용이 권장된다. 전체 동시성 위험도는 낮다.

## 위험도

LOW
