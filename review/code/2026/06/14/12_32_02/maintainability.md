# 유지보수성(Maintainability) 리뷰 결과

## 발견사항

### [WARNING] execution-engine.service.spec.ts — BusinessMetricsService 중복 등록
- **위치**: `execution-engine.service.spec.ts` diff 기준 `SUMMARY W3 / W5 / W6 / W7 보완 단위 테스트` describe 내 `module3` 생성 코드 (diff lines +273~274)
- **상세**: `BusinessMetricsService` 가 동일 `providers` 배열에 두 번 나열되어 있다. NestJS는 중복 provider를 허용하지만 의도치 않은 실수이며, 나중에 추가된 항목이 먼저 등록된 것을 덮어쓰는 동작이 숨겨진 부작용을 일으킬 수 있다. 코드 읽는 사람이 의도적인 패턴인지 착오인지 즉시 판단할 수 없다.
- **제안**: 중복 `BusinessMetricsService` 한 줄을 제거한다.

### [WARNING] continuation-dlq-monitor.service.ts — `{ registerQueueDepthProvider } as never` 테스트 타입 우회
- **위치**: `continuation-dlq-monitor.service.spec.ts` `makeService` 함수 내 `{ registerQueueDepthProvider } as never`
- **상세**: `as never` 캐스트는 TypeScript 타입 시스템을 완전히 우회한다. 추후 `BusinessMetricsService` 인터페이스가 변경될 경우 컴파일 오류가 이 테스트에서 잡히지 않아 묵시적 회귀 위험이 생긴다. `as unknown as BusinessMetricsService` 또는 구체적인 Partial 타입을 쓰는 것이 보다 유지보수 친화적이다.
- **제안**: `{ registerQueueDepthProvider } as unknown as BusinessMetricsService` 로 변경해 최소한 상위 타입을 명시한다.

### [WARNING] execution-engine.service.ts — `onModuleInit` 내 큐 depth provider 등록 블록의 응집도 저하
- **위치**: `execution-engine.service.ts` `onModuleInit` 메서드, diff +887~+910
- **상세**: `onModuleInit`은 핸들러 등록(`registerHandlers`)과 BullMQ 큐 깊이 gauge 등록이라는 두 가지 서로 다른 책임을 혼재한다. 새 계측 포인트가 추가될수록 이 메서드가 비대해질 수 있다. `ContinuationDlqMonitorService`가 동일 목적의 등록을 별도 메서드 없이 `onModuleInit` 서두에서 수행하는 것과 패턴이 동일하여 일관성 자체는 있지만, 두 서비스 모두에서 초기화 로직이 한 메서드에 점점 쌓이는 구조다.
- **제안**: 큐 depth provider 등록 블록을 `private registerQueueDepthProviders(): void` 와 같은 전용 메서드로 추출하고 `onModuleInit`에서 호출하면 책임이 분리되고 테스트 작성도 용이해진다.

### [WARNING] business-metrics.service.ts — `recordLlmTokens` 의 falsy 검사가 0을 과도하게 차단
- **위치**: `business-metrics.service.ts` `recordLlmTokens` 메서드 (lines 3073~3081)
- **상세**: `if (usage.inputTokens)` 구문은 값이 `0`일 때도 건너뛴다. 주석("0 은 건너뛴다")과 테스트가 이를 명시적으로 의도한 동작으로 검증하므로 버그는 아니다. 그러나 향후 토큰 수가 실제 0인 케이스(예: 캐시 히트)를 계측해야 할 때 조용히 누락될 위험이 있다. 또한 `undefined`와 `0`을 구분하지 않아 의미가 불명확하다.
- **제안**: `if (usage.inputTokens != null && usage.inputTokens > 0)` 와 같이 `undefined` 제외와 `0` 제외 의도를 명시적으로 표현하거나, JSDoc에 "값이 0이면 계측하지 않는다" 를 명기한다.

### [INFO] execution-engine.service.ts — `terminal` 배열이 매 호출마다 재생성
- **위치**: `execution-engine.service.ts` `emitTerminalExecutionMetrics` 메서드 (diff +9220~+9224)
- **상세**: `emitTerminalExecutionMetrics` 내부에서 `const terminal: ExecutionStatus[] = [COMPLETED, FAILED, CANCELLED]` 배열이 메서드 호출마다 새로 생성된다. 성능에 미치는 영향은 미미하지만, 클래스 상수 또는 모듈 상수로 추출하면 의도가 명확하고 재사용성이 높아진다.
- **제안**: 클래스 외부 또는 `private static readonly`로 `TERMINAL_STATUSES` 상수를 추출한다.

### [INFO] business-metrics.service.ts — `LlmTokenUsage` 인터페이스의 접근 제한
- **위치**: `business-metrics.service.ts` `LlmTokenUsage` 인터페이스 (line 3009)
- **상세**: `LlmTokenUsage` 인터페이스가 파일 내부에서만 사용됨에도 `export` 없이 정의되어 있는데, `TokenUsage`(외부 정의)와 별도로 유사한 필드 구조를 중복 정의하고 있다. `TokenUsage`의 부분 집합이라면 `Pick<TokenUsage, ...>` 나 직접 `TokenUsage` 재활용이 가능한지 검토할 가치가 있다.
- **제안**: `TokenUsage` 타입과의 관계를 명시하거나, 중복이 의도적(느슨한 결합)이라면 주석으로 근거를 남긴다.

### [INFO] app.module.ts — import 순서 일관성 경미한 위반
- **위치**: `app.module.ts` import 섹션, 74~76행
- **상세**: `MetricsModule`이 `RedisModule` 다음, `RolesGuard` 앞에 삽입되어 있다. 기존 패턴(공통 인프라 → feature modules)과는 일치하지만, `common/guards` 임포트 사이에 `modules/metrics` 임포트가 끼어 있어 파일 구조 읽기 흐름이 미세하게 끊긴다. 모듈 배열에서의 위치(RedisModule 바로 다음)와 임포트 선언 위치가 일치하지 않는다.
- **제안**: import 선언을 `common/` 임포트 블록과 `modules/` 임포트 블록으로 구분하고 `MetricsModule` 임포트를 다른 `modules/` 임포트 그룹으로 이동한다. (사소한 수준이므로 optional)

---

## 요약

이번 변경은 `BusinessMetricsService` + `MetricsModule` 신설을 통한 NF-OB-07 도메인 메트릭 계측 도입이다. 전반적으로 설계 의도가 명확하고 코드 구조는 간결하다. `BusinessMetricsService` 자체는 단일 책임을 잘 유지하며, 공개 API(`recordExecutionTerminal`, `recordLlmTokens`, `registerQueueDepthProvider` 등)가 목적을 잘 나타낸다. 계측 실패가 실행 경로에 영향을 주지 않도록 오류를 삼키는 패턴도 일관되게 적용됐다. 주요 유지보수성 우려사항은 테스트 코드의 `BusinessMetricsService` 중복 등록(실수 가능성)과 `as never` 타입 우회(타입 안전성 손실), 그리고 `onModuleInit` 책임 혼재다. 이 중 중복 등록과 `as never` 캐스트는 빠르게 수정할 수 있는 항목이며, 나머지는 장기 유지보수 관점의 개선 권고다.

---

## 위험도

LOW
