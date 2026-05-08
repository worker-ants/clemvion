# Code Review 통합 보고서

## 전체 위험도
**HIGH** — `void publish()` 패턴으로 인한 Redis 장애 시 실행 행잉, V035 마이그레이션 단일 트랜잭션 DDL 락, 분산 정합성 핵심 경로 테스트 공백이 동시에 존재

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Performance / Concurrency | V035 마이그레이션: `executeInTransaction=true` 상태에서 `INSERT…SELECT` + `ALTER TABLE DROP COLUMN`이 단일 트랜잭션으로 묶여 있어, 대형 테이블에서 `AccessExclusiveLock`이 장시간 유지됨. 신규 실행 생성·조회 전체가 차단될 수 있음 (파일 주석 자체가 V035a/V035b 분리를 언급하나 실제로는 분리되지 않음) | `V035__execution_node_log.sql`, `V035__execution_node_log.conf` | 운영 DB 볼륨 기준으로 스테이징 소요시간 측정 후, V035a(CREATE TABLE + INSERT 이행, `executeInTransaction=false`) / V035b(DROP COLUMN, 별도 배포 시점)로 분리 적용. 또는 `SET lock_timeout = '3s'`를 DROP 직전에 추가해 lock 대기 초과 시 즉시 롤백 |
| 2 | Architecture / Concurrency | `void this.continuationBus.publish(...)` 패턴: Redis 장애 또는 직렬화 오류로 `publish()`가 reject되면 예외가 완전히 삼켜지고 `pendingContinuations`의 Promise resolver가 영원히 호출되지 않아 해당 execution이 `WAITING_FOR_INPUT` 상태로 행잉됨 | `execution-engine.service.ts` — `continueExecution`, `cancelWaitingExecution`, `continueButtonClick`, `continueAiConversation`, `endAiConversation` (5개 진입점) | `publish().catch(err => this.logger.error(...))` 체인 추가. 또는 `pendingContinuations` 측에 타임아웃 가드를 두어 Redis 장애 시에도 reject가 발생하도록 보완 |
| 3 | Testing | `acquireLock()` 분산 lock 메커니즘에 대한 단위 테스트 전무: SET NX semantics(첫 획득 `true`, 재획득 `false`), TTL 파라미터 전달, publisher connection 사용 여부 모두 미검증 | `continuation-bus.service.spec.ts` | `FakeRedis`에 `set()` 구현 추가 후 `acquireLock` describe 블록 신설. 반환 `'OK'` → `true`, `null` → `false`, NX/EX 옵션 전달 spy 검증 |
| 4 | Testing | `findById`의 신규 `executionPath` 조회 경로(`executionNodeLogRepository.find → nodeId 배열`)가 완전히 미테스트. `executionNodeLogRepo` mock은 주입되어 있으나 모든 테스트에서 빈 배열 고정 반환 | `executions.service.spec.ts` — `findById` 관련 케이스 | `findById` describe 추가: ① `executionNodeLogRepo.find` 호출 인수 검증, ② rows → `executionPath` 매핑 정확성 검증, ③ 빈 rows 시 `executionPath: []` 반환 검증 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | Redis 연결에 인증·TLS 미적용: `new Redis({ host, port })`에 `password`/`tls` 옵션 없음. 동일 네트워크 접근자가 `execution:continuation` 채널에 임의 메시지 publish 가능 (실행 강제 취소·재개·AI 메시지 주입) | `continuation-bus.service.ts` — `onModuleInit()` | `password: configService.get('redis.password')`, `tls: ...` 옵션 추가 |
| 2 | Security / Requirement | Redis `error` 이벤트 핸들러 미등록: ioredis는 연결 실패·재연결 한도 초과 시 `error` 이벤트를 emit하며, 리스너가 없으면 Node.js 프로세스가 즉시 crash됨 | `continuation-bus.service.ts` — `onModuleInit()` | `subscriber.on('error', ...)` / `publisher.on('error', ...)` 등록 |
| 3 | Security | `continueExecution`의 `formData?: unknown`에 크기 제한 없음: `continueAiConversation`은 10,000자 제한이 있으나 `formData`는 무제한. 수 MB payload가 모든 인스턴스에 fan-out됨 | `execution-engine.service.ts` — `continueExecution()` | controller 레이어에서 request body size 제한 명시 또는 서비스 레이어에서 serialized size 상한 적용 |
| 4 | Security | AI 메시지 길이 검증이 서비스 레이어에만 존재해 Redis 직접 publish로 우회 가능. `ai_message` 핸들러에서 재검증 없음 | `execution-engine.service.ts` — `continueAiConversation()` + `ai_message` 핸들러 | `ai_message` 핸들러 내부에서 `message.length > MAX_MSG_LEN` 재검증 추가 |
| 5 | API Contract / Architecture | 목록 조회(`findByWorkflow`) 응답의 `executionPath`가 항상 `[]`로 변경되어 단건 조회(`findById`)와 동일 필드명이 다른 값을 반환함. 기존 소비자에게 조용한 파괴적 변경 | `executions.service.ts` — `toExecutionDto()` | 목록 DTO에서 `executionPath` 필드를 제거하거나 `null`로 명시해 타입 레벨에서 의미 차이를 강제. API changelog/OpenAPI 스키마에 정책 명시 |
| 6 | Architecture / Concurrency | 모듈 초기화 순서 race: `ContinuationBusService.onModuleInit()`이 Redis 구독을 먼저 활성화한 뒤 `ExecutionEngineService.onModuleInit()`에서 핸들러를 등록하므로, 그 사이 수신 메시지가 silent drop됨 | `ContinuationBusService.onModuleInit()` vs `ExecutionEngineService.registerContinuationHandlers()` | 핸들러 등록 완료 후 `continuationBus.startSubscribing()`을 명시적으로 트리거하도록 초기화 순서 역전 |
| 7 | Dependency / Architecture | `ExecutionsModule`이 `execution-engine` 내부 엔티티(`ExecutionNodeLog`)를 직접 import해 `TypeOrmModule.forFeature()`에 독립 등록. 소유권 불명확으로 모듈 재구성 시 누락 위험 | `executions.module.ts`, `executions.service.ts` | `ExecutionNodeLog` 조회 책임을 `ExecutionEngineModule`이 export하는 서비스로 캡슐화하고, `executions` 모듈은 해당 서비스를 통해 접근 |
| 8 | Concurrency | 분산 lock value로 `process.pid` 사용: 컨테이너 환경에서 모든 인스턴스가 PID 1을 가질 수 있어 소유자 식별 불가. `releaseLock` 메서드 미구현으로 조기 해제 불가 | `continuation-bus.service.ts` — `acquireLock()` | `crypto.randomUUID()` 또는 `os.hostname() + ':' + process.pid` 사용. Lua script 기반 `releaseLock(key, token)` 추가 |
| 9 | Concurrency / Requirement | Redis 연결 설정값(`redis.host`/`redis.port`) 미설정 시 ioredis가 `localhost:6379`로 묵시적 연결. 운영 환경에서 환경 변수 누락 시 잘못된 Redis에 연결됨 | `continuation-bus.service.ts` — `onModuleInit()` | 값 조회 후 falsy이면 `throw new Error('redis.host / redis.port 설정 누락')` |
| 10 | Performance | `findById` DB 왕복 증가(기존 2→3회): execution + nodeExecutions + executionNodeLog가 순차 실행됨 | `executions.service.ts` — `findById()` | `nodeExecutions` + `executionNodeLog` 조회를 `Promise.all`로 병렬화하여 RTT 2회로 축소 |
| 11 | Testing | `appendExecutionPath` catch 블록(insert 실패 시 warn + 계속 진행) 미테스트. best-effort 설계의 핵심 경로 | `execution-engine.service.spec.ts` | `mockExecutionNodeLogRepo.insert.mockRejectedValueOnce(new Error('DB error'))` 케이스 추가, 흐름 중단 없음 + `logger.warn` 호출 검증 |
| 12 | Testing | `cancel` 핸들러의 silent skip(로컬 Map에 키 없을 때) 미테스트. `continue` 핸들러는 검증되어 있으나 `cancel`은 누락 | `execution-engine.service.spec.ts` | `cancel` 핸들러의 미등록 executionId에 대한 no-op 검증 추가 |
| 13 | Side Effect / Testing | `FakeRedis`에 `set()` 메서드 미구현: `acquireLock` 테스트 추가 시 `TypeError: this.publisher.set is not a function` 발생 | `continuation-bus.service.spec.ts` — `class FakeRedis` | NX semantics 지원하는 `set()` stub 구현 추가 |
| 14 | Maintainability | `registerContinuationHandlers` 내 5개 핸들러에 `pendingContinuations.get → if(!pending) return → .delete → .resolve/reject` 동일 패턴 반복. 변경 시 5곳 수정 필요 | `execution-engine.service.ts` — `registerContinuationHandlers()` | `resolvePending(executionId, value)` / `rejectPending(executionId, error)` 헬퍼 추출 |
| 15 | Maintainability | `CHANNEL` 상수(`'execution:continuation'`)가 서비스 내부 스코프에만 존재해 테스트가 문자열을 하드코딩. 채널명 변경 시 테스트가 조용히 오동작 | `continuation-bus.service.spec.ts:145` | `CHANNEL`을 `export const`로 공개하거나 별도 상수 파일로 분리 |
| 16 | Scope / Testing | `executions.service.spec.ts`의 `FakeExec` 타입 및 `baseFake`에 V035로 제거된 `executionPath: string[]` 필드 잔존. 엔티티와 픽스처 불일치 | `executions.service.spec.ts` — `FakeExec`, `baseFake` | `FakeExec.executionPath` 필드 및 `baseFake`의 `executionPath: []` 제거 |
| 17 | Requirement | `cancelWaitingExecution` 관련 주석이 "동기 함수로 `pendingContinuation.reject()` 만 트리거한다"고 기술하나, 실제는 Redis pub/sub 비동기 publish로 변경됨 | `executions.service.ts` — `stop()` 메서드 내 주석 | 주석을 비동기 Redis publish 흐름으로 갱신 |
| 18 | Concurrency | `onModuleDestroy` 이후 in-flight `void publish()` 호출 처리 미흡: `quit()` 이후 미완료 publish가 에러를 throw해도 `void`로 무시됨 | `continuation-bus.service.ts` — `onModuleDestroy` | `activePublishes` 카운터 유지 후 `Promise.allSettled(activePublishes)` 완료 후 `quit()` 호출 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Documentation | spec §9.2 Redis 키 테이블에 `exec:recover:lock` 누락. §7.4에는 기술됐으나 §9.2와 불일치. `{service}:{workspaceId}:{resource}` 패턴 미준수 예외도 미문서화 | `spec/5-system/4-execution-engine.md` §9.2 | 행 추가: `exec:recover:lock \| 부팅 시 stuck recovery 분산 lock (전역, workspace 미분리) \| 60초`. 패턴 예외 각주 명시 |
| 2 | Documentation | `Execution` 엔티티에서 `executionPath` 컬럼이 조용히 삭제되어 이행 맥락 주석 없음 | `execution.entity.ts` — `recursionDepth` 아래 | `// executionPath is tracked in execution_node_log table (V035).` 한 줄 추가 |
| 3 | Documentation | `ExecutionNodeLog`가 두 모듈에 이중 등록된 이유 주석 없어 향후 개발자가 중복으로 오인하고 제거 시도할 수 있음 | `executions.module.ts` / `execution-engine.module.ts` | 한쪽 등록 위치에 "이 모듈도 Repository를 직접 주입받으므로 별도 등록 필요" 주석 추가 |
| 4 | Performance | `id` BIGSERIAL → TypeScript `string` 매핑: DB `ORDER BY id ASC`는 수치 정렬이나, 애플리케이션 코드에서 직접 비교 시 문자열 사전순(`"9" > "10"`) 오류 가능 | `execution-node-log.entity.ts:21`, `executions.service.ts` | `id` 직접 비교 금지 및 "DB ORDER BY만 사용" 주석 명시 |
| 5 | Architecture | `ContinuationBusService`가 pub/sub 버스와 분산 락이라는 두 책임을 가짐 (SRP 위반). `publisher` 필드명이 락 용도를 포함함 | `continuation-bus.service.ts` — `acquireLock()` | 즉각 수정 불필요. 락 사용처 증가 시 `DistributedLockService` 분리 검토 |
| 6 | Architecture | `on()` 핸들러 단일 등록 제약: 동일 타입 재등록 시 마지막만 유효(Map.set 덮어쓰기). 다중 구독 필요 시 파괴적 변경 필요 | `continuation-bus.service.ts` — `on()` | `handlers` 타입을 `Map<ContinuationType, Array<handler>>`로 확장 검토. 현재는 덮어쓰기 시 `logger.warn` 추가로 최소 대응 |
| 7 | Performance | Continuation Bus 단일 채널 fan-out: 인스턴스 N개 환경에서 메시지당 N번 dispatch, N-1번이 Map miss로 무처리 | `continuation-bus.service.ts` — `const CHANNEL` | 현재 규모에서는 수용 가능. 인스턴스 20+ 시 execution별 채널 세분화 또는 Redis Streams 이전 경로를 spec에 명시 |
| 8 | Maintainability | `'exec:recover:lock'` 매직 문자열: 다른 lock 관련 상수(`STUCK_RECOVERY_STALE_MS`, `RECOVERY_LOCK_TTL_SECONDS`)는 상수화되어 있으나 키만 하드코딩 | `execution-engine.service.ts` — `recoverStuckExecutions()` | `private static readonly RECOVERY_LOCK_KEY = 'exec:recover:lock'` 추가 |
| 9 | Testing | `button_click`/`ai_message` 핸들러의 payload 누락(`undefined`, `{}`) 엣지케이스 미테스트. `buttonId: undefined`로 resolve되는 동작이 의도인지 불명확 | `execution-engine.service.spec.ts` | `payload: undefined` 케이스 resolve 값 확인 테스트 추가 |
| 10 | Security | 로그 인젝션 가능성: Redis 수신 raw 메시지를 그대로 `warn` 로그에 포함해 개행/ANSI 이스케이프로 로그 위조 가능 | `continuation-bus.service.ts:112` — `dispatch()` | `JSON.stringify(raw.slice(0, 200))` 또는 제어문자 strip 후 로깅 |
| 11 | Testing | 모듈 레벨 `subscribers` Map이 테스트 간 공유되어 `beforeEach` 이전 비정상 종료 시 이전 상태 오염 가능 | `continuation-bus.service.spec.ts:14` | `subscribers`를 `beforeEach` 내부로 이동하거나 `afterEach`에서도 `.clear()` 추가 |
| 12 | Database | Recovery lock TTL(60초)이 bulk UPDATE 실행 시간을 보장하지 않음: 60초 초과 시 다른 인스턴스가 동시 UPDATE 가능 (데이터 오손은 없으나 중복 UPDATE 발생) | `execution-engine.service.ts` — `RECOVERY_LOCK_TTL_SECONDS = 60` | TTL을 300초로 상향하거나, 완료 후 명시적 `DEL` 호출로 조기 반환 |
| 13 | Database | `executionPath` 조회 시 `select: { nodeId: true }` + `order: { id: 'ASC' }` 조합에서 TypeORM 버전별로 SELECT 목록 외 컬럼 ORDER BY 처리가 다를 수 있음 | `executions.service.ts:110` | `select: { nodeId: true, id: true }`로 명시하거나 현 상태 유지(`.map(r => r.nodeId)`로 후처리됨) |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Performance | **HIGH** | V035 단일 트랜잭션 DDL 락으로 운영 서비스 중단 위험 |
| Concurrency | **HIGH** | `void publish()` 패턴으로 Redis 장애 시 실행 행잉, 모듈 초기화 race window |
| Testing | **HIGH** | `acquireLock` 전무 테스트, `findById` 신규 경로 미테스트, `appendExecutionPath` catch 경로 미테스트 |
| Security | **MEDIUM** (네트워크 격리 미흡 시 HIGH) | Redis 인증/TLS 미적용, `formData` 크기 무제한, AI 메시지 검증 우회 가능 |
| Architecture | **MEDIUM** | `void publish()` 오류 파기(CRITICAL 동일), 모듈 경계 위반, `executionPath` API 불일치 |
| Database | **MEDIUM** | V035 DDL 락, lock value PID 문제, lock TTL/실행시간 불일치 |
| API Contract | **MEDIUM** | `executionPath` 목록 응답 silent breaking change, continuation 에러 계약 제거 |
| Requirement | **MEDIUM** | Redis error 핸들러 미등록(프로세스 crash 위험), 주석/구현 불일치 |
| Side Effect | **MEDIUM** | `void publish()` silent loss, `executionPath` silent breaking change |
| Dependency | **LOW** | 모듈 경계 위반(엔티티 직접 교차 참조) |
| Maintainability | **LOW** | 5중 반복 핸들러 패턴, 매직 문자열, `CHANNEL` 상수 비공유 |
| Documentation | **LOW** | spec §9.2 누락, 엔티티 이행 맥락 주석 없음 |
| Scope | **LOW** | `FakeExec` 잔여 필드, 목록 API `executionPath` 의도적 변경 |

