# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `EXECUTION_SEQ_TTL_SECONDS` 환경 변수 읽기 — 프로덕션 코드(ExecutionSeqAllocator 생성자)에 이미 존재하는 읽기이며 테스트 파일이 새로 도입한 것이 아님. 테스트 내 `makeProvider` 어댑터도 환경 변수를 건드리지 않는다. 단, `REDIS_HOST` / `REDIS_PORT` 는 테스트 파일 모듈 스코프에서 즉시 평가(`const` 선언)되므로 해당 변수가 프로세스 시작 시 설정돼야 함 — 이는 docker-compose.e2e.yml 변경으로 이미 보장됨.
  - 위치: `execution-seq-allocator-load.e2e-spec.ts` L86-L87
  - 상세: `process.env.REDIS_HOST ?? 'redis'` 가 모듈 로드 시 평가됨. 테스트 런타임 중 환경 변수 변경은 반영 안 됨. 설계 의도와 일치하므로 문제 없음.
  - 제안: 해당 없음.

- **[INFO]** Redis 키 잔류 가능성 — 테스트가 각 `it` 블록에서 `allocA.release(executionId)` 를 호출하지만 `allocB.release(executionId)` 는 호출하지 않는다. `release` 는 (1) in-memory fallbackCounters 삭제 + (2) best-effort Redis DEL 을 수행한다. `allocB` 의 Redis DEL 이 생략돼 `exec:seq:<uuid>` 키가 TTL(기본 86400초)까지 Redis에 남는다.
  - 위치: `execution-seq-allocator-load.e2e-spec.ts` L151-L153, L185-L187, L218-L220
  - 상세: executionId 가 매번 `randomUUID()` 로 고유하게 생성되므로 **테스트 간 상태 오염은 없다**. Redis TTL이 결국 정리하므로 데이터 누수도 무해. 단, `allocB` 의 in-memory fallbackCounters 도 `afterAll` 에 정리되지 않는다 — `afterAll` 에서 `redisB.quit()` 만 하므로 `allocB.fallbackCounters` 는 GC에 맡긴다. 테스트 프로세스가 종료하는 순간 자동 해제되므로 실질적 영향 없음.
  - 제안: 명시성을 위해 `allocB.release(executionId)` 도 `finally` 블록에 추가할 수 있으나 비필수.

- **[INFO]** `makeProvider` 함수가 `as never` 타입 캐스팅 사용 — `RedisConnectionProvider` 의 실제 타입 구조(Injectable 데코레이터 등)를 우회해 duck-type 어댑터를 주입한다. 이는 테스트 스코프 한정이며 프로덕션 코드 시그니처를 변경하지 않는다.
  - 위치: `execution-seq-allocator-load.e2e-spec.ts` L120-L121
  - 상세: `ExecutionSeqAllocator.constructor` 가 `RedisConnectionProvider` 를 타입으로 받는데, 테스트 어댑터는 `getClient` / `getClientOrNull` 만 구현한다. `as never` 캐스팅으로 컴파일러를 통과시킴. 프로덕션 API 시그니처 불변.
  - 제안: 해당 없음 (테스트 전용 패턴으로 수용 가능).

- **[INFO]** `docker-compose.e2e.yml` — `backend-e2e-runner` 서비스에 `REDIS_HOST: redis` / `REDIS_PORT: "6379"` 환경 변수 추가. 기존 기본값(`?? 'redis'`)과 동일한 값이므로 런타임 동작 변경 없음. `backend-e2e` 서비스(이미 `REDIS_HOST: redis` 보유)에는 영향 없음.
  - 위치: `docker-compose.e2e.yml` L648-L652
  - 상세: 추가된 환경 변수가 기존 스펙 동작을 바꾸지 않으며, 의존성을 명시적으로 선언하는 것이 목적임.
  - 제안: 해당 없음.

- **[INFO]** 네트워크 호출(Redis INCR/EXPIRE/DEL) — 의도된 외부 서비스 호출. 이 테스트의 존재 목적이 실 Redis 연결을 통한 경험적 검증이므로 부작용이 아닌 설계 의도임. `afterAll` 에서 `quit()` 으로 연결을 정리한다.
  - 위치: `execution-seq-allocator-load.e2e-spec.ts` L124-L129
  - 상세: `redisA?.quit()` / `redisB?.quit()` 의 null-guard (`?.`) 와 `.catch(() => undefined)` 로 `beforeAll` 실패 시에도 안전하게 정리됨.
  - 제안: 해당 없음.

## 요약

변경 내용은 신규 e2e 테스트 파일 1개와 docker-compose 환경 변수 추가, plan 문서 갱신으로 구성된다. 신규 테스트는 프로덕션 코드의 어떠한 시그니처·인터페이스·전역 상태도 변경하지 않는다. Redis 키(`exec:seq:<uuid>`)가 `allocB.release()` 미호출로 TTL 까지 잔류하지만, 매 테스트마다 UUID 가 고유하므로 테스트 간 오염이 없고 TTL 만료로 자동 정리된다. docker-compose 변경은 기존 기본값과 동일한 환경 변수를 명시적으로 선언하는 것뿐이며 동작 변경은 없다. 의도하지 않은 부작용은 발견되지 않았다.

## 위험도

NONE
