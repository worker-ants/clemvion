# 아키텍처(Architecture) 코드 리뷰 — EIA idempotency fail-open fix (`eia-idempotency-fixes`)

## 검토 범위에 대한 메모

이번 diff는 실질적으로 두 층으로 나뉜다.

1. **프로덕션 코드 변경** (`codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` + `.spec.ts`) — Redis `get()` 런타임 reject를 `catchError`로 캐시 미스로 강등하는 작은 RxJS 파이프라인 수정.
2. **문서/리뷰 산출물** (`CHANGELOG.md`, `plan/in-progress/backend-lint-gate-broken-on-main.md`, `review/code/2026/08/12/{14_27_02,14_50_36,15_04_25}/**`) — 이전 리뷰 라운드들의 감사 기록(markdown/json)이 저장소에 반영된 것.

2번 그룹은 생성된 리뷰 아티팩트이지 사람이 유지보수하는 소스가 아니므로 SOLID/결합도/디자인 패턴 관점의 평가 대상이 아니다(`review/code/**`는 프로젝트 규약상 `code-review-agents`의 산출 경로). 아래 발견사항은 1번 그룹(실제 소스)에 한정한다.

## 발견사항

- **[INFO]** GET/SET 두 캐시 실패 처리 로직이 동일한 포맷팅·판별 로직을 독립적으로 복제
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:107-112` (신규 `catchError` — GET 실패), `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:174-180` (기존 `cacheTapped()` 내 `.catch()` — SET 실패, 이 diff로 직접 수정되지 않은 자리)
  - 상세: 두 자리 모두 `` `IdempotencyInterceptor cache ${OP} 실패 — fail-open: ${err instanceof Error ? err.message : String(err)}` `` 형태의 동일한 문자열 조립·`instanceof Error` 판별을 독립적으로 갖는다. "Redis 캐시 작업이 실패했을 때 어떻게 보고할 것인가"라는 하나의 개념이 클래스 안에서 두 곳에 흩어져 있어, 추상화 수준이 살짝 낮다 — `private warnCacheFailure(op: 'GET'|'SET', err: unknown)` 같은 메서드로 캡슐화하면 이 클래스의 "실패 보고" 책임이 한 곳에 응집된다. 이미 `maintainability` 축에서 두 라운드(`14_27_02`, `14_50_36`) 동안 INFO로 지적되고 "2곳뿐이라 보류, 3번째 실패 경로가 생기면 재검토"로 의도적으로 유예된 항목이며, 이번 diff가 새로 늘린 것도 아니다. 아키텍처 관점에서도 같은 결론(낮은 우선순위, 조치 불요)에 동의한다.
  - 제안: 별도 조치 불필요. 유예 판정 유지.

- **[INFO]** Redis 장애 시 fail-open을 각 모듈이 개별적으로 구현 — 공유 추상화 부재(레포 전역, 스코프 밖)
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` 전체(신규 `catchError` 포함) / 비교 대상: `codebase/backend/src/common/redis/redis-connection.provider.ts` (fail-open 래퍼 미제공)
  - 상세: `grep -rl "fail-open" codebase/backend/src --include='*.ts'`로 확인한 결과 external-interaction·chat-channel·hooks·execution-engine 등 20개 이상 파일이 각자 Redis 호출부에서 개별적으로 `catch`/`catchError` + `logger.warn` 패턴을 반복 구현한다. `RedisConnectionProvider`는 원시 client(`getClientOrNull()`)만 제공하고 "실패 시 graceful degrade" 라는 반복되는 정책을 캡슐화한 공유 래퍼(예: `safeRedisCall()` 데코레이터/헬퍼)를 제공하지 않는다. 이번 diff는 이 기존 컨벤션을 그대로 따랐을 뿐 새로운 결함을 만들지 않았다 — 레포 전체에 걸친 리팩터는 이 국소적 버그 수정의 스코프를 크게 벗어난다.
  - 제안: 이번 PR에서 조치 불필요. 다만 "Redis 미가용 시 fail-open"이 반복 정책이라는 점을 고려하면, 후속으로 `RedisConnectionProvider` 위에 얇은 resilience 래퍼(예: `provider.safeGet<T>(fn, fallback)`)를 두는 것을 별도 아키텍처 개선 항목으로 검토할 만하다. 이번 fix와는 독립적인 백로그 성격.

