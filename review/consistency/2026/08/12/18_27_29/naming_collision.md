# 신규 식별자 충돌 검토 — `spec/data-flow/` (EIA §R8 idempotency 캐시 재설계)

## 검토 범위 확인

diff-base `origin/main` 대비 변경 파일은 3개뿐이며 전부 `codebase/` 아래고 `spec/**` 변경은
없다 (`spec/data-flow/15-external-interaction.md` 는 컨텍스트 번들일 뿐 이번 diff 의 변경
대상이 아님 — 새 spec 식별자·API endpoint·엔티티·이벤트명 도입 없음):

- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts`
- `codebase/backend/test/external-interaction.e2e-spec.ts`

따라서 이번 검토의 "신규 식별자"는 코드 레벨 함수명·메서드명·테스트 helper·테스트 ID 로
한정된다. HEAD 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434`)
에서 `git grep` 로 전수 확인했다.

## 발견사항

- **[INFO]** 테스트 ID 중복(`I-2`)은 이미 이전 리뷰 라운드에서 발견·수정됨 — 재발 아님
  - target 신규 식별자: 신규 e2e 테스트 3건에 부여된 `IDEM-1` / `IDEM-2` / `IDEM-3`
    (`codebase/backend/test/external-interaction.e2e-spec.ts:371,446,512`)
  - 기존 사용처: 같은 파일 657행의 기존 테스트 `I-2. getStatus wire — buttons 노드는...`
  - 상세: `review/code/2026/08/12/18_07_36/RESOLUTION.md` (WARNING #3, maintainability) 에
    기록된 대로, 신규 e2e 테스트가 처음에는 `I-1`/`I-2` 로 명명되어 같은 파일 617행(당시 기준)의
    기존 `I-2`(`getStatus wire`)와 **문자 그대로 중복**되었던 이력이 있다. 해당 라운드에서
    `grep "it('I-"` 로 `I-2` 2건을 실측 확인한 뒤 `IDEM-1`/`IDEM-2`/`IDEM-3` 로 개명해 A~J
    순차 관행 및 기존 `I-2` 와 충돌하지 않도록 조치했고, plan 인용도 함께 갱신했다고 기록되어
    있다. 현재 HEAD 를 `grep -noE "it\('[A-Za-z0-9-]+\."` 로 재검사하면 `IDEM-1/2/3` 와
    `I-2` 가 공존하되 완전히 구분되는 문자열이라 실제 충돌은 **해소된 상태**임을 확인했다
    (중복 0건).
  - 제안: 조치 불요 — 이미 해소됨. 참고용으로만 기록. 다만 `IDEM-` prefix 는 파일의 기존
    `A, B, …, G, G-2, H, I, I-2, J` 알파벳 순차 관행과 형식이 다르다(문자+숫자 vs 단일 문자).
    리뷰 라운드가 "충돌하지 않게 했다"고만 확인했을 뿐 관행 통일까지는 다루지 않았으므로,
    향후 같은 파일에 테스트를 더 추가할 때 `IDEM-` 처럼 도메인 접두어를 쓸지 순차 알파벳을
    이어갈지 방향을 정해 두면 좋다(선택, 비차단).

- **[INFO]** `IDEM-` 문자열이 기존 에러 코드 `IDEMPOTENCY_KEY_CONFLICT` 와 부분 문자열이 겹침 — 실질 충돌 아님
  - target 신규 식별자: 테스트 ID prefix `IDEM-1`/`IDEM-2`/`IDEM-3`
  - 기존 사용처: `codebase/backend/src/modules/external-interaction/interaction.controller.ts:83`,
    `codebase/backend/src/modules/hooks/hooks.service.ts:724`, `hooks.service.spec.ts:1151,1178`
    의 에러 코드 문자열 `IDEMPOTENCY_KEY_CONFLICT`
  - 상세: 둘 다 "idempotency" 도메인을 가리키는 것은 맞지만 하나는 테스트 ID(자유 형식 라벨),
    다른 하나는 API 계약상의 에러 코드 enum 값이라 네임스페이스와 소비자가 다르다. grep 매치
    폭 정도의 우연한 접두 겹침이며 사람이 혼동할 실제 지점(동일 파일·동일 문맥에서 함께 쓰임)이
    없다.
  - 제안: 조치 불요.

- **[INFO]** 신규 함수 `isErrorStatusCacheable` / 신규 private 메서드 `storeEntry` — 전역 유일성 확인
  - target 신규 식별자: `isErrorStatusCacheable(statusCode: number): boolean`
    (모듈 스코프, `idempotency.interceptor.ts:255`), `IdempotencyInterceptor.storeEntry(...)`
    (private 메서드, `idempotency.interceptor.ts:214`)
  - 기존 사용처: 없음 — `git grep -n "isErrorStatusCacheable"` / `git grep -n "storeEntry"` 전체
    저장소 검색 결과 이번 diff 가 도입한 자리와 그것을 인용하는 `review/**`·`plan/**` 문서
    (이력 기록)뿐이었고, 다른 의미로 쓰이는 기존 정의는 없었다. `storeEntry` 는 클래스 private
    메서드라 export 표면도 없어 다른 모듈과의 충돌 가능성이 원천적으로 없다. 유사 이름
    `isCacheable` 도 저장소 전체에 없다.
  - 제안: 해당 없음(충돌 없음, 정보성 확인).

- **[INFO]** 신규 테스트 helper `makeThrowingHandler` — 전역 유일성 확인
  - target 신규 식별자: `makeThrowingHandler(err: unknown): CallHandler`
    (`idempotency.interceptor.spec.ts:101`)
  - 기존 사용처: 없음. 저장소 전체에서 `make*Handler` 패턴은 같은 파일의 기존
    `makeCallHandler` 와 `execution-engine.service.spec.ts` 의 `makeAiAgentHandler`(다른
    타입 `NodeHandler` 대상, 다른 파일) 뿐이며 이름·타입 모두 겹치지 않는다. 두 헬퍼 모두
    파일 로컬 함수라 import 경합도 없다.
  - 제안: 해당 없음.

- **[INFO]** ENV var·Redis key namespace — 신규 도입 아님, 기존 컨벤션 재사용 확인
  - target: `process.env.REDIS_HOST` / `process.env.REDIS_PORT` (신규 e2e 블록,
    `external-interaction.e2e-spec.ts:142-143`), Redis key prefix `interaction:idempotency:`
    (기존 `REDIS_KEY_PREFIX` 상수, 변경 없음)
  - 기존 사용처: `execution-seq-allocator-load.e2e-spec.ts:35-36`,
    `integration-cache-invalidate.e2e-spec.ts:50-51` 이 동일한 `REDIS_HOST`/`REDIS_PORT`
    fallback 패턴(`?? 'redis'` / `?? '6379'`)을 이미 쓰고 있다. 새 ENV var 도입이 아니라
    기존 관행을 그대로 재사용한 것이라 충돌 소지가 없다. Redis key prefix 도 이번 diff 에서
    값 자체는 바뀌지 않았다(적재 경로만 `catchError` 로 확장).
  - 제안: 해당 없음.

- **API endpoint / 이벤트·메시지명 / spec 파일 경로**: 이번 diff 에 신규 endpoint, 신규
  webhook·queue·SSE 이벤트명, 신규 spec 파일이 전혀 없다 (diff 는 기존
  `/api/external/executions/:id/interact` 캐시 계층의 내부 재구현일 뿐, `POST`/`GET`
  경로·요청 스키마·이벤트 타입은 모두 기존 그대로다). 검토할 대상 자체가 없다.

## 요약

이번 target 은 `spec/**` 를 전혀 변경하지 않는 순수 코드 재구현(EIA §R8 idempotency 캐시의
409/410 error-channel 처리)이라, 신규 식별자 충돌의 표면 자체가 좁다. 유일하게 실제 충돌
이력이 있었던 항목 — 신규 e2e 테스트 ID `I-1`/`I-2` 가 같은 파일의 기존 `I-2`(`getStatus wire`)
와 문자 그대로 겹쳤던 문제 — 는 직전 리뷰 라운드(`review/code/2026/08/12/18_07_36`)에서 이미
`IDEM-1`/`IDEM-2`/`IDEM-3` 로 개명해 해소되었고, 현재 HEAD 에서 재검증한 결과 중복이 없음을
확인했다. 새로 도입된 함수·메서드·테스트 helper(`isErrorStatusCacheable`, `storeEntry`,
`makeThrowingHandler`)는 전역 유일하며 다른 의미의 기존 정의와 충돌하지 않는다. ENV
var·Redis key namespace 는 신규 도입이 아니라 기존 관행 재사용이며, 신규 API endpoint·이벤트명·
spec 파일 경로 도입은 없다. Live 한 CRITICAL/WARNING 급 신규 식별자 충돌은 발견되지 않았다.

## 위험도
NONE
