# 성능(Performance) 코드 리뷰

## 발견사항

### 발견사항 없음 (NONE)

이번 변경은 매우 좁은 범위로 구성되어 있으며, 실질적인 성능 리스크가 없다.

---

## 변경 범위 요약

| 파일 | 변경 내용 |
|------|-----------|
| `.env.example` | `CONTINUATION_WORKER_CONCURRENCY` 환경변수 문서화 |
| `continuation-execution.queue.ts` | `resolveContinuationWorkerConcurrency()` 순수 파서 함수 + 상수 추가 |
| `continuation-execution.processor.ts` | `@Processor` 데코레이터에 `concurrency` 옵션 주입 |
| `continuation-execution.queue.spec.ts` | 파서 함수 단위 테스트 추가 |
| `spec/5-system/4-execution-engine.md` | §7.4 / §11 표 행 추가 |
| `plan/in-progress/continuation-resume-optional-followups.md` | 항목 완료 체크 및 frontmatter 갱신 |

---

## 각 관점별 검토

### 1. 알고리즘 복잡도

`resolveContinuationWorkerConcurrency()` 는 단일 환경변수를 파싱하는 O(1) 함수다. 정규식 `/^\d+$/` 검증은 입력 길이에 비례하지만 환경변수 값이 수십 자를 넘을 수 없으므로 실질적으로 O(1)이다. 문제 없음.

### 2. N+1 쿼리/호출

해당 없음. 이번 변경은 BullMQ Worker 의 `concurrency` 설정값을 결정하는 초기화 코드이며, 런타임 반복 호출 경로에 DB / Redis 호출을 추가하지 않는다.

### 3. 메모리 할당

`resolveContinuationWorkerConcurrency()` 는 모듈 로드 시점에 **단 1회** 호출되어 데코레이터 인자로 전달된다. 이후 런타임에 재호출되지 않는다. 불필요한 객체 생성이나 메모리 누수 가능성 없음.

### 4. 캐싱

BullMQ Worker concurrency 는 프로세스 기동 시 1회 고정된다. 이 값 자체가 캐시 역할을 하므로 추가적인 캐싱 레이어가 불필요하다. 적절한 설계.

### 5. 블로킹 I/O

`resolveContinuationWorkerConcurrency()` 는 `process.env` 접근(동기, O(1))만 수행한다. 블로킹 I/O 없음.

### 6. 불필요한 연산

함수 내부 분기는 `undefined` 체크 → 정규식 선검증 → `Number()` 변환 → `isInteger` + `> 0` 검증 순으로 단락평가(short-circuit)된다. 중복 계산 없음.

`@Processor` 데코레이터 인자 평가 시점에 함수를 1회 호출하는 설계는 `SHUTDOWN_GRACE_MS` 등 다른 유사 패턴과 일관된다. 모듈 초기화 비용이 미미하다.

### 7. 데이터 구조

환경변수 값으로 단순 `number` 를 반환하여 BullMQ `WorkerOptions.concurrency` 에 전달한다. BullMQ 내부에서 이 값은 세마포어 카운터로 사용된다. 올바른 자료형 선택.

### 8. 지연 로딩

데코레이터 인자는 모듈 로드 시점에 평가된다. 이는 TypeScript/NestJS 데코레이터의 필수 제약이며, 지연 로딩이 구조적으로 불가하다. 코드 주석에도 이 제약이 명시되어 있어 의도적 선택임이 분명하다.

---

## 추가 관찰 (성능 관련 정보성 메모)

- **INFO**: `concurrency: 1` (기본값)은 단일 Worker 인스턴스당 continuation job 을 순차 처리한다. 다중 인스턴스 배포(수평 확장) 환경에서는 `인스턴스 수 × 1` 의 실효 병렬도가 적용된다. 인스턴스당 직렬은 rehydration slow path(`rehydrateContext` / `loadAndBuildGraph`)에서 DB 커넥션 풀 경합을 억제하는 보수적 기본값으로 적절하다. 운영에서 setup 직렬화 latency 가 관측될 때 `CONTINUATION_WORKER_CONCURRENCY` 를 올리면 되며, 이 값을 높일수록 DB 커넥션 풀 사용량이 비례해 증가함을 고려해야 한다. 이미 .env.example 주석에 안내되어 있다.

- **INFO**: `void this.engine.applyCancellation(executionId)` (processor.ts `cancel` case) 는 fire-and-forget 이며 TODO 주석(`async 전환 시 await 복원`)이 이미 달려있다. 이번 변경 범위 밖이지만, cancel 실패가 무음으로 소실될 수 있어 향후 성능/신뢰성 관점 개선 대상이다.

---

## 요약

이번 변경(`CONTINUATION_WORKER_CONCURRENCY` ENV 설정화)은 BullMQ Worker 초기화 경로에 순수 파서 함수 1개와 상수 1개를 추가한 최소 범위 변경이다. 모든 연산은 모듈 로드 시 1회 수행되며, 런타임 반복 경로에 추가 비용이 없다. 알고리즘 복잡도, N+1 쿼리, 메모리 할당, 블로킹 I/O 등 주요 성능 관점에서 발견된 문제가 없다. 기본값 1(직렬)은 rehydration slow path 의 DB 부하를 고려한 보수적이고 적절한 선택이다.

## 위험도

NONE
