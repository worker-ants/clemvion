# 테스트(Testing) 리뷰 — `resolveCacheHit()` 추출 (idempotency.interceptor.ts)

## 검증 방법 메모

`codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` 는 이번 diff 에
**포함되지 않았다** (`git diff origin/main --stat` 확인: 변경 파일은 `idempotency.interceptor.ts`
1개뿐). plan(`backend-lint-gate-broken-on-main.md`) 은 "순수 구조 변경 — 기존 spec 63건 전부
GREEN, 새 테스트 없음" 이라고 주장한다. 이 주장과 docstring 에 적힌 뮤테이션 실측 수치를
독립적으로 재현했다:

1. `npx jest idempotency.interceptor.spec.ts` — **63/63 통과** (plan 의 "63건" 과 일치).
2. `CacheLookup` 의 `redisKey`↔`bodyHash` 를 서로 바꿔 넣는 뮤턴트 주입 → **13개 RED**
   (docstring 61~66행의 "13개가 죽었다" 와 정확히 일치).
3. 분기 4(`bodyHash` 불일치 → `throw ConflictException`)를 성공 채널(`of(...)`)로 바꾸는
   뮤턴트 주입 → **4개 RED** (docstring 218행의 "4개" 와 정확히 일치).
4. 두 뮤턴트 모두 `cp` 로 scratch(`/private/tmp/.../scratchpad`)에 원본을 보관한 뒤 수정 →
   테스트 실행 → `cp` 로 즉시 원복. `git status --short` 로 저장소가 clean 함을 매번 확인했다
   (분기 6의 "2개 RED" 주장은 시간상 별도로 재현하지 않았으나, 위 두 건이 정확히 일치해
   신뢰도가 높다).

이 프로젝트 이력(MEMORY "실측했다"가 틀린 사례 다수)에 비추어 문서화된 실측 수치를 그대로
받아들이지 않고 직접 재현했고, 두 건 모두 **정확히 일치**했다 — 이 PR 의 테스트 커버리지
주장은 신뢰할 수 있다.

## 발견사항

- **[INFO]** 신규 추출된 `resolveCacheHit()` / 신규 `CacheLookup` interface 에 대한 전용
  단위 테스트가 없다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:222` (`private resolveCacheHit(...)`), `:72` (`interface CacheLookup`)
  - 상세: 둘 다 `private`/module-internal 이라 spec 파일이 이미 채택한 컨벤션(스펙 파일
    59~57행 "헬퍼가 전부 module-private 라 전부 `intercept()` 를 통해 본다 — 헬퍼 직접 호출은
    호출부 테스트가 아니다")을 그대로 따르면 직접 호출 테스트를 추가하지 않는 것이 맞다.
    실제로 `intercept()` 를 통한 63개 기존 테스트가 `resolveCacheHit()` 의 7개 분기를 전부
    통과시키며, 이 리뷰가 재현한 뮤테이션 결과(13 RED / 4 RED)도 이를 뒷받침한다.
  - 제안: 조치 불필요 — 현 상태가 이 코드베이스의 기존 테스트 철학과 일치한다. 다만 다음에
    이 메서드를 다시 만질 때 "타입이 위치 인자 swap 을 막아준다" 는 근거를 재도입하기 전
    (docstring 62~70행이 이미 이 함정을 스스로 경고해 두었다) 이 리뷰처럼 실제 뮤테이션으로
    확인할 것.

- **[INFO]** 리팩터 전후 동작 동등성을 직접 비교하는 골든/스냅샷 테스트는 없다 — 63건이
  통과한다는 사실 자체가 동등성의 증거다.
  - 위치: `idempotency.interceptor.ts` 전체 (구조 변경 diff)
  - 상세: `switchMap` 콜백 본문을 그대로 옮긴 pure extract-method 이므로 기존 스펙이 이미
    "행동 동등성" 을 규정한다. 별도 비교 테스트를 추가하는 것은 오버엔지니어링에 가깝다.
  - 제안: 조치 불필요.

- **[INFO]** `switchMap` 의 project 함수 *안에서* `resolveCacheHit()` 를 호출해야 하는 제약
  (throw 가 동기 예외가 아니라 Observable error 채널이 되어야 함, docstring 213~217행)을
  전용으로 고정하는 테스트는 없지만, 기존 회귀 테스트들이 부수적으로 이를 검증한다.
  - 위치: `idempotency.interceptor.ts:189-191` (`switchMap((cachedJson) => this.resolveCacheHit(...))`)
  - 상세: 만약 이 호출이 `switchMap` 밖으로 끌려 나가면 `throw` 가 `intercept()` 자체를
    동기적으로 던지게 되어, `lastValueFrom(interceptor.intercept(...)).rejects.toThrow(...)`
    형태의 기존 테스트(예: "같은 key + 다른 body → 409", "throw 된 409 가 캐시된다" 등)가
    `await expect(...)` 평가 이전에 예외를 던져 실패한다 — RED 로 잡히지만 실패 형태(assertion
    실패가 아니라 uncaught throw)가 원인 파악을 더 어렵게 만들 수 있다.
  - 제안: 우선순위 낮음. 원하면 "position 캐너리" 형태로 `intercept()` 호출 자체가 throw 하지
    않고 항상 Observable 을 반환한다는 것을 명시적으로 단언하는 테스트 1건을 추가하면 실패
    메시지가 더 명확해진다. 필수는 아니다.

## 요약

`idempotency.interceptor.ts` 의 `switchMap` 콜백을 `resolveCacheHit()` private 메서드로
추출한 순수 구조 리팩터다. 스펙 파일(`idempotency.interceptor.spec.ts`)은 이번 diff 에 포함되지
않았고 그럴 필요도 없다 — 신규 `CacheLookup`/`resolveCacheHit` 은 module-private 이라 기존
컨벤션대로 공개 API(`intercept()`)를 통한 63개 기존 테스트로 이미 전 분기(7갈래)가 커버된다.
plan/docstring 이 주장하는 두 건의 뮤테이션 실측(필드 swap → 13 RED, 분기4 채널 변경 → 4 RED)을
독립적으로 재현했고 **정확히 일치**했다 — 문서화된 커버리지 근거가 신뢰할 만하다. 테스트
격리(매 테스트 fresh mock, `Logger.prototype.warn` spy 의 `try/finally` 복원)와 가독성(각
`describe`/`it` 이 왜 그 형태인지, 과거 어떤 뮤테이션이 살아남았는지를 주석으로 남김)도 이
코드베이스 기준으로 모범적이다. 회귀 위험은 관측되지 않았다.

## 위험도
NONE
