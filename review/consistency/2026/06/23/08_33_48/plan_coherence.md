# Plan 정합성 검토 결과

검토 모드: 구현 완료 후 (--impl-done, scope=spec/2-navigation, diff-base=origin/main)
분석 기준: `plan/in-progress/refactor/02-architecture.md` M-8 vs target `spec/2-navigation`

---

## 발견사항

- **[WARNING]** `spec/2-navigation/2-trigger-list.md` frontmatter `code:` 에 신규 파일 미등재
  - target 위치: `spec/2-navigation/2-trigger-list.md` frontmatter `code:` 배열
  - 관련 plan: `plan/in-progress/refactor/02-architecture.md` M-8 — "`lib/api/triggers.ts` 신설 — §3 API 표 + rotate-bot-token 의 typed wrapper"
  - 상세: M-8 1단계로 `codebase/frontend/src/lib/api/triggers.ts` 가 신설되었으나, `spec/2-navigation/2-trigger-list.md` 의 frontmatter `code:` 배열에 해당 파일이 등재되지 않았다. spec-impl-evidence 규약상 구현 코드는 담당 spec 문서 frontmatter `code:` 에 등재되어야 추적 가능하다.
  - 제안: `spec/2-navigation/2-trigger-list.md` frontmatter `code:` 에 `codebase/frontend/src/lib/api/triggers.ts` 추가. developer 가 아닌 planner 영역(spec 갱신)이므로 해당 plan 의 "planner 후속(비차단 SPEC-DRIFT)" 항목으로 기록하거나 별도 planner 세션에서 처리.

- **[INFO]** M-8 1단계(API 레이어)가 plan 권장안 A 의 일부로 올바르게 착지했으나, 2단계(§2.3.1 카드 경계 분리) 와 m-2(`triggers/page.tsx` 이전)가 plan 에 미완으로 남아 있음
  - target 위치: 해당 없음 (spec/2-navigation 문서 본문에 변경 없음)
  - 관련 plan: `plan/in-progress/refactor/02-architecture.md` M-8 개선 방안 2~3 및 m-2 항목
  - 상세: M-8 plan 에 "Option B. `lib/api/triggers.ts` 만 우선 (컴포넌트 분리는 후속 PR)" 경로가 명시되어 있으며 1단계 완료가 이 옵션 또는 Option A 의 1단계 선착수와 일치한다. 02-architecture.md M-8 체크박스가 여전히 "미착수([ ])" 로 표기되어 있는데, 1단계 완료 상태를 반영해 체크리스트 갱신이 필요하다. 또한 m-2 의 "1. `lib/api/triggers.ts`(M-8 에서 생성) → `triggers/page.tsx` 이전"이 이제 차단 해제된 상태이므로 m-2 착수 가능 여부를 표기하면 후속 작업자에게 명확하다.
  - 제안: `plan/in-progress/refactor/02-architecture.md` M-8 항목의 `[ ] 미착수`를 1단계 완료 상태로 갱신(체크리스트 추가). m-2 의 "triggers/page.tsx 이전" 선행 요건(`lib/api/triggers.ts` 생성)이 충족됨을 기록.

---

## 요약

`spec/2-navigation` 의 어떤 문서도 미해결 결정을 우회하거나 미합의 사항을 일방적으로 결정하는 내용을 포함하지 않는다. M-8 1단계(lib/api/triggers.ts API 레이어 추출)는 `plan/in-progress/refactor/02-architecture.md` M-8 의 Option B 또는 Option A 1단계 선착수로서 plan 과 정합한다. 주요 갭은 신설 파일이 담당 spec 문서 frontmatter `code:` 에 미등재된 SPEC-DRIFT(WARNING 1건)와, plan 진행 상태 표기가 미갱신된 INFO 1건이다. 선행 plan 미해소·결정 우회·후속 plan 무효화에 해당하는 CRITICAL 사안은 없다.

## 위험도

LOW
