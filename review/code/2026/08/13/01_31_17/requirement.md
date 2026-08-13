# 요구사항(Requirement) 리뷰 — idempotency.interceptor `isHttpStatusCode` + 경계값 테스트 (최종 라운드)

## 대상

- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` — `intercept()` 의 `rawKey` null 판정 `!rawKey` → `rawKey === null` 명시 비교, `isIdempotencyEntry()` 의 `statusCode` 검사를 `typeof === 'number'` → 신설 `isHttpStatusCode()`(정수 + 100~599 범위)로 강화
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` — `readKey`/`hashBody` 경계값 `describe` 블록(선언 9 / `it.each` 전개 후 실행 15) 신설
- `CHANGELOG.md` — `statusCode` 범위 검사 관련 Unreleased 항목 신설
- `plan/in-progress/backend-lint-gate-broken-on-main.md` — 해당 체크박스 완료 표시 + 근거
- 나머지 파일(`review/code/2026/08/13/{00_54_18,01_10_52}/**`, `review/consistency/2026/08/13/01_10_53/**`, `review/code/2026/08/12/23_48_38/SUMMARY.md`)은 이전 라운드의 정규 리뷰 산출물 아카이빙으로, 기능 요구사항 검토 대상이 아니다.

## 검증 방법

코드 정독 외에 직접 실행/대조했다:
- `npx jest idempotency.interceptor.spec.ts` → **56/56 pass** (재실측, plan/이전 라운드 수치와 일치)
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` 전체를 `Read` 로 직접 열어 `isHttpStatusCode`/`readKey`/`isIdempotencyEntry`/`intercept()` 로직을 line-level 로 대조
- `idempotency.interceptor.spec.ts` 의 "readKey / hashBody 경계값" `describe` 블록(라인 1224~1467)을 전수 대조 — `it`/`it.each` 선언 9개, 케이스 전개 15개(1+2+1+1+1+1+1+5+2=15)로 plan 의 "선언 9개·실행 15건" 서술과 일치
- `spec/5-system/14-external-interaction-api.md` §R8("캐시 대상은 닫힌 목록이다", "캐시 키 스코프")과 대조 — 쓰기 경로(`isErrorStatusCacheable`, `cacheTapped`)는 이번 diff로 변경되지 않음을 확인
- `interaction.controller.ts`(`@HttpCode(ACCEPTED/OK)`) · `interaction.service.ts`(`GoneException`(410) · `ConflictException`(409))를 grep 대조 — CHANGELOG 의 "이 API 는 100~599 밖 statusCode 를 만들지 않는다" 주장 확인
- 모듈 최상단 docstring의 "다섯 번째 describe" 색인, `readKey()` JSDoc 신설을 확인(직전 라운드 WARNING #4/INFO #9 반영 확인)
- `plan/in-progress/backend-lint-gate-broken-on-main.md` L665 "✅ 착수 가능" 문구가 직전 consistency round(`01_10_53`) plan_coherence WARNING에 대한 조치임을 확인

## 발견사항

- **[INFO]** `isHttpStatusCode()` 의 유효 범위(100~599)와 `bodyHash` 판정 순서의 상호작용이 테스트로 커버되지 않는다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` (`intercept()` 내 `if (!isIdempotencyEntry(parsed))` 분기, `isHttpStatusCode` 정의부 397-402), 테스트: `idempotency.interceptor.spec.ts:1385-1430`(statusCode 무효 케이스, 전부 `bodyHash` 일치 조건에서만 검증)
  - 상세: `statusCode` 유효성 검사는 `isIdempotencyEntry()` 안에서 수행되며, 이는 `cached.bodyHash !== bodyHash` 비교(라인 189)보다 **앞**이다. 즉 손상된 `statusCode` 를 가진 엔트리는 요청 body 와 `bodyHash` 가 일치하는지 여부와 무관하게 항상 "손상"으로 처리돼 `processFresh()` 로 강등된다. 이 동작 자체는 합리적(어차피 `statusCode` 가 못 쓰는 값이면 재현할 방법이 없다)이고 spec 위반도 아니지만, 현재 테스트 9종 statusCode 무효 케이스가 전부 `bodyHash` 를 일치시킨 상태로만 검증돼 있어 "`bodyHash` 불일치 + `statusCode` 손상이 동시에 발생하면 어느 쪽이 먼저 보고되는가"라는 우선순위가 테스트로 고정돼 있지 않다. `bodyHash` 판정 순서를 고정하는 회귀 테스트(라인 697, 730 — "안쪽이 깨졌어도 body 가 다르면 여전히 409")는 `responseJson`/엔트리 문법 손상만 다루고 `statusCode` 범위 손상은 다루지 않는다.
  - 제안: 급하지 않음(동작이 결정적이고 문서화돼 있어 회귀 위험 낮음). 추후 이 영역을 다시 만질 때 "`statusCode` 손상 + `bodyHash` 불일치" 조합 케이스 하나를 추가해 `discardCorruptEntry`가 `bodyHash` 판정보다 먼저 개입한다는 사실을 명시적으로 캐너리로 고정하면 좋다.

