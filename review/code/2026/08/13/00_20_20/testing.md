# 테스트(Testing) 리뷰 — 누적 diff (`8a2d13031`(merge-base)..HEAD, 5커밋)

## 리뷰 범위 및 검증 방법

핵심 변경은 `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` /
`idempotency.interceptor.spec.ts` 두 파일이고(그 외 `CHANGELOG.md`, plan 문서, 이전 3라운드
(`23_24_08`/`23_36_13`/`23_48_38`)의 리뷰 감사 아티팩트는 코드 실행 경로가 아니라 이 관점의
평가 대상 밖이다). 프롬프트의 diff 가 크기 제한으로 생략돼 있어, `git diff` 로 두 소스 파일의
실제 diff 를 직접 받고 최신 파일 전문을 `Read` 로 읽어 아래 인용 줄 번호를 소스 파일 기준으로
확인했다.

이전 세 라운드가 이미 다음 항목을 지적하고 후속 커밋이 실제로 조치했음을 코드에서 직접 확인했다:

- `23_24_08` testing WARNING — payload 손상 "에러 재현 분기" 테스트의 단언 얕음 → 형제와
  동형으로 `warnSpy`/`redis.set`/저장값 단언 보강 (`idempotency.interceptor.spec.ts:701-749`).
- `23_48_38` testing WARNING — `JSON.parse('null')` 이 `try/catch` 를 통과해 `TypeError`→500 으로
  샌다 → `isIdempotencyEntry()` 형태 가드 신설 + `it.each` 8-fixture 로 방어 (`ts:370-378`,
  `spec.ts:552-605`).
- `23_48_38` testing INFO — 신규 테스트 1건이 `warnSpy` 를 `try/finally` 밖에 둠 → 전체 신규
  테스트 5블록이 `try/finally` 로 통일됨 (직접 대조: `spec.ts:515-546`, `581-604`, `611-628`,
  `636-665`, `710-748` 전부 `finally { warnSpy.mockRestore(); }`).

이 세 건은 재발 없이 반영돼 있음을 확인했으므로 아래에서는 반복하지 않는다. 대신 이 라운드에서는
**직접 뮤테이션을 걸어 무수정 검증**했다(단순히 RESOLUTION.md 의 주장을 재인용하지 않기 위해) —
백업은 `cp` 로 scratch 에 뜨고 원복도 `cp` 로 했으며, 매 뮤테이션 뒤 `git diff --stat` 로 워킹
트리가 깨끗함을 확인했다.

