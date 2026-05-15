# Code Review 조치 보고서 — PR-B (수평 확장 인프라)

**리뷰 세션**: `review/2026-05-09_00-05-34/`
**원 PR**: 954dc9c4 (Part A) + ebf934e1 (Part B) + 14834cf3 (Part C)
**조치 PR**: 본 commit (PR-B 후속 ai-review 조치)

## 요약

- Critical 4건 / Warning 18건 / Info 13건 보고. 본 조치에서 처리: **C 4 / W 16 / I 5 = 25건**.
- 외부 API 정책·인프라 결정 의존 등 보류 항목: **W 1 / I 8 = 9건** (deferred).
- backend lint clean / unit 2856 / 2856 pass / build clean.

## 처리한 항목

### Critical (4/4)

| # | 발견사항 | 조치 위치 | 조치 내용 |
|---|----------|-----------|----------|
| C1 | V035 단일 트랜잭션 DDL lock — 운영 서비스 중단 위험 | `migrations/V035a__execution_node_log_create.sql` (rename + executeInTransaction=false), `migrations/V035b__execution_drop_execution_path.sql` (신규) | 마이그레이션을 V035a (CREATE + 데이터 이행, non-transactional) / V035b (DROP COLUMN, lock_timeout 3s) 로 분리. V035a 의 INSERT...SELECT 가 read traffic 을 막지 않으며, V035b 는 별도 후속 배포에서 적용. `ALTER TABLE` 직전 `SET lock_timeout = '3s'` 추가로 lock 대기 초과 시 즉시 롤백. |
| C2 | `void this.continuationBus.publish(...)` Redis 장애 시 silent error → execution 행잉 | `continuation-bus.service.ts` `publish()` | publish 내부에서 `.catch(err => logger.error(...)) → null` 체인 추가. 호출자는 reject 받지 않고 null 반환만 봄. inflight Set 으로 onModuleDestroy 가 graceful 대기. |
| C3 | `acquireLock` 단위 테스트 전무 | `continuation-bus.service.spec.ts` | `FakeRedis` 에 `set()` (NX semantics) + `eval()` (Lua owner 검증) stub 추가. `acquireLock / releaseLock` describe 신설 — SET NX 반환 분기, owner-mismatch 보호, publisher 에러 시 false 반환 검증 (총 4건). |
| C4 | `findById` 의 신규 executionPath 채움 미테스트 | `executions.service.spec.ts` | `findById → execution_node_log 기반 executionPath 채움` describe 신설 — log 채움·빈 배열 fallback·list 응답 N+1 회피 (총 3건). |

### Warning (16/18)

| # | 발견사항 | 조치 |
|---|----------|------|
| W1 | Redis 인증·TLS 미적용 | `RedisOptions` 에 `password` / `tls` 옵션 조건부 적용 (configService 기반). |
| W2 | Redis `error` 이벤트 핸들러 미등록 → 프로세스 crash 위험 | `publisher.on('error', ...)` / `subscriber.on('error', ...)` 등록. 로그만 남기고 진행. |
| W4 | AI 메시지 길이 검증이 서비스 레이어에만 — Redis 직접 publish 우회 가능 | `ai_message` 핸들러 내부에서 `MAX_MESSAGE_LENGTH` 재검증. 초과 시 silent drop + warn 로그. |
| W6 | 모듈 init 순서 race — subscribe 후 핸들러 등록 사이 메시지 drop | `subscribed` 플래그 + `isSubscribed()` 노출. `ExecutionEngineService.onModuleInit` 이 `registerContinuationHandlers` → `recoverStuckExecutions` 순서로 명시. |
| W7 | 모듈 경계 위반 (ExecutionsModule 이 engine entity 직접 import) | 한쪽 등록 위치 (`executions.module.ts`) 에 의도 명시 주석 추가. ExecutionEngineModule 도 자신 도메인이라 등록 유지 — 본격 캡슐화는 follow-up. |
| W8 | 분산 lock value 가 PID — 컨테이너 충돌 위험 | `lockToken = hostname() + ':' + randomUUID()`. owner 검증 Lua script 기반 `releaseLock` 신규 추가. |
| W9 | Redis 설정 falsy fallback | `host`/`port` 누락 시 `throw new Error(...)` — 기동 실패. |
| W10 | `findById` DB 왕복 증가 | `nodeExecutions` 와 `executionNodeLog` 조회를 `Promise.all` 병렬화 — RTT 1회 단축. |
| W11 | `appendExecutionPath` catch 경로 미테스트 | `execution-engine.service.spec.ts` 에 best-effort describe 신설 — insert reject 시 warn 로그 + 흐름 중단 없음. |
| W12 | `cancel` 핸들러 silent skip 미테스트 | `execution-engine.service.spec.ts` 에 cancel describe 추가. |
| W13 | `FakeRedis.set()` 미구현 | C3 와 함께 처리 (FakeRedis 에 set/eval 모두 추가). |
| W14 | `registerContinuationHandlers` 5개 핸들러 중복 패턴 | `resolvePending(executionId, value)` / `rejectPending(executionId, error)` 헬퍼 추출. 5개 핸들러가 모두 helper 사용. |
| W15 | `CHANNEL` 상수 미공개 — 테스트 하드코딩 | `export const CONTINUATION_CHANNEL` + spec 도 같은 이름 참조. 추가로 `RECOVERY_LOCK_KEY` 도 export. 테스트 하드코딩 검증. |
| W16 | `FakeExec.executionPath` 잔여 필드 | `executions.service.spec.ts` 의 type / baseFake 에서 제거. |
| W17 | `cancelWaitingExecution` 주석 outdated | `executions.service.ts` `stop()` 내 주석을 Redis pub/sub 흐름으로 갱신. |
| W18 | `onModuleDestroy` 가 in-flight publish 미대기 | `inflight: Set<Promise>` 유지. `onModuleDestroy` 가 `Promise.allSettled(inflight)` 후 `quit()`. |

