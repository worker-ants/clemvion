# Plan 정합성 검토 — spec/conventions/interaction-type-registry.md

## 발견사항

- **[WARNING]** target diff 가 해소하는 plan 후속 항목의 체크박스가 아직 미갱신
  - target 위치: `spec/conventions/interaction-type-registry.md` §1.2 rule 3, §2.1 `system_error`/`rag` 두 행, §4 "AST 가드" 행, §5 두 곳 — 전부 "grep" → "AST(코드 리터럴) 스캔"/"AST 로 스캔" 용어 정정 (현재 working tree 상 uncommitted diff, `git diff` 로 확인).
  - 관련 plan: `plan/in-progress/interaction-type-guard-comment-false-negative.md` §"후속 (본 PR 범위 밖)" 첫 항목 — `[ ] **[project-planner]** spec interaction-type-registry.md §1.2 rule 3 · §2.1 두 행 · §5 의 "grep 대상 파일"/"grep 검증 대상"/"코드 grep 결과" 류 잔여 표현 → "AST(코드 리터럴) 스캔 대상"/"코드 AST 파싱 결과" 로 다듬기.`
  - 상세: 현재 target 초안은 이 plan 항목이 지목한 위치·표현을 **정확히** 그대로 정정한 것이다 (§1.2 rule 3, §2.1 `system_error`·`rag` 두 행, §5 두 문장 전부 diff 에 포함 — 심지어 plan 이 명시하지 않은 §4 "AST 가드 — grep 할 사본이 없다" 행까지 동일 패턴으로 정정해 더 철저하다). 즉 **결정 충돌은 없고 오히려 plan 이 요청한 작업을 그대로 이행**하는 정합적인 변경이다. 다만 `git status` 상 수정된 파일은 target spec 1개뿐이며, plan 문서(`interaction-type-guard-comment-false-negative.md`)의 해당 체크박스는 여전히 `[ ]` 로 남아있다. 이 저장소의 관례("plan 체크박스 = 실제 상태", `plan-lifecycle.md` §1·§2)상 이 spec 커밋이 단독으로 랜딩되면 plan 문서가 즉시 stale 해진다.
  - 제안: target spec 커밋과 **같은 변경 세트**에서 `plan/in-progress/interaction-type-guard-comment-false-negative.md` 의 해당 항목을 `[x]` 로 갱신하고 완료 근거(이 커밋 SHA/PR)를 남긴다. 단, plan 의 "종결 조건"은 4개 후속 항목(project-planner 1 + developer 선택 2 + harness 비차단 1) 전부 해소를 요구하므로, 이번 항목이 닫혀도 나머지 3건(선택·비차단)이 남아있는 한 plan 은 여전히 `in-progress/` 에 남아야 한다 — `complete/` 로 조기 이동하지 말 것.

## 요약

target 초안은 `plan/in-progress/interaction-type-guard-comment-false-negative.md` 가 명시적으로 project-planner 에게 위임한 용어 정정 작업(§1.2 rule 3·§2.1 두 행·§5 "grep" 잔여 표현 → "AST" 계열)을 정확히 그 범위와 표현으로 이행하고 있어 plan 이 남긴 미해결 결정과 충돌하지 않는다. 다른 in-progress plan(`node-output-redesign/*`, `eia-context-schema-followups.md` 등)의 `endReason`/EIA 경로 관련 언급도 target 의 §4 경계 서술(값 도메인=패키지, port 매핑=노드 spec, 봉투 구조=node-output.md)과 이미 정합하며 재작업이 필요한 충돌은 없다. 유일한 갭은 target spec 변경이 그것을 촉발한 plan 문서의 체크박스에 아직 반영되지 않았다는 bookkeeping 성격의 누락이다.

## 위험도
LOW
