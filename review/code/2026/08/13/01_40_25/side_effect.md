# 부작용(Side Effect) 리뷰

## 검증 방법

`idempotency.interceptor.ts` 전체와 `idempotency.interceptor.spec.ts` 의 `makeContext()` 정의·
호출부 49곳을 직접 `Read`/`Grep` 으로 열어, 이전 세 라운드(`00_54_18`→`01_10_52`→`01_31_17`)가
이미 NONE 으로 판정한 side-effect 결론을 독립적으로 재검증했다. 또한 `git log`/`git show` 로 이번
세션 직전 마지막 커밋(`2a1abb4c1`, docstring 문단 재배치)이 코드/테스트 로직을 건드리지 않았음을
확인했다.

## 발견사항

- **[INFO]** 신규 모듈 상수 `MIN_HTTP_STATUS_CODE`/`MAX_HTTP_STATUS_CODE` — 전역 가변 상태 아님
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:25-26`
  - 상세: `const` 로 선언되고 export 되지 않으며 재할당 지점이 없다(파일 전체 grep 으로 확인). 같은
    파일의 기존 `MAX_KEY_LENGTH`/`TTL_SEC`/`REDIS_KEY_PREFIX` 와 동일한 module-private 불변 상수
    패턴이라 side-effect 관점의 "전역 변수"(공유 가변 상태) 위험에 해당하지 않는다.
  - 제안: 조치 불요.

- **[INFO]** `isIdempotencyEntry()` 의 `statusCode` 판정이 `typeof === 'number'` → `isHttpStatusCode()`
  로 좁혀져, 캐시 hit 이 캐시 miss(신규 처리 + warn emit)로 강등되는 경로가 새로 생긴다 — 의도된
  동작 변경
  - 위치: `idempotency.interceptor.ts:383`(`isIdempotencyEntry` 내부 호출), `:397-403`(`isHttpStatusCode`
    정의), `:241-250`(`discardCorruptEntry` — 강등 시 `logger.warn` emit)
  - 상세: 종전에는 `-1`·`0`·`600`·`200.5` 같은 `statusCode` 를 가진 엔트리도 "유효"로 판정해
    `res.status(...)`/`new HttpException(_, statusCode)` 로 그대로 흘려보냈다(express 가 전송
    시점에 `RangeError`→500). 변경 후에는 이런 엔트리가 `discardCorruptEntry()` 경로로 재분류되어
    새로 `logger.warn()` 을 emit 하고 캐시를 버린 뒤 `next.handle()` 로 재처리한다 — 이벤트/콜백
    관점에서 새 warn 이벤트 발생 경로가 늘었고, 종전엔 호출되지 않았을 다운스트림 핸들러가 실제로
    다시 호출된다. 이 API 자신이 100~599 밖 `statusCode` 를 생성하지 않으므로(클래스 docstring
    §fail-open 표·CHANGELOG 양쪽에 명시) 정상 운영 경로에서는 관측되지 않지만, 배포 시점에
    Redis 에 우연히 그런 손상 엔트리가 이미 있었다면 그 키에 한해 1회성 "캐시 miss + 재실행" 이
    발생할 수 있다. `CHANGELOG.md` 에 클라이언트 영향이 이미 명시돼 있어 문서화 갭은 없다.
  - 제안: 조치 불요 — 의도된 하드닝이고 영향 범위가 문서화돼 있다.

- **[INFO]** `if (!rawKey || …)` → `if (rawKey === null || …)` 전환은 현재는 순수 리팩터이지만,
  호출부가 `readKey()` 의 "빈 문자열을 반환하지 않는다" 는 암묵적 계약에 새로 의존하게 됐다
  - 위치: `idempotency.interceptor.ts:113`(호출부), `:423-428`(`readKey` 구현)
  - 상세: `readKey()` 는 non-string → `null`, trim 후 빈 문자열 → `null`, `MAX_KEY_LENGTH` 초과 →
    `null` 세 사유만 `null` 을 반환하고 그 외엔 항상 "trim 된 비어있지 않은 문자열" 을 반환하도록
    구현돼 있어(3개 반환 지점 직접 확인), 현재 코드 기준으로는 `!rawKey` 와 `rawKey === null` 이
    완전히 동일한 분기 결과를 낸다. 다만 이 전환으로 "빈 문자열을 캐시 skip 조건으로 잡아 주던
    이중 방어"가 단일 지점(`readKey`)으로 좁혀졌다 — 향후 `readKey` 에 실수로 `''` 를 반환하는
    경로가 추가되면 호출부는 더 이상 그것을 걸러내지 못하고, 키 세그먼트가 빈
    `` `${REDIS_KEY_PREFIX}${executionId}:${route}:` `` 형태의 Redis 키가 그대로 쓰인다. 지금
    시점엔 실제 위험이 없고, `readKey()` JSDoc(`:412-422`)이 그 불변식을 명시해 뒀다.
  - 제안: 조치 불요 — 향후 `readKey` 를 수정할 때 "빈 문자열 미반환" 불변식만 유의.

- **[INFO]** 공유 테스트 헬퍼 `makeContext()` 의 `body` 정규화 규약 변경 — 파일 내 모든 호출부에
  영향 범위지만 회귀 없음을 직접 grep 으로 재확인
  - 위치: `idempotency.interceptor.spec.ts:137`(`body: 'body' in opts ? opts.body : {}`)
  - 상세: `opts.body ?? {}` → `'body' in opts ? opts.body : {}` 로 바뀌어, `body` 키를 생략한 호출은
    여전히 `{}` 로 정규화되지만 `body: undefined`/`body: null` 을 **명시**한 호출은 이제 그대로
    전달된다. `makeContext(` 호출부 49건을 grep 한 결과 `body: undefined`/`body: null` 을 쓰는
    자리는 이번에 신설된 두 테스트(`:1363`, `:1370`)뿐이고, 나머지 전부는 리터럴 객체(`{ a: 1 }`
    등)를 넘기거나 `body` 키 자체를 생략해 `{}` 로 귀결된다 — 조용히 깨지는 기존 테스트는 없다.
    프로덕션 코드·공개 인터페이스에는 영향 없는 test-only 변경이다.
  - 제안: 조치 불요 — 향후 동적 `body` 값을 넘기는 신규 호출부를 추가할 때 "키 생략"과 "값이
    명시적 undefined" 를 혼동하지 않도록만 유의.

- **[INFO]** `codebase/` 밖 신규 파일(review/consistency 산출물, plan/CHANGELOG 갱신)은 런타임
  코드가 만드는 부작용이 아니라 프로젝트 규약에 따른 정상 산출물/문서 변경
  - 위치: `review/code/2026/08/13/{00_54_18,01_10_52,01_31_17}/**`,
    `review/consistency/2026/08/13/01_10_53/**`(신규), `review/consistency/2026/08/12/23_36_14/**`
    (삭제 — `_retry_state.json`·`meta.json`), `CHANGELOG.md`, `plan/in-progress/backend-lint-gate-broken-on-main.md`
  - 상세: `CLAUDE.md` 가 지정한 저장 위치(`review/code/**`, `review/consistency/**`) 규약에 정확히
    부합하는 git 커밋 산출물이며, `IdempotencyInterceptor` 실행이 만드는 파일시스템 부작용이
    아니다. `23_36_14` 아래 두 파일 삭제는 커밋 메시지("SUMMARY 하나를 빠뜨렸다 — 빈 세션은 push
    게이트를 거짓 통과시킨다")가 밝히듯 prepare-only 로 남은 중복 consistency 세션 정리이며,
    실행 코드와 무관한 리뷰 인프라 위생 조치다.
  - 제안: 조치 불요.

전역 변수의 **가변** 도입, 예상치 못한 파일시스템 생성·수정·삭제, 환경 변수 읽기/쓰기, 의도치 않은
네트워크 호출, 공개 인터페이스(생성자·`intercept()` 시그니처) 변경은 이번 diff 범위에서 발견되지
않았다. `constructor`/`intercept()`/`discardCorruptEntry`/`cacheTapped`/`storeEntry` 등 기존 메서드
시그니처는 전부 변경 전과 동일하고, `isHttpStatusCode()` 는 module-private 신설 함수라 외부
호출자에 영향이 없다. Redis I/O(`get`/`set`)는 기존 로직 그대로이고 새로 추가된 호출은 없다.
신규 `Logger.prototype.warn` spy 테스트는 파일 전체 관행대로 `try/finally { warnSpy.mockRestore() }`
로 격리돼 테스트 간 전역 mock 누수 위험이 없다. 마지막 커밋(`2a1abb4c1`)은 모듈 docstring 내
문단 위치 재배치만이고 코드/테스트 로직 변경이 없음을 `git show` 로 직접 확인했다.

## 요약

이번 diff(`idempotency.interceptor.ts` 의 `statusCode` 유효성 판정 강화(`isHttpStatusCode()`) +
`rawKey` null 판정 명시화, `idempotency.interceptor.spec.ts` 의 경계값 테스트 신설 및 `makeContext`
정규화 변경, `CHANGELOG.md`/`plan/**` 문서 갱신, 그리고 다수의 이전 리뷰/consistency 세션 산출물
아카이빙)은 side-effect 관점에서 위험한 변경을 도입하지 않는다. 공개 인터페이스는 불변이고, 신규
모듈 상수는 재할당 없는 module-private 상수이며, 파일시스템·환경변수·네트워크 호출 표면은 새로
생기거나 바뀌지 않았다. `isHttpStatusCode()` 판정 강화로 손상 엔트리가 캐시 miss 로 강등돼
`logger.warn()` 을 새로 emit 하는 것은 CHANGELOG 에 명시된 의도된 변경이며, 그 유일한 촉발 조건
(서버 자신이 과거에 적재한 손상 엔트리)은 정상 운영에서 발생하지 않는다. 공유 테스트 헬퍼
`makeContext()` 의 `body` 정규화 규약 변경은 49개 호출부를 직접 대조해 회귀 없음을 재확인했다.
`review/**` 아래 신규 파일들은 코드 실행이 만든 부작용이 아니라 프로젝트가 정한 저장 위치 규약에
따른 정상 산출물이다. 이전 세 독립 side_effect 리뷰 라운드의 NONE 판정과 이번 독립 재검증 결과가
일치한다. CRITICAL/WARNING 급 side-effect 발견사항 없음.

## 위험도

NONE
