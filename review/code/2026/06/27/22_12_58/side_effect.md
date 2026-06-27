# 부작용(Side Effect) 리뷰 결과

## 발견사항

### 파일 1: codebase/backend/test/execution-seq-allocator-load.e2e-spec.ts

- **[INFO]** `makeProvider` 반환 타입 변경 — 호출자 영향 없음
  - 위치: diff hunk `makeProvider` 함수 시그니처 (line 79–81)
  - 상세: 반환 타입이 인라인 객체 리터럴 타입에서 `Pick<RedisConnectionProvider, 'getClient' | 'getClientOrNull'>` 로 변경됐다. 이 함수는 동일 파일 내 `beforeAll` 에서만 호출되며, 공개 API 가 아니다. 반환 구조(객체 멤버 이름·시그니처)는 동일하므로 런타임 동작 변화는 없다. `RedisConnectionProvider` 가 private 멤버를 가져 구조적 서브타입이 되지 않아 주입 시점에 `as unknown as RedisConnectionProvider` 이중 캐스트가 필요해졌지만, 이는 의도된 변경이며 기존 `as never` 보다 타입 안전성을 높인다. 인터페이스 drift 시 컴파일 오류로 검출 가능해져 부작용이 오히려 감소한다.
  - 제안: 현 변경 유지.

- **[INFO]** `P95_PERCENTILE = 0.95` 상수 도입 — 동작 무변경
  - 위치: line 64 (상수 선언), line 112 (사용)
  - 상세: `Math.floor(sorted.length * 0.95)` 의 리터럴 `0.95` 를 모듈 스코프 상수로 추출했다. 상수는 `const` 로 선언돼 재할당 불가하며 전역 스코프가 아닌 모듈 스코프다. 연산 결과가 동일하므로 테스트 동작·어설션에 부작용 없음.
  - 제안: 현 변경 유지.

- **[INFO]** `as never` → `as unknown as RedisConnectionProvider` 캐스트 변경 — 런타임 부작용 없음
  - 위치: lines 98–103 (`allocA`, `allocB` 초기화)
  - 상세: 캐스트는 TypeScript 컴파일 타임 전용이다. 런타임에서 `ExecutionSeqAllocator` 생성자에 전달되는 객체(`makeProvider(redis)` 의 반환값)는 변경 전후 완전히 동일하다. `as never` 가 `as unknown as RedisConnectionProvider` 로 바뀌어도 JS 출력에는 어떠한 차이도 없다.
  - 제안: 현 변경 유지.

---

### 파일 2: docker-compose.e2e.yml

- **[INFO]** YAML anchor `x-redis-env` 도입 — 환경 변수 동작 동일
  - 위치: lines 398–400 (`x-redis-env` 블록), lines 411, 423 (`<<: *redis-env` merge)
  - 상세: `REDIS_HOST: redis`, `REDIS_PORT: "6379"` 를 두 서비스(backend-e2e, backend-e2e-runner) 에 각각 인라인으로 선언하던 것을 YAML merge key(`<<:`)로 대체했다. YAML 1.1 merge key 는 docker-compose v3+ 에서 지원되며, 동일 키가 merge 대상 anchor 와 직접 선언에 동시에 존재할 경우 직접 선언이 우선한다. 두 서비스 모두 해당 키를 직접 선언하지 않으므로 anchor 값이 그대로 적용된다. 결과 환경 변수 집합이 변경 전과 동일하다.
  - 제안: 현 변경 유지. docker-compose v1(Python) 은 YAML anchor 를 지원하지 않으나, 이 프로젝트는 v2 CLI 를 사용하므로 문제없다. `x-` prefix top-level 키는 Compose spec 에서 서비스로 해석되지 않는 것이 보장된다.

---

### 파일 3: plan/complete/spec-draft-eia-seq-nfr.md

- **[INFO]** frontmatter `spec_impact` 타입 변경 (bare string → YAML list) — Gate C 테스트 정합 복구
  - 위치: lines 725–727 (frontmatter diff)
  - 상세: `spec_impact: spec/5-system/14-external-interaction-api.md` (스칼라) 를 `spec_impact:\n  - spec/5-system/14-external-interaction-api.md` (리스트)로 변경했다. 이는 Gate C 테스트(`spec-plan-completion.test.ts`)가 요구하는 스키마 정합 수정으로, 회귀 버그 수정이다. 파일 내용(의미)에는 변화가 없고, plan 파일이므로 런타임·네트워크·파일시스템 부작용은 없다.
  - 제안: 현 변경 유지.

---

### 파일 4: plan/in-progress/eia-seq-load-spec-cleanup.md

- **[INFO]** 신규 plan 파일 추가 — plan/ 디렉터리 내 트래킹 문서
  - 위치: 전체 파일 신규 생성
  - 상세: `plan/in-progress/` 아래 신규 마크다운 파일을 추가했다. 이 디렉터리는 `CLAUDE.md` 의 정보 저장 위치 정의에 따른 정상 경로다. 코드·환경 변수·네트워크·전역 상태에 영향을 주는 파일이 아니다.
  - 제안: 현 변경 유지.

---

## 요약

이번 변경(커밋 8a32ba0)은 코드 동작 무변경을 목표로 한 trivial cleanup 4건과 Gate C 테스트 회귀 수정 1건으로 구성된다. 부작용 관점에서 모든 변경은 의도한 범위 안에 머무른다. `makeProvider` 반환 타입 변경은 컴파일 타임 타입 검사를 강화할 뿐 런타임 동작에 영향이 없고, `P95_PERCENTILE` 상수화는 단순 리터럴 추출이며, docker-compose YAML anchor 는 환경 변수 값을 동일하게 유지한다. 전역 변수 도입, 파일시스템 부작용(테스트 파일 외), 환경 변수 변경, 네트워크 호출, 이벤트/콜백 변경은 없다. `plan/complete/spec-draft-eia-seq-nfr.md` frontmatter 수정은 unit Gate C 테스트 실패를 야기하던 스키마 오류를 수정한 것으로, 의도된 부작용(회귀 복구)이다.

## 위험도

NONE
