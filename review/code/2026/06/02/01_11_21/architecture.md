# 아키텍처(Architecture) 리뷰 결과

## 발견사항

### [INFO] resolveContinuationWorkerConcurrency 의 배치 위치와 레이어 책임
- 위치: `codebase/backend/src/modules/execution-engine/queues/continuation-execution.queue.ts` (신규 추가 함수 및 상수)
- 상세: 환경변수 파싱 책임을 큐 정의 파일에 직접 내포했다. `continuation-dlq-monitor.config.ts` 는 `useFactory` DI + 전용 config 파일 패턴을 사용해 `process.env` 를 서비스 바깥으로 밀어내는 의존성 역전(DIP) 을 적용한 반면, 이번 변경은 큐 메타데이터 파일(types·상수·jobId builder 가 공존) 안에 env 파서를 직접 추가했다. 단일 책임 원칙(SRP) 관점에서 큐 파일에 설정 파싱 책임이 섞인다.
- 제안: `@Processor` 데코레이터 인자가 DI 이전 모듈 로드 시점에 평가된다는 기술적 제약은 주석으로 명시되어 있고 실제로 factory 주입이 불가하다. 이 제약 때문에 현재 구조는 불가피하다. 단, DLQ monitor config 와 같이 별도 `continuation-worker.config.ts` 파일로 분리하면 파싱 로직과 큐 wire format 책임을 물리적으로 분리할 수 있다. 기능 오류는 없으나 향후 설정 항목이 늘어날 때 큐 파일 비대화를 예방하는 차원에서 검토 권장.

### [INFO] parsePositiveInt 로직 중복 (DRY 위반 가능성)
- 위치: `continuation-execution.queue.ts:528-539` (신규) vs `continuation-dlq-monitor.config.ts:48-52`
- 상세: `resolveContinuationWorkerConcurrency` 내 파싱 로직(`/^\d+$/ + Number.isInteger + > 0`)이 `continuation-dlq-monitor.config.ts` 의 `parsePositiveInt` 함수와 완전히 동일한 구조다. 주석도 이를 인식하고 "동일 규약" 이라고 명시하나, 코드 공유는 이뤄지지 않았다.
- 제안: 두 곳이 현재는 2개뿐이어서 즉각적 위험은 낮다. 하나가 변경될 때 다른 쪽이 누락될 수 있다. `execution-engine` 모듈 공통 유틸(예: `parse-positive-int.util.ts`)로 추출하거나, 설정 파일 분리 시 공유 파서로 통합하는 방안을 검토할 것.

### [INFO] process.env 직접 참조 — DIP 패턴과의 비일관성
- 위치: `continuation-execution.queue.ts:529` (`env: NodeJS.ProcessEnv = process.env`)
- 상세: `continuation-dlq-monitor.config.ts` 는 `useFactory` 를 통해 config 객체를 DI 컨테이너로 주입받아 서비스가 `process.env` 를 직접 읽지 않는 패턴을 명시적으로 적용한다(주석에 "review W-9, DIP" 로 근거 기록). 이번 변경은 `@Processor` 데코레이터 제약 때문에 동일 패턴 적용이 불가해 부득이하게 default parameter 로 `process.env` 를 주입받는 형태를 취했다. 결과적으로 동일 모듈 안에 두 가지 env 읽기 패턴이 공존하게 된다.
- 제안: 이는 NestJS `@Processor` 데코레이터의 정적 평가 타이밍에서 비롯된 프레임워크 제약이므로 현재 구현이 실용적으로 최선이다. 다만 향후 `@Processor` 가 동적 factory 를 지원하거나 NestJS 버전이 올라가면 DLQ monitor 와 동일한 패턴으로 통합 가능하다. 코드 주석("DI 이전 모듈 로드 시점")이 이 판단 근거를 이미 문서화하고 있어 가독성은 충분하다.

### [INFO] cancel 처리의 비동기 불일치 (기존 코드 — 이번 변경으로 표면화)
- 위치: `continuation-execution.processor.ts:421` (`void this.engine.applyCancellation(executionId)`)
- 상세: 이번 변경에서 직접 수정된 부분은 아니나, concurrency 가 1 → N 으로 상향될 경우 `void` fire-and-forget 패턴과 동시성 상호작용이 문제가 될 수 있다. `apply Cancellation` 이 sync 라고 주석에 기술되어 있지만, 동시성이 올라가면 cancel job 과 다른 타입 job 이 동시에 처리될 때 `rejectPending` 상태 조작 경쟁이 심화된다.
- 제안: `CONTINUATION_WORKER_CONCURRENCY` 를 기본 1 로 유지하는 정책은 이 위험을 현재 단계에서 차단한다. 향후 concurrency 를 상향하기 전에 `applyCancellation` 의 async 전환(`TODO` 주석 확인) 및 cancel-vs-other race 시나리오 통합 테스트를 선행할 것.

## 요약

이번 변경은 `CONTINUATION_WORKER_CONCURRENCY` 환경변수를 도입해 BullMQ continuation worker 의 concurrency 를 런타임에 조정 가능하게 한 최소한의 확장이다. `@Processor` 데코레이터의 정적 평가 제약을 정확히 파악하고 순수 파서 함수(`env` default parameter 패턴) 로 우회한 점, 기본값을 1(직렬) 로 유지해 기존 동작을 보존한 점, spec(§7.4/§11)/env.example/plan 을 동기화한 점은 아키텍처적으로 적절하다. 주요 개선 여지는 파싱 로직이 큐 파일 안에 인라인으로 위치해 DLQ monitor 의 전용 config 파일 패턴과 비일관성이 생긴다는 점, 그리고 동일한 `parsePositiveInt` 로직이 두 곳에 중복된다는 점이다. 두 가지 모두 현 규모에서 즉각적 위험은 낮으나, 설정 항목이 증가할 때 기술 부채로 누적될 수 있다. 레이어 경계, 순환 의존성, 확장성, 디자인 패턴 면에서는 별도 위반이 없다.

## 위험도

LOW
