# 요구사항(Requirement) Review

## 검토 방법

프롬프트 diff 는 6차례 선행 리뷰 라운드(`16_29_45`~`18_52_47`)의 산출물(`review/code/**`,
`review/consistency/**`)이 함께 커밋되어 있어 부풀어 있다. 실질 요구사항 대상은
`codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`(+`.spec.ts`),
`codebase/backend/test/external-interaction.e2e-spec.ts`, `CHANGELOG.md`,
`spec/data-flow/15-external-interaction.md`, `plan/**` 6개 실질 파일이며, 이 3개 코드 파일의
diff 는 프롬프트에서 크기 제한으로 생략되어 있었다 — `Read` 로 현재 워크트리의 실제 파일을
직접 열어 spec 원문(`spec/5-system/14-external-interaction-api.md` §R8)과 line-level 로
대조했다.

## 발견사항

- **[INFO]** `isErrorStatusCacheable()`/`cacheTapped()` 의 캐시 대상 판정이 Spec EIA §R8 의
  닫힌 목록과 정확히 line-level 로 일치함을 직접 대조로 확인
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:177`
    (`if (statusCode < 200 || statusCode >= 300) return;`), `:255-257`
    (`function isErrorStatusCacheable(statusCode) { return statusCode === 409 || statusCode === 410; }`)
    vs `spec/5-system/14-external-interaction-api.md:1053-1059`(§R8 본문)
  - 상세: §R8 은 "캐시 대상은 닫힌 목록이다: `2xx`·`409`·`410` 이 전부다. `400` 중
    `VALIDATION_ERROR` 외의 코드와 `5xx` 는 재시도가 의미 있는 실패라 캐시하면 안 된다.
    **단일 비교로 축약하면 안 된다** — `=== 400` 은 다른 400 계열·5xx 를 캐시 대상으로
    만들고, `>= 400` 은 반대로 409·410 을 떨군다" 고 명시한다. 현재 구현은 성공 채널
    (`2xx`, `>= 200 && < 300`)과 에러 채널(정확히 `409`/`410` 두 값 열거)을 분리된 함수로
    구현해 이 요구를 정확히 반영하며, 두 오답 축약(`>= 400`, `=== 400`) 모두 코드상 불가능한
    형태로 짜여 있다. `IDEMPOTENCY_KEY_CONFLICT`(같은 키+다른 body → 409)는 `intercept()`
    의 `switchMap` 콜백에서 캐시 조회 직후 동기적으로 throw 되어 `cacheTapped()` 의
    `catchError` 를 거치지 않으므로 STATE_MISMATCH 409 와 혼동되지 않는다(`intercept()`
    L122-129 vs L163-203).
  - 제안: 없음 — 확인용 기록.

- **[INFO]** 에러 채널 재현(`HttpException` 재throw)이 실제로 §R8/`EIA-RL-02`("동일 키 24h
  동일 응답 재현")를 충족하는지 e2e·단위 양쪽에서 상태코드·`error.code`·payload 까지 단언함을
  확인
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:272-327`(단위, `409`/`410` 적재+payload),
    `:329-387`(단위, 캐시 히트 시 예외 재현), `codebase/backend/test/external-interaction.e2e-spec.ts:371-444`(`IDEM-1`, 실 파이프라인 409 재현),
    `:512-550`(`IDEM-3`, 410 자매 케이스)
  - 상세: e2e `IDEM-1`은 `redis.get()` 으로 캐시 엔트리 자체를 조회해 `statusCode`/`responseJson` 을
    직접 단언하며(상태코드만 비교하면 무캐시 재처리와 캐시 재현을 못 가르는 fixture 문제가
    plan 에 실측 기록돼 있음), `IDEM-3` 이 같은 분기를 공유하는 410 을 별도로 덮는다.
    `requestId` 는 예외 필터가 매번 새로 발급하므로 재현 대상에서 명시적으로 제외됨이
    CHANGELOG(`CHANGELOG.md:27-29`)에 정확히 기록돼 있고, 실제 재현 단언(`statusCode`·
    `error.code`)도 그 범위와 일치한다.
  - 제안: 없음 — 확인용 기록.

