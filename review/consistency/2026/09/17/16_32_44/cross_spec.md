# Cross-Spec 일관성 검토 — 트리거 자원 해제 계약 draft

검토 대상: `plan/in-progress/spec-draft-deletion-releases-trigger-resources.md` (spec_impact 7개 파일)

방법: 번들(`_prompts/cross_spec.md`)의 대상 spec 6개 본문이 예산 초과로 절단되어 있어(harness 기지 결함,
파일 자체가 "(main 추가)" 절에서 이를 인정하고 절대경로를 지정함), 아래 7개 spec 파일과 관련 코드를
worktree 에서 직접 Read 해 실측 대조했다: `1-workflow-list.md`, `2-trigger-list.md`,
`data-flow/10-triggers.md`, `data-flow/11-workflow.md`, `data-flow/12-workspace.md`,
`1-data-model.md`, `conventions/secret-store.md`, `V001__initial_schema.sql`,
`V063__secret_store.sql`, `workflows.service.ts`, `workspaces.service.ts`, `triggers.service.ts`.

## 발견사항

- **[WARNING]** `secret-store.md §6` 이 draft 가 고치는 바로 그 결함 문장을 **세 번째로** 복제해 갖고 있는데, draft 의 변경안(S1~S7)이 이 자리를 빠뜨렸다
  - target 위치: draft `## 실측 > spec 이 이미 서로 어긋나 있다` 표(4행) + `## 변경안 S6·S7`
  - 충돌 대상: `spec/conventions/secret-store.md` §6 "Trigger 삭제 시 cascade" 본문 (line 388-392, S7 이 건드리는 §R4 Rationale 바로 아래 절)
  - 상세: draft 는 "없는 메서드 `TriggersService.delete()`" 오기 + "workspace 삭제 시 `deleteByPrefix` 로 정리"라는 **거짓 서술**이 세 곳에 있다고 밝히고(`1-data-model.md` line 791 → S6 이 수정, `secret-store.md §R4` line 428 → S7 이 수정, `V063` 마이그레이션 주석 → Flyway 체크섬 때문에 의도적 보류) 두 곳만 이 draft 의 편집 대상이라고 적었다. 그런데 실제로 읽어보면 같은 파일 안에 **네 번째 자리**가 있다 — §6 본문(line 390-392): "`workspace_id` 컬럼은 workspace 삭제 시 cascade 정리용 (`DELETE FROM secret_store WHERE workspace_id = $1`)." 이 문장은 `TriggersService.delete()` 오기는 없지만, "workspace 삭제가 이미 `secret_store` 를 정리한다"는 **똑같이 반증된 주장**이다 — draft 의 실측(`WorkspacesService.deleteWorkspace()` 에 그런 DELETE 가 없음, line 492-533)이 이 문장도 직접 반증한다. S6·S7 적용 후에도 이 §6 문장은 그대로 남아, 같은 파일 안에서 **"트리거 삭제(`TriggersService.remove()`) 외 경로가 지금 정리하지 않고 있다"(수정된 §R4)** 와 **"workspace_id 컬럼은 workspace 삭제 시 cascade 정리용"(미수정 §6)** 이 서로 모순되는 상태가 된다. 다음에 이 draft 를 근거로 D4(workspace 삭제에 명시 DELETE 추가)를 구현하려는 developer 가 §6 을 먼저 읽으면 "이미 되어 있다"고 오판할 위험이 크다 — 정확히 이 draft 가 발단이 된 «developer 항목 8» 류의 재발 경로다.
  - 제안: `## 변경안`에 S8 을 추가해 `secret-store.md §6` line 392 를 "`workspace_id` 컬럼은 workspace 삭제 시 애플리케이션이 명시 DELETE 로 정리한다(`DELETE FROM secret_store WHERE workspace_id = $1`) — **트리거 삭제와 마찬가지로 DB 가 대신 지워주지 않는다**"는 식으로 D4/S5 와 정합하게 고치거나, 최소한 "(2026-09-17 이전에는 이 DELETE 가 구현되어 있지 않았다 — D4 참고)"를 덧붙여 §R4 Rationale 과 모순되지 않게 정정한다. 트래커의 "세 곳" 집계도 네 곳으로 갱신 필요.

- **[INFO]** Rationale 번호 네임스페이스가 파일마다 다른 접두 규칙을 쓴다 — draft 인용에는 영향 없음
  - target 위치: draft 가 `spec/conventions/secret-store.md §R4` 를 인용하는 자리(실측 표, S7)
  - 충돌 대상: `spec/2-navigation/2-trigger-list.md` 의 `### R-4. isActive 편집 경로는 PATCH /api/triggers/:id body 단일 경로`
  - 상세: `secret-store.md` 는 하이픈 없는 `R4`, `trigger-list.md` 는 하이픈 있는 `R-4` 를 쓴다. 두 "R4"/"R-4" 는 완전히 다른 주제(Trigger FK 미설정 vs isActive 편집 경로)이고 항상 파일 경로와 함께 인용되므로 실질적 충돌은 아니다 — draft 도 항상 `secret-store.md §R4` 로 파일을 명시해 인용해 안전하다. 이 draft 가 만든 문제는 아니며, 사전 존재하던 명명 비일관성이다.
  - 제안: 이번 draft 범위 밖. 향후 spec 정비 시 Rationale 번호 접두 표기(R vs R-)를 문서군 전체에서 통일 검토.

