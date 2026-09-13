# Plan 정합성 검토 — error-code-emission-axis (impl-done 라운드 2, scope=spec/conventions/)

## 발견사항

- **[INFO]** 라운드 1 plan_coherence WARNING(트래커 L3404 체크박스 미갱신)이 실제로 해소됨 — 확인만
  - target 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (구 라인 3404 부근,
    `CONTAINER_MISSING_EMIT`·`CONTAINER_MULTIPLE_EMIT` 항목)
  - 관련 plan: `review/consistency/2026/09/13/19_23_31/plan_coherence.md` WARNING (라운드 1)
  - 상세: 라운드 1 이 지적한 대로 이 항목은 `[ ]` → `[x]` 로 바뀌었고, "2026-09-13 해소 — (A)
    문장 정정 채택, `logic{,.en}.mdx` KO/EN 정정 + `GUIDE_NON_EMITTED_VOCABULARY` 등록으로 가드
    고정, `execution-engine.service.ts:8016` 실측(`nodeExec.error = { message }`, `code` 필드
    없음) 근거 명시" 형태의 해소 주석이 정확히 추가됐다(`git diff origin/main...HEAD` 확인). 라운드
    1 이 제안한 문구와 사실상 동일하다. 재지적 불필요.
  - 제안: 없음(조치 완료).

- **[INFO]** 새로 등재된 두 planner 결정 항목이 target(spec/conventions 영역)을 침범하지 않고
  올바르게 우회되어 있음 — 확인만
  - target 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` 의
    `collectCatalogCodes()` JSDoc("카탈로그를 «요구 조건» 이 아니라 «탈출구» 로 쓴다")
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 신규 두 항목 — ①
    "spec 6파일이 `CONTAINER_*` 를 «코드» 로 적는다" (planner, `spec/5-system/4-execution-engine.md`
    등 6파일 대상, `spec/conventions/` 밖), ② "`3-error-handling.md §1.4` 의 «앵커 없는 코드» 7종
    카탈로그 표기를 정할 것" (planner, (a) backfill vs (b) 앵커-없음 표기 택일)
  - 상세: 두 항목 모두 `spec/` 쓰기가 필요해 developer 권한 밖이고, 실제로 developer 는 그 문서들을
    건드리지 않았다(`spec/conventions/` 델타 0과 일치, `spec/5-system/**` 델타도 0).
    대신 가드 구현이 **어느 쪽으로 planner 가 택일해도 깨지지 않는 설계**(카탈로그 등재=탈출구)를
    택했고, 코드 JSDoc 이 "그 처분이 집행되는 순간 이 탈출구가 발화해 등록 2종이 불필요해진다"고
    명시해 두 결정 사이의 의존을 스스로 추적한다. 미해결 결정과의 충돌·선행 plan 미해소 어느 쪽도
    해당 없음.
  - 제안: 없음(정상 우회, 이미 양쪽 plan 파일에 상호 참조 기록됨).

- **[INFO]** `PROJECT.md` SoT 포인터 drift 는 이번 PR 이 악화시키지 않은 기존 상태로 계속 잔존
  - target 위치: `PROJECT.md:300`(가드 나열 항목) — "SoT: `spec/conventions/user-guide-evidence.md
    §2`"
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` "`user-guide-evidence.md
    §2.1` 관계표에 새 가드 2건이 빠져 있다 — «어디에» 적을지 아직 안 정해졌다" (planner, (a)/(b)
    택일 대기)
  - 상세: 이번 PR 은 `PROJECT.md:300` 의 가드 설명 문구를 "발행 축" 추가분으로 갱신했지만, 그 줄이
    가리키는 SoT(`user-guide-evidence.md §2`)는 여전히 `<ImplAnchor>` 3건짜리 표만 갖고 있고
    `guide-identifier-existence.test.ts` 행이 없다(직접 확인, `spec/conventions/user-guide-evidence.md`
    §2 표는 3행). 다만 이 drift 는 `#1330`/`#1331` 때부터 있던 것이고 위 플랜 항목이 "어디에 적을지
    (a) Overview 스코프 확장 vs (b) 신규 §6" 택일 대기로 이미 정확히 등재해 두었다 — 이번 PR 이 새로
    만든 gap 이 아니며 별도 조치를 요구하지 않는다.
  - 제안: 없음(기존 planner 항목이 이미 포착, 재등재 불필요).

## 요약

이번 배치(`error-code-emission-axis`)의 라운드 2 상태를 점검한 결과, 라운드 1
plan_coherence 가 지적한 유일한 WARNING(트래커 L3404 체크박스 미갱신)은 정확히 해소됐고
새로 만들어진 plan 비정합은 발견되지 않았다. target(`spec/conventions/`)은 이번 PR 에서
델타 0 이며, 실제 코드 변경(`guide-identifier-scan.ts` 발행 축 신설)은 자신이 의존하는 두 개의
미해결 planner 결정(spec 6파일의 `CONTAINER_*` 서술 정정, `3-error-handling.md §1.4` 카탈로그
표기 택일)을 일방적으로 결정하지 않고 명시적으로 우회했으며, 그 우회가 두 plan 결정 어느
쪽으로 귀결되어도 깨지지 않도록 설계(카탈로그=탈출구)하고 상호 참조를 코드 JSDoc·plan 문서
양쪽에 남겼다. "미해결 결정과의 충돌"·"선행 plan 미해소"·"후속 항목 누락" 세 축 모두 깨끗하다.

## 위험도

NONE
