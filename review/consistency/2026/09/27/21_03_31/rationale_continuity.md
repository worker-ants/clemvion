# Rationale 연속성 검토 — spec/2-navigation/ (impl-prep, cross-workspace-refs 3차 재실행)

## 발견사항

- **[INFO]** 재판정 대상 두 문장은 현재 규칙(§1.1)과 정합 — 재발 없음
  - target 위치: `spec/2-navigation/1-workflow-list.md` §3.1 (`POST /api/folders` 행, 141행) · Rationale §3 "(2026-09-27 정정)" 문단(201행); `spec/data-flow/11-workflow.md` §1.2 각주(81~85행)
  - 과거 결정 출처: `spec/data-flow/12-workspace.md` Rationale "본문 참조 id 도 저장 전에 소속을 본다 (2026-09-27)" · `spec/1-data-model.md` §1.1(같은 날 신설)
  - 상세: orchestrator 가 재판정을 요구한 두 문장을 §1.1 신설 규칙과 대조했다. (1) `1-workflow-list.md` §3.1 의 `POST /api/folders` 행은 "parentId 가 같은 워크스페이스의 폴더가 아니면 400" 을 §1.1 링크와 함께 명시하고, Rationale §3 의 "(2026-09-27 정정)" 문단은 "이 결정 뒤에도 생성 경로는 깊이만 봤다" 는 사실을 인정하며 `plan/in-progress/cross-workspace-refs.md`(완료 전 pending_plans 로 이미 추적됨, frontmatter 확인)를 근거로 "같은 PR — spec 과 코드가 함께 착지" 라고 명시해 시제·경로가 모두 현재형/in-progress 로 일치한다. (2) `data-flow/11-workflow.md` §1.2 각주는 "저장 경로가 저장 시점에 보는 것은 참조의 소속뿐이다 … [데이터 모델 §1.1]" 이라고 적어 §1.1 을 그대로 가리키며 실행 시점 검증(§1.2 표의 `CONTAINER_CYCLE`/`CONTAINER_INVALID_CHILD`)과 저장 시점 검증(참조의 소속)을 층으로 명확히 분리한다 — §1.1 이 정의한 "실행 엔진은 워크플로를 id 로만 읽는다" 는 전제와도 어긋나지 않는다. 1·2차 `--impl-prep` 이 지적한 Critical(구현보다 먼저 착지한 서술의 `pending_plans` 미추적·완료형 인용)은 `a8bfd1492` → `18f235a81` 두 planner 턴에서 이미 해소된 상태이고, 이번 재조사에서 재발을 발견하지 못했다.
  - 제안: 없음 (확인 목적의 기록).

- **[WARNING]** §3 Rationale 내부에 스스로 반증한 문장이 취소선 없이 남아 있다
  - target 위치: `spec/2-navigation/1-workflow-list.md` 198행 "**에러 코드**: 세 위반(같은 워크스페이스·순환·깊이) 모두 생성 경로와 동일한 `VALIDATION_ERROR` 를 재사용한다…" (2026-07-05 결정문 안 불릿) vs. 같은 섹션 201행 "(2026-09-27 정정) 이 결정 뒤에도 **생성** 경로는 깊이만 봤다"
  - 과거 결정 출처: 같은 문서 `## Rationale` §3 자체(2026-07-05 결정과 2026-09-27 정정이 같은 절 안에 공존)
  - 상세: 198행 불릿은 "세 위반(같은 워크스페이스·순환·깊이) 모두 생성 경로와 동일한 VALIDATION_ERROR 를 재사용한다"고 적어, PATCH 재부모화가 생성 경로와 "동일하게" 세 가지를 이미 검사하고 있다는 것을 전제로 한 문장이다. 그런데 바로 세 줄 아래 201행의 정정은 "생성 경로는 깊이만 봤다 — 다른 워크스페이스의 부모를 «없음» 으로 읽어 통과시켰다"고 명시적으로 반증한다. 즉 198행은 지금 시점에 **사실이 아닌 전제**(생성 경로가 이미 워크스페이스를 검사한다)를 깔고 있는데, 정정 문단이 새로 추가되었을 뿐 198행 자체는 고쳐지거나 취소선 처리되지 않았다. 같은 섹션을 위에서부터 순서대로 읽는 독자(또는 이 Rationale 을 코드 근거로 인용하는 다음 PR)는 "에러 코드" 불릿만 보고 "생성 경로도 이미 워크스페이스 검증을 재사용해 왔다"고 오독할 수 있다 — 정정 문단이 바로 아래 있다고 해서 자동으로 상쇄되지 않는다.
  - 제안: 198행 불릿에서 "같은 워크스페이스" 부분을 취소선 처리하거나 각주로 "(2026-09-27 정정 참고 — 생성 경로는 이 PR 이전엔 깊이만 검사)" 를 인접시켜, 정정 문단과 원문 불릿이 서로를 가리키게 한다. `CLAUDE.md` 의 자기-반증형 소정정 조건 4("원문은 취소선으로 남기고 인접 서술은 건드리지 않는다")가 developer 예외 조항이라 이 케이스(project-planner 의 spec 정정)에 문자 그대로 적용되진 않지만, 같은 원리(모순되는 원문을 무표시로 방치하지 않는다)는 여기도 유효하다.

