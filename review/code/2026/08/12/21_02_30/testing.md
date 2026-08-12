# 테스트(Testing) 리뷰 — 멱등 캐시 키 execution+route 스코프 (Spec EIA §R8)

## 검증한 사실 (재현)

- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` 를
  `npx jest` 로 직접 실행 — **29/29 통과** (`IdempotencyInterceptor (W-4 provider 경로)` ·
  `(캐시 히트·응답 형태 방어)` · `(Redis 런타임 장애 fail-open)` · `— 캐시 키 스코프 (Spec EIA §R8)`
  4개 describe 블록 전체).
- `npx tsc --noEmit -p tsconfig.json` 전체 실행 — 결과에 이 PR 대상 3개 파일
  (`idempotency.interceptor.ts` / `.spec.ts`, `test/external-interaction.e2e-spec.ts`) 관련
  에러는 **0건**. 리포트된 300여 건은 전부 다른 모듈의 기존 타입 부채(레포 자체 "ratchet" 대상,
  이 PR 과 무관)였다.
- `CancelDto` 는 `reason` 하나만 선언하고 전 필드 optional, 전역 `CustomValidationPipe` 가
  `whitelist: true` + `forbidNonWhitelisted: true` 를 켜고 있음을 직접 확인 — `IDEM-5` e2e 가
  `{command:'cancel'}` 을 `/cancel` 에 보내 400 을 기대하는 근거가 실제 설정과 일치한다.
- `context.getHandler().name` 를 흉내 낸 mock 패턴(`{ [routeName]: () => undefined }[routeName]`)이
  실제로 함수 `.name` 을 올바르게 추론하는지 Node 로 직접 확인 — 의도대로 동작.
- `IdempotencyInterceptor` 를 사용하는 라우트가 컨트롤러 전체에서 `interact` / `cancel` 단 둘뿐임을
  `interaction.controller.ts` 에서 확인 — 테스트가 커버하는 route 축이 실제 사용면과 정확히 일치.
- `git log -S` 로 두 커밋(`2e433c001`, `8316c8981`)의 실제 히스토리를 확인 — 개발자가 이미
  뮤테이션 테스트로 e2e `IDEM-4`/`IDEM-5` 의 단언 순서 결함(키 존재를 먼저 봐서 "행동" 단언에
  뮤턴트가 도달하지 못하던 문제)을 스스로 잡아 고친 이력이 있다. 이는 이 프로젝트가 반복적으로
  겪은 "판별력 없는 fixture" 클래스이고, 이번엔 릴리스 전에 자체적으로 잡혔다.

## 발견사항

- **[WARNING]** 유닛 레벨 "route 축" 테스트가 GET 키만 검증하고 SET 키의 route 스코프는
  검증하지 않는다 — 같은 describe 블록의 JSDoc 이 명시한 원칙("조회(GET)와 적재(SET)를 **둘
  다** 단언한다 — 한쪽만 스코프하는 회귀가 실제 가능한 형태다")이 "execution 축" 테스트에서는
  지켜지지만 "route 축" 테스트에서는 지켜지지 않는다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:839-864`
    (`it('route 축 — 같은 execution 이라도 interact 와 cancel 은 분리된다', …)`). 대조군인
    "execution 축" 테스트는 같은 파일 `:797-837` 에서 `redisA.set`/`redisB.set` 을
    `toHaveBeenCalledWith(scopedKey(...), …)` 로 명시 검증한다.
  - 상세: 이 프로젝트 자체 교훈("하드닝/검증을 자매 자리에 미적용")과 정확히 같은 형태다.
    다만 실제 위험은 낮다 — 구현(`idempotency.interceptor.ts:114-167`)이 GET 과 SET(cacheTapped
    경유 storeEntry) 양쪽에 **동일한 `redisKey` 지역변수**를 그대로 넘기므로, route 세그먼트가
    SET 에서만 빠지는 회귀는 코드 구조상 사실상 나오기 어렵다. 게다가
    `test/external-interaction.e2e-spec.ts` 의 `IDEM-5`(`:644-692`)가 실 Redis 에 대해
    `interact` 로 스코프된 키를 직접 GET 해 non-null 을 단언하므로, SET 이 route 를 놓치는
    회귀가 있었다면 e2e 레이어에서 잡힌다 — 그래서 CRITICAL 이 아니라 WARNING.
  - 제안: `redis.set` 호출 인자에도 `scopedKey('k', DEFAULT_EXECUTION_ID, 'cancel')` 형태의
    단언을 "route 축" 테스트에 한 줄 추가해 describe 블록 자신의 명시적 불변식과 실제 테스트를
    일치시킨다. (트리비얼한 추가이고, "execution 축" 테스트가 이미 같은 패턴을 쓰고 있어
    복붙 수준.)

