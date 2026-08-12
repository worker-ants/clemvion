# 유지보수성(Maintainability) 리뷰

## 배경

이 변경(`idempotency.interceptor.ts` §R8 캐시 대상 정합화)은 이미 6라운드
(`16_29_45` → `16_53_26` → `17_07_45` → `18_07_36` → `18_37_45` → `18_52_47`)의
코드 리뷰를 거쳤고, 매 라운드 maintainability reviewer 가 독립적으로 소스를 열어
같은 결론(CRITICAL/WARNING 없음, 잔여는 전부 선택적 INFO)에 수렴해 왔다. 이번
라운드(`19_04_29`)가 다루는 실제 delta 는 커밋 `6298d6fdb` 하나뿐이다 — 직전 라운드
(`18_52_47`)가 잡은 "모듈 docstring 이 '테스트 전부 warn 단언' 이라고 과장했는데 실제로는
7건 중 4건" 문제를 정확한 부분집합 서술로 좁힌 **주석 8줄 수정**이며, 실행 코드 변경은
없다.

## 독립 확인 (직접 소스 열람)

`codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`,
`.spec.ts`, `codebase/backend/test/external-interaction.e2e-spec.ts` 전체를 직접
읽고 이전 라운드들이 남긴 INFO 항목이 이번 delta 이후에도 정확히 같은 자리에 같은
형태로 남아 있는지 확인했다.

## 발견사항

- **[INFO]** 이번 delta(`6298d6fdb`)는 모듈 docstring 문장을 "전부 7건" → "4건(GET
  실패·SET 실패·직렬화 실패 양 채널)은 단언, 나머지 3건은 각각 다른 것을 보므로 안 붙임"
  으로 정정한 것으로, 유지보수성 관점에서는 순수하게 개선이다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:21-24`
    (모듈 최상단 docstring, 세 번째 `describe` 블록 설명)
  - 상세: "문서한 보장이 구현보다 넓다" 클래스의 재발을 리뷰가 잡았고, 그 수정이 범위를
    좁히는 방향(넓히는 방향이 아님)이라 검증 비용이 늘지 않는다. 실제로 `it` 블록을
    세어보면 이번 라운드에서 새로 추가된 `직렬화 불가 payload` 2건 + 기존 GET/SET 실패
    2건 = 4건이 `jest.spyOn(Logger.prototype, 'warn')` 을 쓰고, 나머지 3건(`Redis 조회
    실패해도 요청은 성공 …`·`catchError 는 반드시 switchMap 앞에 …`·비-`Error` reject)은
    쓰지 않아 서술과 코드가 정확히 일치한다.
  - 제안: 없음 — 확인용 기록.

- **[INFO]** 캐시 히트 재현 분기에서 `JSON.parse(cached.responseJson)` 이 상호 배타적인
  두 분기에 한 번씩 나타나 시각적으로는 중복처럼 보인다 (6라운드 연속 동일 지적·유예)
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:137`,
    `:143` (`intercept()` 의 `switchMap` 콜백, 캐시 히트 분기)
  - 상세: `isErrorStatusCacheable(cached.statusCode)` 가 참이면 137행, 거짓이면 143행에서
    각각 독립적으로 파싱한다. 런타임에는 1회만 실행되지만 소스만 보면 중복 파싱처럼 읽힌다.
    plan(`plan/in-progress/backend-lint-gate-broken-on-main.md:561-568`)에 "캐시 엔트리
    내부 `responseJson` 손상 무방비" 항목과 묶어 한 번에 닫는 방향이 이미 기록돼 있다.
    이번 delta 는 이 영역을 건드리지 않았다.
  - 제안: 필수 아님. `const parsed = JSON.parse(cached.responseJson) as unknown;` 을 두
    분기 위로 한 번만 끌어올리면 단일 파싱 지점이 되고, 그 자리에 손상 방어를 추가하면
    plan 의 두 항목을 동시에 해소할 수 있다.

- **[INFO]** "닫힌 목록" 판정이 에러 쪽(`isErrorStatusCacheable`)은 named 함수, 성공 쪽
  (2xx)은 `cacheTapped` 내부 인라인 조건으로 비대칭 팩터링돼 있다 (6라운드 연속 동일 지적)
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:177`
    (인라인 `if (statusCode < 200 || statusCode >= 300) return;`) vs `:255-257`
    (`isErrorStatusCacheable` named 함수)
  - 상세: 클래스·`cacheTapped` docstring 모두 "§R8 닫힌 목록 = 2xx + 409 + 410" 을 하나의
    정책으로 설명하지만, 실제로 이름 붙은 단일 출처는 정책의 절반(에러 쪽)뿐이다. 향후
    §R8 범위가 또 바뀌면(이번 PR 이 그랬듯) 수정 지점이 named 함수와 인라인 조건 두 곳으로
    갈린다.
  - 제안: 필수 아님. `isSuccessStatusCacheable(statusCode)` 를 같은 방식으로 뽑으면 정책이
    코드에서도 대칭적인 두 named 함수로 드러난다.

- **[INFO]** `intercept()` 가 캐시 조회·손상 fallback·body 충돌·에러 재현·정상 재현·미스
  위임 여섯 갈래를 한 메서드(약 63줄)에서 처리하며 중첩 깊이가 최대 4단
  (`switchMap → if(cachedJson) → try/if → if(isErrorStatusCacheable)`)에 이른다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:88-150`
  - 상세: 각 분기가 짧고 인라인 주석이 근거를 바로 옆에 남겨 두어 현재 가독성이 크게
    훼손되지는 않지만, 분기가 하나 더 늘면 단일 메서드로는 버거워질 수 있는 지점이다. 순환
    복잡도 자체는 여전히 관리 가능한 수준(각 분기가 독립적·얕음).
  - 제안: 필수 아님. 캐시 히트 처리(112-144행 `if (cachedJson) { ... }` 블록)를
    `private replayCached(cached, context, bodyHash): Observable<unknown>` 로 추출하면
    `intercept()` 자체는 "조회 → 히트/미스 위임" 한 단계로 짧아진다.

