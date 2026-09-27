# Plan 정합성 검토 — `spec/2-navigation/` (impl-prep, scope=spec/2-navigation/)

## 발견사항

- **[WARNING] `1-workflow-list.md` §3.1 폴더 API 인접 미해소 planner 항목을 이번 착수가 건드리지 않는다**
  - target 위치: `spec/2-navigation/1-workflow-list.md` frontmatter `pending_plans:` (완료된 `plan/complete/workflow-duplicate-nodes-edges.md` 참조) + §3.1 `GET /api/folders` 행 (응답 봉투 형태 미기술)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 미체크 항목 **「`spec/2-navigation/` 목록 API 둘의 응답 형태 · 완료된 `pending_plans`」** (line ~6253, 2026-09-20 등재, `--impl-prep` convention WARNING 1·2 · plan_coherence INFO 5 로 기존에도 지적됨)
  - 상세: 이 tracker 항목은 (1) `1-workflow-list.md` §3.1 `GET /api/folders` 행이 실제 구현(`{ data: FolderDto[] }`, 페이지네이션 없음)과 다르게 응답 형태를 적지 않는 갭, (3) 같은 문서 frontmatter `pending_plans` 가 이미 `plan/complete/` 로 옮겨진 `workflow-duplicate-nodes-edges.md` 를 여전히 가리키는 사실 오류를 이미 명시적으로 지적했고, 아직 미해소(`- [ ]`)다. 지금 착수하려는 `plan/in-progress/folders-contract-e2e.md` 는 정확히 같은 절(§3.1 폴더 API)·같은 모듈(`FolderDto`/`folders.controller.ts`)에 e2e 를 신설하고 DTO 를 고치는데, 이 인접 미해소 항목을 인지·교차 참조하지 않는다. 두 작업이 상충하지는 않지만(하나는 부재 표현 버그, 하나는 응답 envelope 문서화 갭), 폴더 e2e 를 새로 짜는 이 시점이 같은 파일의 문서화 갭도 함께 닫거나 최소한 언급하기 좋은 지점이며, 그냥 지나치면 이번 PR 이 "폴더 API 정리 끝" 이라는 인상을 주고 정작 tracker 항목은 그대로 남는다.
  - 제안: `folders-contract-e2e.md` 실행 시 (a) 새 `folders.e2e-spec.ts` 작성 참에 `GET /api/folders` 응답 envelope(`{ data: [...] }`, no pagination)을 §3.1 에 한 줄 보강하는 것을 같은 PR 또는 바로 다음 plan 으로 붙이거나, (b) 최소한 plan 본문에 "이 tracker 항목은 별도" 라고 명시적으로 스코프 배제를 적어 다음 사람이 중복 조사하지 않도록 한다. `pending_plans:` 의 완료 참조 제거는 planner 턴 필요(§3.1 폴더 관리 UI 미구현 등 남은 surface 유무를 먼저 확인해야 한다는 tracker 자체의 단서를 존중).

