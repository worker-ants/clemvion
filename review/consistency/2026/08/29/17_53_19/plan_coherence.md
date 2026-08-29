# Plan 정합성 검토 — `spec/data-flow/` (--impl-done)

## 검토 배경

이번 turn 의 실제 코드 변경은 `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`
1개 파일뿐이다(`git diff origin/main...HEAD --stat` 확인) — `intercept()` 의 `switchMap`
콜백을 `resolveCacheHit()` 사설 메서드로 추출하고 호출부 4값(`redisKey`·`bodyHash`·
`context`·`next`)을 `CacheLookup` 인터페이스로 묶는 **순수 구조 리팩터**(동작 변경 없음,
기존 spec 63건 GREEN, 새 테스트 없음). target 번들은 `spec/data-flow/` 전체이며, 이 변경이
근거로 삼는 `spec/data-flow/15-external-interaction.md` §1.2/§2.2(캐시 스코프·손상 처리·
fail-open) 및 `plan/in-progress/**` 항목과의 정합성을 확인했다.

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** 이 diff 가 이행한 조건부 유예 항목의 plan 체크박스·근거 기록이 이미 완결돼 있음 (확인용, 조치 불요)
  - target 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`
    (`resolveCacheHit()`, `CacheLookup`)
  - 관련 plan: `plan/in-progress/backend-lint-gate-broken-on-main.md` L806-859
  - 상세: 직전 라운드(`review/consistency/2026/08/29/17_23_43/plan_coherence.md`)가 "diff
    완료 시 L806 체크박스를 `[x]` 로 닫고 커밋 SHA·라운드 식별자를 기록하라" 는 INFO 를
    남겼는데, 그 사이 커밋 `49b9f92b5`(리팩터)와 `6cb32c862`(`17_32_16` 리뷰 산출물 +
    INFO 3건 plan 이관)가 정확히 그 조치를 이행했다. 현재 L806 은 `[x]` 이고, 그 아래에
    ①착수 직전 `origin/main`(`98af82eeb`) 기준 재실측(`resolveCacheHit` grep 0건 확인)
    ②뮤테이션 실측표(예측 vs 실측 — `CacheLookup` 필드 swap 13건 RED, 분기 4·6 각 4/2건
    RED) ③커밋 SHA·게이트 결과(`--impl-prep spec/5-system/` BLOCK:NO, `/ai-review`
    Critical 0·Warning 0) ④조건부 후속 3건(두 번째 호출부 생성 시·`cacheTapped`/
    `storeEntry` 를 다음에 만질 때·8번째 분기 발생 시)이 모두 기록돼 있다. **새로 지적할
    미이행이 없다** — 직전 라운드의 처방이 그대로 집행된 상태를 재확인한 것뿐이다.
  - 제안: 없음 (조치 완료 확인).

## 교차 확인 (충돌 없음 확인용, 문제 아님)

- `plan/in-progress/backend-lint-gate-broken-on-main.md` 의 잔여 미해결 항목 7건(L377
  LIKE 메타문자 공유 상수·L548 idempotency fail-open 구간 관측 확장·L792 SoT 이관 앵커
  grep 절차화·L801 `4-cafe24.md §4.4` 위치·L1229/1233 raw-query 감사·L1237
  `updateExecutionStatus` else 분기 트랜잭션화) 는 전부 이번 diff 의 코드 경로
  (`IdempotencyInterceptor.resolveCacheHit`)와 겹치지 않는다 — 이번 리팩터가 그 항목들의
  전제·범위를 바꾸지 않는다.
- `resolveCacheHit()` 자신이 예고한 조건부 트리거 3건(두 번째 호출부·`cacheTapped`/
  `storeEntry` 접촉·8번째 분기) 중 이번 diff 에서 새로 발동한 것은 없다 — 호출부는
  여전히 `intercept()` 의 `switchMap` 한 곳, 분기는 7개 그대로, `cacheTapped`/
  `storeEntry` 는 손대지 않았다.
- `spec/data-flow/15-external-interaction.md`·`spec/5-system/14-external-interaction-api.md`
  는 캐시 스코프·손상 처리·fail-open 을 **동작 수준**(2xx/409/410 캐시, 손상 시 fail-open,
  `executionId`+`route` 스코프)으로만 서술하고 `switchMap`·`resolveCacheHit`·`CacheLookup`
  같은 구현 세부는 어디도 인용하지 않는다 — 이번 구조 리팩터로 stale 해질 앵커가 없다.
- `eia-context-schema-followups.md` · `eia-terminal-payload.md` ·
  `spec-draft-eia-62-waiting-payload.md` · `spec-draft-eia-notification-payload-contract.md` ·
  `spec-sync-external-interaction-api-gaps.md` — `resolveCacheHit`/`CacheLookup`/
  `idempotency.interceptor.ts` 관련 미해결 결정 없음(grep 0건 또는 무관한 표면).
- 이번 diff 는 `spec/**` 를 건드리지 않는다(`spec_impact: none`, diff --stat 확인) —
  target 번들이 이번 turn 에서 새로 결정을 내리는 것도 없다.

## 요약

이번 turn 의 코드 변경(`resolveCacheHit()` 추출)은 `plan/in-progress/backend-lint-gate-broken-on-main.md`
가 조건부로 유예해 둔 항목을 트리거 성립 시점에 이행한 것이며, 직전 라운드가 지적한
"완료 후 plan 체크박스·근거 기록" 절차까지 이미 커밋 `49b9f92b5`/`6cb32c862` 로 완결돼
있다. spec 변경이 없고, 다른 EIA 계열 plan 과 겹치는 미해결 결정도 없으며, 이 리팩터가
예고한 조건부 후속 3건 중 발동한 것도 없다. 새로 취할 조치 없음.

## 위험도

NONE
