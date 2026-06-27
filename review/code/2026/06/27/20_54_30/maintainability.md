# 유지보수성(Maintainability) 리뷰

## 발견사항

### 파일 1: `codebase/backend/test/execution-seq-allocator-load.e2e-spec.ts`

- **[INFO]** 매직 넘버 `1e6` (나노초→밀리초 변환) 인라인 반복
  - 위치: 라인 173, 207, 211
  - 상세: `Number(process.hrtime.bigint() - start) / 1e6` 패턴이 throughput 테스트와 latency 테스트에서 각각 독립적으로 등장한다. `1e6` 자체가 단위 변환 상수이지만 맥락 없이 반복되면 의도가 불명확하다.
  - 제안: `const NS_PER_MS = 1e6;` 상수를 파일 상단에 선언하거나, `hrtime.bigint()` 래핑 헬퍼 `elapsedMsSince(start: bigint): number`를 추출해 변환 로직을 한 곳에 둔다.

- **[INFO]** `N = 1000` 이 두 테스트에서 각자 독립 선언됨
  - 위치: 라인 142, 164
  - 상세: 두 테스트가 동일한 `N = 1000`을 `const N = 1000;`으로 각자 선언한다. 값이 다를 때 한쪽만 바꾸면 불일치가 생긴다.
  - 제안: `describe` 블록 상단에 `const ALLOC_COUNT = 1000;`으로 공유 상수화한다. 주석 "인스턴스당 500개씩, 총 1000 동시 발급."도 자동으로 정합성을 유지한다.

- **[INFO]** `WARMUP = 20`, `SAMPLES = 200` 상수 명명은 적절하지만 기준값 선택 근거 부재
  - 위치: 라인 197–198
  - 상세: 값은 테스트-로컬 `const`로 선언되어 네이밍 자체는 좋다. 다만 `20`과 `200`을 선택한 이유가 주석에 "연결·키 초기화 outlier 제외" 한 줄에 그쳐, 나중에 값을 조정할 때 얼마가 충분한지 판단 근거가 없다.
  - 제안: 주석에 "연결 RTT outlier 영향을 실측에서 약 10회 이내로 확인, 20회로 여유를 둠 / 95th percentile 안정화에 100+ samples 필요, 200으로 여유"처럼 선택 근거를 한 줄씩 추가한다.

- **[INFO]** `releaseBoth` 함수가 `describe` 내부 중첩 함수로 선언
  - 위치: 라인 135–138
  - 상세: `releaseBoth`는 세 `it` 블록 모두에서 `finally`에 사용되는 테스트 헬퍼다. `describe` 안에 일반 함수로 선언된 것은 scope 상 자연스럽지만, `allocA`·`allocB` 를 클로저로 캡처해 함수 시그니처만으로는 부수 효과(두 인스턴스 모두 release)를 알 수 없다.
  - 제안: JSDoc 주석이 이미 이 의도를 설명하고 있어 현재 수준은 허용 가능. 만약 향후 인스턴스가 세 개 이상으로 늘어나면 `instances` 배열을 인자로 받는 형태로 리팩터링한다.

- **[INFO]** `allocateConcurrentlyAcrossInstances` 의 `total` 이 홀수일 때 묵시적 소수점 처리
  - 위치: 라인 95
  - 상세: `perInstance = total / 2`는 `total`이 홀수이면 부동소수점 값이 되어 루프 횟수가 소수점 이하로 내림된다. 현재 호출처가 모두 짝수(`1000`)라 문제없지만 방어 코드가 없다.
  - 제안: `if (total % 2 !== 0) throw new Error('total must be even');` 또는 `Math.floor`를 명시해 의도를 코드로 표현한다.

- **[INFO]** throughput 테스트에서 `Math.min(...seqs)` / `Math.max(...seqs)` 가 test 1과 동일하게 반복
  - 위치: 라인 178–180
  - 상세: 완전히 동일한 3줄 검증 블록(`Set` 크기, min, max)이 두 `it` 블록에 복제되어 있다. 테스트 의도의 차이(test 1: 유일성 집중, test 2: throughput 추가)가 있으나 검증 코드 자체는 중복이다.
  - 제안: `assertMonotonicUniqueness(seqs: number[], n: number): void` 헬퍼 함수로 추출해 공유한다. 두 테스트 모두 한 줄 호출로 단순화된다.

- **[INFO]** `console.log` 형식 문자열이 두 위치에서 유사 패턴으로 중복
  - 위치: 라인 184–188, 217–224
  - 상세: 두 로그 모두 `[seq-load]` 접두어 + 측정값 포맷 패턴을 사용한다. 현재 개수에서는 중복 부담이 낮으나, 접두어 변경 시 두 곳을 동시에 수정해야 한다.
  - 제안: `const LOG_PREFIX = '[seq-load]';` 상수화면 충분하다.

---

### 파일 2: `docker-compose.e2e.yml`

- **[INFO]** `REDIS_HOST: redis` / `REDIS_PORT: "6379"` 가 두 서비스에 중복 선언됨
  - 위치: `backend-e2e` 서비스 환경변수(기존), `backend-e2e-runner` 서비스 환경변수(신규 추가)
  - 상세: diff에서 추가된 두 환경변수는 `backend-e2e`에 이미 존재하는 값과 동일하다. 현재 docker-compose YAML 앵커/확장 기능이 이 파일에서 활용되지 않아 두 위치를 따로 유지해야 한다.
  - 제안: 값이 단순(redis, 6379)하고 변경 가능성이 낮으므로 현재 중복은 허용 가능 범위. 만약 포트가 바뀔 경우 두 곳을 동시에 수정해야 함을 주석으로 명시하거나, YAML 앵커(`x-redis-env: &redis-env`)를 도입한다.

- **[INFO]** 추가 주석이 기존 `backend-e2e-runner` 서비스의 같은 환경변수 블록 주석과 일치
  - 위치: 라인 455–458 (diff 기준), 662–664 (전체 파일 기준)
  - 상세: 두 주석이 동일한 설명("실 Redis 직결 e2e ... 미지정 시 각 spec 의 `?? 'redis'` 기본값과 동일하지만, 의존성을 명시해 둔다.")을 반복한다. 이는 두 서비스의 역할 차이가 없음을 반영하지만, 주석 자체의 중복은 한쪽 변경 시 불일치 리스크가 있다.
  - 제안: 주석을 파일 헤더의 설명 블록에 한 번 작성하고 각 서비스에는 `# (헤더의 "실 Redis 직결 e2e" 참고)` 처럼 참조 형식으로 줄인다.

---

## 요약

전체적으로 코드는 명확한 의도를 가지고 잘 문서화되어 있으며, 테스트 구조(beforeAll/afterAll/try-finally)와 네이밍(allocA/allocB, WARMUP, SAMPLES 등)이 일관성 있게 유지된다. 주요 개선 여지는 (1) `N = 1000`과 `1e6` 같은 반복 상수의 공유 선언, (2) 두 `it` 블록 간 동일 검증 로직(`assertMonotonicUniqueness`)의 헬퍼 추출, (3) `allocateConcurrentlyAcrossInstances`의 홀수 입력 방어 부재 세 가지이며 모두 INFO 수준이다. docker-compose 변경은 필요한 환경변수를 최소한으로 명시적으로 추가한 것으로 유지보수성 관점에서 무난하다.

## 위험도

LOW