1. **bodyHash 판정 ↔ payload 파싱 순서 스왑** (plan `620-634` 이 "뮤턴트를 처음엔 무효로
   만들었다" 고 자체 기록한 바로 그 자리) — payload 파싱 블록과 bodyHash 판정 블록의 텍스트
   순서를 실제로 맞바꿔 재실행: `안쪽이 깨졌어도 body 가 다르면 여전히 409 — 판정 순서를
   고정한다` (`spec.ts:668`) 가 정확히 실패했다(`rejects.toBeInstanceOf(ConflictException)` 가
   `{fresh:true}` 로 resolve). **1건 실패, 나머지 40건 통과** — 순서 캐너리가 실제로 하중을
   받는다는 것을 직접 재현했다.
2. **`isIdempotencyEntry()` 의 `responseJson` 타입 검사절 제거** — `typeof e.responseJson ===
   'string'` 절만 걷어내고 재실행: `문법은 유효하지만 엔트리 형태가 아닌 캐시(responseJson 만
   타입 불일치) → 500 이 아니라 신규 처리` 케이스 **정확히 1건**만 실패(`ConflictException` 이
   되레 던져짐 — `bodyHash` 검사가 먼저라 `cached.bodyHash !== bodyHash` 비교에서 우연히 걸림).
   RESOLUTION(`23_48_38`)이 표로 적어 둔 "각 필드 검사가 각각 1건씩 죽인다" 는 주장과 실측이
   일치한다.

둘 다 매 뮤테이션 후 `npx jest idempotency.interceptor.spec.ts` 를 재실행해 확인했고, 최종
원복 후 41/41 통과 + `git diff` 무변경도 확인했다.

## 발견사항

- **[INFO]** `describeShape()` 로그 헬퍼가 어떤 테스트로도 하중을 받지 않는다 — 함수 본문
  전체를 상수로 치환해도 41개 테스트가 전부 그대로 통과한다(직접 뮤테이션 실측).
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:380-385`
    (`function describeShape`), 호출부 `:173` (`discardCorruptEntry('엔트리', \`형태 불일치
    (${describeShape(parsed)})\`, processFresh)`)
  - 상세: `it.each` 형태-불일치 fixture 8건(`spec.ts:552-605`)은 모두
    `expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('cache 엔트리 손상'))` 까지만
    본다 — 이 substring 은 `discardCorruptEntry` 의 앞부분(`` `IdempotencyInterceptor cache
    ${what} 손상 — 무시하고 신규 처리: ` ``)에서 이미 확정되므로, 뒤에 이어지는
    `describeShape(parsed)` 의 반환값(`'null'`/`'array'`/`typeof value`)이 무엇이든, 심지어
    `describeShape` 를 `() => 'x'` 로 통째로 대체해도 이 단언은 여전히 통과한다. 실제로
    `return 'x';` 로 바꾸고 `npx jest` 를 재실행해 41/41 그대로 통과함을 확인했다 — 이 함수는
    지금 **관측 불가능한 코드**다. 다만 위험은 낮다: `describeShape` 는 client-observable 동작에
    관여하지 않고 warn 로그의 부가 정보 한 조각일 뿐이며(`security.md` 도 이 함수의 존재 이유를
    "캐시 payload 원본이 로그로 새지 않도록 형태만 문자열화" 로 긍정 평가했다), 세 분기 각각이
    실행되긴 한다(`null`/`[]`/`42` fixture 가 코드 경로는 통과시킨다) — **값을 검사하는 assertion
    이 없을 뿐**이다.
  - 제안: `it.each` fixture 중 최소 1~2건(예: `null`, `42`)에
    `expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('형태 불일치 (null)'))` /
    `expect.stringContaining('형태 불일치 (number)')` 를 추가하면 `describeShape` 의 세 분기가
    실제로 정확한 문자열을 내는지까지 고정된다. 급하지 않음 — 로그 메시지 정확도 수준의 갭이라
    기능·계약에는 영향이 없다.

- **[INFO]** `statusCode` 필드의 값 범위(유효 HTTP 상태코드 여부)를 검사하는 테스트가 없다 —
  `isIdempotencyEntry()` 자체가 `typeof === 'number'` 만 보므로 `NaN`·음수·`Infinity`·비정수도
  통과하는데, 이 경계를 exercise 하는 fixture 가 없다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:370-378`
    (`isIdempotencyEntry`), 소비부 `:208`(`isErrorStatusCacheable(cached.statusCode)`),
    `:214-215`(`res.status(cached.statusCode)`). 테스트 쪽 `spec.ts:552-569` 의 `it.each`
    fixture 는 `statusCode` 타입 불일치(`"200"` 문자열) 1건만 포함하고 `NaN`/음수/`0` 값 자체는
    다루지 않는다.
  - 상세: 같은 세션의 `security.md` INFO 도 동일 지점(`statusCode` 값 범위 미검증)을 독립적으로
    짚었다 — 두 관점이 같은 코드 자리를 서로 다른 각도(보안: 신뢰 경계 낮음이라 위험 낮음 / 테스트:
    이 경계를 고정하는 회귀 테스트 부재)에서 수렴한다. 이 값의 출처가 이 서비스 자신이
    `storeEntry()` 로만 쓴 Redis 엔트리라 실효 위험은 낮지만(캐시 손상·수동 Redis 조작이 아닌 한
    도달 불가), `NaN`/음수 `statusCode` 가 저장된 엔트리를 캐시 히트로 재생할 때 `res.status(NaN)`
    이 어떤 응답을 만드는지는 현재 어떤 테스트도 고정하지 않는다.
  - 제안: 급하지 않음(선재 갭, PR 표제 범위 밖). 향후 `readKey`/`hashBody` 경계값 테스트
    (plan 백로그에 이미 등재된 `12_55_52` testing INFO 10)를 다룰 때 함께 정리하면 비용이
    낮다.

- **[INFO]** 뮤테이션 실측으로 두 핵심 회귀 테스트의 하중을 독립 재검증 — 발견사항이라기보다
  이번 라운드가 이전 라운드의 자기보고(self-report)를 그대로 받지 않고 무수정 프로브로 대조한
  기록이다.
  - 위치: `idempotency.interceptor.spec.ts:668`(순서 캐너리), `:552-605`(형태 fixture 8건)
  - 상세: 위 "리뷰 범위 및 검증 방법" 절에 실측 절차·결과를 남겼다. 두 케이스 모두 RESOLUTION
    (`23_48_38`)이 문서로 주장한 뮤테이션 결과(순서 스왑 1건 실패 / 필드 제거 1건씩 실패)와
    정확히 일치했다 — 문서-코드 정합성이 실제로 유지되고 있음을 확인했다.
  - 제안: 없음.

## 회귀 확인

- `npx jest idempotency.interceptor.spec.ts` — **41 passed, 41 total** (plan/RESOLUTION 이 적은
  "41/41" 과 일치, 직접 재실행 확인. 이 파일만 실행하면 신규 8건 = 형태 fixture 5(`null`·숫자·
  배열·문자열·필드 누락) + 격리 fixture 3(bodyHash/responseJson/statusCode 단일 타입 불일치)).
- 기존 캐시 히트/충돌/스코프/W-4 provider 테스트는 이번 diff 로 로직이 바뀌지 않은 happy-path를
  그대로 exercise 하므로 유효하다 — 리팩터(조기 반환·`processFresh` 클로저·단일 파싱 지점)가
  관측 가능한 분기 순서를 바꾸지 않았음을 41/41 GREEN 과 별도 순서 뮤테이션 실측으로 확인.
- `Logger.prototype.warn` 전역 mock 은 신규 테스트 5블록(단일 4건 + `it.each` 1블록) 전부
  `try/finally` 로 스코프돼 교차 오염이 없다 — `jest.config.ts` 에 `restoreMocks` 안전망이 없다는
  점(직접 확인: 파일에 해당 키 없음)을 감안하면 이 규율이 유일한 방어선이고, 검토 범위 내에서는
  전부 지켜지고 있다.
- 이 diff 가 건드리지 않은 기존 GET 실패 테스트 2건(`ECONNRESET`/`'connection lost'`)은 여전히
  `Logger.warn` 을 mock 하지 않아 테스트 실행 중 실제 로그가 콘솔로 새는 것을 직접 관찰했다 —
  다만 이는 선재 상태이고 모듈 docstring(`spec.ts:26-27`)이 "나머지 3건은 … warn 단언을 붙이지
  않았다" 로 명시적으로 스코프 밖임을 밝히고 있으며 이전 라운드(`23_48_38` testing)도 같은
  결론이라 새 지적으로 올리지 않는다.

## 요약

이번 누적 diff(캐시 엔트리 안쪽 `responseJson` 손상 방어 완성 + `isIdempotencyEntry` 형태 가드
신설)의 테스트 커버리지는 세 라운드를 거치며 성숙했다 — 엔트리/payload 두 겹 손상, 각각의 warn
가시성, `bodyHash` 판정과 payload 파싱의 순서 계약, 에러/성공 두 재현 채널의 자매 커버리지,
그리고 문법은 유효하지만 형태가 아닌 8가지 JSON 값(`null`·숫자·배열·문자열·필드 누락·필드별
타입 불일치 3건)까지 모두 개별 회귀 테스트로 고정돼 있다. 이번 라운드에서 RESOLUTION 의 뮤테이션
주장 두 건(순서 스왑·필드 검사 제거)을 직접 재현해 자기보고와 실측이 일치함을 확인했고, 새로
발견한 갭은 둘 다 INFO 수준이다 — 로그 메시지 조립용 `describeShape()` 헬퍼가 값 수준에서
검증되지 않는 점(client-observable 동작에는 영향 없음), 그리고 `statusCode` 값 범위(유효 HTTP
코드 여부)를 고정하는 fixture 가 없는 점(security 리뷰와 같은 지점을 다른 각도에서 확인, 신뢰
경계가 낮아 실효 위험도 낮음). 회귀 위험은 낮다 — 41/41 통과, 기존 happy-path 테스트 전부 유효,
mock 격리 규율도 신규 테스트 전체에 일관 적용됨.

## 위험도

LOW
