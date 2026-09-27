# Plan 정합성 검토 — `spec/2-navigation/` (--impl-prep, cross-workspace-refs 3차 재실행)

## 발견사항

- **[재판정: RESOLVED — 신규 Critical 없음]** `1-workflow-list.md` §3.1·Rationale §3 / `data-flow/11-workflow.md` §1.2 각주
  - target 위치: `spec/2-navigation/1-workflow-list.md` frontmatter `pending_plans:` + §3.1 `POST /api/folders` 행 + `## Rationale` §3 "(2026-09-27 정정)" 문단, `spec/data-flow/11-workflow.md` §1.2 각주(81~85행)
  - 관련 plan: `plan/in-progress/cross-workspace-refs.md` (§체크리스트 `[ ] 구현` 등 5항목 미완료)
  - 상세: 이전 라운드(`review/consistency/2026/09/27/20_21_21`)가 Critical 로 판정한 원인 두 가지 — (a) `pending_plans` 미등재, (b) 존재하지 않는 `plan/complete/cross-workspace-refs.md` 를 완료형("더했다")으로 인용 — 모두 커밋 `18f235a81`에서 해소를 확인했다. 현재 `1-workflow-list.md` frontmatter 는 `pending_plans: [..., plan/in-progress/cross-workspace-refs.md]` 를 갖고, Rationale §3 정정 문단은 `` `plan/in-progress/cross-workspace-refs.md` `` 정확한 경로 + "더한다"(계획형) 시제 + "고치기 전 e2e 가 201 을 쟀다"(과거 시제로 결함 서술)를 쓴다. `data-flow/11-workflow.md` §1.2 각주는 frontmatter/`pending_plans` 스키마 자체가 없는 "라이프사이클 비추적" 데이터-플로 문서라(이전 라운드 `20_45_35`의 관찰과 동일 부류), 같은 효과를 자매 문서 `data-flow/12-workspace.md` Rationale "본문 참조 id 도 저장 전에 소속을 본다 (2026-09-27)"가 프로즈로 담당한다 — 그 문단도 "고치기 전 e2e 가 둘을 재현했다"는 과거 시제로 버그를 서술하고 `spec/1-data-model.md §1.1`을 규칙의 SoT 로 지목한다. 두 파일 모두 `plan/in-progress/cross-workspace-refs.md`의 `spec_impact` frontmatter 에 이미 등재돼 있어 추적 경로가 존재한다. spec-first 로 목표 계약을 먼저 적고 같은 PR 에서 코드가 뒤따르는 것은 이 프로젝트의 정상 흐름(이전 라운드 요약과 동일 결론)이며, 이번 재판정에서 새로운 모순은 찾지 못했다.
  - 제안: 조치 불요(확인만). 남은 것은 아래 두 항목뿐이다.

