# Rationale 연속성 검토 — EIA idempotency `resolveCacheHit` 추출

## 대상

- 검토 모드: `--impl-done`, scope=`spec/data-flow/`, diff-base=`origin/main`
- 변경 코드: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` 단일 파일
  (커밋 `49b9f92b5` — `intercept()` 의 `switchMap` 콜백을 `resolveCacheHit()` private 메서드로 추출,
  개별 인자 4개를 `CacheLookup` 객체로 묶음)
- 관련 spec Rationale: `spec/data-flow/15-external-interaction.md` `## Rationale`
  ("단일 sink (R10)", "Fail-open 정책의 일관 표기"), `spec/5-system/14-external-interaction-api.md`
  `### R8. Idempotency-Key 와 submit_form 검증 실패의 관계`

## 발견사항

- **[INFO]** `spec/5-system/14-external-interaction-api.md` §R8 Rationale 의 "선재 갭" 서술이
  구현 완료 후에도 갱신되지 않음 (오늘 diff 와는 무관 — 사전 존재하는 drift)
  - target 위치: 이번 diff 자체에는 없음. 참고용으로만 열람한
    `spec/5-system/14-external-interaction-api.md:1264` (§R8 Rationale, "fail-open 의 원인은
    두 축이다" 문단)
  - 과거 결정 출처: 같은 문단 — "`statusCode` 는 현재 **타입만** 검사한다(`typeof === 'number'`)
    — 값 범위는 아직 보지 않는 **선재 갭**이다 … 범위 검사는 `readKey`/`hashBody` 경계값 항목과
    함께 닫는다." (2026-08-13 11:51, planner 턴 `eia-failopen-wording`, 커밋 `1e9f3f238`)
  - 상세: 그 문장이 쓰인 시점 기준으로는 정확했으나, 같은 날 이미 별도 PR(`#1159`, 커밋
    `4b1f899b7`, plan 항목 `eia-idem-key-boundary` 로 `[x]` 완료 처리됨)이 `isHttpStatusCode()`
    범위 검사(100~599 정수)를 `idempotency.interceptor.ts` 에 실제로 추가해 이 갭을 닫았다.
    현재 HEAD 코드(`idempotency.interceptor.ts:461-477`)에는 이 검사가 들어 있는데, §R8
    Rationale 문장은 여전히 "아직 보지 않는다 / 닫는다(미래형)" 로 남아 있어 **구현 완료 사실을
    반영하지 못한 stale 서술**이다. 병렬 세션이 같은 날 두 방향(코드 완료 vs 문서 서술)으로 각자
    진행되며 갈린 것으로 보인다.
  - 판정 근거: 오늘 검토 대상인 `49b9f92b5`(resolveCacheHit 추출) 는 이 gap 과 무관 — 순수 구조
    리팩터로 `isHttpStatusCode` 로직 자체는 건드리지 않았다. 따라서 이번 diff 가 만든 문제가
    아니며, target scope(`spec/data-flow/`) 밖의 문서(`5-system/14`)라 이번 리뷰의 1차 대상도
    아니다. 다만 §R8 은 target 문서(`data-flow/15-external-interaction.md`)가 반복 인용하는
    핵심 SoT 라 정합 보완 차원에서 기록한다.
  - 제안: 다음에 이 §R8 절을 여는 planner 턴에서 "값 범위는 아직 보지 않는 선재 갭" 문장을
    "값 범위도 `isHttpStatusCode()` 로 검증한다(100~599 정수, `#1159`)" 로 갱신하고 "범위 검사는
    …항목과 함께 닫는다" 의 미래형을 완료형으로 정정. 이번 PR 의 승인 차단 사유는 아니다.

## 점검 관점별 결론

1. **기각된 대안의 재도입** — 없음. `CacheLookup` 파라미터 객체 도입은 과거 어떤 Rationale 에서도
   명시적으로 기각된 적이 없는 새 구조이며, 오히려 스스로 "타입이 막아준다는 근거를 쓰지 말라"는
   실측(파라미터 순서 교환 뮤턴트 → spec 13건 사망)을 docstring 에 못박아 두어 memory 의
   "손으로 짠 primitive + 확신 주석" 함정을 선제적으로 피했다.
2. **합의된 원칙 위반** — 없음. §R8 의 세 핵심 계약(닫힌 캐시 목록 `2xx/409/410` 열거·
   `<executionId>:<route>:<key>` 스코프·전역 키 fallback 금지)과 판정 순서(bodyHash 판정을
   payload 파싱보다 먼저 두는 것 — "손상 엔트리에서 409 가 조용히 사라지는" 것을 막기 위한 순서)가
   추출 전후로 **완전히 동일**하게 보존됨을 diff 로 직접 대조 확인. `resolveCacheHit` 이
   `switchMap` project 함수 안에서 호출돼야 하는 이유(4·6 번 분기의 `throw` 가 RxJS error 채널로
   변환되려면 그 자리여야 함)도 새 docstring 이 명시적으로 설명한다.
3. **결정의 무근거 번복** — 없음. 이는 결정의 번복이 아니라, `23_24_08`·`23_36_13`(2026-08-12) 두
   코드 리뷰 라운드가 "6번째 분기가 추가되면 메서드 추출을 재고하라"고 남긴 **조건부 유예**가
   `00_20_20`(2026-08-13) 라운드에서 실제로 7번째 분기(엔트리 형태 불일치)가 추가되며 발동한 것을
   집행한 것. `git log`(`review/code/2026/08/12/23_36_13/maintainability.md`,
   `review/code/2026/08/13/00_20_20/maintainability.md`) 로 이 이력이 실재함을 확인했고,
   plan 항목(`plan/in-progress/backend-lint-gate-broken-on-main.md:806`)도 `[x]` 로 갱신되어
   실제 상태와 일치한다. 새 Rationale 이 필요한 "결정 변경"이 아니라 이미 기록된 조건이 충족된
   경우라 이 항목은 해당 없음.
4. **암묵적 가정 충돌** — 없음. Redis fail-open 5경로 구분, `409`/`410` 예외 채널 재현, 캐시 키
   스코프(execution+route) 등 `spec/data-flow/15-external-interaction.md` `## Rationale` 이
   기록한 invariant 를 우회하는 지점이 diff 안에 없다. commit message 도 "동작 변경 없음 — 기존
   spec 63건 전부 GREEN" 으로 명시.

## 요약

이번 diff(`49b9f92b5`, `IdempotencyInterceptor.resolveCacheHit()` 추출)는 순수 구조 리팩터로,
`spec/data-flow/15-external-interaction.md` 및 `spec/5-system/14-external-interaction-api.md`
§R8 이 기록한 핵심 계약(닫힌 캐시 목록·캐시 키 스코프·판정 순서·fail-open 5경로·RxJS 채널 제약)을
모두 그대로 보존하며, 스스로도 과거 코드 리뷰 라운드가 명시적으로 남긴 "6번째 분기 시 재검토"
유예 조건이 충족되어 집행된 것임을 실제 이력(review 세션·plan 체크박스)으로 뒷받침한다. Rationale
연속성 관점에서 위반·번복·기각 대안 재도입 없음. 유일한 관찰은 target scope 밖의 참조 문서
(`5-system/14-external-interaction-api.md` §R8)에 남은, 이번 diff 와 무관한 사전 존재 stale
서술(`statusCode` 범위 검사가 "선재 갭"이라는 표현이 이미 닫힌 뒤에도 갱신 안 됨) 하나뿐이며 이는
INFO 로 기록해 다음 §R8 편집 턴에서 함께 정리할 것을 제안한다.

## 위험도

NONE
