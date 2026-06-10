### 발견사항

- **[WARNING]** `deepFreeze` 재귀 호출 — O(N) 공간·시간, dev/test 에서 캐시 항목 수가 많으면 비용 누적
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/codebase/backend/src/modules/execution-engine/containers/parallel-executor.ts` — `deepFreeze` 함수, `freezeSharedCacheValues` 호출
  - 상세: `deepFreeze`는 cache 값 객체 전체를 재귀 순회하며 모든 중첩 속성을 freeze한다. 각 branch 생성 시(최대 16개 branch) `nodeOutputCache`와 `structuredOutputCache` 양쪽에 각각 한 번씩 호출되므로, 캐시 항목 수 × 평균 depth × 2(캐시 종류) × branchCount 만큼의 객체 방문이 발생한다. dev/test 환경이므로 production에 영향은 없으나, 캐시가 커질수록 테스트 실행 시간이 선형 이상으로 증가할 수 있다. 특히 대형 통합 테스트에서 모든 branch context 생성 시 반복 freeze가 누적된다.
  - 제안: 현재 구현은 `Object.isFrozen` 으로 이미 frozen 객체를 건너뛰어 중복 재귀를 방지하고 있다. 추가로 freeze 대상을 `nodeOutputCache` 값 객체로 한정하되, 각 값이 이미 frozen이면 `freezeSharedCacheValues` 내 루프 자체를 조기 종료하는 guard를 추가하는 것도 고려할 수 있다. 현재 상태(이미 frozen 건너뜀 포함)가 허용 가능하지만, cache 항목마다 첫 branch에서 freeze된 값이 나머지 branch에서는 `isFrozen` 조기 반환으로 비용을 회피하므로 실질 비용은 첫 branch에 집중된다는 점을 문서화해 두면 유용하다.

- **[INFO]** `nextSeq` 내 직렬 async 호출 — `INCR` 완료 후 `EXPIRE` 순차 실행
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/codebase/backend/src/modules/execution-engine/continuation/continuation-bus.service.ts` — `nextSeq` 메서드
  - 상세: `await client.incr(key)` 후 `await client.expire(...)` 가 순차 실행된다. 두 명령은 의존 관계가 있어(INCR 성공 여부와 무관하게 EXPIRE는 키를 대상으로 하므로 순서가 맞다) 파이프라이닝이 어렵다. 단, EXPIRE 실패를 swallow하는 catch로 감싸 있어 대기 시간이 항상 두 RTT 비용을 부담한다. 고빈도 continuation publish 시 두 RTT의 cumulative 지연이 발생할 수 있다.
  - 제안: Redis pipeline(`multi`/`exec`) 또는 단일 `SET key value EX ttl` (INCR 불가하므로 불가)로 대체는 어렵다. 현재 구조에서는 `EXPIRE` 실패를 fire-and-forget으로 처리(`void client.expire(...).catch(...)`)하여 INCR 응답 반환을 앞당기는 방법을 고려할 수 있다. 단, EXPIRE 결과를 기다리지 않으면 TTL 설정 실패를 로그에 남기는 타이밍이 달라질 수 있으므로 허용 가능 여부를 확인 후 적용한다.

- **[INFO]** `releaseLock`에서 매 호출마다 Lua 스크립트 문자열 재생성
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/codebase/backend/src/modules/execution-engine/continuation/continuation-bus.service.ts` — `releaseLock` 메서드
  - 상세: `const script = "..."` 가 메서드 호출마다 로컬 변수로 선언된다. 문자열 자체는 JS 엔진이 상수 풀로 최적화할 가능성이 높지만, 관용적으로 클래스 정적 상수로 추출하면 의도가 명확해진다.
  - 제안: `private static readonly RELEASE_LOCK_SCRIPT = "..."` 로 추출. 성능 영향은 미미하나 가독성과 의도 명확화에 기여한다.

- **[INFO]** `sanitizeForLog`의 정규식 — 매 호출 시 리터럴 평가
  - 위치: `continuation-bus.service.ts` — `sanitizeForLog` 정적 메서드
  - 상세: `/[\x00-\x1F\x7F]/g` 정규식 리터럴은 JS 엔진이 메서드 최초 파싱 시 컴파일하므로 일반적으로 호출마다 재생성되지 않는다. 현재 구현은 문제 없다.
  - 제안: 현재 상태 유지.

### 요약

이번 변경 세트의 핵심 성능 관련 항목은 `parallel-executor.ts`의 `deepFreeze` 재귀 도입이다. `FREEZE_BRANCH_CACHE` 플래그로 production은 완전히 배제되어 운영 성능에 영향이 없다. dev/test 환경에서는 캐시 항목 수와 branch 수에 따라 선형 비용이 발생하나, `Object.isFrozen` 조기 반환이 중복 순회를 방지하고 freeze 지점이 branch context 생성 한 곳으로 한정되어 설계 범위가 적절히 통제된다. `continuation-bus.service.ts`의 두 Redis 직렬 호출(`INCR` + `EXPIRE`)은 구조적으로 불가피하며, EXPIRE fire-and-forget 전환으로 약간의 지연을 줄일 수 있지만 강제 사항은 아니다. 나머지 변경(함수명 rename, deprecated 코드 삭제, 테스트 정리)은 성능에 중립적이다.

### 위험도

LOW
