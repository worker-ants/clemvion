# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `assertMonotonicUniqueness` 함수가 min/max 단일 패스로 계산하나 `Set` 생성은 별도 패스 — 세 가지 검증이 한 함수 안에 혼재
  - 위치: `execution-seq-allocator-load.e2e-spec.ts` L120-133
  - 상세: 현재 구조는 기능적으로 올바르고 주석도 충분하다. 다만 `Set(seqs).size === expectedCount` 만으로 중복+빠짐 양쪽을 동시에 단언할 수 없어(예: `{1,2,3}` vs `{0,1,2}` 모두 size=3이지만 min이 다름) min/max 검사가 필수이므로 설계는 타당하다. 단, 세 `expect` 가 모두 같은 오류 메시지 없이 실패하면 어느 조건이 위반됐는지 즉각 식별하기 어렵다.
  - 제안: `expect(new Set(seqs).size).toBe(expectedCount)` 에 `.withContext` 또는 Jest `toBe` 메시지 옵션을 추가하면 더 명확해진다. 단, 현재 규모에서는 INFO 수준이다.

- **[INFO]** 상수 `NS_PER_MS = 1e6` 과 `0.95` (p95 계산) 가 파일 내 인라인 혼재
  - 위치: L72(`NS_PER_MS`), L238(`0.95`)
  - 상세: `NS_PER_MS` 는 모듈 수준 상수로 잘 추출돼 있으나, p95 분위수 `0.95` 는 세 번째 테스트 내부에 인라인이다. `Math.floor(sorted.length / 2)` (중앙값 계산) 도 동일 패턴으로 두 번 등장한다. 현재 RESOLUTION.md 에서 "헬퍼 추출로 국소화, 과도한 추출 회피" 로 보류 처리한 사안이나, `0.95` 가 무엇인지 이름이 없어 처음 읽는 사람에게 매직 넘버로 작동한다.
  - 제안: 파일 상단에 `const P95_PERCENTILE = 0.95;` 를 추가하거나, 최소한 인라인 주석(`// p95`)을 붙이면 충분하다. 인라인 주석은 이미 존재(`const p95 = ...`)하므로 현재 수준에서 허용 가능.

- **[INFO]** `makeProvider` 반환 타입이 명시적 객체 리터럴 타입으로 선언돼 있어 `RedisConnectionProvider` 인터페이스와 구조적으로만 연결됨
  - 위치: L81-89
  - 상세: 반환 타입을 `{ getClient: () => Redis; getClientOrNull: () => Redis | null; }` 로 명시한 것은 의도를 잘 드러내지만, `RedisConnectionProvider` 인터페이스를 참조하지 않아 프로덕션 인터페이스가 변경되면 타입 오류 없이 mismatch 가 발생할 수 있다. `as never` 캐스트는 이 위험을 완전히 흡수해버린다.
  - 제안: `import { RedisConnectionProvider } from '../src/...'` 가 순환 의존 또는 타입 export 없이 불가한 경우라면 현재 패턴이 최선이다(주석도 달려 있음). 가능하다면 반환 타입을 `RedisConnectionProvider` 로 명시해 `as never` 없이 주입하는 것이 더 안전하다.

- **[INFO]** `releaseBoth` 함수가 describe 클로저 내부에 정의돼 있어 `allocA`/`allocB` 캡처에 의존
  - 위치: L166-169
  - 상세: 세 테스트 모두 `releaseBoth(executionId)` 를 `finally` 에서 호출하는 패턴이 잘 추출돼 있다. 함수가 비동기가 아닌 동기인 점(`void` 반환)도 의도에 맞다(`release` 자체가 동기라 가정). 다만 이 함수가 클로저 변수(`allocA`/`allocB`)에 암묵적으로 의존하므로 테스트 수가 늘어날 때 두 인스턴스 외에 세 번째 인스턴스가 추가되면 헬퍼를 수정해야 한다. 현재 범위에서는 적절하다.
  - 제안: 현 구조 유지. 인스턴스 목록이 가변적으로 확장되는 경우 `instances: readonly ExecutionSeqAllocator[]` 를 매개변수로 받는 형태로 변경 검토.

