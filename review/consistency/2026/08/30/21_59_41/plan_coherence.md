# Plan 정합성 검토 — spec/data-flow/ (impl-done)

## 범위 요약

`origin/main...HEAD` 의 `code_areas` diff 중 `spec/data-flow/` scope 에 걸리는 변경은
**`codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 의
`updateExecutionStatus` JSDoc 주석 갱신 1건**뿐이다(다른 파일은 harness workflow
스크립트·테스트·plan·review 산출물이며 spec/data-flow scope 밖). `spec/data-flow/**`
자체는 이 브랜치에서 전혀 수정되지 않았다(`git diff origin/main...HEAD --stat -- spec/`
결과 0건).

JSDoc 변경 내용: 호출부 수(11 → 20)와 대조 축("어휘적 범위" → "호출 스택 포함,
`.transaction(` 블록 36개 전수")를 정정하고, "새 호출부·새 `.transaction(` 블록 추가 시
재대조 필요"를 명시. 세는 방법의 함정(제네릭 누락 시 35, 주석 포함 시 39)도 병기.

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** JSDoc 수치 정정이 plan 과 정확히 미러링됨
  - target 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
    `updateExecutionStatus` 상단 JSDoc (diff `@@ -8568,17 +8568,19 @@`)
  - 관련 plan: `plan/in-progress/backend-lint-gate-broken-on-main.md` L289-306
    (`updateExecutionStatus self-deadlock 확인의 호출 스택 축` 항목, `[x]` 완료)
  - 상세: JSDoc 이 옮겨 적은 "11→20→36, 어휘적→호출 스택" 3판 정정 이력이 plan 의 표
    (`17_36_15`/`18_10_28`/`20_21_06`/`20_46_48`)와 숫자·서사 모두 1:1 일치한다. 같은
    브랜치의 `plan/in-progress/update-returning-tuple-shape.md` L240-247 에도 교차
    포인터가 추가돼 두 plan 이 동일 SoT(`backend-lint-gate-broken-on-main.md`)를 가리키게
    유지된다. 이 항목이 근거로 삼는 기능 변경("else 분기 트랜잭션화")의 spec 반영도
    이미 `spec/5-system/4-execution-engine.md` §1.1/Rationale 과
    `spec/data-flow/3-execution.md` §2.1 매핑 표(196번째 행, "2026-08-30" 각주)에
    선행 커밋으로 반영돼 있어 target 문서와도 어긋나지 않는다.
  - 제안: 조치 불요. 추적 메모로만 남긴다 — 향후 `updateExecutionStatus` 호출부나
    `.transaction(` 블록이 늘어나면 JSDoc 이 스스로 요구하는 재대조를 하고, 그 결과도
    같은 plan 표에 이어 적을 것.

## 요약

이번 diff 는 `spec/data-flow/` 범위에서 실질적으로 코드 주석 1건(`updateExecutionStatus`
self-deadlock 정적 대조 수치 정정)만 건드리며, 그 서술은 `backend-lint-gate-broken-on-main.md`
가 이미 3판에 걸쳐 추적해 온 항목의 완료 상태·수치와 완전히 일치한다. 자매 plan
(`update-returning-tuple-shape.md`)에도 교차 참조가 갱신돼 두 plan 이 분기하지 않았고,
근거가 된 기능 변경(else 분기 트랜잭션화)의 spec 반영도 target 문서(`3-execution.md` §2.1)에
이미 선행 커밋으로 존재한다. `plan/in-progress/**` 의 "결정 필요" 항목 중 이 변경과 충돌하는
것, 이 변경이 가정하는 미해소 선행 조건, 이 변경이 무효화하거나 새로 만들어야 하는 후속
항목 어느 것도 발견되지 않았다.

## 위험도

NONE
