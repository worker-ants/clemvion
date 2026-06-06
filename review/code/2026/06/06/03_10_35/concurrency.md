# 동시성(Concurrency) 리뷰

## 발견사항

### [INFO] `wsCache` Promise 캐싱 — 이전 경고 조치 완료 확인

- 위치: `codebase/backend/src/scripts/eval-retrieval.ts` (L146–163)
- 상세: 이전 리뷰(02_39_25) WARNING #11(wsCache check-then-act 중복 쿼리)이 commit 92ebe8f2 에서 완전히 조치됨. 현재 코드는 `Promise` 를 캐시 값으로 저장하므로, 동일 `kbId` 로 동시에 진입한 여러 async task 가 `await` 경계를 넘어도 중복 DB 쿼리가 발생하지 않는다. check-then-act 경쟁 조건 해소됨.

---

### [INFO] `searched` / `done` / `failed` 카운터 단일 스레드 의존 — 현재 안전

- 위치: `eval-retrieval.ts` (L167–168, L197–200), `generate-golden-set.ts` (L208–209, L275–279)
- 상세: `SEARCH_CONCURRENCY = 4` / `CHUNK_LLM_CONCURRENCY = 4` 로 `pLimit` 을 통해 동시 4개 async task 가 실행된다. Node.js 단일 스레드 이벤트 루프 특성상 `+=` 연산 자체는 인터리빙되지 않는다. `finally` 블록 내 진행 로그 조건(`searched % 20 === 0 || searched === length`)은 비결정적 완료 순서 때문에 출력이 중복되거나 누락될 수 있으나 기능 버그는 아니다.
- 상태: 기능상 안전. Worker Threads 확장 시 즉시 문제가 되므로 단일 스레드 가정에 의존함을 인지해야 한다.

---

### [INFO] `retrievedByEntryId` 객체 쓰기 — 중복 id 묵시적 덮어쓰기

- 위치: `eval-retrieval.ts` (L166, L176, L186–189)
- 상세: `entry.id` 키별로 쓰기가 이루어지며, Node.js 단일 스레드 특성상 동시성 문제는 없다. 골든셋에 중복 id 가 있는 경우 마지막 write 가 이기는 묵시적 동작이 발생한다. zod `GoldenSetSchema` 런타임 검증이 추가(commit 92ebe8f2, #6)되었으나 중복 id 자체는 zod schema 에서 검증하지 않는다.
- 상태: 실용적 위험 낮음(자동 합성 스크립트가 `stableEntryId` 해시로 id 를 생성하므로 구조적 중복이 드물다). 추가 방어 코드가 필요하다면 실행 전 `Set` 중복 검사를 추가할 수 있다.

---

### [INFO] `generated` 배열 `push` — 단일 스레드 환경에서 안전

- 위치: `generate-golden-set.ts` (L252–269)
- 상세: `pLimit(4)` 병렬 task 각각이 `generated.push(...)` 를 호출한다. Node.js 이벤트 루프 특성상 배열 push 는 `await` 경계 없이 즉시 완료되므로 인터리빙이 발생하지 않는다. 현재 구조에서 경쟁 조건 없음.

---

### [INFO] `pLimit` 을 통한 동시성 상한 제어 — 적절한 리소스 풀링

- 위치: `eval-retrieval.ts` (L165), `generate-golden-set.ts` (L206)
- 상세: `SEARCH_CONCURRENCY = 4` / `CHUNK_LLM_CONCURRENCY = 4` 상수로 동시 실행 수가 제한되어 있다. DB 커넥션 풀·LLM API rate limit 과의 정합성 측면에서 적절한 보수적 수치다. 상수명이 파일 상단에 명시되어 있어 조정이 용이하다.

---

## 요약

현재 코드의 동시성 구조는 CLI 스크립트 용도에 적합하다. 이전 리뷰(02_39_25) 에서 제기된 주요 동시성 경고(#11 wsCache check-then-act 중복 쿼리)는 commit 92ebe8f2 에서 Promise 캐싱 패턴으로 완전히 조치되었음을 현재 코드에서 확인했다. `pLimit(4)` 로 동시 실행 상한이 제어되고, `generated` 배열 push 와 카운터 증감은 Node.js 단일 스레드 이벤트 루프 보장 하에 안전하다. 나머지 INFO 항목은 모두 단일 스레드 가정에 묵시적으로 의존하는 패턴이거나 기능 영향이 없는 방어 코드 부재로, 즉각 차단이 필요한 이슈는 없다. Worker Threads 등으로 확장 시에는 카운터 원자성과 배열 공유 접근을 재검토해야 한다.

## 위험도

NONE