- **[INFO]** 세 번째 테스트 내부에 `const WARMUP = 20`/`const SAMPLES = 200` 로컬 상수 정의 — 파일 상단 `ALLOC_COUNT` 와 스타일 불일치
  - 위치: L221-222
  - 상세: `ALLOC_COUNT`, `NS_PER_MS`, `LOG_PREFIX` 는 모듈 수준 상수인 반면, `WARMUP`/`SAMPLES` 는 테스트 함수 내부에 위치한다. 논리적으로는 이 테스트에만 관련된 값이므로 함수 내부 배치가 옳다. 단, 스타일 불일치가 코드베이스 합류 시 "어디에 놓아야 하나" 혼란을 줄 수 있다.
  - 제안: 주석 `// 연결·키 초기화 outlier 제외.` 가 이미 있으므로 현 상태로 수용 가능. 파일 상단으로 올리면 오히려 불필요하게 넓은 공개 범위가 된다.

- **[INFO]** `allocateConcurrentlyAcrossInstances` 함수명이 다소 길고, 이전 RESOLUTION 에서 언급된 `runConcurrentAllocations` 이름과 다름
  - 위치: L96
  - 상세: 현재 코드의 함수명은 `allocateConcurrentlyAcrossInstances` 이고 SUMMARY(INFO #5)에서 채택된 헬퍼명은 `runConcurrentAllocations` 였다. 실제 코드는 더 서술적인 이름을 채택했다. 긴 이름이지만 파라미터 타입 `readonly [ExecutionSeqAllocator, ExecutionSeqAllocator]` 와 함께 함수의 목적을 명확히 전달한다. 일관성 문제는 없으나 RESOLUTION 문서와 실제 코드 이름이 다른 점이 이후 리뷰 추적 시 미세한 혼란이 될 수 있다.
  - 제안: 코드 기준으로 RESOLUTION 을 소급 정정하거나, 현 이름을 그대로 유지한다. 기능 영향 없음.

- **[INFO]** latency 루프에서 `process.hrtime.bigint()` 를 두 번 호출 — `start` 변수가 루프 바깥에 없음
  - 위치: L228-231
  - 상세: `await allocA.next(executionId)` 전후로 `hrtime.bigint()` 를 각각 호출해 per-call 측정하는 패턴이 의도에 맞다. 다만 `const start = process.hrtime.bigint();` 가 루프 내부에 있어 `await` 이전의 할당 자체가 측정에 포함되는 미세한 오버헤드가 있다. 실제 영향은 무시할 수준이다.
  - 제안: 현 구조 유지. 고정밀 마이크로벤치가 필요해지면 `start`/`end` 를 `BigInt` 배열로 미리 쌓는 패턴으로 변경 가능.

## 요약

`execution-seq-allocator-load.e2e-spec.ts` 는 전반적으로 유지보수성이 높다. 모듈 수준 상수, 헬퍼 함수 추출(`allocateConcurrentlyAcrossInstances`, `assertMonotonicUniqueness`, `makeProvider`, `releaseBoth`), 풍부한 JSDoc 이 잘 갖춰져 있으며, 이전 리뷰 사이클에서 지적된 중복·`as never` 주석·릴리즈 누락 등이 이미 해소된 상태다. 잔여 관찰은 모두 INFO 등급으로, `0.95` 매직 넘버 명명, 함수명 RESOLUTION 문서 불일치, 반환 타입이 `RedisConnectionProvider` 인터페이스를 직접 참조하지 않는 점 정도다. `docker-compose.e2e.yml` 변경은 `REDIS_HOST`/`REDIS_PORT` 명시 반복이나 기존 파일의 명시 스타일과 일관되어 별도 지적 사항이 없다.

## 위험도

LOW
