# 유지보수성(Maintainability) 리뷰

## 발견사항

### 파일 1: codebase/backend/test/execution-seq-allocator-load.e2e-spec.ts

- **[INFO]** 중복 코드 — 테스트 1·2 에서 동일한 "N=1000, perInstance=N/2, call-array 생성 + await Promise.all" 패턴이 그대로 반복됨
  - 위치: 라인 133-143 (테스트 1), 라인 158-168 (테스트 2)
  - 상세: 두 블록은 `executionId` 접두사와 `start` 타이머 유무만 다르고 구조가 동일하다. 향후 N 값 변경이나 인터리브 방식 수정 시 두 곳을 동시에 고쳐야 한다.
  - 제안: `async function runConcurrentAllocations(allocA, allocB, executionId, N)` 헬퍼로 추출하면 단일 변경 포인트로 수렴된다.

- **[INFO]** 매직 넘버 분산 — `1e6`(나노→밀리초 변환), `0.95`(p95), `Math.floor` 인덱스 계산이 인라인으로 등장
  - 위치: 라인 169, 202, 207
  - 상세: `1e6` 은 ns→ms 변환 상수임을 주석 없이 사용하고, `0.95` 퍼센타일 계산도 반복된다. `throughput` 계산 공식 `(N / elapsedMs) * 1000` 역시 단위 설명이 인라인 주석으로만 처리된다.
  - 제안: `const NS_PER_MS = 1e6;`, `const P95_RATIO = 0.95;` 상수로 이름을 부여하거나, `hrtime.bigint` 를 래핑하는 소형 유틸(`elapsedMsSince(start)`)을 로컬에 두면 가독성이 개선된다.

- **[INFO]** `as never` 타입 캐스트 사용
  - 위치: 라인 120-121 (`makeProvider(redisA) as never`, `makeProvider(redisB) as never`)
  - 상세: `as never` 는 TypeScript 타입 안전성을 우회하는 광범위한 캐스트다. `RedisConnectionProvider` 인터페이스가 실제로 어떤 타입인지 가져와서 `makeProvider` 반환 타입을 정확히 맞추거나, `as unknown as RedisConnectionProvider` 처럼 의도적 캐스트임을 명시하면 향후 타입 불일치 오류를 더 빨리 포착할 수 있다.
  - 제안: `ExecutionSeqAllocator` 가 요구하는 provider 인터페이스를 import 해 `makeProvider` 반환 타입을 명시한다.

- **[INFO]** `release` 호출이 테스트 1·2 에만 있고 테스트 3 에도 추가가 필요할 수 있음
  - 위치: 라인 222 (`finally` 블록)
  - 상세: 테스트 3 의 `finally` 에 `allocA.release(executionId)` 가 있으나 `allocB` 에 대한 release 는 없다. 테스트 1·2 에서도 `allocB` release 가 누락돼 있다. `release` 가 메모리 정리 목적이라면 두 인스턴스 모두 호출해야 일관성이 유지된다.
  - 제안: `finally { allocA.release(executionId); allocB.release(executionId); }` 패턴을 통일하거나, release 대상을 헬퍼로 묶어 누락을 방지한다.

- **[INFO]** 테스트 설명 내 숫자("수용 기준 #3") 가 하드코딩
  - 위치: 라인 190, `it(...)` 설명 문자열
  - 상세: "수용 기준 #3" 이라는 기준 번호는 외부 plan 문서의 순서에 의존한다. plan 이 리넘버링되면 테스트 설명과 불일치가 생긴다.
  - 제안: "in-memory baseline 대비 회귀 < 5ms" 처럼 번호 의존 없이 기준 내용을 직접 기술하는 편이 자기완결적이다.

---

### 파일 2: docker-compose.e2e.yml

- **[INFO]** `REDIS_HOST`/`REDIS_PORT` 중복 선언
  - 위치: `backend-e2e` 서비스 (라인 579-580)와 `backend-e2e-runner` 서비스 (추가된 라인 648-652)
  - 상세: `backend-e2e` 에는 이미 `REDIS_HOST: redis`, `REDIS_PORT: "6379"` 가 있었고, 이번 변경으로 `backend-e2e-runner` 에도 동일 값이 추가됐다. 두 서비스에서 값이 다를 경우 일관성 오류 추적이 어려워진다.
  - 제안: YAML anchor(`&redis-env`) + alias(`*redis-env`)나 `x-` extension 블록으로 단일 진실 지점을 만들면 향후 포트/호스트 변경 시 한 곳만 수정하면 된다.

---

### 파일 3: plan/in-progress/eia-distributed-seq-load-verify.md

발견사항 없음 — 체크박스·측정값·결정 근거가 명확하고 일관성 있게 기록돼 있다.

---

## 요약

전반적으로 코드 의도와 설계 근거가 JSDoc + 인라인 주석으로 충분히 설명돼 있어 가독성이 높다. 테스트 타임아웃(60_000) 이나 N(1000) 같은 주요 상수는 의미 있는 주석이 곁들여져 있고, `makeProvider` 어댑터 분리, `beforeAll` PING 강제 확인 등 구조적 선택도 명확하다. 다만 두 throughput 테스트에서 call-array 생성 패턴이 반복되고 `1e6`/`0.95` 인라인 매직 숫자와 `as never` 타입 우회가 미래 변경 시 오류 발생 지점이 될 수 있다. `allocB.release` 누락 패턴은 메모리 누수보다는 코드 일관성 문제다. docker-compose 의 Redis 환경변수 중복은 YAML anchor 로 쉽게 해소할 수 있다. 크리티컬 결함은 없으며 전체 유지보수성 수준은 양호하다.

## 위험도

LOW