- **[INFO]** e2e 가 인터셉터의 Redis 키 prefix(`interaction:idempotency:`)를
  export 되지 않은 내부 상수(`REDIS_KEY_PREFIX`)와 별개로 3곳에 리터럴로 하드코딩한다
  (6라운드에서 처음 지적, 이번 delta 는 이 영역 무변경)
  - 위치: `codebase/backend/test/external-interaction.e2e-spec.ts:425`, `:495`, `:538`
    (`` redis.get(`interaction:idempotency:${idempotencyKey}`) ``) vs
    `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:21`
    (`const REDIS_KEY_PREFIX = 'interaction:idempotency:';` — export 없음)
  - 상세: 이 e2e 블록(`IDEM-1`~`IDEM-3`) 자체가 "Redis 엔트리를 직접 조회해야 판별력이
    생긴다" 는 것을 스스로 증명한 계약이라 리터럴 정합성이 특히 중요한 자리인데, prefix
    값이 단일 출처가 아니라 두 파일에 각각 하드코딩돼 있다. `REDIS_KEY_PREFIX` 를 바꾸면
    타입 체커는 이 drift 를 잡아 주지 못한다(문자열 리터럴이라 타입 불일치 없음).
  - 제안: `REDIS_KEY_PREFIX` 를 인터셉터에서 `export` 하고 e2e 가 import 해 쓰면 이 계약의
    유일한 관측점이 실제로 하나가 된다. 직전 라운드(`18_52_47`)가 "타당하나 프로덕션 표면을
    테스트 편의로 넓히는 변경이라 별도 판단 필요" 로 유예했고, 이번 delta 도 그 판단을
    바꿀 근거를 추가하지 않는다.

- **[INFO]** e2e `IDEM-1`~`IDEM-3` 가 워크플로/노드/execution/node_execution 생성
  셋업(각 10~25줄)을 거의 그대로 반복한다
  - 위치: `codebase/backend/test/external-interaction.e2e-spec.ts:371-424`(IDEM-1),
    `:448-494`(IDEM-2), `:516-541`(IDEM-3)
  - 상세: 같은 파일의 기존 테스트(`G`, `G-2` 등, 271-359행 부근)가 이미 확립한 스타일이며,
    `createTriggerWithInteraction` 헬퍼 외의 세부 fixture(대기 노드 유무·execution 상태)는
    테스트마다 의도적으로 달라 공유 헬퍼로 접기 쉽지 않다. 새 패턴이 아니라 기존 컨벤션의
    반복이다.
  - 제안: 조치 불요(기존 컨벤션과 일치). fixture 조합이 더 늘어나면
    `createWaitingFormExecution(db, { status, ... })` 류의 공용 헬퍼를 고려할 수 있다.

- **[INFO]** `review/code/2026/08/12/{16_29_45,16_53_26,17_07_45,18_07_36,18_37_45,18_52_47}/**`,
  `review/consistency/2026/08/12/18_27_29/**` 하위 신규 파일은 이전 리뷰 라운드가 생성한
  산출물(이력 기록)이며, 사람이 유지보수하는 소스가 아니라 가독성·네이밍·중첩·매직넘버 등
  통상 유지보수성 기준을 적용할 대상이 아니다.
  - 위치: 위 세션 디렉토리 하위 전체
  - 제안: 조치 불요.

## 요약

이번 라운드(`19_04_29`)의 실제 delta 는 이전 라운드가 잡은 "문서한 보장이 구현보다
넓다"(과장된 docstring) 결함을 정확한 부분집합 서술로 좁힌 주석 8줄 수정뿐이며, 실행
코드는 무변경이고 새로 도입된 유지보수성 결함은 없다. `idempotency.interceptor.ts`
핵심 변경 자체는 6라운드에 걸친 리뷰·재설계를 거치며 이미 잘 정리된 상태에 도달해
있다 — `isErrorStatusCacheable()` named 함수로 정책 판정을 분리했고, JSDoc 이 "왜
`>= 400`·`=== 400` 두 축약이 각각 오답인지" 와 "왜 error 채널을 봐야 하는지"를 코드
옆에 정확히 남겼으며, 각 결정을 잡는 회귀 테스트(단위 25건 + e2e 3건)가 뮤테이션
실측으로 판별력까지 확인돼 있다. 남은 항목은 전부 4~6라운드 연속 동일하게 지적·유예된
INFO 수준 선택적 개선(`JSON.parse` 시각적 중복, 성공/에러 판정 팩터링 비대칭,
`intercept()` 길이, e2e `REDIS_KEY_PREFIX` 리터럴 하드코딩 3곳, e2e 셋업 반복)이며,
이번 delta 가 새로 만든 것이 아니고 지금 손대면 오히려 수렴된 diff 를 흐릴 수 있다는
이전 라운드들의 판단과 일관된다. 즉시 조치가 필요한 CRITICAL/WARNING 성격의
유지보수성 결함은 발견되지 않았다.

## 위험도

NONE
