## 발견사항

### [WARNING] 모듈 경계 위반 — `ExecutionNodeLog` 엔티티 직접 교차 참조
- **위치**: `executions.module.ts:4`, `executions.service.ts:10,42`
- **상세**: `ExecutionsModule`이 `execution-engine` 모듈의 내부 폴더(`../execution-engine/entities/execution-node-log.entity`)에서 엔티티를 직접 import하고 `TypeOrmModule.forFeature()`에 등록한다. 이는 두 모듈 간 암묵적 결합을 만든다. `ExecutionEngineModule`이 해당 엔티티나 Repository를 export하지 않으면서 `ExecutionsModule`이 소유권 없이 사용하는 구조다.
- **제안**: `ExecutionNodeLog` 엔티티를 `shared` 모듈로 분리하거나, `ExecutionEngineModule`이 `TypeOrmModule.forFeature([ExecutionNodeLog])`를 export해 `ExecutionsModule`이 재등록 없이 주입받도록 한다. 현재처럼 두 모듈이 동일 엔티티를 각자 `forFeature()`에 등록하는 것은 TypeORM 내부에서 동작하지만, 소유권이 불명확해 이후 모듈 재구성 시 누락이 생기기 쉽다.

---

### [WARNING] 테스트 픽스처 `FakeExec`에 삭제된 컬럼 잔존
- **위치**: `executions.service.spec.ts:22`
- **상세**: `FakeExec` 타입에 `executionPath: string[]` 필드가 남아있고 `baseFake`도 `executionPath: []`를 초기화한다. 실제 `Execution` 엔티티에서 해당 컬럼은 V035 마이그레이션으로 제거됐다. 픽스처가 삭제된 컬럼을 계속 포함하면 미래 개발자가 엔티티에 해당 필드가 실제 존재한다고 오인할 수 있다.
- **제안**: `FakeExec` 타입과 `baseFake` 초기값에서 `executionPath` 필드를 제거한다.

---

### [WARNING] `ioredis` 직접 인스턴스화 — 중앙화된 연결 관리 우회
- **위치**: `continuation-bus.service.ts:57-58`
- **상세**: `onModuleInit`에서 `new Redis({ host, port })`를 두 번 직접 호출해 publisher/subscriber 커넥션을 생성한다. 프로젝트에 이미 `ioredis` 기반 NestJS 모듈(예: `@nestjs-modules/ioredis`, `@liaoliaots/nestjs-redis`)이 있다면 커넥션 풀이 분리되어 총 Redis 연결 수가 늘어난다. package.json 없이 확인이 불가하나, 기존 Redis 클라이언트 주입 패턴과의 일관성 점검이 필요하다.
- **제안**: 프로젝트에 NestJS Redis 모듈이 있다면 해당 모듈의 `getRedisToken()` 등으로 커넥션을 주입받는 방식으로 통일한다. 없다면 현 방식은 허용되나 주석에 이유를 명시한다.

---

### [INFO] Recovery 분산 락 키가 스펙 Redis 네이밍 컨벤션 불일치
- **위치**: `execution-engine.service.ts` (recoverStuckExecutions), `spec/5-system/4-execution-engine.md §9.1`
- **상세**: 락 키가 `'exec:recover:lock'`으로 workspaceId 세그먼트가 없다. 스펙 §9.1의 패턴 `{service}:{workspaceId}:{resource}:{id}:{sub}`를 따르지 않는다. 인스턴스 레벨 락이므로 workspaceId 포함이 의미 없다는 의도는 이해되나, 컨벤션 예외가 문서화되어 있지 않다.
- **제안**: 스펙 §9.2 "용도별 키 정의" 테이블에 `exec:recover:lock` 항목과 TTL(60초), 예외 사유를 명시한다.

---

### [INFO] `publisher` 커넥션의 이중 역할 — pub/sub 발행 + 분산 락
- **위치**: `continuation-bus.service.ts:77, 107`
- **상세**: `this.publisher`가 `publish(CHANNEL, ...)` pub/sub 발행과 `set(key, ..., 'NX')` 분산 락 획득 모두에 사용된다. ioredis에서 publisher 커넥션은 subscribe 모드가 아니므로 일반 명령어도 실행 가능해 동작상 문제는 없다. 단, `acquireLock`이 `ContinuationBusService`의 public API가 됨으로써 이 서비스가 pub/sub 버스와 분산 락이라는 두 책임을 동시에 갖게 된다.
- **제안**: 현 범위에서는 허용 가능하나, 락 기능이 확장된다면 `DistributedLockService`로 분리를 검토한다.

---

### [INFO] 테스트 파일의 모듈 스코프 `subscribers` Map — 테스트 격리 취약점
- **위치**: `continuation-bus.service.spec.ts:16`
- **상세**: `subscribers`가 describe 블록 바깥 모듈 스코프에 선언돼 있다. `beforeEach`에서 `subscribers.clear()`를 호출하므로 정상 케이스에서는 격리되지만, 테스트가 `beforeEach` 이전에 비정상 종료되면 이전 상태가 남아 후속 테스트를 오염시킬 수 있다.
- **제안**: `subscribers`를 `describe` 블록 내부로 이동시키거나, `afterEach`에서도 `subscribers.clear()`를 호출해 이중 보호한다.

---

## 요약

이번 변경에서 추가된 외부 패키지는 `ioredis`이며, 이는 Redis pub/sub 및 분산 락 구현을 위한 적절한 선택이다. 취약점이나 라이선스 비호환 문제는 식별되지 않는다. 핵심 위험은 외부 패키지가 아닌 **내부 모듈 경계 위반**에 있다 — `ExecutionsModule`이 `ExecutionEngineModule` 소유 엔티티를 직접 교차 참조하며 독립적으로 `forFeature()`에 등록하는 패턴은 소유권 불명확으로 인해 이후 모듈 재구성 시 누락과 버그를 유발할 수 있다. 나머지 사항은 동작 정합성보다는 일관성과 유지보수성에 관한 개선 권고다.

## 위험도

**LOW**