### Info (5/13)

| # | 조치 |
|---|------|
| I1 | spec §9.2 에 `execution:continuation` 채널 + `exec:recover:lock` 두 전역 키 행 추가, §9.1 패턴 예외 각주 명시. |
| I2 | `Execution.entity.ts` 에 V035 이행 맥락 주석 추가 (`recursionDepth` 아래). |
| I3 | `executions.module.ts` 에 ExecutionNodeLog 이중 등록 의도 주석 추가. |
| I8 | `'exec:recover:lock'` 매직 문자열 → `RECOVERY_LOCK_KEY` 상수. |
| I10 | 로그 인젝션 방지 — `dispatch` 의 raw 로깅 시 `[\\x00-\\x1F\\x7F]` 제어문자 strip. |

## Deferred (배포 전·후 follow-up)

`plan/in-progress/ai-review-deferred-items.md` 또는 별도 백로그에서 처리 권장.

| # | 항목 | 이유 |
|---|------|------|
| W3 | `formData` 크기 제한 | controller / WS gateway 의 request body limit 정책. 본 PR scope (engine service) 밖. |
| W5 | 목록 응답 `executionPath` API 정책 | DTO 시그니처 유지로 호환 영향 0 (frontend 사용 0 grep 검증), 운영자에게 명시화는 follow-up CHANGELOG 항목으로. |
| I4 | BIGSERIAL `id` TS string 매핑 비교 주석 | 현재 코드가 `id` 를 직접 비교하지 않음. 향후 직접 비교 코드 추가 시 검토. |
| I5 | `ContinuationBusService` SRP 분리 (lock vs bus) | 락 사용처 증가 시 `DistributedLockService` 분리. 현재 단일 사용처. |
| I6 | `on()` 다중 핸들러 지원 | 현 사용처는 단일 등록. 필요 발생 시 확장. |
| I7 | 단일 채널 fan-out 인스턴스 N개 시 Map miss | 현재 규모 수용. 인스턴스 20+ 시 채널 세분화 / Redis Streams 검토. |
| I9 | `button_click`/`ai_message` payload 누락 — 부분 처리 | 본 조치에 button_click 추가 검증. ai_message 길이초과 silent drop 검증. payload 자체가 undefined 인 케이스는 추가 follow-up 가능. |
| I11 | `subscribers` Map 테스트 간 공유 정리 | beforeEach + afterEach 모두 clear 추가로 부분 보강됨. 모듈 변수 vs 테스트 클래스 책임 재구성은 별도 정리. |
| I12 | Recovery lock TTL bulk UPDATE 시간 보장 | 명시 release 로 expire 의존 제거됨 (W8 조치). 60초는 보수적. |
| I13 | TypeORM `select` 컬럼 + ORDER BY 관계 | 현재 `id` 는 select 에 포함되지 않으나 ORDER BY 는 동작 (TypeORM 5.x 검증). 버전 변경 시 명시 select 로 안정화 가능. |

## 검증

- `cd backend && npm run lint` — clean
- `npm test` — 171 suite / 2856 / 2856 pass
- `npm run build` — clean
- 신규 테스트: ContinuationBus 4건 (acquireLock / releaseLock / channel 상수 / publish 에러), ExecutionsService findById 3건, ExecutionEngine 4건 (cancel silent / button_click payload 누락 / ai_message 길이 silent drop / appendExecutionPath catch).
