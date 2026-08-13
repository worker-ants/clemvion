# 요구사항(Requirement) 리뷰 — idempotency.interceptor `isHttpStatusCode` + 경계값 테스트 (수렴 확인 라운드)

## 대상 (diff base `59d2a7840`..`HEAD`)

- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` — `intercept()` 의 `rawKey` null 판정을 `!rawKey` → `rawKey === null` 명시 비교로 전환, `isIdempotencyEntry()` 의 `statusCode` 검사를 `typeof === 'number'` → 신설 `isHttpStatusCode()`(정수 + `MIN_HTTP_STATUS_CODE=100`~`MAX_HTTP_STATUS_CODE=599`)로 강화
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` — `readKey`/`hashBody` 경계값 `describe` 블록 신설(선언 9개, `it`/`it.each` 전개 후 실행 15건) + `makeContext()` 의 `body` mock 정규화를 `opts.body ?? {}` → `'body' in opts ? opts.body : {}` 로 수정 + 모듈 최상단 docstring 색인 갱신
- `CHANGELOG.md` — `isHttpStatusCode()` 방어에 대응하는 Unreleased 항목 신설
- `plan/in-progress/backend-lint-gate-broken-on-main.md` — 해당 체크박스 완료 표시 + 완료 근거·정정 서술 + 선행 consistency WARNING 해소 문구 추가
- 나머지 파일(`review/code/2026/08/13/{00_54_18,01_10_52,01_31_17}/**`, `review/consistency/2026/08/13/01_10_53/**`, `review/code/2026/08/12/23_48_38/SUMMARY.md`)은 이전 세 라운드(reviewer 7명 × 3회)의 정규 리뷰 산출물 아카이빙이며, 기능 요구사항 검토 대상 코드 변경이 아니다.

## 검증 방법

- `npx jest idempotency.interceptor.spec.ts` 직접 재실행 → **56/56 pass** (재실측, 이전 라운드 수치와 일치)
- `idempotency.interceptor.ts` 전체(435줄)를 `Read` 로 열어 `isHttpStatusCode`/`readKey`/`isIdempotencyEntry`/`intercept()` 로직을 line-level 로 대조
- `idempotency.interceptor.spec.ts` 의 "readKey / hashBody 경계값" `describe` 블록(1224~1467행)을 전수 대조, `grep '^describe('` 로 5개 블록의 **실제 파일 내 등장 순서**가 모듈 docstring 의 "두 번째~다섯 번째" 순번 서술과 일치함을 확인(`01_31_17` 라운드가 지적한 문단 오삽입이 `2a1abb4c1` 로 수정된 결과 확인)
- `it`/`it.each` 선언 9개(`it(` 6개 + `it.each(` 3개), 케이스 전개 6+2+5+2=15로 plan/이전 라운드 서술("선언 9·실행 15")과 정확히 일치함을 직접 카운트로 재확인
- `spec/5-system/14-external-interaction-api.md` §R8("캐시 대상은 닫힌 목록이다", "캐시 키 스코프")을 재대조 — 쓰기 경로(`isErrorStatusCacheable`=409/410 고정, `cacheTapped` 의 2xx 분기)는 이번 diff 로 미변경, R8 이 규정하는 필드·상태 전이·에러 코드 어느 것도 이번 diff 로 건드리지 않음을 확인
- `plan/in-progress/backend-lint-gate-broken-on-main.md` L664-668 의 "✅ 착수 가능" 문구가 `review/consistency/2026/08/13/01_10_53/SUMMARY.md` WARNING #1(plan_coherence, 선행 조건 충족 미반영)에 대한 실제 조치임을 대조 확인 — consistency 라운드가 지적한 갭이 이번 diff 로 닫혔다

## 발견사항

- **[INFO]** `isHttpStatusCode()` 의 유효 범위(100~599)가 [Spec EIA §R8] 의 캐시 대상 닫힌 목록(`2xx`/`409`/`410`)보다 넓다 (회색지대, 이전 라운드부터 반복 확인)
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:397-402`(`isHttpStatusCode`), 근거 spec: `spec/5-system/14-external-interaction-api.md:1059`(R8 "캐시 대상은 닫힌 목록이다")
  - 상세: R8 은 **무엇을 적재(write)하는가**를 규율하고 그 쓰기 경로는 이번 diff 로 미변경이라 R8 위반이 아니다. `isHttpStatusCode()` 는 **읽은 값을 안전하게 다시 쓸 수 있는가**(express `RangeError` 방지)라는 별개 관심사이고, 함수 JSDoc·CHANGELOG·plan 완료 노트가 이 목적을 일관되게 명시해 의도적 설계로 판단된다. spec 이 "읽기 경로 형태 방어의 범위"에 대해 애초에 침묵하는 영역이라 `[SPEC-DRIFT]` 대상도 아니다(반영해야 할 새 확정 동작이 아니라 순수 구현 방어).
  - 제안: 조치 불요. 참고 기록.

- **[INFO]** `statusCode` 유효성 검사(`isHttpStatusCode`)가 `bodyHash` 일치 판정보다 먼저 개입하는 우선순위가 "`bodyHash` 불일치 + `statusCode` 손상 동시 발생" 조합으로는 테스트에 명시 고정돼 있지 않다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` — `isIdempotencyEntry()` 호출(177행 부근) 이 `cached.bodyHash !== bodyHash` 비교(189행)보다 앞선 구조. 테스트: `idempotency.interceptor.spec.ts:1385-1430`(statusCode 무효 케이스, 전부 `bodyHash` 를 일치시킨 상태로만 검증)
  - 상세: 동작 자체는 합리적(값을 못 쓰면 애초에 재현할 방법이 없으므로 형태 손상이 우선하는 것이 타당)이고 spec 위반도 아니다. 다만 "형태 손상이 body 불일치보다 먼저 보고된다"는 우선순위를 캐너리로 고정한 테스트는 없다.
  - 제안: 급하지 않음(회귀 위험 낮고 동작이 결정적). 이 영역을 다음에 만질 때 조합 케이스 하나를 추가하면 좋다.

