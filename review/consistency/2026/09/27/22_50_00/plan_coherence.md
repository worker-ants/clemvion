That confirms the 3R "층 경계" Warning came from `/ai-review` (code-review-agents), not from a plan-coherence check — out of this agent's scope, already converged per the plan's own checklist. This session's plan-coherence check (the `--impl-done` consistency pass at `22_50_00`) is a fresh, independent run.

Based on the review of `spec/2-navigation/1-workflow-list.md`'s actual diff (`git diff origin/main...HEAD`), the owning plan `plan/in-progress/cross-workspace-refs.md`, the parent tracker `plan/in-progress/spec-draft-nullable-notation-followups.md`, and cross-references into `spec/1-data-model.md §1.1` and `codebase/backend/src/modules/alerts/alerts.service.ts`, here are the findings.

### 발견사항

- **[INFO]** 원문 불릿과 정정 단락의 교차 참조 부재는 이미 트래커에 등재된 결함
  - target 위치: `spec/2-navigation/1-workflow-list.md` `## Rationale` §3 — "에러 코드" 불릿("세 위반(같은 워크스페이스·순환·깊이) 모두 생성 경로와 동일한 `VALIDATION_ERROR`")과 바로 아래 새로 추가된 "(2026-09-27 정정)" 단락이 서로 각주로 연결되지 않음(실제 diff 확인 — `git diff origin/main...HEAD -- spec/2-navigation/1-workflow-list.md`에서 정정 단락만 추가되고 원문 불릿은 무수정).
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` L1495-1498 "교차 워크스페이스 참조 후속" 항목 — "원문의 «같은 워크스페이스» 에 정정 단락을 가리키는 각주"를 이미 후속 작업으로 명시 등재.
  - 상세: 두 문단이 표면적으로 모순되어 보이지만(생성 경로가 원래 워크스페이스도 검사했다는 착시), 이는 이번 PR이 놓친 게 아니라 **같은 세션이 스스로 식별해 별도 후속 항목으로 등재**한 것 — plan lifecycle 관례("미룬 항목은 그 턴에 plan/")를 따른 정상 처리다.
  - 제안: 추가 조치 불필요. 후속 planner 턴이 트래커 항목을 처리할 때 함께 닫힘.

- **[INFO]** API 문서 3종(trigger/schedule/user-profile)의 `workflowId` 소속 검사 미러가 의도적으로 지연됨
  - target 위치: `spec/2-navigation/2-trigger-list.md` §3 API 표, `3-schedule.md` §4 API, `9-user-profile.md` L406(POST /api/alerts) — 모두 `workflowId` 를 받지만 "같은 워크스페이스만" 검사를 서술하지 않음(silence).
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` L1488-1498 "교차 워크스페이스 참조 후속" — 이 미러 작업을 "구현이 착지한 뒤" planner 턴으로 명시적으로 미룸(먼저 넣으면 세 문서에 `pending_plans` 가 추가로 필요해진다는 근거 포함).
  - 상세: 검토 대상 diff(`spec/2-navigation/1-workflow-list.md`, `spec/1-data-model.md` §1.1, `alerts.service.ts` 등)는 실제로 `workflowId`/`folderId` 교차 워크스페이스 참조를 저장 전에 거부하도록 코드를 바꿨지만, 2-navigation 영역의 자매 문서(trigger-list/schedule/user-profile)는 이 변경을 아직 반영하지 않음. 다만 이는 정합성 위반이 아니라 **의도적으로 후속 플랜으로 등재된 순연**(target 문서 자체가 이 3 문서를 포함하지 않으므로 이번 diff 스코프 밖).
  - 제안: 조치 불필요 — 후속 planner 턴에서 트래커 항목을 처리.

- **[INFO]** `settings.maxConcurrentExecutions` null 처리 불일치는 이번 diff 와 무관한 선재 이슈
  - target 위치: `spec/2-navigation/1-workflow-list.md` §3.2 6번 · Rationale §2 "permissive 예외에 포함되지 않는다" 문단(hard-fail 서술).
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` L1469-1475 "PATCH null 후속" — `settings.maxConcurrentExecutions` 에 `null` 이 오면 `@IsOptional()` 을 통과해 저장된다는 관찰(`patch-null-validation` 리뷰 W2)이 "거부로 정하면 서술은 그대로 맞고, 계약으로 정하면 그 두 문단이 planner 몫" 이라는 미해결 결정으로 남아 있음.
  - 상세: 이 diff(`git diff origin/main...HEAD -- spec/2-navigation/1-workflow-list.md`)는 §3.2/§Rationale 2 를 건드리지 않았다 — 이 불일치는 cross-workspace-refs 작업 이전부터 존재했고 이번 PR 이 새로 만들거나 악화시키지 않았다. 미해결 결정 자체는 다른 plan(`spec-draft-nullable-notation-followups.md`)에 정확히 등재되어 있어 "일방적 결정 우회"에 해당하지 않는다.
  - 제안: 이번 PR 범위 밖 — 조치 불필요, 참고용 기록.

검증 상세: `spec/2-navigation/1-workflow-list.md` 실제 diff(`pending_plans` 추가, POST/PATCH `/api/workflows` `folderId` 검사 서술, POST/PATCH `/api/folders` `parentId` 검사 서술, "(2026-09-27 정정)" 단락 추가)는 `spec/1-data-model.md §1.1`(신설, 같은 PR)과 정확히 정합하고, 실제 코드 diff(`codebase/backend/src/modules/**` 25파일)의 `alerts.service.ts`·`folders.service.ts`·`workflows.service.ts` 변경과 서술이 일치함을 확인했다. `plan/in-progress/cross-workspace-refs.md` 는 자체적으로 세 차례의 `--impl-prep`/`--spec` 게이트(BLOCK: YES→NO)를 거쳐 발견된 결함(플랜 인용 누락, `1-data-model.md` 승격 오기 등)을 이미 정정했고, 스코프 밖 항목(트리거 `config` 비밀 참조, 이미 저장된 교차 행, OAuth `mode=new`, API 문서 미러)을 전부 명시적으로 트래커(`spec-draft-nullable-notation-followups.md` "교차 워크스페이스 참조 후속")에 등재해 두었다.

### 요약
`plan/in-progress/cross-workspace-refs.md`가 변경한 `spec/2-navigation/1-workflow-list.md`는 같은 PR에서 신설된 `spec/1-data-model.md §1.1`(참조의 소속) 및 실제 backend 코드 diff와 정합하며, 스코프 밖으로 넘긴 항목(트리거 config 비밀 참조·이미 저장된 교차 행·OAuth mode=new·자매 API 문서 미러)은 모두 상위 트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md`의 "교차 워크스페이스 참조 후속" 항목에 명시적으로 등재되어 있어 후속 항목 누락이 없다. 유일하게 남는 것은 `1-workflow-list.md` 내부의 원문 불릿↔정정 단락 각주 미연결과 `settings.maxConcurrentExecutions` null 처리 미해결 결정인데, 둘 다 이번 diff가 새로 만든 문제가 아니라 이미 트래커에 정확히 등재되어 planner 턴을 기다리는 상태다. Plan 정합성 관점에서 이 diff는 미해결 결정을 우회하거나 선행 조건을 무시하지 않았다.

### 위험도
NONE