## 검증되어 문제없음으로 판정한 항목 (참고용)

아래는 cross-spec 관점에서 의심해 실측했으나 draft 의 서술과 실제 spec/코드가 **일치**해 발견사항으로
올리지 않은 항목이다.

- `1-workflow-list.md` line 108 "연결된 트리거/스케줄도 함께 비활성화" — draft 실측대로 원문 그대로 존재. `trigger.workflow_id NOT NULL … ON DELETE CASCADE`(V001, 실측 확인) 와 모순되므로 draft 의 오기 판정(S1)이 타당하다. 동일 문구가 다른 spec 파일에 복제돼 있는지 전수 grep 했으나 없다.
- `2-trigger-list.md §4.3` "상류" 행 — draft S2 가 덧붙이려는 문장이 기존 문면("DB 레벨 삭제라 트리거 단위 락을 거치지 않는다")과 결이 맞고, 앵커(`#43-cascade-동작`)도 실제 헤딩과 일치한다.
- `data-flow/11-workflow.md §3.1` — draft 는 §3.1 을 "FK 파급 표"로 부르지만 실제 헤딩은 `workflow.is_active`다; 다만 그 절 안에 실제로 "workflow 삭제의 FK 파급" 표와 `trigger` 행(CASCADE, advisory lock 미적용 각주 포함)이 존재해 draft S4 의 편집 대상 지정은 정확하다.
- `data-flow/12-workspace.md §1.10` — 현재 문면에 트리거 정리 언급이 전혀 없음을 확인, draft S5 의 재작성이 사실과 부합.
- `data-flow/10-triggers.md §1.4` — Workflow·Workspace CASCADE 삭제를 다루는 행이 현재 표에 없음을 확인, draft S3 의 신규 행 추가가 빈 자리를 정확히 채운다.
- `WorkflowsService.remove()` / `WorkspacesService.deleteWorkspace()` (코드) — 둘 다 트리거의 schedule job·chat channel·secret_store 정리를 전혀 하지 않음을 확인 (draft 의 핵심 실측과 일치).
- RBAC — 워크플로 삭제(editor+ 로 추정)·워크스페이스 삭제(owner) 모두 트리거 직접 삭제 권한(editor+)의 상위 집합이라, 새 계약이 하위 권한자에게 트리거 자원 해제 권한을 우회로 부여하는 문제는 없다.
- 감사 로그 — D2 가 캐스케이드 경로에 `trigger.deleted` per-trigger 감사를 만들지 않기로 한 결정은 `spec/conventions/audit-actions.md`·`spec/data-flow/1-audit.md` 의 기존 "workspace.deleted 의도적 미기록" 구조적 제약과 결이 같아 충돌 없음.
- 동시성 — `teardownChatChannel` 은 외부 HTTP 호출만 하고 `trigger.config` 를 쓰지 않음(코드 확인)이므로, D3 가 요구하는 "트리거 단위 advisory lock 없이 트랜잭션 밖에서 해제"가 기존 `TriggersService.remove()` 의 이미 스펙화된 패턴(§4.4 "락을 잡기 전에 되돌릴 수 없는 정리를 끝낸다")과 동일한 위험 프로파일이라 새로운 레이스를 추가하지 않는다.

## 요약

이 draft 의 핵심 주장(워크플로·워크스페이스 삭제가 트리거의 외부 자원을 전혀 해제하지 않는다)과
`spec/2-navigation/1-workflow-list.md`·`spec/data-flow/{10,11,12}-*.md`·`spec/1-data-model.md` 를
겨냥한 S1~S6 변경안은 실측(spec 원문·코드)과 정확히 일치하며 cross-spec 충돌이 없다. 다만 draft 가
스스로 지목한 "같은 결함 문장이 세 곳에 있다"는 진단이 실제로는 **네 곳**이고, 그중 한 곳
(`secret-store.md §6` 본문의 "workspace 삭제 시 cascade 정리용" 문장)이 변경안 목록에서 빠져 있어
draft 적용 후에도 같은 파일 안에서 §R4(수정됨)와 §6(미수정)이 서로 다른 사실을 말하게 된다. 이는
구현을 막는 CRITICAL 은 아니지만, 이 draft 의 존재 이유(잘못된 "이미 정리된다" 서술이 다음 사람의
판단을 흐린다)를 그대로 재현하는 잔여 결함이라 WARNING 으로 반영해 S6/S7 과 함께 닫을 것을 제안한다.

## 위험도

LOW