- **[INFO]** `context.getHandler().name` 로 route 를 얻는 설계는 캐시 키의 route 세그먼트를
  컨트롤러 메서드 이름에 암묵적으로 결속시킨다. 유닛 테스트의 `DEFAULT_ROUTE = 'interact'`
  상수는 실제 컨트롤러 메서드명과 컴파일 타임으로 연결돼 있지 않다 — 누군가 `interact` 메서드를
  리네임해도 유닛 테스트는 자체 fake handler 이름을 그대로 쓰므로 그 드리프트를 탐지하지 못한다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:62-65`
    (`DEFAULT_EXECUTION_ID`/`DEFAULT_ROUTE` 상수 선언).
  - 상세: 실질 위험은 낮다 — 메서드 리네임은 캐시 키 네임스페이스만 바꿀 뿐 격리 자체를 깨지
    않고(24h 후 자연 소멸), e2e(`IDEM-5`)는 실제 컨트롤러를 거치므로 리네임이 있어도 정상
    동작한다. 회귀를 만드는 결함 클래스가 아니라 단순 관찰 사항.
  - 제안: 조치 불필요. 참고로만 남긴다.

- **[INFO]** 이 PR 의 회귀 테스트 설계는 이 프로젝트가 과거 반복적으로 지적당한 실패 패턴들
  (판별력 없는 fixture, mock 이 실제로 발생하지 않는 상태를 검사, 단언 순서로 인한 vacuous
  테스트, GET/SET 짝 미검증)을 명시적으로 docstring 에 인용하며 방어하고 있고, 실제로
  `git log` 상 뮤테이션 테스트를 스스로 돌려 `IDEM-4`/`IDEM-5` 의 단언 순서 결함을 릴리스 전에
  고친 이력이 확인된다. 유닛(4건 신규: execution 축·route 축·캐시 hit 스코프·ctx 부재 skip)과
  e2e(2건 신규: `IDEM-4`/`IDEM-5`)가 같은 계약을 다른 층위에서 상호 보완적으로 검증하는 구조도
  적절하다 — mock 이 못 보는 실 파이프라인(예외 채널·컨트롤러 `@HttpCode`·`getHandler().name`)
  invariant 는 e2e 로, mock 조합의 경우의 수는 유닛으로 나눠 담당한다.

## 테스트 격리·가독성·Mock 적절성

- 유닛: 매 테스트가 `makeRedis()`/`makeInterceptor()` 로 독립 mock 을 새로 만들고, `Logger.warn`
  spy 는 전부 `try/finally` 로 `mockRestore()` 한다 — 테스트 간 상태 누수 없음.
- `makeContext()` 의 `executionId?: string | null` 3-state 설계(미지정=기본값 / `null`=Guard
  미적용 / 문자열=명시)는 "명시 안 함" 과 "명시적으로 없음" 을 구조적으로 구분해, 이전에 이
  프로젝트가 반복한 "truthiness 로 뭉갠 3-state" 결함 패턴을 피한다.
- e2e: `redis`/`db` 클라이언트를 `beforeAll` 에서 한 번만 열고 각 테스트가 `randomUUID()` 로
  독립된 workflow/execution 을 만들어 데이터 충돌 없이 격리된다. 기존 `IDEM-1`~`IDEM-3` 과
  동일한 관례를 유지해 새 케이스가 파일 컨벤션에서 벗어나지 않는다.
- `scopedKey()`(유닛)와 `idempotencyCacheKey()`(e2e)는 각 파일에서 독립적으로 손으로 작성돼
  있어, 구현의 key-template 을 재사용(import)하며 자기 자신을 정당화하는 tautological 검증이
  아니다 — 실제 리터럴 포맷을 양쪽에서 따로 고정하고 있어 회귀에 더 강하다.

## 회귀 테스트

- 기존 `IdempotencyInterceptor (W-4 provider 경로)` / `(캐시 히트·응답 형태 방어)` /
  `(Redis 런타임 장애 fail-open)` 블록은 `makeContext()` 가 기본값(`DEFAULT_EXECUTION_ID`,
  `DEFAULT_ROUTE`)으로 interaction ctx 를 자동 주입하도록 바뀌어, 스코프 도입 이전에 작성된
  케이스들이 코드 변경 없이 그대로 유효하다(실측: 29/29 GREEN). 유일하게 수정된 기존 단언은
  `stringContaining('interaction:idempotency:key-1')` → `scopedKey('key-1')` 정확 일치로
  **강화**된 것이지 완화가 아니다.
- e2e `IDEM-1`/`IDEM-2`/`IDEM-3` 은 `interaction:idempotency:${key}` 리터럴 조합을
  `idempotencyCacheKey(executionId, idempotencyKey)` 헬퍼 호출로 교체됐을 뿐 검증 의도는
  동일 — 같은 execution 내 재현/미캐시 계약은 그대로 유지된다.

## 요약

멱등 캐시 키 스코프 확장(execution+route)에 대한 테스트는 유닛(신규 4건)과 e2e(신규 2건)
양쪽에서 실제 위협 시나리오(다른 execution 의 응답 유출, `interact`/`cancel` 캐시 혼선)를
"상태코드가 실제로 갈리는" 판별력 있는 fixture 로 검증하고, mock 이 만드는 상태와 실제
파이프라인이 만드는 상태의 괴리(예외 채널 vs 성공 채널, 컨트롤러 `@HttpCode`, 실제
`getHandler().name`)를 층위별로 정확히 나눠 담당한다. 개발자가 이미 뮤테이션 테스트로
단언 순서 결함을 자체 발견·수정한 이력이 `git log` 로 확인되고, 유닛 테스트 29/29 실행
통과·대상 파일 타입에러 0건을 직접 재현 확인했다. 유일한 지적은 "route 축" 유닛 테스트가
자신이 속한 블록의 GET/SET 동시 검증 원칙을 SET 쪽에서 누락한 것인데, 코드 구조(GET/SET
공유 변수)와 e2e `IDEM-5` 가 실질적으로 그 갭을 상쇄한다.

## 위험도

LOW
