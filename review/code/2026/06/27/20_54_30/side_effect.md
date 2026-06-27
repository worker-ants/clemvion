# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `releaseBoth()` 가 `allocA.release()` 뒤 즉시 `allocB.release()` 를 동기 호출하며, 각 `release()` 내부에서 `client.del(key)` 가 비동기 fire-and-forget 으로 발사된다.
  - 위치: `codebase/backend/test/execution-seq-allocator-load.e2e-spec.ts` 라인 135–138 (서비스), 테스트 라인 135–138
  - 상세: `release()` 는 동기 메서드이므로 `releaseBoth()` 반환 직후 두 개의 `DEL` 명령이 큐잉되지만, `afterAll` 의 `quit()` 가 먼저 호출될 경우 `DEL` 이 전송되기 전에 연결이 닫힐 수 있다. 서비스 코드 자체가 "DEL 실패는 TTL 이 회수한다"고 수용한 trade-off 이므로, 테스트 문맥에서도 허용 가능하다. 다만 `DEL` 을 기다리지 않으면 테스트 실행 후 Redis 에 `exec:seq:<uuid>` 키가 잠시 잔류한다(TTL=24h).
  - 제안: e2e 테스트 환경이 전용 Redis 를 사용하므로 실질 영향은 없다. 명시적 cleanup 이 필요하다면 `releaseBoth` 를 async 로 전환해 `client.del()` 을 `await` 할 수 있으나, 현재 코드는 서비스 계약을 그대로 따른 것으로 변경 필수 아님.

- **[INFO]** 모듈-레벨 상수 `REDIS_HOST` / `REDIS_PORT` 가 `process.env` 를 읽는다.
  - 위치: 라인 66–67
  - 상세: 환경 변수 읽기는 모듈 로드 시점 1회 평가된다. 의도된 패턴이며 사이드 이펙트는 없다. docker-compose `backend-e2e-runner` 서비스에 동일 값을 명시(`REDIS_HOST: redis`, `REDIS_PORT: "6379"`)해 의존성이 코드와 인프라 양쪽에 고정됐다.
  - 제안: 없음.

- **[INFO]** `allocA` / `allocB` 인스턴스의 `fallbackCounters`(in-memory Map) 가 각 테스트 케이스 사이에 리셋되지 않는다.
  - 위치: `ExecutionSeqAllocator.fallbackCounters`, 테스트 `beforeAll` (라인 111–128)
  - 상세: 각 테스트가 `randomUUID()` 로 고유 `executionId` 를 생성하고 `finally` 에서 `releaseBoth()` 를 호출하므로 Map 항목은 삭제된다. 테스트 간 상태 오염 경로 없음.
  - 제안: 없음.

- **[INFO]** `allocateConcurrentlyAcrossInstances` 가 `total` 이 홀수이면 `perInstance = total / 2` 가 정수가 아니어서 호출 횟수가 예상과 달라진다.
  - 위치: 라인 95
  - 상세: 현재 모든 호출처가 `N = 1000` (짝수)을 전달하므로 문제가 없다. 향후 홀수 인수 사용 시 잠재적 오작동 경로가 있다.
  - 제안: `const perInstance = Math.floor(total / 2)` 또는 입력 검증 추가. 현재 코드 범위에서는 차단 불필요.

- **[INFO]** `docker-compose.e2e.yml` 변경은 `backend-e2e-runner` 서비스에 `REDIS_HOST` / `REDIS_PORT` 환경 변수를 추가한다.
  - 위치: `docker-compose.e2e.yml` +4/+5 라인
  - 상세: 기존에 `backend-e2e` 서비스에는 이미 동일 변수가 설정되어 있었다. 이번 추가는 runner 컨테이너(테스트 프로세스)에도 같은 값을 노출하는 것으로, 신규 e2e spec 이 runner 내부에서 직접 ioredis 연결을 열 때 필요한 설정이다. 기존 서비스 동작에는 영향 없다.
  - 제안: 없음.

## 요약

이번 변경은 신규 e2e 테스트 파일 추가와 docker-compose runner 환경 변수 보강으로 구성된다. 전역 변수 도입, 공유 상태 변경, 시그니처 변경, 공개 API 수정은 전혀 없다. `release()` 의 비동기 `DEL` fire-and-forget 패턴이 테스트 종료 직후 Redis 에 키를 일시 잔류시킬 수 있으나, 이는 서비스 코드의 수용된 trade-off 를 테스트가 그대로 따른 것이며 전용 Redis 환경에서 실질 영향은 없다. 환경 변수 읽기는 모듈 로드 시 1회이며 기존 코드와 인프라 설정이 정합한다. 의도하지 않은 부작용은 발견되지 않았다.

## 위험도

NONE