- **[INFO]** GET→SET이 낮은 수준의 raw ioredis 호출로 직접 배선되어 있어, "멱등성 저장소"라는 개념이 별도 추상화(리포지토리/포트) 없이 인터셉터 안에 흩어져 있다 — 이미 concurrency 축에서 추적 중
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:98`(`from(this.redis.get(redisKey))`), `:174-176`(`cacheTapped()`의 `void this.redis.set(...)`)
  - 상세: 인터셉터가 `IdempotencyEntry` 직렬화·TTL·prefix·GET/SET 커맨드 조립까지 직접 담당한다. 원자적 "미존재 시 선점"(`SET NX EX` 또는 Lua) 대신 GET 후 별도 SET이라 비원자 구간이 존재하고, 이미 `plan/in-progress/backend-lint-gate-broken-on-main.md` §후속과 여러 라운드의 concurrency 리뷰(WARNING)가 이 갭을 추적 중이다. 아키텍처 관점에서 보면 이는 "저장 방식(원자성)"의 문제라기보다 "저장소 개념이 인터셉터 책임에 섞여 있어 원자성 있는 구현으로 교체하기 어렵다"는 추상화 경계 문제이기도 하다 — `IdempotencyStore`(reserve/commit 같은 원자적 인터페이스) 하나로 뽑아내면, 이후 `SET NX EX`나 Lua 스크립트로 구현을 교체할 때 인터셉터(프레젠테이션에 가까운 AOP 레이어)를 건드리지 않아도 된다.
  - 제안: 이번 diff의 스코프가 아니다(신규 결함 아님, 이미 concurrency 축 WARNING으로 문서화·백로그됨). GET→SET 원자성 개선을 실제로 착수할 때, 그 기회에 `IdempotencyStore` 인터페이스 추출도 함께 검토할 것을 참고로 남긴다.

## 확인했지만 문제 없음

- **연산자 배치(레이어 경계) 판단이 정확하다.** `catchError`가 `from(this.redis.get(redisKey)).pipe(...)`의 첫 연산자로, `switchMap` **앞**에 위치한다(`idempotency.interceptor.ts:107` vs `:113`, `Read`로 직접 재확인). RxJS의 `catchError`는 자신보다 상류(upstream)에서 발생한 에러만 잡고 `switchMap` 내부(하류)의 동기 `throw new ConflictException(...)`은 잡지 않으므로, "Redis 조회 실패를 흡수한다"는 책임과 "캐시 충돌을 검출해 던진다"는 책임이 서로 침범하지 않는다. 두 책임이 다른 연산자에 명확히 분리돼 있고(SRP가 함수/연산자 단위로 유지됨), 그 경계를 깨는 변경을 즉시 잡아내는 캐너리 테스트(`idempotency.interceptor.spec.ts:405-428`)까지 갖춰 회귀 방어가 구조적으로 되어 있다.
- **레이어 책임 분리 유지.** `IdempotencyInterceptor`는 NestJS Interceptor(AOP 횡단 관심사) 레이어에 머물러 있고, 이번 변경으로 컨트롤러/서비스(비즈니스 레이어)나 데이터 레이어 코드를 건드리지 않는다. Redis 접근은 `RedisConnectionProvider`(추상화된 DI 경로)를 통해 이뤄지고, 인터셉터가 커넥션 풀 관리나 클라이언트 생성에 관여하지 않는다.
- **의존성 역전 유지.** 생성자가 `@Optional() @Inject('IDEMPOTENCY_REDIS')`와 `RedisConnectionProvider`를 통해 Redis 접근을 주입받는 기존 구조가 그대로 유지된다. 이번 fix는 이 DI 경로를 재사용해 테스트가 가능했고(`makeInterceptor(redis)`), 새 결합을 추가하지 않았다.
- **순환 의존성 없음.** import 그래프에 새 순환이 생기지 않는다(`rxjs/operators`에서 `catchError` 하나 추가 import).
- **디자인 패턴 적절성.** graceful degradation(장애 시 기능을 낮은 수준으로 유지)이라는 목적에 RxJS `catchError` + `of(null)` 폴백은 적절한 관용구다. 이 자리에 서킷 브레이커나 재시도 정책 같은 더 무거운 패턴을 도입하는 것은 spec이 요구하는 "즉시 fail-open"과 어긋나 과도한 추상화였을 것 — 현재 수준의 추상화가 적절하다.
- **확장성.** 세 번째 Redis 장애 경로(생성자 null·조회 실패·적재 실패)가 추가될 때도 같은 `catchError`/`.catch()` 관용구를 재사용할 수 있는 구조이며, 클래스 docstring이 "세 경로 모두"를 명시적으로 계약화해 두어 향후 네 번째 경로가 생기면 그 계약이 자연스럽게 확장 지점을 알려준다.

## 요약

이번 diff의 프로덕션 코드 변경은 `IdempotencyInterceptor`의 RxJS 파이프라인에 `catchError` 연산자 하나를 정확한 위치(`switchMap` 앞)에 추가하는 국소적 수정으로, 클래스의 책임 범위·의존성 구조·레이어 경계를 전혀 바꾸지 않는다. NestJS Interceptor 패턴, DI를 통한 Redis 접근, 그리고 "캐시 실패 흡수"와 "충돌 검출"을 서로 다른 RxJS 연산자에 분리해 유지하는 설계 모두 건전하다. 남는 것은 전부 이미 다른 라운드에서 발견되어 의도적으로 유예된 저강도 항목(GET/SET 실패 처리 로직의 소규모 코드 중복, 레포 전역에 반복되는 fail-open 관용구, GET→SET 비원자 구조로 인한 "저장소" 추상화 미분리)이며, 이번 PR의 좁은 스코프(런타임 fail-open 버그 수정)를 넘어서는 후속 개선 기회로 보는 것이 적절하다. diff에 함께 실린 `review/code/**` 산출물·`CHANGELOG.md`·plan 문서는 생성된 감사 기록/문서이지 소스 아키텍처 평가 대상이 아니다.

## 위험도

LOW
