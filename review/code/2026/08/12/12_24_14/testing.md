# 테스트(Testing) 리뷰 — `12_24_14` (backend lint `no-unsafe-*` 46→0 처분 누적 diff)

## 검증 방법

- 프롬프트의 unified diff 게이트 숫자를 그대로 인용하되, 확신이 필요한 자리는 `Read`로 실제
  소스(`idempotency.interceptor.ts`, `idempotency.interceptor.spec.ts`,
  `migrate-node-output-refs.ts`, `migrate-node-output-refs.spec.ts`)를 직접 열어 대조했다.
- 직전 두 라운드(`11_06_12`, `12_05_39`)의 testing.md / RESOLUTION.md가 주장한 "고쳤다"는
  내용을 그대로 믿지 않고, 그 라운드가 스스로 나열한 "실행된 적 없는 경로" 목록과 실제
  추가된 테스트를 1:1로 대조했다(`grep`으로 재확인).
- `execution-engine.service.spec.ts`의 `m.query` mock 형태, `trigger-dto-validation.spec.ts`의
  `text_only` 케이스, `execution-concurrency-cap.e2e-spec.ts` 존재 여부 등 이전 라운드가 인용한
  근거 파일들을 직접 grep으로 재확인했다 — 전부 주장과 일치했다.
- `plan/in-progress/backend-lint-gate-broken-on-main.md`를 읽어 이번 라운드가 "채웠다"고
  주장하는 테스트 공백과 실제 diff를 대조했다.

## 발견사항

- **[WARNING]** `idempotency.interceptor.ts`의 손상된 캐시 JSON `catch` 분기가 여전히 완전
  미검증 상태인데, plan 문서는 "캐시 히트 경로 전체"를 이번 라운드에서 "메웠다"고 주장한다 —
  보장이 구현보다 넓다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`
    (`intercept()` 내부 `try { cached = JSON.parse(cachedJson) ... } catch { ... }` 블록,
    소스 88-95행 — 이번 diff가 직접 건드린 줄은 아니지만 같은 `if (cachedJson)` 블록 안에서
    캐시 히트 흐름을 분기시키는 코드). 테스트 파일:
    `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` 전체
    (기존 4건 + 이번에 추가된 5건, 총 9건).
  - 상세: 직전 라운드(`12_05_39`)의 testing.md는 캐시 미스만 도는 기존 4건 때문에 다음 5개
    경로가 "한 번도 실행되지 않는다"고 명시적으로 열거했다 — `(1) 캐시 응답 재생, (2) 409
    충돌, (3) 손상된 캐시 JSON → catch 후 신규 처리 fallback, (4) 4xx 캐시 제외, (5)
    statusCode 기본값 fallback`. 그런데 그 라운드의 제안(a)-(d)와 실제 구현된 5건의 신규
    테스트(`idempotency.interceptor.spec.ts:154-285`)는 (1)(2)(4)(5)만 메웠고 **(3) 손상된
    JSON catch 분기는 처음부터 제안에서 빠졌고 지금도 비어 있다** — `grep -n "JSON.parse\|
    catch\|malformed\|corrupt"`를 스펙 파일 전체에 돌려도 `redis.get`이 파싱 불가능한
    문자열(예: `'not-json'`)을 반환하는 케이스가 0건이다. 관련 e2e도 없다
    (`grep -rn "IdempotencyInterceptor" --include="*.spec.ts" --include="*.e2e-spec.ts"`
    결과 `interaction.controller.spec.ts`는 인터셉터가 "부착돼 있는지"만 확인, 실제 흐름은
    타지 않는다).
    그런데 `plan/in-progress/backend-lint-gate-broken-on-main.md:480-483`는 "이번 라운드에
    `idempotency.interceptor.ts`의 같은 클래스 공백(**캐시 히트 경로 전체**)은 **메웠다**"라고
    적는다 — `catch` 분기도 `if (cachedJson)` 블록 안의 캐시 조회 흐름 일부이므로 "전체"라는
    표현이 실제로 남은 공백을 가린다. 이 저장소 메모리가 이미 3회 지적한 "문서한 보장이
    구현보다 넓으면 안 된다" 패턴과 같은 형태다.
    실패 시 영향은 낮다 — `catch`가 잡으면 그냥 `next.handle()` + `cacheTapped`(신규 처리)로
    fallback하므로 fail-open이고 요청 자체는 실패하지 않는다. 다만 그 fallback 자체가 실제로
    동작하는지, 혹은 catch 안에서 예외가 새지 않는지는 지금 테스트로 전혀 보장되지 않는다 —
    누군가 이 catch 블록을 실수로 지우거나 로직을 바꿔도 현재 스위트는 잡지 못한다.
  - 제안: `redis.get.mockResolvedValue('not-valid-json{')` 같은 케이스 1건을 추가해 (a)
    `next.handle()`이 실제로 호출되는지(`handleSpy`), (b) 그 결과가 정상적으로 흘러나오는지,
    (c) 이후 `cacheTapped`를 거쳐 정상 응답이면 재적재되는지를 고정할 것. plan 문서의 "메웠다"
    문구도 이 공백이 남아 있다는 사실을 반영해 정정하거나, 이 항목을 별도 백로그로 옮길 것.