- **[WARNING]** 같은 날 신설된 invariant(§1.1)가 대상 필드 10개 중 3개(트리거/스케줄/알림 규칙의 `workflowId`)를 명시하는데, 그 API 를 서술하는 형제 spec 은 이 invariant 를 언급도 추적도 하지 않는다
  - target 위치: `spec/2-navigation/2-trigger-list.md` §2.5 트리거 생성 표(`workflowId`) · §3 API(`POST /api/triggers`); `spec/2-navigation/3-schedule.md` §2.2 스케줄 생성/수정 다이얼로그(워크플로우 드롭다운) · §4 API(`POST /api/schedules`); `spec/2-navigation/9-user-profile.md` §6.3 알림 규칙 API(`POST /api/alerts` 의 `workflowId?`)
  - 과거 결정 출처: `spec/data-flow/12-workspace.md` Rationale "본문 참조 id 도 저장 전에 소속을 본다 (2026-09-27)" · `spec/1-data-model.md` §1.1 표("트리거 생성 workflowId · 스케줄 생성 workflowId(연결 트리거의 workflow_id 가 된다) · 알림 규칙 생성 workflowId | Workflow | 워크스페이스"); `plan/in-progress/cross-workspace-refs.md` §전수의 (X) 표 1·2행("POST /api/triggers"·"POST /api/schedules" 의 `workflowId` 가 "다른 워크스페이스에 작용" 하는 최고 심각도 항목으로 분류되고, §처방이 "(X)·(D) 전부 저장 전에 거부한다"·"이 PR 밖으로 넘기는 것" 목록에 트리거/스케줄/알림 workflowId 가 없음을 명시)
  - 상세: 같은 PR(같은 plan)에서 신설된 시스템 invariant("서버는 이것을 저장 전에 거부한다")는 트리거·스케줄·알림 규칙의 `workflowId` 도 명시적으로 포함하고, 플랜 본문은 이 셋을 "이 PR 밖으로 넘기는 것"에 올리지 않아 이번 PR 에서 코드로 닫을 대상임을 밝히고 있다. 그런데 `plan/in-progress/cross-workspace-refs.md` 의 frontmatter `spec_impact` 는 `1-data-model.md` · `2-navigation/1-workflow-list.md` · `data-flow/11-workflow.md` · `data-flow/12-workspace.md` · `3-workflow-editor/0-canvas.md` 5개만 나열하고, 정작 그 필드들의 계약을 서술하는 `2-trigger-list.md` · `3-schedule.md` · `9-user-profile.md` 는 목록에도, 각 파일의 `pending_plans`(2-trigger-list.md 는 `spec-draft-nullable-notation-followups.md` 만, 3-schedule.md 는 항목 자체 없음, 9-user-profile.md 는 `spec-sync-user-profile-gaps.md` 만)에도 들어 있지 않다. 구현이 계획대로 이 3개 엔드포인트에 400 `VALIDATION_ERROR` 를 추가하면, 그 순간 이 세 spec 문서는 실제 API 계약보다 뒤처진 상태로 남는다 — 1·2차 `--impl-prep` 이 `1-workflow-list.md`/`0-canvas.md` 에서 정확히 지적했던 "구현·spec 착지 시점 불일치" 패턴이 이번엔 반대 방향(spec 이 코드 뒤에 남는 방향)으로 다른 세 파일에 재발할 소지가 있다.
  - 제안: (a) 지금 이 impl-prep 라운드에서 `cross-workspace-refs.md` 의 `spec_impact`/`pending_plans` 전파 대상에 `2-trigger-list.md`·`3-schedule.md`·`9-user-profile.md` 를 추가하고, 각 API 표에 "§1.1 참조" 한 줄을 예고(pending_plans 로 추적)하거나, (b) 트리거/스케줄/알림 `workflowId` 검사를 의도적으로 이번 PR 범위에서 제외한다면 plan 의 "이 PR 밖으로 넘기는 것" 절에 그 사실과 사유를 명시해 §전수 표의 심각도 분류("다른 워크스페이스에 작용")와 실제 처리 범위가 어긋나지 않게 한다.

## 요약

이번 3차 재실행에서 orchestrator 가 지목한 두 문장(`1-workflow-list.md` §3.1·Rationale §3, `data-flow/11-workflow.md` §1.2 각주)은 2026-09-27 신설 규칙(`1-data-model.md` §1.1, `data-flow/12-workspace.md` Rationale)과 정합하며 1·2차에서 지적된 Critical(구현보다 먼저 착지한 서술의 `pending_plans` 미추적)은 재발하지 않았다. 다만 그 정정 작업 자체가 남긴 두 개의 잔여 리스크를 발견했다 — (1) `1-workflow-list.md` §3 Rationale 안에서 2026-07-05 원문 불릿이 2026-09-27 정정과 모순되는 채로 취소선 없이 공존하는 점, (2) 같은 신설 invariant 가 명시적으로 포함한 트리거·스케줄·알림 규칙의 `workflowId` 검증이 그 API 를 서술하는 형제 spec 세 곳(2-trigger-list.md·3-schedule.md·9-user-profile.md)과 plan 의 `spec_impact`/`pending_plans` 에는 전파되지 않아, 구현이 계획대로 진행되면 그 세 문서가 조용히 뒤처질 위험이 있다는 점이다. 둘 다 새 규칙 자체를 뒤집거나 기각된 대안을 되살리는 CRITICAL 성격은 아니고, 같은 결정을 문서 전반에 일관되게 반영하지 못한 전파 누락에 가깝다.

## 위험도

LOW
