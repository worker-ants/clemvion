# 요구사항(Requirement) 리뷰 — idempotency.interceptor `isHttpStatusCode` + `readKey`/`hashBody` 경계값 (최종 수렴 라운드)

## 대상 (실제 코드 변경, `git diff origin/main...HEAD -- codebase/` 로 재확인)

- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` — `intercept()` 의 `rawKey` null 판정을 `!rawKey` → `rawKey === null` 명시 비교로 전환, `isIdempotencyEntry()` 의 `statusCode` 검사를 `typeof === 'number'` → 신설 `isHttpStatusCode()`(정수 + `MIN_HTTP_STATUS_CODE=100`~`MAX_HTTP_STATUS_CODE=599`)로 강화
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` — `readKey`/`hashBody` 경계값 `describe` 블록 신설(선언 9개, `it`/`it.each` 전개 후 실행 15건) + `makeContext()` 의 `body` mock 정규화 수정 + 모듈 최상단 docstring 색인 갱신
- `CHANGELOG.md` — `isHttpStatusCode()` 방어에 대응하는 Unreleased 항목 신설
- `plan/in-progress/backend-lint-gate-broken-on-main.md` — 해당 체크박스 완료 표시 + 완료 근거·정정 서술
- 나머지(`review/code/2026/08/13/{00_54_18,01_10_52,01_31_17,01_40_25}/**`, `review/consistency/2026/08/13/{01_10_53,01_49_10}/**`)는 선행 4라운드 `/ai-review` + 2라운드 `/consistency-check` 의 정규 산출물 아카이빙이며, 기능 요구사항 검토 대상 코드 변경이 아니다.

## 검증 방법

- 실제 소스(`idempotency.interceptor.ts` 전체 436줄, `idempotency.interceptor.spec.ts` 의 다섯 번째 `describe` 블록 1224~1467행)를 `Read` 로 직접 열어 line-level 대조
- `spec/5-system/14-external-interaction-api.md` §R8("캐시 대상은 닫힌 목록이다", "캐시 키 스코프")을 재대조 — 쓰기 경로(`isErrorStatusCacheable`=409/410 고정, `cacheTapped` 의 2xx 분기)는 이번 diff 로 미변경
- `grep 'describe(\|it(\|it.each'` 로 다섯 번째 `describe` 블록의 실제 케이스 수(선언 9 · 전개 15)를 직접 재카운트 — plan 완료 노트(`:691`)의 "15건" 서술과 일치
- 모듈 최상단 docstring(`:1-45`)의 "두 번째~다섯 번째" 순번 서술이 실제 `describe` 등장 순서와 일치함을 확인 (`01_31_17` 라운드가 지적한 문단 오삽입이 이후 커밋으로 정정된 상태가 그대로 유지)
- `grep "body: '"` 로 `hashBody()` 의 `typeof body === 'string'` 분기가 어떤 테스트에서도 행사되지 않음을 확인
- `plan/in-progress/backend-lint-gate-broken-on-main.md`·`CHANGELOG.md` 현재 상태가 선행 라운드들이 지적한 WARNING(테스트 개수 자기모순, CHANGELOG 누락 등)을 실제로 반영하고 있는지 재확인

## 발견사항

- **[INFO]** `isHttpStatusCode()` 의 유효 범위(100~599)가 [Spec EIA §R8] 의 캐시 **적재(write)** 대상 닫힌 목록(`2xx`/`409`/`410`)보다 넓다 (회색지대)
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:397-403` (`isHttpStatusCode`), 근거 spec: `spec/5-system/14-external-interaction-api.md:1059` (R8 "캐시 대상은 닫힌 목록이다")
  - 상세: R8 은 "무엇을 적재하는가"를 규율하고 그 쓰기 경로(`isErrorStatusCacheable`, `cacheTapped` 의 2xx 분기)는 이번 diff 로 변경되지 않았다. `isHttpStatusCode()` 는 "**읽은** 값을 안전하게 다시 쓸 수 있는가"(express `RangeError` 방지)라는 별개 관심사이며, 함수 JSDoc·CHANGELOG·plan 완료 노트가 이 목적을 일관되게 명시한다. spec 이 "읽기 경로 형태 방어의 범위"에 대해 애초에 침묵하므로 `[SPEC-DRIFT]` 대상도 아니다(코드가 어떤 확정 동작을 앞서가는 것이 아니라 순수 방어적 구현이다).
  - 제안: 조치 불요. 참고 기록(이전 3라운드에서도 동일 결론).

- **[INFO]** `hashBody()` 의 `typeof body === 'string'` 분기가 이번 신설 "readKey/hashBody 경계값" 블록을 포함해 스펙 파일 전체에서 한 번도 행사되지 않는다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:430-435` (`function hashBody`), 관련 신설 테스트: `idempotency.interceptor.spec.ts:1224-1467`
  - 상세: `grep "body: '"` 결과 유일한 매치는 `makeContext()` 정의 자체(`137`행, `'body' in opts ? opts.body : {}`)뿐이고, 어떤 `it`/`it.each` 도 문자열 `body` 를 넘기지 않는다 — 전 테스트가 객체 또는 `undefined`/`null` 만 쓴다. 이번 diff 의 신규 블록이 스스로를 "`readKey()`·`hashBody()` **경계값**" 이라 명명했고 body nullish 동등성·키 순서 의존은 커버하지만, `hashBody` 의 두 분기 중 문자열 body 경로는 여전히 미검증이다. 함수명·주석의 "경계값" 이라는 표방과 실제 커버리지 사이에 남은 소폭 괴리다. `body` 가 실제로 문자열이 되는 경로(비-JSON content-type 등)가 프로덕션에 있는지는 확인하지 못했다 — 위험은 낮다.
  - 제안: 급하지 않음. 다음에 이 영역을 만질 때 `it('body 가 문자열이면 원문 그대로 해시된다', …)` 1건을 추가하면 "경계값" 표방과 커버리지가 완전히 일치한다.