## 회귀 테스트 유효성 — 재확인한 나머지 자리

아래는 이전 라운드의 주장을 독립적으로 재확인한 것이며, 새 결함은 발견되지 않았다.

- `migrate-node-output-refs.spec.ts:59-66`(Pass 2 신규 테스트) — 실제 구현
  (`migrate-node-output-refs.ts:289-307`)의 정규식·치환·`hits.push({field, ...})` 형태와
  테스트 기대값이 정확히 일치함을 직접 대조했다. 입력이 Pass 1(`.output.output.`)이 아니라
  Pass 2(`.output.meta.`) 패턴에만 매치해 다른 pass와 간섭하지 않는다. 구조적으로 vacuous가
  아니다.
- `chat-channel-config.dto.ts`의 `text_only → text` `@Transform` — `trigger-dto-validation.
  spec.ts:413-419`가 `plainToInstance`로 실제 transform을 실행해 단언함을 grep으로 확인.
- `execution-engine.service.ts`의 `m.query<{ id: string }[]>` — `execution-engine.service.
  spec.ts`의 여러 자리(`:301,331,4389,4468,4494,5176,5200,5248`)가 `mockResolvedValue([{ id:
  ... }])` 형태로 배열을 스텁함을 확인, `test/execution-concurrency-cap.e2e-spec.ts` 존재도
  확인.
- `chat-channel.dispatcher.ts`의 `logFn` 분기, `executions.service.ts`의 `snapshotCache`
  evict — 둘 다 여전히 테스트로 도달 불가능하지만, `plan/in-progress/
  backend-lint-gate-broken-on-main.md:474-483`에 "선재 테스트 공백 2건"으로 명시적으로
  추적되고 있어 은폐되지 않았다. 이번 diff가 타입만 바꾼 자리라 조치 대상이 아니라는 판단도
  타당하다 — 새 지적 아님.

## Mock 적절성 · 테스트 격리 · 가독성

- 신규 5건(`idempotency.interceptor.spec.ts:154-285`)은 매 테스트마다 독립된 `makeRedis()` /
  `IdempotencyInterceptor` 인스턴스를 새로 만들어 공유 mutable 상태가 없다 — 테스트 간 순서
  의존성 없음.
- `makeContext`에 추가된 `responseOverride`는 기존 4건(W-4 provider 경로)의 기본 동작을
  바꾸지 않는 backward-compatible 확장(`?? { statusCode, status: jest.fn() }`)이라 회귀
  위험이 없다.
- `handleSpy = jest.spyOn(handler, 'handle')` + `expect(handleSpy).not.toHaveBeenCalled()`로
  "캐시 히트 시 downstream이 아예 안 돈다"를 직접 검증한 것은 mock을 관찰용으로만 쓰지 않고
  실제 호출 여부까지 확인하는 적절한 사용이다.
- `status`/`statusCode` 없는 `responseOverride: {}` 케이스 2건은 `HttpResponseLike`의
  optional 필드가 지키려는 정확한 시나리오(어댑터/mock이 그 필드를 갖추지 않은 경우)를
  실제로 재현한다 — 형태만 있고 실제로는 항상 필드를 갖춘 mock을 쓰는 "가짜 커버리지" 함정을
  피했다.
- 테스트명이 한국어로 시나리오를 명확히 서술하고(`'같은 key + 다른 body → 409 …'` 등), 각
  `describe` 블록 docstring이 "왜 이 테스트가 필요한가"를 실행 경로 근거와 함께 남겨 가독성이
  좋다.

## 요약

이번 델타는 대부분 순수 타입 강화(런타임 미접촉, side_effect가 emit md5로 실증)이며, 직전
라운드가 WARNING으로 지적한 `idempotency.interceptor.ts`의 `HttpResponseLike` 방어 미검증은
5건의 신규 테스트로 실질적으로 메워졌다 — mock 격리·가독성·형태-없는-응답 재현 모두 양호하다.
다만 그 WARNING을 낳았던 원 진단(캐시 미스만 도는 4건)이 스스로 열거한 5개 미실행 경로 중
"손상된 캐시 JSON → catch fallback" 하나는 제안 단계에서부터 빠졌고 지금도 비어 있는데, plan
문서는 "캐시 히트 경로 전체를 메웠다"고 적어 실제보다 넓은 보장을 주장한다. 실패 시 영향은
fail-open이라 낮지만, catch 블록 자체가 깨져도 지금 스위트는 못 잡는다 — WARNING 1건으로
기록한다. `migrate-node-output-refs.ts` Pass 2 신규 테스트, 나머지 파일들의 기존 커버리지
주장은 소스 대조로 전부 사실과 일치함을 확인했고, 이미 disclosure된 두 개의 선재 공백
(dispatcher `logFn`, `executions.service.ts` evict)은 plan 문서에 정상적으로 추적되고 있어
재지적하지 않는다.

## 위험도

LOW
