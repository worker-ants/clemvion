# 아키텍처(Architecture) 리뷰

대상: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` (순수 구조 리팩터 —
`intercept()`의 `switchMap` 콜백을 `resolveCacheHit()` 사설 메서드로 추출 + 호출 인자 4개를 `CacheLookup`
인터페이스로 묶음). 나머지 변경 파일(`plan/in-progress/backend-lint-gate-broken-on-main.md`,
`review/consistency/2026/08/29/17_23_43/*`)은 plan 체크박스 기록과 consistency-check 산출물이라
아키텍처 관점 대상이 아니다.

## 발견사항

- **[INFO]** `resolveCacheHit()`의 "반드시 `switchMap` project 함수 안에서 호출해야 한다"는 계약이
  타입 시스템이 아니라 JSDoc 서술로만 강제된다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:213`
    (계약을 설명하는 docstring), 메서드 시그니처는 `:222`
  - 상세: `resolveCacheHit`의 반환 타입은 `Observable<unknown>`이지만, 분기 4·6은 값을 반환하는 대신
    동기적으로 `throw`한다. 이 이중 계약(정상 반환 vs 동기 throw)은 지금은 `intercept()`의
    `switchMap` 콜백이라는 단일 호출부 안에서만 성립하고 그 정합성은 docstring의 경고로만
    유지된다. 리팩터 이전엔 이 `throw`가 `switchMap` 콜백 리터럴 안에 물리적으로 박혀 있어 위치
    오용이 구조적으로 불가능했지만, 사설 메서드로 뽑아내면서 "어디서 불러도 되는 메서드"처럼
    보이는 시그니처와 "특정 실행 컨텍스트에서만 안전한" 실제 의미가 분리됐다. 지금은 호출부가
    하나뿐이라 위험이 낮지만, 다음에 두 번째 호출부(예: 다른 인터셉터 재사용)가 생기면 이 불변식이
    타입으로 안 걸리므로 조용히 깨질 수 있다.
  - 제안: 현재 위험도는 낮으니 강제 리팩터는 불필요하다. 다만 이 메서드가 재사용되는 시점이 오면
    "throw 가능"을 타입으로 드러내거나(예: 판정 결과를 discriminated union으로 반환하고 호출부에서
    `throw` 하는 형태로 역전), 최소한 메서드명에 그 계약을 반영(`resolveCacheHitOrThrow` 등)하는
    것을 권장.

- **[INFO]** 메서드명 `resolveCacheHit`이 분기 1(캐시 미스)까지 포함해 실제로는 "캐시 조회 결과
  판정" 전체를 다루는데, 이름은 "히트"만 가리킨다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:222`
  - 상세: docstring의 표(`:196-206`)는 스스로 "일곱 갈래"라 밝히고 1번을 "캐시 미스"로 적어 두어
    문서 층위에서는 혼동이 없지만, 이름만 보는 독자(IDE 자동완성·호출부 추론)에게는 "히트일 때만
    쓰는 함수"로 읽힐 여지가 있다. 사소한 사안.
  - 제안: `resolveCacheLookup` 또는 `resolveCachedResult` 등으로 이름을 좁히면 이름과 책임 범위가
    더 정확히 일치한다. 필수는 아님.

- **[INFO]** `CacheLookup`이 순수 데이터(`redisKey`, `bodyHash`)와 프레임워크 객체
  (`ExecutionContext`, `CallHandler`)를 한 인터페이스로 묶는다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:72-81`
  - 상세: docstring(`:58-70`)이 이 설계를 명시적으로 정당화한다 — "타입 안전이 근거가 아니라
    가독성이 근거"라고 스스로 적어 두었고, 실제로 이 클래스 spec 13건이 `redisKey`/`bodyHash` swap을
    이미 문다는 실측까지 남겼다. 단일 호출부(사설 메서드 하나)를 위한 파라미터 객체로는 적절하다.
    다만 "성격이 다른 두 축(조회 키 데이터 vs 실행 컨텍스트)을 한 타입에 담는다"는 점에서, 만약
    이 인터페이스가 다른 맥락(예: 캐시 적재 전용 헬퍼)으로 재사용되면 그 경계가 흐려질 수 있다.
    지금은 `resolveCacheHit` 하나의 전용 파라미터 객체이므로 문제는 없다.
  - 제안: 현재 유일 호출부 범위에서는 조치 불필요. 두 번째 소비자가 생기면 그때 데이터 축과
    컨텍스트 축을 분리할지 재판단.

## 설계 평가 (긍정)

- **SRP 분리가 명확해졌다.** `intercept()`는 이제 "캐시를 쓸 수 있는 요청인가"(헤더 파싱 · execution
  스코프 · Redis 가용성)만 책임지고, `resolveCacheHit()`는 "조회 결과로 무엇을 하는가"(파싱 · 형태
  검증 · 충돌 판정 · 재현 채널 분기)를 전담한다. 두 책임의 경계가 메서드 경계와 정확히 일치한다.
- **트리거 기반 리팩터링 규율.** 이 추출은 즉흥적 리팩터가 아니라, 두 라운드 전에 "여섯 번째 분기가
  생기면 재검토"라고 스스로 세워 둔 조건이 일곱 번째 분기(엔트리 형태 불일치)에서 실제로 발동해
  집행됐다(`:208-210`). 조건부 유예를 이행하는 이력이 plan 문서(`plan/in-progress/backend-lint-gate-broken-on-main.md:815-838`)에도 실측(뮤테이션 RED 13/4/2건)과 함께 남아 있어, "고쳤다"는
  주장과 검증 근거가 분리되지 않는다.
- **순수 판정 헬퍼(`isIdempotencyEntry`, `isHttpStatusCode`, `describeShape`, `readKey`, `hashBody`)가
  이미 모듈 스코프 함수로 분리돼 있어** `resolveCacheHit` 자체는 시퀀셜 오케스트레이션만 담당한다.
  분기가 순서 의존적(파싱→형태검증→bodyHash비교→payload파싱→상태코드분기)이라 각 단계가 이전
  단계의 산출물에 의존하므로, Strategy/Chain-of-Responsibility 패턴으로 더 쪼개는 것은 이 시점에는
  과설계다 — 현재의 guard-clause 나열이 적절한 추상화 수준이다.
- **회귀 방지가 코드가 아니라 실측으로 고정돼 있다.** docstring 자체가 "이 채널은 실측으로
  고정돼 있다"며 분기 4·6을 성공 채널로 바꾼 뮤턴트가 각각 4건·2건의 spec을 죽인다고 명시해,
  다음 사람이 "채널을 값 반환으로 단순화해도 되지 않을까" 하는 유혹을 받을 때 근거를 바로 확인할
  수 있게 해 둔다.
- **순환 의존성·모듈 경계**: 이번 변경은 클래스 내부 리팩터일 뿐 신규 import·신규 모듈 간 참조가
  없어 순환 의존성·모듈 경계 문제는 발생하지 않는다.
- **레이어 책임**: 인터셉터가 Redis에 직접 접근하는 것은 이 클래스의 기존 설계(교차 관심사
  캐싱)와 일관되며, 이번 diff가 그 경계를 새로 흐리지 않는다.

## 요약

이번 변경은 신규 기능이 아니라 `IdempotencyInterceptor.intercept()`의 비대해진 `switchMap` 콜백을
`resolveCacheHit()` 사설 메서드로 추출하고 4개 인자를 `CacheLookup` 파라미터 객체로 묶는 순수 구조
리팩터다. 스스로 세워 둔 복잡도 트리거(분기 수 임계값)가 실제로 발동한 뒤 집행됐고, `intercept()`
(캐시 적용 가능 여부 판단)와 `resolveCacheHit()`(조회 결과 처리)의 책임 분리가 메서드 경계와 정확히
일치해 SRP 관점에서 개선이다. 순환 의존성·레이어 경계·디자인 패턴 오용 등 구조적 결함은 발견되지
않았다. 유일하게 주목할 점은 `resolveCacheHit()`가 "특정 RxJS 실행 컨텍스트(`switchMap` project
함수) 안에서만 안전"이라는 불변식을 타입이 아니라 문서로만 강제한다는 것인데, 호출부가 하나뿐인
현재 시점에는 실질 위험이 낮고 docstring이 그 위험을 명시적으로 경고해 두었다.

## 위험도

NONE