- **[INFO]** `statusCode` 손상 판정이 `bodyHash` 불일치 판정보다 먼저 개입하는 우선순위가 "동시 손상" 조합으로는 캐너리 테스트로 고정돼 있지 않다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` — `isIdempotencyEntry()` 호출(177행 부근)이 `cached.bodyHash !== bodyHash` 비교(189행)보다 앞서는 구조. 관련 테스트: `idempotency.interceptor.spec.ts:1385-1430`(statusCode 무효 케이스 전부 `bodyHash` 를 일치시킨 상태로만 검증)
  - 상세: 동작 자체는 합리적이다(값을 못 쓰면 애초에 재현할 방법이 없으므로 형태 손상이 우선하는 것이 타당) — spec 위반이 아니다. 다만 "형태 손상이 body 불일치보다 먼저 보고된다"는 우선순위를 명시적으로 고정하는 조합 테스트가 없다.
  - 제안: 급하지 않음. 회귀 위험 낮고 동작이 결정적이라 우선순위는 낮다.

- **[INFO]** (수렴 재확인) 선행 4라운드(`00_54_18`/`01_10_52`/`01_31_17`/`01_40_25`)가 지적한 WARNING 전부가 현재 코드·plan 상태에 실제로 반영돼 있음을 독립적으로 재대조
  - `CHANGELOG.md:1-19` — `isHttpStatusCode()` 500-방지 항목 신설, 클래스 docstring 의 fail-open 5-경로 표(`idempotency.interceptor.ts:66-74`)와 서술 일치 확인
  - `idempotency.interceptor.spec.ts:1-45` 모듈 docstring — "두 번째~다섯 번째" 순번이 실제 물리적 등장 순서와 일치(`01_31_17` 이 잡은 문단 오삽입이 정정된 상태 유지)
  - `idempotency.interceptor.ts:412-422` `readKey()` JSDoc, `:24-26` `MIN_HTTP_STATUS_CODE`/`MAX_HTTP_STATUS_CODE` 상수화 — 반영 확인
  - `plan/in-progress/backend-lint-gate-broken-on-main.md:691` — "경계 테스트 15건"(선언 9개/전개 15개, 무엇을 세는 숫자인지 명시)으로 정정, 직접 카운트로 재확인 일치
  - `idempotency.interceptor.spec.ts:1391` `99`(하한 인접 무효), `:1312-1329` 조인 문자열(`"a, b"`) 테스트 — 신설 확인, 인접 뮤턴트(하한 확대 `100→50`) 가 이제 잡힘
  - 위치: 위 각 항목. 조치 불요, 긍정 확인.

Critical/Warning 급 결함은 발견되지 않았다. TODO/FIXME/HACK/XXX 주석은 diff 전체에서 발견되지 않았다.

## 요약

이번 diff(`CHANGELOG.md` / `idempotency.interceptor.ts` / `idempotency.interceptor.spec.ts` / plan 체크리스트, `git diff origin/main...HEAD -- codebase/` 로 실측한 실질 변경은 코드 2파일 304줄뿐)를 line-level 로 독립 재검증했다. 핵심 변경 `isHttpStatusCode()`(정수+100~599 범위)는 [Spec EIA §R8] 이 요구하는 "손상 캐시 → 500 이 아니라 신규 처리" fail-open 원칙을 구체 방어로 정확히 구현하며, R8 의 캐시 대상 닫힌 목록(`isErrorStatusCacheable`)·캐시 키 스코프 로직은 이번 diff 로 변경되지 않고 그대로 유지된다. `intercept()` 의 `rawKey === null` 전환은 `readKey()` 가 이미 빈 문자열을 필터링하므로 런타임 동작을 바꾸지 않는 안전한 명시화이고, "책임 분리로 뮤테이션 관측성이 개선됐다"는 주석·plan 서술이 코드와 일치함을 확인했다. 경계값 테스트는 선언 9개·전개 15건으로 plan 문서 수치와 정확히 일치하고, 선행 4라운드 리뷰 + 2라운드 consistency-check 가 지적한 WARNING(CHANGELOG 누락, 모듈 docstring 색인 누락/오삽입, 하한 인접 경계 부재, 중복 헤더 근거 오류, plan 테스트 개수 자기모순)이 모두 최종 코드·문서에 실제로 반영돼 있음을 재대조로 확인했다. 남은 것은 세 가지 회색지대(읽기 경로 범위 검증이 R8 닫힌 목록보다 넓음, `hashBody` 의 문자열-body 분기 미검증, statusCode 손상과 bodyHash 불일치 동시 조합의 우선순위 미고정)뿐이며 전부 spec 위반이 아니고 병합을 막을 사유가 아니다.

## 위험도

NONE