---

## 발견 없는 에이전트
없음 (전 에이전트 발견사항 있음)

---

## 권장 조치사항

1. **[즉시 — 배포 전 필수]** `void this.continuationBus.publish(...)` 5개 진입점에 `.catch(err => this.logger.error(...))` 체인 추가 — Redis 장애 시 무음 행잉 방지
2. **[즉시 — 배포 전 필수]** `subscriber.on('error', ...)` / `publisher.on('error', ...)` 등록 — 미등록 시 프로세스 crash
3. **[즉시 — 운영 배포 전]** V035 마이그레이션을 V035a(CREATE + INSERT, `executeInTransaction=false`) / V035b(DROP COLUMN, 후속 배포)로 분리하거나 스테이징에서 실행 시간 측정 후 결정
4. **[단기]** `acquireLock` 단위 테스트 및 `findById` executionPath 신규 경로 테스트 추가 — 핵심 분산 정합성 로직의 테스트 공백 보완
5. **[단기]** Redis 연결에 `password`/`tls` 옵션 추가 (환경 변수 기반), `redis.host`/`redis.port` 미설정 시 기동 실패 처리
6. **[단기]** 목록 응답 DTO에서 `executionPath` 필드 제거 또는 `null` 명시, API changelog/OpenAPI 스키마 반영
7. **[단기]** `acquireLock` lock value를 `crypto.randomUUID()` 또는 `os.hostname() + ':' + process.pid`로 교체
8. **[중기]** `FakeExec.executionPath` 및 `baseFake` 잔여 필드 제거, `CHANNEL` 상수 공개, `RECOVERY_LOCK_KEY` 상수화
9. **[중기]** `appendExecutionPath` catch 경로, `cancel` silent skip, `button_click`/`ai_message` payload 누락 케이스 테스트 추가
10. **[중기]** spec §9.2에 `exec:recover:lock` 전역 키 항목 추가, `Execution` 엔티티에 이행 맥락 주석 추가