- **[INFO]** 반환값 완전성 — `intercept()`·`cacheTapped()`·`storeEntry()` 모든 분기가 값을
  반환하거나(캐시 히트/미스/손상 JSON/무키), 명시적으로 `void`(적재 실패 fail-open)로
  귀결됨을 확인. 암묵적 `undefined` 반환 경로 없음
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:88-150`(`intercept`),
    `:214-241`(`storeEntry`)
  - 상세: `readKey`/`redis` 부재 시 `next.handle()` 그대로 반환(L91-93), 캐시 조회
    실패는 `catchError`가 `of(null)`로 강등(L105-110), JSON 파싱 실패는 `next.handle()`
    폴백(L114-121), body 불일치는 명시적 throw(L122-129), 캐시 히트는 에러 재현 또는
    `of(...)` 재현(L135-143), 캐시 미스는 `next.handle().pipe(cacheTapped(...))`(L145-147) —
    모든 분기가 `Observable<unknown>` 을 반환한다. `storeEntry` 는 `redis` 부재 시 조기
    `return`(명시적 `void`), 직렬화 실패도 `return`(적재만 skip, 원 예외는 호출자 쪽에서
    `throwError`로 그대로 전파 — 불변식이 코드·테스트(`:682-722`) 양쪽에서 일치).
  - 제안: 없음 — 확인용 기록.

- **[INFO]** (carried-forward, 신규 아님) `plan/in-progress/backend-lint-gate-broken-on-main.md`
  의 미착수 백로그 항목 한 줄이 이미 해소된 R8 갭을 여전히 참조
  - 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md:569-571`
    (`- [ ] readKey/hashBody 경계값 테스트 부재 … 함께: 클래스 docstring 에 R8 선재 결함
    참조 한 줄 추가(INFO 2, 경미).`)
  - 상세: 이 unchecked 항목의 부속 지시("R8 선재 결함 참조 한 줄 추가")는 R8 갭이 아직
    미해결이던 시점(`12_55_52` 라운드)에 작성됐는데, 그 R8 갭 자체는 이번 diff(같은 파일
    L572-641)로 이미 해소됐다. 이 항목은 이미 직전 라운드(`review/code/2026/08/12/18_37_45/documentation.md`)
    가 INFO 로 식별·유예한 것과 동일하며, 이번 라운드에서 새로 찾은 사항이 아니다. 실질
    영향은 없다 — `readKey`/`hashBody` 경계값 테스트 자체는 이번 PR 범위 밖의 선재 갭이고,
    이 항목이 실제로 착수될 때 자연히 드러날 성격이다.
  - 제안: 없음 — 이미 기록·유예된 사항의 재확인.

## 요약

`idempotency.interceptor.ts`/`.spec.ts`/`external-interaction.e2e-spec.ts` 최종 상태를
`spec/5-system/14-external-interaction-api.md` §R8 원문과 line-level 로 직접 대조한 결과,
캐시 대상 판정(`isErrorStatusCacheable` + 성공 채널 인라인 범위)이 §R8 의 닫힌 목록(`2xx`·
`409`·`410`, `400 VALIDATION_ERROR`·`5xx` 제외)과 정확히 일치하고, §R8 이 명시적으로 경고한
두 축약 오답(`>= 400`, `=== 400`)이 코드·테스트 양쪽에서 구조적으로 재발 불가능하게 막혀
있다. `EIA-RL-02`(동일 키 24h 동일 응답 재현)는 e2e(`IDEM-1`/`IDEM-3`)와 단위 테스트가 상태
코드·에러코드·캐시 엔트리 payload 까지 직접 단언해 충족을 확인했고, `requestId` 비재현
caveat 도 CHANGELOG·실제 예외 필터 동작과 일치한다. 모든 코드 경로가 적절한 값/void 를
반환하며 TODO/FIXME/HACK/XXX 류 미완성 마커는 없다. 본 변경은 이미 6차례 리뷰 라운드
(CRITICAL 1건 → dead code 재설계, WARNING 다수 → 자매 케이스·방어 누락·문서 정확도 순차
해소)를 거쳐 수렴한 상태이며, 이번 독립 검증에서 새로운 CRITICAL/WARNING 은 발견되지 않았다.
유일한 잔여 항목은 plan 백로그의 미착수 항목 한 줄이 이미 해소된 갭을 여전히 참조하는
경미한 문서 잔재로, 이미 이전 라운드가 식별·유예한 것과 동일하다.

## 위험도

LOW
