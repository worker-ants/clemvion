## 발견사항

### 파일 1: execution-seq-allocator-load.e2e-spec.ts

- **[INFO]** `makeProvider` 반환 타입 개선 — Pick 도입
  - 위치: 라인 79-83 (변경 diff), 전체 파일 176-183
  - 상세: `as never` 대신 `Pick<RedisConnectionProvider, 'getClient' | 'getClientOrNull'>` 을 반환 타입으로 명시해 두 메서드의 시그니처가 `RedisConnectionProvider` 실제 계약과 다를 경우 컴파일 에러로 잡히게 됐다. `as never` 는 타입 검사를 완전히 우회하므로 이 방향은 올바른 개선이다.
  - 제안: 추가 개선 필요 없음. 현재 단위 테스트(`execution-seq-allocator.service.spec.ts`)의 `makeRedisConn` 은 여전히 `as never` 를 사용 중이지만, 이는 이번 변경 범위 밖이며 별도 INFO 수준 개선 사항이다 (기능 영향 없음).

- **[INFO]** `P95_PERCENTILE = 0.95` 상수화
  - 위치: 라인 64, 112 (변경 diff)
  - 상세: 매직 넘버가 상수로 추출되어 의도가 명확해졌다. p95 는 실제 assert 에는 사용되지 않고 로그 출력 전용이며, 이 사실이 주석으로도 명시되어 있다. 변경 자체는 동작에 영향 없음.
  - 제안: 추가 개선 필요 없음.

- **[INFO]** 테스트 내 `as unknown as RedisConnectionProvider` 이중 cast 패턴
  - 위치: 라인 99-103 (변경 diff), 전체 파일 249-254
  - 상세: 이중 cast 의 이유(private 멤버로 인한 구조적 매칭 불가)가 상세 주석으로 문서화되어 있다. `Pick` 으로 시그니처 검사 후 주입 지점에서만 이중 cast 를 하는 패턴은 현재 TypeScript 구조상 최선이다. 단위 테스트(`service.spec.ts`)는 이미 `as never` 패턴을 사용 중이어서 일관성 측면의 차이는 존재하나, 이번 e2e 파일의 접근 방식이 더 안전하다.
  - 제안: `service.spec.ts` 의 `makeRedisConn` + `makeAllocator` 의 `as never` 도 동일 패턴으로 교체하면 프로젝트 전반 일관성이 높아지지만, 동작 영향이 없으므로 이번 범위에서는 INFO 수준.

- **[INFO]** `beforeAll` 내 Redis PING 실패 시 `allocA` / `allocB` 가 미초기화 상태로 이후 테스트가 실행될 위험
  - 위치: 전체 파일 236-255
  - 상세: `expect(pongA).toBe('PONG')` 실패 시 Jest 는 `beforeAll` 을 abort 하고 이후 테스트를 skip 처리한다. 현재 구조에서 `allocA` / `allocB` 는 class-level `let` 으로 선언되어 있어 미초기화 시 `undefined` 상태로 테스트 진입 가능성이 이론상 존재하나, Jest 의 `beforeAll` 실패 → 해당 suite 전체 skip 동작으로 실제 위험은 없다. 이는 이전 PR #730 부터 존재하던 패턴이며 이번 변경과 무관하다.
  - 제안: 현재 수준에서 수용 가능. 개선이 필요하다면 `allocA` / `allocB` 를 `beforeAll` 내부에서 지역 변수로 선언 후 상위 스코프에 할당하는 패턴을 고려할 수 있으나 동작 동일.

### 파일 2: docker-compose.e2e.yml

- **[INFO]** `x-redis-env` YAML anchor 도입으로 DRY 개선
  - 위치: 라인 398-401, 411, 424 (변경 diff)
  - 상세: `backend-e2e` 와 `backend-e2e-runner` 두 서비스가 동일한 `REDIS_HOST`/`REDIS_PORT` 를 공유하므로 anchor 로 단일 진실 지점화한 것은 적절하다. `x-` 접두 top-level 키는 docker compose v2 이상에서 서비스로 해석되지 않는다.
  - 제안: 추가 개선 필요 없음. 커밋 메시지와 파일 내 주석이 anchor 패턴을 충분히 설명하고 있으며, e2e(218) 통과로 실제 검증도 완료되었다.

### 파일 3: plan/complete/spec-draft-eia-seq-nfr.md

- **[INFO]** `spec_impact` bare string → YAML list 정정 — Gate C 회귀 수정
  - 위치: 라인 725-727 (변경 diff)
  - 상세: `spec-plan-completion.test.ts` 의 Gate C 는 `spec_impact` 가 문자열인 경우 `NONE_VALUES`(`none`/`없음`/`n/a`/`na`) 여부를 검사하고, 배열인 경우 경로 존재 여부를 검사한다. 이전 bare string `spec/5-system/14-external-interaction-api.md` 는 `NONE_VALUES` 에 해당하지 않으므로 "string spec_impact must be none/없음" 테스트에서 실패했다. YAML list 로 정정 후 경로 존재 검사(dangling-ref guard)를 통과한다.
  - 제안: 수정 방향 정확. Gate C 의 `hasValidSpecImpact` 로직이 올바르게 동작했음이 이 회귀에서 검증된 셈이다.

### 파일 4: plan/in-progress/eia-seq-load-spec-cleanup.md

- **[INFO]** `/ai-review` 체크박스 미완료 상태로 커밋
  - 위치: 라인 864 (변경 diff), 전체 파일 895
  - 상세: `- [ ] /ai-review (Critical/Warning 0)` 가 체크되지 않은 상태로 커밋되어 있다. 이는 현재 리뷰가 진행 중이므로 의도된 상태이나, 메모리 규약 상 "e2e/ai-review 는 수행 후 체크하고 그 갱신을 PR 커밋에 포함"이 원칙이다.
  - 제안: ai-review 완료 후 체크박스를 업데이트하여 후속 커밋에 포함할 것. 현재 상태는 프로세스 진행 중이라 BLOCK 사유는 아님.

---

## 요약

이번 변경은 `execution-seq-allocator-load.e2e-spec.ts` 의 타입 안전성 개선(blind `as never` → `Pick` 반환 타입 + 이중 cast) 과 가독성 개선(P95_PERCENTILE 상수화), docker-compose의 DRY 개선(x-redis-env anchor), 그리고 Gate C 단위 테스트를 통과시키기 위한 `spec_impact` frontmatter 형식 수정으로 구성된다. 모든 변경은 코드 동작 변경 없이 순수한 리팩토링·버그픽스 수준이며, 기존 unit 테스트 커버리지(service.spec.ts)는 그대로 유효하고, e2e 218건이 통과했다. Gate C 회귀 수정은 `spec-plan-completion.test.ts` 의 `hasValidSpecImpact` 로직이 실제로 실패를 잡아낸 사례로, 테스트 게이트가 올바르게 동작하고 있음을 보여준다. Critical 또는 Warning 수준의 테스트 결함은 없다.

## 위험도

NONE
