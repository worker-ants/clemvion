# Plan 정합성 검토 — spec/2-navigation/ (impl-done, ImportWorkflowDto.settings 비대칭 해소)

## 참고: payload 스코프 보정

`_prompts/plan_coherence.md` 의 "진행 중 plan 문서 모음" 절에는 target plan
`plan/in-progress/import-workflow-settings-dto.md` 가 포함되어 있지 않았다(다른 plan 다수만 번들됨 —
mis-scope). 지시에 따라 워크트리에서 다음을 직접 Read 했다:

- `plan/in-progress/import-workflow-settings-dto.md` (target plan, 본 PR)
- `plan/in-progress/workflow-cap-validated-dto.md` (선행 PR #805 — 본 plan 이 명시하는 파생 원본)
- `plan/in-progress/spec-sync-workflow-list-gaps.md` (target spec 의 `pending_plans:` 참조)
- `plan/in-progress/exec-intake-followups.md` (workflow-level cap DTO 항목의 상위 백로그)
- `spec/1-data-model.md` §2.4 Workflow.settings 스코프
- git log(origin/main) — PR #805/#806 merge 여부

## 발견사항

없음(정합성 위반 미검출).

### 확인된 정합 근거 (참고용, 발견사항 아님)

1. **선행 plan 계보 명확** — `workflow-cap-validated-dto.md`(PR #805, origin/main `07b6d598f` merge 완료)의
   말미 "후속(별도) — ImportWorkflowDto.settings opaque 비대칭" 절이 정확히 본 target plan 이 착수한
   항목이다. 상위 `exec-intake-followups.md` 도 해당 완료 라인에 동일 후속을 명시적으로 남겨뒀다
   (`후속(별도): ImportWorkflowDto.settings opaque 비대칭`). 즉 본 plan 은 선행 plan 이 예고한 후속을
   그대로 이행하는 것이라 "미해결 결정 우회"·"선행 plan 미해소" 어느 쪽에도 해당하지 않는다.

2. **strict 정책 근거 재사용의 정합성** — target spec(`1-workflow-list.md` §3.2 item 6, Rationale §2)의
   "workflow `settings` 는 admission-gate 파라미터라 이 permissive 예외에 포함되지 않는다" 서술은
   #805 의 동일 논거(백엔드 소비 키가 `maxConcurrentExecutions` 단 하나, `spec/1-data-model.md §2.4`
   가 이미 이 키로 스코프)를 그대로 재사용한다. 코드 확인 결과 `import-workflow.dto.ts:176`
   `settings?: WorkflowSettingsDto`(nested `@ValidateNested @Type`)로 실제 전환되어 있고,
   `spec/1-data-model.md:120` 이 `Workflow.settings` 를 `maxConcurrentExecutions` 단일 키로 스코프함을
   재확인 — spec 서술과 구현이 일치한다.

3. **다른 in-progress plan 과의 충돌 없음** — `ImportWorkflowDto`/`workflows/import` 를 언급하는
   in-progress plan 은 `exec-intake-followups.md`(후속 예고만) · `workflow-cap-validated-dto.md`
   (원본 후속 명시) · target plan 자신 3개뿐이며, 셋 다 동일 방향(opaque→strict 전환)을 가리킨다.
   `settings` 키워드로 걸리는 다른 plan(`cafe24-backlog-residual.md`, `spec-sync-*-gaps.md` 등)은
   워크스페이스/스케줄 등 무관한 도메인이라 충돌 없음.

4. **target spec 의 `pending_plans` 미해소 항목과 무충돌** — `1-workflow-list.md` frontmatter
   `pending_plans: [spec-sync-workflow-list-gaps.md]` 가 가리키는 미해결 항목(태그·폴더 필터 UI,
   빈 상태 마켓플레이스 링크)은 §2.3/§2.7 소관이며, 본 PR 이 변경한 §3.2/Rationale(Export/Import
   JSON 포맷의 settings 검증)과 별개 영역이라 상호 간섭 없다.

## 요약

target(`spec/2-navigation/1-workflow-list.md` §3.2 item 6 + Rationale §2)이 반영하는 변경은
선행 완료 PR #805(`workflow-cap-validated-dto.md`)가 명시적으로 예고한 후속 항목을 그대로 이행한
것으로, plan 계보가 문서로 명확히 추적되고 상위 백로그(`exec-intake-followups.md`)에도 동일 후속이
등재되어 있다. 코드(`import-workflow.dto.ts`)와 spec 서술이 일치하며, target spec 이 남긴
미해결 `pending_plans` 항목(태그/폴더 필터 UI 등)과도 스코프가 겹치지 않는다. 다른 in-progress
plan 중 이 변경으로 무효화되거나 후속이 필요해지는 항목은 발견되지 않았다.

## 위험도

NONE

BLOCK: NO

STATUS: SUCCESS