- **[INFO]** (수렴 확인) 이전 세 라운드(`00_54_18`/`01_10_52`/`01_31_17`)가 지적한 WARNING 6건 전부가 최종 코드에 실제로 반영돼 있음을 직접 재확인
  - `CHANGELOG.md:3-18` — `isHttpStatusCode()` 항목 신설 확인
  - `idempotency.interceptor.spec.ts:41-45` 모듈 docstring "다섯 번째 describe" 색인이 **올바른 위치**(네 번째 뒤)에 있음을 확인 — `01_31_17` 라운드가 잡은 문단 오삽입(다섯 번째 설명이 두 번째 설명 한가운데 끼어 있던 것)이 `2a1abb4c1` 로 정정됨
  - `idempotency.interceptor.ts:412-422` `readKey()` JSDoc 신설 확인
  - `idempotency.interceptor.spec.ts:1391` `statusCode` 무효 케이스에 `99`(하한 인접) 추가, `:1312-1329` 중복 헤더 조인 문자열(`"a, b"`) 테스트 신설 확인 — 인접 뮤턴트(하한 확대 `100→50`)가 이제 `99` 무효 케이스로 잡힘
  - `plan/in-progress/backend-lint-gate-broken-on-main.md:687-689` — "13건" → "15건"(무엇을 세는 숫자인지 명시)으로 정정, 선언 9개 vs 실행 15건 카운트를 실측 재확인(직접 카운트 6+3=9 선언, 6+9=15 전개)
  - `plan/in-progress/backend-lint-gate-broken-on-main.md:664-668` — consistency `01_10_53` WARNING #1(spec §4 fail-open 서술 갱신 트리거 충족 미반영)에 대한 조치 확인
  - 위치: 위 각 항목. 조치 불요, 긍정 확인.

Critical/Warning 급 결함은 발견되지 않았다.

## 요약

이번 라운드는 `idempotency.interceptor.ts`/`.spec.ts`/`CHANGELOG.md`/plan 문서로 구성된 diff(diff base `59d2a7840`)를 독립적으로 재검증했다. `isHttpStatusCode()`(정수+100~599 범위)는 [Spec EIA §R8] 이 요구하는 "손상 캐시 → 500 이 아니라 신규 처리" fail-open 원칙을 구체 방어로 정확히 구현하며, R8 의 캐시 대상 닫힌 목록(`isErrorStatusCacheable`)·캐시 키 스코프 로직은 이번 diff 로 변경되지 않고 그대로 유지된다. `intercept()` 의 `rawKey === null` 전환은 `readKey()` 가 이미 빈 문자열을 필터링하므로 런타임 동작을 바꾸지 않는 안전한 명시화이고, "책임 분리로 뮤테이션 관측성이 개선됐다"는 주석·plan 서술은 코드와 일치한다. 경계값 테스트는 선언 9개·`it.each` 전개 후 실행 15건으로 plan 문서 수치와 정확히 일치함을 직접 카운트로 재확인했고(`jest idempotency.interceptor.spec.ts` 재실측 56/56 pass), 이전 세 라운드에서 지적된 WARNING 6건(CHANGELOG 누락, 모듈 docstring 색인 누락/오삽입, 하한 인접 경계 부재, 중복 헤더 근거 오류, plan 테스트 개수 자기모순, consistency plan_coherence 갱신 누락)이 모두 최종 코드·문서에 실제로 반영됐음을 재대조로 확인했다. 남은 것은 이전 라운드부터 일관되게 INFO 로 분류된 두 가지 회색지대(읽기 경로 범위 검증이 R8 닫힌 목록보다 넓음, statusCode 손상과 bodyHash 불일치 동시 조합의 우선순위 미고정)뿐이며 둘 다 spec 위반이 아니고 병합을 막을 사유가 아니다. TODO/FIXME/HACK/XXX 주석은 diff 전체에서 발견되지 않았다.

## 위험도

NONE