- **[WARNING]** 트리거·스케줄·알림규칙 `workflowId` 소속 검사가 `spec/2-navigation/` 내 형제 문서 3곳에 아직 미반영 — 단, 반영 시점은 다른 tracker 가 명시적으로 "구현 착지 후"로 유예해 뒀다
  - target 위치: `spec/2-navigation/2-trigger-list.md` §2.5(트리거 생성 `workflowId`)·§3 API 註, `spec/2-navigation/3-schedule.md` §4 API(`POST /api/schedules`), `spec/2-navigation/9-user-profile.md` §5.4(`POST /api/alerts` `workflowId?`) — 세 파일 모두 frontmatter 에 `pending_plans: plan/in-progress/cross-workspace-refs.md` 없음(각각 확인: `2-trigger-list.md`는 `spec-draft-nullable-notation-followups.md`만, `3-schedule.md`는 `pending_plans` 필드 자체 없음(`status: implemented`), `9-user-profile.md`는 `spec-sync-user-profile-gaps.md`만)
  - 관련 plan: `plan/in-progress/cross-workspace-refs.md` §전수 "(X) 다른 워크스페이스에 작용한다" 표 — `POST /api/triggers workflowId`·`POST /api/schedules workflowId`를 **가장 심각한 케이스**(웹훅/스케줄 발화가 실제로 남의 워크플로를 실행)로 직접 열거하는데, 이 plan 의 `spec_impact` frontmatter(5개 파일: `1-data-model.md`·`1-workflow-list.md`·`data-flow/11-workflow.md`·`data-flow/12-workspace.md`·`0-canvas.md`)에는 이 세 파일이 없다. / `plan/in-progress/spec-draft-nullable-notation-followups.md`:1491-1494 "교차 워크스페이스 참조 후속" 항목이 "API 문서 셋에 §1.1 한 줄 미러 — `2-trigger-list.md`·`3-schedule.md`·`9-user-profile.md`… 구현이 착지한 **뒤**에 넣는다(먼저 넣으면 세 문서에도 `pending_plans` 가 필요해진다)"로 **명시적으로 유예**하고 있음을 확인
  - 상세: 이전 라운드(`20_21_21`, cross_spec WARNING #3·INFO #1)가 동일 갭을 지적했고 이번 재검토 시점(커밋 `79b954a48` 이후)에도 세 파일 본문·frontmatter 는 그대로다. 다만 유예 자체는 오판이 아니라 별도 tracker(`spec-draft-nullable-notation-followups.md`)에 근거·순서까지 문서화된 **의도된 결정**이다. 문제는 그 유예 결정이 `cross-workspace-refs.md` 자신의 "이 PR 밖으로 넘기는 것" 절(트리거 `config` 비밀 참조·OAuth `mode=new`·실행 경로 방어선 3항목만 나열)에는 교차 인용되어 있지 않다는 점 — `cross-workspace-refs.md` 만 읽는 사람은 "트리거/스케줄/알림 nav 문서 미러링"이 별도로 유예돼 있다는 사실을 알 수 없고, `spec-draft-nullable-notation-followups.md`(409,946자, 컨텍스트 예산 초과로 번들에서 절단됨)를 직접 열어야만 확인 가능하다.
  - 제안: `plan/in-progress/cross-workspace-refs.md` §"이 PR 밖으로 넘기는 것"에 "`2-trigger-list.md`/`3-schedule.md`/`9-user-profile.md` §1.1 미러는 구현 착지 후 별도 planner 턴 — 추적: `spec-draft-nullable-notation-followups.md` '교차 워크스페이스 참조 후속'" 한 줄만 추가해 자기완결적으로 만들 것(developer 가 plan/** 을 직접 수정 가능, planner 턴 불필요).

- **[INFO]** `1-workflow-list.md` §3.1 신규 행에 문서 자체의 "(Planned)" 라벨 관례 미적용
  - target 위치: `spec/2-navigation/1-workflow-list.md` §3.1 `POST /api/folders` 행, `PATCH /api/folders/:id` 행
  - 관련 plan: `plan/in-progress/cross-workspace-refs.md` (§체크리스트 `[ ] 구현` 미완료)
  - 상세: 같은 문서 §2.1·§2.7·§3.2 는 미구현 기능에 **"미구현 (Planned)"** 라벨을 인라인으로 붙이는 관례를 이미 쓰고 있는데, §3.1 의 신규 소속-검사 서술(생성 시 "같은 워크스페이스" 검사, PATCH `details[].field='parentId'`)은 이 라벨 없이 이미 동작하는 것처럼 present-tense 로만 적혀 있다. 이전 라운드(`20_21_21`, convention_compliance WARNING #1)가 지적했고, 이후 처분 기록(`cross-workspace-refs.md`:105-110 "planner 턴 2")에는 이 WARNING 이 명시적으로 언급되지 않아 — pending_plans + Rationale 정정 문단(더 상위 신호)으로 대체 커버된 것으로 보이나, 표 행 자체만 보는 독자에게는 여전히 "이미 구현됨"으로 읽힐 여지가 남는다.
  - 제안: 낮은 우선순위 — pending_plans/Rationale 이 이미 실질적으로 같은 신호를 주므로 즉시 조치 불요. 같은 PR 의 구현 커밋에서 함께 정리해도 무방.

## 요약

이번 3차 재실행이 재판정을 요청한 두 Critical 문장(`1-workflow-list.md` §3.1·Rationale §3, `data-flow/11-workflow.md` §1.2 각주)은 커밋 `18f235a81`(pending_plans 등재 + 경로/시제 정정)과 `data-flow/12-workspace.md` Rationale 의 과거-시제 버그 서술로 이미 정합 상태다 — 신규 Critical 은 없다. 남은 갭은 두 가지다: (1) plan 이 스스로 최우선(X)으로 분류한 트리거·스케줄·알림규칙 `workflowId` 소속 검사가 `spec/2-navigation/2-trigger-list.md`·`3-schedule.md`·`9-user-profile.md` 세 형제 문서에 아직 반영되지 않았는데, 이는 방치가 아니라 `spec-draft-nullable-notation-followups.md` 가 "구현 착지 후" 로 명시 유예해 둔 결정이나 그 사실이 `cross-workspace-refs.md` 자신의 범위 밖 목록에는 교차 인용돼 있지 않아 자기완결성이 떨어진다(WARNING). (2) `1-workflow-list.md` §3.1 표 행에 문서 자체의 "(Planned)" 라벨 관례가 빠져 있으나 pending_plans/Rationale 이 실질적으로 같은 신호를 주므로 경미하다(INFO). 다른 in-progress plan(`marketplace-and-plugin-sdk.md`의 미해결 사용자 결정 5건, `ai-agent-tool-connection-rewrite.md`의 도구 등록 모델 TBD)과 이번 target 변경 사이의 직접 충돌은 발견하지 못했다 — 전자는 워크플로 목록의 빈 상태 링크(§2.7)에 한정된 무관한 의존이고, 후자는 캔버스 Tool Area UX 재설계이지 `node.tool_owner_id` 소속 검증 계층과 직교한다.

## 위험도

LOW
