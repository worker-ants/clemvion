# 부작용(Side Effect) 리뷰

## 발견사항

### [INFO] 환경 변수 읽기 — 모듈 레벨 상수로 고정
- 위치: `codebase/backend/test/execution-seq-allocator-load.e2e-spec.ts` L66–67
- 상세: `REDIS_HOST` / `REDIS_PORT` 를 모듈 평가 시점(import 단계)에 `process.env` 에서 읽어 상수로 고정한다. 이는 의도된 동작이며 부작용이 아니다. 단, `process.env` 를 변경하는 다른 테스트 파일이 같은 Jest worker 에서 먼저 실행되면 원하지 않는 값이 주입될 수 있다. 현재 구조상(e2e 전용 프로세스) 위험은 낮다.
- 제안: 현행 유지 가능. 우려 시 `beforeAll` 안으로 이동해 실행 시점에 읽을 수 있다.

### [INFO] 외부 네트워크 호출 — 의도된 실 Redis 연결
- 위치: `execution-seq-allocator-load.e2e-spec.ts` `beforeAll` (L143–155)
- 상세: `new Redis(...)` 두 개를 생성해 실제 Redis 서버로 TCP 연결을 맺고 `INCR`, `PING`, `DEL`(release 내부) 명령을 발행한다. 이는 파일 주석이 명시한 **의도된** e2e 부작용이다. `afterAll` 에서 `quit()` 로 정리한다.
- 제안: 이슈 없음.

### [INFO] Redis 키 잔류 — `exec:seq:<uuid>` TTL(24h) 잔류
- 위치: `execution-seq-allocator-load.e2e-spec.ts` 각 테스트 `finally` 블록
- 상세: `releaseBoth()` 가 `allocA.release()` + `allocB.release()` 를 모두 호출하므로, 이전 리뷰 세션(20_40_18)의 WARNING(allocB 누락)은 현재 코드에서 이미 수정됐다. 각 테스트는 `randomUUID()` 기반 키를 사용해 실행 간 격리가 보장된다. `release()` 는 allocator 의 in-memory 카운터를 삭제하지만 Redis 키 자체는 TTL 만료까지 남는다 — 이는 `ExecutionSeqAllocator` 의 기존 설계 동작이며 본 변경이 새로 도입한 부작용이 아니다.
- 제안: 이슈 없음.

### [INFO] 전역 변수 없음 확인
- 위치: `execution-seq-allocator-load.e2e-spec.ts` 전체
- 상세: 모든 상태(`redisA`, `redisB`, `allocA`, `allocB`)는 `describe` 스코프 지역 변수이고, 모듈 레벨 상수(`ALLOC_COUNT`, `NS_PER_MS`, `LOG_PREFIX`)는 불변이다. 전역 변수 도입 없음.
- 제안: 이슈 없음.

### [INFO] 환경 변수 추가(docker-compose.e2e.yml) — 명시적 선언, 중복 없음
- 위치: `docker-compose.e2e.yml` `backend-e2e-runner` 서비스 `environment` 섹션
- 상세: `REDIS_HOST: redis` / `REDIS_PORT: "6379"` 를 `backend-e2e-runner` 에 추가했다. 이는 이미 `backend-e2e` 서비스에 있던 값과 동일하며, runner 컨테이너가 Redis 에 직접 연결하는 e2e spec 을 위한 의도된 추가다. 기존 서비스에 대한 변경이 아니어서 다른 서비스 동작에 영향 없다.
- 제안: 이슈 없음.

### [INFO] 공개 API·시그니처 변경 없음
- 위치: 모든 변경 파일
- 상세: 변경된 파일은 e2e 테스트 파일·docker-compose·plan·review 문서에 한정된다. 프로덕션 코드 시그니처 변경 없음. 기존 호출자에 영향 없음.
- 제안: 이슈 없음.

### [INFO] 이벤트/콜백 변경 없음
- 위치: 모든 변경 파일
- 상세: 이벤트 등록·해제, 콜백 변경 없음.
- 제안: 이슈 없음.

## 요약

이번 변경은 신규 e2e 테스트 파일, docker-compose 환경 변수 추가, plan/review 문서 갱신으로 구성된다. 의도치 않은 상태 변경, 전역 변수 도입, 파일시스템 부작용, 시그니처/인터페이스 변경은 없다. 외부 네트워크 호출(실 Redis 연결)은 e2e 티어에서 의도된 동작이며 `afterAll` 에서 정상 정리된다. `releaseBoth()` 헬퍼가 양쪽 allocator 를 모두 해제해 lifecycle 계약을 완결하므로 in-memory 잔류 위험도 없다. 환경 변수 읽기는 모듈 레벨 상수 패턴이나 e2e 전용 프로세스 환경에서 충분히 안전하다. 부작용 관점의 위험 요소가 없다.

## 위험도

NONE
