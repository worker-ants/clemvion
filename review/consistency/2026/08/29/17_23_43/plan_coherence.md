# Plan 정합성 검토 — `spec/5-system/` (--impl-prep)

## 검토 배경

이번 turn 의 실제 코드 변경은 `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`
1개 파일 — `intercept()` 의 `switchMap` 콜백을 `resolveCacheHit()` 사설 메서드로 추출하는
순수 구조 리팩터(동작 변경 없음, `spec_impact` 대상 아님). target 번들은 `spec/5-system/`
전체이므로 이 변경이 근거로 삼는 `spec/5-system/14-external-interaction-api.md` §R8
(Idempotency-Key, EIA-IN-11) 및 관련 `plan/in-progress/**` 항목과의 정합성을 확인했다.

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** `resolveCacheHit()` 추출은 이미 존재하던 plan 항목을 그대로 이행한 것 — plan 갱신(체크 완료) 잊지 말 것
  - target 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` (`resolveCacheHit()` 신설, `CacheLookup` 인터페이스)
  - 관련 plan: `plan/in-progress/backend-lint-gate-broken-on-main.md` L806-809 — `- [ ] intercept() 의 switchMap 콜백을 resolveCacheHit() 로 추출`
  - 상세: 이 항목은 `23_24_08`·`23_36_13` 두 라운드에서 "6번째 분기가 추가되면 재검토" 로
    조건부 유예됐고, `00_20_20` maintainability INFO 4 가 분기 7개(캐시 미스·엔트리 문법 손상·
    엔트리 형태 불일치·bodyHash 불일치·payload 손상·에러 재현·성공 재현)를 확인하며 트리거가
    발동, "다음에 이 콜백을 만질 때 착수한다" 로 명시적으로 예고돼 있었다. 이번 diff 는 그
    트리거를 그대로 이행한다 — 새 `resolveCacheHit()` 의 JSDoc 표(7갈래)가 plan 이 센 7분기와
    정확히 일치하고, `CacheLookup` 타입도 그 자리에서 요구된 것 이상을 하지 않는다(behavior
    변경 없음, spec 결정 새로 내리지 않음). **미해결 결정 우회나 선행 plan 미해소는 없다** —
    오히려 선행 plan 이 승인해 둔 작업을 정확히 수행 중이다.
  - 제안: 이번 turn 이 완료되면 `plan/in-progress/backend-lint-gate-broken-on-main.md` L806
    체크박스를 `[x]` 로 닫고 완료 사유(이 diff 커밋 SHA·라운드 식별자)를 그 항목 아래에
    기록할 것. 새 plan 파일을 만들거나 다른 위치에 중복 기록하지 말 것 — 이 백로그 plan 이
    해당 항목의 SoT 다.

## 교차 확인 (충돌 없음 확인용, 문제 아님)

- `plan/in-progress/backend-lint-gate-broken-on-main.md` L548 "idempotency fail-open 구간의
  관측·중복 억제" (미해결, `[ ]`) 는 다른 Redis fail-open 소비자 배선·GET→SET 비원자성
  검토 항목 — 이번 순수 구조 리팩터와 겹치는 코드 경로가 없어 무관.
- `spec-sync-external-interaction-api-gaps.md` L1481 "두 Manual 엔드포인트의 error.code
  drift" 는 2026-08-22 사용자 결정으로 이미 해소(`INVALID_TRIGGER_PARAMETERS` 로 통일) —
  이번 변경과 무관한 별개 표면.
- `eia-context-schema-followups.md` · `eia-terminal-payload.md` ·
  `spec-draft-eia-62-waiting-payload.md` · `spec-draft-eia-notification-payload-contract.md` —
  idempotency/`resolveCacheHit`/`cacheTapped` 언급 없음. 이번 변경과 교차하는 미해결 결정 없음.
- 현재 diff 는 `spec/**` 를 건드리지 않으므로 target 번들(`spec/5-system/`)이 이번 turn 에서
  새로 결정을 내리는 것도 없다 — "미해결 결정과의 충돌" 관점에서 위험 표면 자체가 없다.

## 요약

이번 turn 의 코드 변경(`resolveCacheHit()` 추출)은 `plan/in-progress/backend-lint-gate-broken-on-main.md`
가 두 라운드에 걸쳐 조건부로 유예해 둔 항목을 그 조건(7번째 분기 발생) 성립 시점에 정확히
이행한 것이다. spec 변경이 없고, 다른 EIA 계열 plan(§context-schema·§terminal-payload·
§62-waiting-payload·§notification-payload-contract)과 겹치는 미해결 결정도 없다. 유일한
후속 조치는 완료 시 해당 plan 체크박스를 닫는 사무적 절차뿐이다.

## 위험도

NONE