- **[INFO]** (spec fidelity, 회색지대) `isHttpStatusCode()` 의 유효 범위(100~599)가 [Spec EIA §R8] 이 규정한 캐시 대상 닫힌 목록(`2xx`/`409`/`410`)보다 넓다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:397-402`(`isHttpStatusCode`), 근거 spec: `spec/5-system/14-external-interaction-api.md:1059`(R8 "캐시 대상은 닫힌 목록이다")
  - 상세: R8 은 **무엇을 적재(write)하는가**를 규율하고, 그 쓰기 경로(`isErrorStatusCacheable()`=409/410, `cacheTapped()`의 2xx 분기)는 이번 diff 로 변경되지 않아 R8 위반은 아니다. `isHttpStatusCode()` 는 **읽은 값을 안전하게 쓸 수 있는가**(express `RangeError` 방지)라는 별개 관심사이며, 함수 자체 JSDoc·CHANGELOG·plan 완료 노트가 모두 이 목적을 일관되게 명시하고 있어 의도적 설계로 판단된다. 다만 이 값이 통과시키는 범위 안에 R8의 닫힌 목록 밖의 코드(예 `404`)가 이론상 섞여 있어도 "손상"으로 잡히지 않고 (정상 운영에선 발생하지 않지만) 성공 채널로 재생될 여지가 남는다는 점은 참고용으로 기록한다.
  - 판정: 코드가 틀린 것도 아니고 spec 이 낡은 것도 아니다 — spec 이 "읽기 경로의 형태 방어 범위"에 대해 애초에 침묵하는 영역이라 회색지대(INFO)다. `[SPEC-DRIFT]` 대상 아님(spec 에 반영해야 할 새 확정 동작이 아니라 순수 구현 방어이기 때문).

- **[INFO]** (문서 관행, 조치 완료 확인) 직전 두 라운드(`00_54_18`, `01_10_52`)의 documentation/testing WARNING 4건이 모두 코드에 실제로 반영됐음을 재확인
  - `CHANGELOG.md:3-18` — `isHttpStatusCode()` 항목 신설 확인(직전 documentation WARNING #3 대응)
  - `idempotency.interceptor.spec.ts:22` 모듈 docstring "다섯 번째 describe" 색인 추가 확인(직전 documentation WARNING #4 대응)
  - `idempotency.interceptor.ts:412-422` `readKey()` JSDoc 신설 확인(직전 INFO #9 대응)
  - `idempotency.interceptor.spec.ts:1391` `statusCode` 무효 케이스에 `99`(하한 인접) 추가 확인, `idempotency.interceptor.spec.ts:1312-1329` 중복 헤더 조인 문자열(`"a, b"`) 테스트 신설 확인(직전 testing WARNING #1·#2 대응) — 인접 뮤턴트(하한 확대 `100→50`)가 이제 `99` 무효 케이스로 잡힘을 코드 대조로 확인
  - 위치: 위 각 항목
  - 상세: 조치가 필요치 않은 긍정 확인이며 별도 제안 없음.

Critical/Warning 급 결함은 발견되지 않았다.

## 요약

이번 diff(3개 실질 파일: `idempotency.interceptor.ts`/`.spec.ts`/`CHANGELOG.md` + plan 문서 갱신)는 [Spec EIA §R8] 이 요구하는 "손상 캐시 → 500 이 아니라 신규 처리" fail-open 원칙을 `isHttpStatusCode()`(정수 + 100~599 범위)로 구체 방어하며, R8 의 캐시 대상 닫힌 목록(`isErrorStatusCacheable`)·캐시 키 스코프 로직은 변경 없이 그대로 유지한다. `intercept()` 의 `rawKey === null` 전환은 `readKey()` 가 이미 빈 문자열을 필터링하므로 런타임 동작을 바꾸지 않는 안전한 명시화이며, JSDoc·주석의 "책임 분리로 뮤테이션 관측성이 개선됐다" 주장은 코드와 일치한다. 경계값 테스트는 선언 9개·`it.each` 전개 후 실행 15건으로 plan 문서의 수치 서술과 정확히 일치하고(`jest idempotency.interceptor.spec.ts` 재실측 56/56 pass), 이전 두 라운드에서 지적된 documentation/testing WARNING 4건(CHANGELOG 누락, 모듈 docstring 색인 누락, 하한 인접 경계 부재, 중복 헤더 근거 오류)이 모두 코드·문서에 실제로 반영됐음을 직접 대조로 확인했다. 유일하게 짚을 점은 `statusCode` 유효성 검사가 `bodyHash` 비교보다 먼저 개입하는 우선순위가 테스트로 명시 고정돼 있지 않다는 것(동작 자체는 합리적, 회귀 위험 낮음)과, read-path 범위 검증이 R8 닫힌 목록보다 넓다는 것(spec 이 침묵하는 회색지대, 의도적 설계로 판단)인데 둘 다 INFO 수준이며 병합을 막을 사유가 아니다.

## 위험도

NONE
