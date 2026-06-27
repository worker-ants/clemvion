# 유지보수성(Maintainability) 리뷰

## 발견사항

### 파일 1: codebase/backend/src/modules/websocket/execution-seq-allocator.service.spec.ts

- **[INFO]** `as never` → `as unknown as RedisConnectionProvider` 타입 캐스트 개선
  - 위치: 라인 43, 52, 63, 74, 85, 100, 115 (각 `makeRedisConn() as never` 위치)
  - 상세: `as never`는 TypeScript에서 타입 안전성을 완전히 포기하는 가장 거친 캐스트다. `as unknown as RedisConnectionProvider`는 실제 타입 의도를 문서화하며 IDE가 타입 정보를 추적할 수 있게 한다. 이 변경은 유지보수성 측면에서 개선이다.
  - 제안: 현재 변경 방향 유지. 향후 `RedisConnectionProvider` 인터페이스가 변경될 때 컴파일 에러로 드러날 가능성이 높아졌다.

- **[WARNING]** `seqKeyTtlSeconds` 테스트 블록에서 `new ExecutionSeqAllocator(makeRedisConn() as unknown as RedisConnectionProvider)` 패턴이 3회 반복
  - 위치: `seqKeyTtlSeconds — EXECUTION_SEQ_TTL_SECONDS env 분기` describe 블록 내 3개 it
  - 상세: `ttlOf` 헬퍼 함수가 이미 존재하지만 그 인자로 전달할 `ExecutionSeqAllocator` 인스턴스 생성 코드가 3회 반복된다. 중첩 호출(`ttlOf(new ExecutionSeqAllocator(...))`)이 4단계 들여쓰기를 만들어 가독성을 저하시킨다. `as unknown as RedisConnectionProvider` 캐스트 추가로 각 인스턴스 생성이 3줄로 늘어나 이 문제가 더 두드러졌다.
  - 제안: `makeAllocatorForTtl()` 같은 헬퍼를 추출하거나, 기존 `makeAllocator`를 재사용하면 중첩을 줄이고 중복을 제거할 수 있다. 단, TTL 테스트가 monkey-patch 없는 실 provider 경로를 검증하는 의도라면 describe 블록 상단에 그 이유를 짧은 주석으로 명시해야 한다.

- **[INFO]** `makeRedisConn` 반환 타입이 구조적 duck-type이고 `RedisConnectionProvider`와의 관계가 암묵적
  - 위치: 라인 150-161 (`makeRedisConn` 함수)
  - 상세: `makeRedisConn`의 반환 타입은 `{ getClient: jest.Mock; getClientOrNull: jest.Mock }`으로 명시되어 있어 `RedisConnectionProvider`의 public surface와 의도적으로 분리되어 있다. 이는 e2e 파일의 `makeProvider`가 `Pick<RedisConnectionProvider, 'getClient' | 'getClientOrNull'>`를 명시적으로 사용하는 패턴과 대조된다. unit 테스트 내 `as unknown as RedisConnectionProvider` 캐스트가 발생하는 근본 원인이다.
  - 제안: `makeRedisConn` 반환 타입을 Pick 교차 타입으로 변경하면 캐스트 없이 직접 주입이 가능해질 수 있다. 단, `RedisConnectionProvider`가 private 멤버를 가진 클래스라면 구조적 매칭이 불완전해 여전히 캐스트가 필요하다는 제약이 있다(e2e 파일 주석 참조).

---

### 파일 2: codebase/backend/test/execution-seq-allocator-load.e2e-spec.ts

- **[INFO]** 인라인 매직 넘버 `20`, `200`을 모듈 수준 상수 `LATENCY_WARMUP_COUNT`, `LATENCY_SAMPLE_COUNT`로 추출
  - 위치: 라인 492-494 (상수 선언), 506-517 (사용처)
  - 상세: 이 변경은 유지보수성 개선이다. 이전에는 인라인 주석으로만 의도를 설명했으나 이제는 이름이 의도를 직접 표현한다. JSDoc 주석도 추가되어 각 상수의 목적이 명확하다. `ALLOC_COUNT`·`NS_PER_MS`·`P95_PERCENTILE`과 일관된 스타일이다.
  - 제안: 현재 패턴 유지.

- **[INFO]** warmup 루프 본문이 단일 라인에서 블록(`{}`)으로 변경
  - 위치: 라인 506-509
  - 상세: 단일 문이라도 블록을 추가한 것은 린트/스타일 가이드의 일관성 요구사항으로 보이며 Prettier 자동 포맷 결과이기도 하다. 가독성에 중립이나 일관성 측면에서 적절하다.
  - 제안: 특이사항 없음.

---

### 파일 3: codebase/backend/test/system-status.e2e-spec.ts

- **[INFO]** `EXPECTED_QUEUE_NAMES` 배열에 `'workspace-invitations-pruner'` 항목 추가
  - 위치: 라인 33 (diff 기준)
  - 상세: 단순한 배열 항목 추가이며 기존 패턴(알파벳순 정렬 아닌 논리적 그룹 순서)과 일치한다. `login-history-pruner`와 `notification-secret-rotator` 사이에 위치한 것은 시스템 계층(system pruner 그룹) 내 논리적 순서와 일관된다.
  - 제안: 배열 항목이 명시적 순서 정책 없이 추가될 경우 나중에 순서 혼란이 생길 수 있으므로, 배열 상단의 `// SoT: ...` 주석에 정렬 기준(예: "그룹별 논리적 순서")을 추가하면 향후 유지보수가 쉬워진다. 현재 변경 자체는 차단 이슈가 아니다.

---

### 파일 4: plan/complete/trigger-review-deferred-fixes.md

- **[INFO]** frontmatter에 `spec_impact` 필드 추가
  - 위치: frontmatter (라인 5-9)
  - 상세: `spec_impact` 필드가 plan frontmatter 스키마에 추가되었다. 이는 영향받은 spec 파일을 명시적으로 추적하여 spec drift 검토 시 참조점을 제공한다. 유지보수성 측면에서 긍정적이다.
  - 제안: 특이사항 없음.

---

## 요약

이번 변경의 핵심은 `as never` 캐스트를 `as unknown as RedisConnectionProvider`로 전환한 것이다. 이는 타입 의도를 명시화하는 점에서 유지보수성 개선이다. 다만, unit 테스트의 `seqKeyTtlSeconds` describe 블록에서 `ExecutionSeqAllocator` 인스턴스 생성 코드가 3회 반복되면서 중첩 깊이와 코드 중복이 증가한 것은 경미한 퇴보이며, describe 블록 상단에 monkey-patch를 하지 않는 이유에 대한 주석이 없어 의도가 불명확하다. e2e 파일에서의 매직 넘버 상수화, system-status 테스트의 큐 목록 동기화, plan frontmatter의 `spec_impact` 추가는 모두 유지보수성에 긍정적인 소규모 개선이다. 전반적으로 코드베이스 패턴(상수 관리, 주석 스타일, `as unknown as` 이중 캐스트 이유 설명)과의 일관성이 잘 유지되어 있다.

## 위험도

LOW