- **[INFO] `§5.4 스윕 2차` tracker 후보 목록이 이미 낡았고, 이번 plan 의 좁히기(step 7)가 전체를 정리하지 않는다**
  - target 위치: (간접) `spec/2-navigation/` 자체는 아니고, 이번 착수 plan 이 인용하는 tracker 항목
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` line 1368-1373 「§5.4 스윕 2차 — 엔드포인트인데 e2e 미도달인 DTO」 후보 목록 vs `plan/in-progress/folders-contract-e2e.md`
  - 상세: 후보 목록(`DashboardSummaryDto`·`StatisticsSummaryDto`·`LlmUsageSummaryDto`·`WorkflowVersionDto`·`WorkflowVersionListItemDto`·`GraphEntityDto`·`FolderDto`·`DocumentDto`·`NodeDto`·`EdgeDto`)은 최초 등재(`bfa124920`) 이후 한 번도 갱신되지 않았다. 그런데 `folders-contract-e2e.md` 자신의 "실측" 절이 `WorkflowVersionDto`·`WorkflowVersionListItemDto`(#1413)·`NodeDto`·`EdgeDto`(#1411/#1412 경유)는 **이미 e2e 계약 대조에 닿았다**고 적는다 — 즉 후보 목록 10개 중 4개가 이미 stale 하다. `folders-contract-e2e.md` 체크리스트 항목 7 「트래커 — 스윕 2차 항목을 폴더 몫만큼 좁힌다」는 `FolderDto` 하나만 빼는 것으로 읽히며, 같은 줄을 편집하는 김에 이미 닫힌 4개 후보를 함께 정리하는 것까지는 범위에 넣지 않았다.
  - 제안: 체크리스트 7 실행 시 `FolderDto` 제거뿐 아니라 이미 닫힌 `WorkflowVersionDto`·`WorkflowVersionListItemDto`·`NodeDto`·`EdgeDto` 도 같은 편집에서 제외해 후보 목록을 `DashboardSummaryDto`·`StatisticsSummaryDto`·`LlmUsageSummaryDto`·`GraphEntityDto`·`DocumentDto`(지식 베이스 e2e 는 있으나 대조 0건이므로 잔존)로 좁히도록 plan 본문에 반영. 사소하지만 다음 세션이 이미 끝난 항목을 다시 조사하는 낭비를 막는다.

- **[INFO] `folders-contract-e2e.md` 의 §5.4 규약 적용 판단 자체는 target 과 일치, `spec_impact: none` 근거도 타당**
  - target 위치: `spec/5-system/2-api-convention.md` §5.4 (검증했음: "기본은 `null`", "소급 적용 대상 아님" 조항 — `FolderDto.parentId` 는 소급 예외 목록(`mcpDiagnostics` 등)에 없어 신규 변경으로 규약 적용 대상이 맞음) + `spec/2-navigation/1-workflow-list.md` §3.1 (폴더 API 동작만 기술, 응답 부재 표현은 명시하지 않아 plan 의 `spec_impact: none` 결론과 충돌 없음)
  - 상세: 이 항목은 발견사항이라기보다 검증 결과 기록 — CRITICAL/WARNING 대상 아님. plan 이 "결정 필요" 로 남겨둔 사안을 우회하거나, 이미 확정된 §5.4 컨벤션과 다른 결정을 내리는 부분은 없었다.
  - 제안: 없음 (참고용).

## 요약

`plan/in-progress/folders-contract-e2e.md`(§5.4 스윕 2차의 폴더 모듈 몫, `spec_impact: none`)는 대상 스코프 `spec/2-navigation/` 안에서 미해결 결정을 우회하거나 이미 확정된 컨벤션(§5.4 부재 표현)과 충돌하는 결정을 내리지 않는다 — 근거(§5.4 소급 미적용 조항, `1-workflow-list.md` §3.1 이 응답 부재 표현을 규정하지 않는다는 관찰)가 target 문서와 실제로 일치했다. 다만 같은 파일·같은 절(§3.1 폴더 API)을 두고 `spec-draft-nullable-notation-followups.md` 에 이미 등재된 별도 미해소 planner 항목(응답 envelope 미기술 + 완료된 `pending_plans` 참조 오류)이 있고, 이번 착수가 그 인접 항목을 인지·교차 참조하지 않은 채 진행하면 "폴더 API 정리는 끝났다" 는 착시를 남길 수 있다. 또한 이번 plan 이 인용하는 상위 tracker 항목(§5.4 스윕 2차 후보 목록)이 이미 절반 가까이 낡아 있는데, 계획된 좁히기(체크리스트 7)가 `FolderDto` 하나만 제거할 뿐 다른 낡은 후보(WorkflowVersionDto 등)는 정리 범위에 넣지 않는다. 두 사안 모두 구현을 막을 CRITICAL 은 아니며, 착수 자체를 저지할 필요는 없다.

## 위험도

LOW
