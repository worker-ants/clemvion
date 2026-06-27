# 동시성(Concurrency) 리뷰 결과

## 발견사항

### 파일 1-3, 9 (DTO 파일 및 Spec 문서)
`create-trigger.dto.ts`, `update-trigger.dto.ts`, `trigger-dto-validation.spec.ts`, `spec/5-system/12-webhook.md` — 이 파일들은 순수 DTO 유효성 검사 데코레이터 변경(`@IsString/@MaxLength(255)` → `@IsUUID('4')`) 및 단위 테스트, spec 문서 업데이트다. 공유 상태·비동기 코드·스레드 관련 코드가 전혀 없으므로 동시성 관점에서 해당 없음.

### 파일 7-8 (e2e 테스트)
`chat-channel-trigger-create.e2e-spec.ts`, `webhook-trigger.e2e-spec.ts` — `crypto.randomBytes(8).toString('hex')` → `crypto.randomUUID()` 교체. 두 API 모두 동기적으로 안전하며, Jest 테스트는 기본적으로 순차 실행이므로 `createdTriggerIds` 배열 공유는 경쟁 조건 없음. `beforeAll`/`afterAll`은 `async/await`로 올바르게 처리됨.

### 파일 5: `workspace-invitations-pruner.service.ts` (신규 파일 — 동시성 관련 코드 존재)

- **[INFO]** `prune()` 의 에러 swallow로 인해 `removeOnFail` 설정이 실질적으로 dead code
  - 위치: `prune()` 메서드 (line ~1282-1295)
  - 상세: `try/catch`가 모든 예외를 삼키고 로그만 남긴다. 이로 인해 BullMQ 잡이 항상 "성공"으로 종료되어 `removeOnFail: { age: 30 * 24 * 60 * 60 }` 설정은 현재 동작 방식에서는 절대 발동되지 않는다. 코드 주석이 이를 인지("process 가 향후 재-throw 로 바뀔 때를 위한 방어적 설정")하고 있으나, 이 의도를 모르는 개발자는 `removeOnFail`이 실제로 동작한다고 오해할 수 있다. 또한 `pruneExpired` 실패 시 BullMQ의 자동 재시도(retry) 메커니즘을 활용할 수 없다.
  - 제안: `onModuleInit` 의 주석에 "현재 `process` 가 에러를 swallow 하므로 `removeOnFail` 은 미래 재-throw 전환 시를 위한 placeholder" 임을 명확히 기술하거나, 또는 `Job.opts.attempts` 등 BullMQ 재시도 정책 활용을 고려한다. 현 설계가 의도적이라면 INFO 수준.

- **[INFO]** `new Date()` 타임스탬프가 스케줄 fire 시각이 아닌 `prune()` 실행 시각 기준
  - 위치: `prune()` 메서드 line ~1284
  - 상세: BullMQ 큐 지연(Redis 백프레셔, 워커 과부하 등)이 발생할 경우, 실제 실행 시각이 04:00보다 늦어질 수 있다. `pruneExpired(new Date())`는 pruner가 실제 실행된 시점을 기준으로 만료 행을 삭제하므로, 지연 실행 시 04:10에 만료된 행도 다음날 04:00까지 잔존할 수 있다. 프루닝 정확도보다 안전성을 우선한 설계로 보이며, 초대 만료 정책 특성상(7일 TTL) 수 분 오차는 무해하다.
  - 제안: 현재 설계 유지 가능. 단, `job.timestamp`(BullMQ가 잡 생성 시각을 담음) 또는 `job.processedOn`을 활용해 스케줄 기준 시각으로 pruning 기준점을 맞추는 것도 고려할 수 있다.

- **[INFO]** `onModuleInit` 이 멀티 인스턴스에서 동시에 호출될 때의 안전성
  - 위치: `onModuleInit()` 메서드 (line ~1259-1276)
  - 상세: k8s replicas:2 환경에서 두 인스턴스가 동시에 기동할 경우 `upsertJobScheduler`를 동시에 호출할 수 있다. BullMQ의 `upsertJobScheduler`는 Redis Lua 스크립트를 통해 원자적·idempotent하게 동작하므로 경쟁 조건 없음. 코드 주석도 이를 명시("같은 ID 를 여러 번 등록해도 Redis 에 단일 repeatable entry 만 남아"). 설계 정확.
  - 제안: 없음. 올바른 구현.

### 파일 4, 6 (테스트 및 모듈 파일)
`workspace-invitations-pruner.service.spec.ts`, `workspaces.module.ts` — 단위 테스트(각 `beforeEach`로 독립 모듈 재생성)와 NestJS 모듈 등록이다. 동시성 이슈 없음.

---

## 요약

변경된 10개 파일 중 동시성 관련 코드는 `workspace-invitations-pruner.service.ts` 에만 존재한다. 이 서비스는 BullMQ의 Redis 중앙 스케줄링과 워커 락을 올바르게 활용하여 멀티 인스턴스 환경에서 중복 실행 없이 동작하며, `upsertJobScheduler`의 idempotency를 통해 동시 기동 경쟁 조건을 방지한다. 발견된 사항은 모두 INFO 수준으로, `prune()` 에러 swallow로 인한 `removeOnFail` dead code와 `new Date()` 타임스탬프 기준점 두 가지이며 둘 다 명시적 설계 결정으로 보인다. DTO 변경(파일 1-3)과 e2e 테스트 변경(파일 7-8)은 동시성과 무관하다.

## 위험도

LOW
